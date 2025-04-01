// Content script that automatically plays Wordle
console.log('Wordle Auto-Player Extension loaded');

// Initial best starting words based on letter frequency and positioning
const STARTING_WORDS = ['crate', 'adieu', 'roate', 'stare', 'soare', 'raise'];

// Game state
let currentAttempt = 0;
let gameActive = true;
let autoPlayActive = false;
let wordList = [];
let isWordly = false;
let lastPlayedWord = '';
let debugMode = true; // Enable detailed logging

// Debug logging function
function debugLog(...args) {
  if (debugMode) {
    console.log('[Wordle Auto-Player]', ...args);
  }
}

// Load word list from background script
chrome.runtime.sendMessage({ type: 'getWordList' }, (response) => {
  if (response.wordList) {
    wordList = response.wordList;
    debugLog(`Loaded ${wordList.length} words for solver`);
  }
});

// Create control panel
function createControlPanel() {
  const panel = document.createElement('div');
  panel.id = 'wordle-autoplay-panel';
  panel.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 260px;
    background-color: white;
    border: 1px solid #d3d6da;
    border-radius: 8px;
    padding: 15px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #000;
  `;

  panel.innerHTML = `
    <h3 style="margin-top: 0; font-size: 18px; color: #538d4e; text-align: center;">Wordle Auto-Player</h3>
    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
      <button id="play-once" style="flex: 1; padding: 10px; background-color: #538d4e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Play Next Move</button>
      <button id="auto-play" style="flex: 1; padding: 10px; background-color: #538d4e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Auto Play</button>
    </div>
    <div id="solver-status" style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-radius: 4px; text-align: center;">Ready to play</div>
    <div id="current-constraints" style="margin-bottom: 15px;"></div>
    <div>
      <h4 style="margin-top: 0; font-size: 14px;">Top Suggestions:</h4>
      <div id="suggestions-list" style="max-height: 150px; overflow-y: auto;"></div>
    </div>
    <div id="debug-info" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
  `;

  document.body.appendChild(panel);

  // Event listeners
  document.getElementById('play-once').addEventListener('click', () => {
    playNextMove();
  });

  document.getElementById('auto-play').addEventListener('click', () => {
    const autoPlayBtn = document.getElementById('auto-play');
    if (autoPlayActive) {
      autoPlayActive = false;
      autoPlayBtn.textContent = 'Auto Play';
      autoPlayBtn.style.backgroundColor = '#538d4e';
      updateStatus('Auto play stopped');
    } else {
      autoPlayActive = true;
      autoPlayBtn.textContent = 'Stop Auto Play';
      autoPlayBtn.style.backgroundColor = '#aa5545';
      updateStatus('Auto playing...');
      playNextMove();
    }
  });
}

// Update status display
function updateStatus(message) {
  const statusElem = document.getElementById('solver-status');
  if (statusElem) {
    statusElem.textContent = message;
  }
}

// Update debug info
function updateDebugInfo(info) {
  const debugInfoElem = document.getElementById('debug-info');
  if (debugInfoElem) {
    debugInfoElem.innerHTML = info;
  }
}

// Display current constraints
function displayConstraints(constraints) {
  const constraintsElem = document.getElementById('current-constraints');
  if (!constraintsElem) return;

  let html = '<h4 style="margin-top: 0; font-size: 14px;">Current Constraints:</h4>';

  // Correct letters (green)
  html += '<div style="margin-bottom: 5px;"><strong>Correct:</strong> ';
  const correctLetters = Object.entries(constraints.correctPositions).map(([pos, letter]) => `<span style="color: #6aaa64; font-weight: bold;">${letter.toUpperCase()}</span> at position ${parseInt(pos) + 1}`);
  html += correctLetters.length > 0 ? correctLetters.join(', ') : 'None';
  html += '</div>';

  // Present letters (yellow)
  html += '<div style="margin-bottom: 5px;"><strong>Present:</strong> ';
  const presentLetters = Object.keys(constraints.presentLetters).map((letter) => `<span style="color: #c9b458; font-weight: bold;">${letter.toUpperCase()}</span>`);
  html += presentLetters.length > 0 ? presentLetters.join(', ') : 'None';
  html += '</div>';

  // Absent letters (gray)
  html += '<div><strong>Absent:</strong> ';
  const absentLetters = constraints.absentLetters.map((letter) => `<span style="color: #787c7e; font-weight: bold;">${letter.toUpperCase()}</span>`);
  html += absentLetters.length > 0 ? absentLetters.join(', ') : 'None';
  html += '</div>';

  constraintsElem.innerHTML = html;
}

// Display suggested words
function displaySuggestions(words) {
  const suggestionsElem = document.getElementById('suggestions-list');
  if (!suggestionsElem) return;

  if (!words || words.length === 0) {
    suggestionsElem.innerHTML = '<p style="text-align: center; color: #aa5545;">No suggestions available</p>';
    return;
  }

  const html = words
    .slice(0, 5)
    .map((word) => `<div style="padding: 8px; margin: 5px 0; background-color: #f0f0f0; border-radius: 4px; text-align: center; font-weight: bold; text-transform: uppercase;">${word}</div>`)
    .join('');

  suggestionsElem.innerHTML = html;
}

// Extract game state from the board - supports both NYT and Wordly
function extractGameState() {
  try {
    isWordly = window.location.hostname.includes('wordly.org');

    if (isWordly) {
      return extractWordlyState();
    } else {
      return extractNYTWordleState();
    }
  } catch (error) {
    debugLog('Error extracting game state:', error);
    updateDebugInfo(`Error: ${error.message}`);
    return null;
  }
}

// Extract game state from Wordly.org
function extractWordlyState() {
  // Find game rows
  const gameRows = document.querySelectorAll('.Row');

  if (!gameRows || gameRows.length === 0) {
    debugLog('Cannot find game rows');
    updateDebugInfo('Error: Cannot find game rows');
    return null;
  }

  debugLog(`Found ${gameRows.length} game rows`);

  const correctPositions = {};
  const presentLetters = {};
  const absentLetters = [];

  currentAttempt = 0;

  // Process each row
  for (let i = 0; i < gameRows.length; i++) {
    const row = gameRows[i];

    // Check if this is a locked-in row (has been evaluated)
    const isLockedIn = row.classList.contains('Row-locked-in');

    if (isLockedIn) {
      currentAttempt++;

      // Get all letter cells in this row
      const letterCells = row.querySelectorAll('.Row-letter');

      for (let j = 0; j < letterCells.length; j++) {
        const cell = letterCells[j];
        const letter = cell.textContent.toLowerCase().trim()[0]; // Get first character

        if (!letter) continue;

        // Check the letter state by class
        if (cell.classList.contains('letter-correct')) {
          correctPositions[j] = letter;
          debugLog(`Correct letter at position ${j}: ${letter}`);
        } else if (cell.classList.contains('letter-elsewhere')) {
          if (!presentLetters[letter]) {
            presentLetters[letter] = [];
          }
          presentLetters[letter].push(j);
          debugLog(`Present letter at position ${j}: ${letter}`);
        } else if (cell.classList.contains('letter-absent')) {
          if (!absentLetters.includes(letter) && !Object.values(correctPositions).includes(letter) && !Object.keys(presentLetters).includes(letter)) {
            absentLetters.push(letter);
            debugLog(`Absent letter: ${letter}`);
          }
        }
      }
    } else {
      // Check if this row has any letters (current row)
      const firstLetter = row.querySelector('.Row-letter');
      if (firstLetter && firstLetter.textContent.trim()) {
        break; // Found the current row, stop processing
      }
    }
  }

  // If we've used all 6 attempts, game is over
  if (currentAttempt >= 6) {
    gameActive = false;
    debugLog('All 6 attempts used, game over');
  }

  // Check for game completion messages
  const winMessage = document.querySelector('.message:nth-of-type(3)');
  const loseMessage = document.querySelector('.message:nth-of-type(4)');

  if ((winMessage && window.getComputedStyle(winMessage).display !== 'none') || (loseMessage && window.getComputedStyle(loseMessage).display !== 'none')) {
    gameActive = false;
    debugLog('Game completed message found, game over');
  }

  // Update the debug info in the panel
  updateDebugInfo(`Wordly state: ${currentAttempt} attempts, ${Object.keys(correctPositions).length} correct letters, ${Object.keys(presentLetters).length} present letters, ${absentLetters.length} absent letters`);

  return {
    correctPositions,
    presentLetters,
    absentLetters,
    currentAttempt,
  };
}

// Extract game state from NYT Wordle
function extractNYTWordleState() {
  // Find rows based on the actual HTML structure
  const gameRows = document.querySelectorAll('.Row-module_row__pwpBq');

  if (!gameRows || gameRows.length === 0) {
    debugLog('Cannot find game rows');
    updateDebugInfo('Error: Cannot find game rows');
    return null;
  }

  const correctPositions = {};
  const presentLetters = {};
  const absentLetters = [];

  currentAttempt = 0;

  // Process each row
  for (let i = 0; i < gameRows.length; i++) {
    const row = gameRows[i];
    const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');

    if (!tiles || tiles.length === 0) continue;

    // Check if this row has been evaluated
    let hasLetters = false;
    let allEmpty = true;
    let rowWord = '';

    // Get the letters in this row
    for (let j = 0; j < tiles.length; j++) {
      const tile = tiles[j];
      const letter = tile.textContent.toLowerCase();
      const state = tile.getAttribute('data-state');

      rowWord += letter;

      if (letter) {
        hasLetters = true;
        allEmpty = false;
      }

      // Check if the tile has been evaluated
      if (state === 'correct') {
        correctPositions[j] = letter;
      } else if (state === 'present') {
        if (!presentLetters[letter]) {
          presentLetters[letter] = [];
        }
        presentLetters[letter].push(j);
      } else if (state === 'absent') {
        if (!absentLetters.includes(letter) && letter) {
          absentLetters.push(letter);
        }
      }
    }

    // If row has letters and has been evaluated, count as an attempt
    if (hasLetters && !allEmpty) {
      // Check if any tiles in this row have been evaluated
      const evaluatedTiles = Array.from(tiles).filter((tile) => ['correct', 'present', 'absent'].includes(tile.getAttribute('data-state')));

      if (evaluatedTiles.length > 0) {
        currentAttempt++;

        // Check if the word was correct (all green)
        if (evaluatedTiles.every((tile) => tile.getAttribute('data-state') === 'correct')) {
          gameActive = false;
        }
      } else {
        // This row has letters but hasn't been evaluated yet, so it's the current row
        break;
      }
    } else if (allEmpty) {
      // Empty row, must be a future attempt
      break;
    }
  }

  // If we've used all 6 attempts, game is over
  if (currentAttempt >= 6) {
    gameActive = false;
  }

  return {
    correctPositions,
    presentLetters,
    absentLetters,
    currentAttempt,
  };
}

// Get best word to play next
function getNextWordToPlay(constraints) {
  // If it's the first move, use one of our good starting words
  if (currentAttempt === 0) {
    const startWord = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)];
    debugLog(`Using starter word: ${startWord}`);
    lastPlayedWord = startWord;
    return startWord;
  }

  // Filter word list based on constraints
  let filteredWords = wordList;
  debugLog(`Starting with ${filteredWords.length} words`);

  // Avoid repeating words if we somehow failed to detect the updated state
  if (lastPlayedWord && filteredWords.includes(lastPlayedWord)) {
    filteredWords = filteredWords.filter((word) => word !== lastPlayedWord);
    debugLog(`Removed last played word ${lastPlayedWord}, ${filteredWords.length} words remaining`);
  }

  // Filter by correct positions
  if (Object.keys(constraints.correctPositions).length > 0) {
    const beforeCount = filteredWords.length;
    filteredWords = filteredWords.filter((word) => {
      for (const [pos, letter] of Object.entries(constraints.correctPositions)) {
        if (word[pos] !== letter) return false;
      }
      return true;
    });
    debugLog(`After correct position filtering: ${filteredWords.length} words (removed ${beforeCount - filteredWords.length})`);
  }

  // Filter by present letters
  if (Object.keys(constraints.presentLetters).length > 0) {
    const beforeCount = filteredWords.length;
    filteredWords = filteredWords.filter((word) => {
      for (const [letter, positions] of Object.entries(constraints.presentLetters)) {
        // The letter must be present somewhere
        if (!word.includes(letter)) return false;

        // But not in the positions we know it's not in
        for (const pos of positions) {
          if (word[pos] === letter) return false;
        }
      }
      return true;
    });
    debugLog(`After present letter filtering: ${filteredWords.length} words (removed ${beforeCount - filteredWords.length})`);
  }

  // Filter by absent letters
  if (constraints.absentLetters.length > 0) {
    const beforeCount = filteredWords.length;
    filteredWords = filteredWords.filter((word) => {
      for (const letter of constraints.absentLetters) {
        // This is tricky as a letter might be absent only in certain positions
        // If a letter is both in presentLetters and absentLetters, it means it appears
        // somewhere but not in the positions we've guessed
        if (!Object.keys(constraints.presentLetters).includes(letter) && !Object.values(constraints.correctPositions).includes(letter) && word.includes(letter)) {
          return false;
        }
      }
      return true;
    });
    debugLog(`After absent letter filtering: ${filteredWords.length} words (removed ${beforeCount - filteredWords.length})`);
  }

  // Display filtered words
  displaySuggestions(filteredWords);

  if (filteredWords.length === 0) {
    updateStatus('No matching words found!');
    debugLog('No matching words found after filtering');
    return null;
  }

  // Ranking approach: prioritize words with most information gain
  if (filteredWords.length > 1) {
    // Calculate letter frequencies
    const letterFreq = {};
    for (const word of filteredWords) {
      const uniqueLetters = [...new Set(word.split(''))];
      for (const letter of uniqueLetters) {
        letterFreq[letter] = (letterFreq[letter] || 0) + 1;
      }
    }

    // Score words based on unique letter frequency
    const scoredWords = filteredWords.map((word) => {
      const uniqueLetters = [...new Set(word.split(''))];
      const score = uniqueLetters.reduce((sum, letter) => sum + letterFreq[letter], 0);
      return { word, score };
    });

    // Sort by score
    scoredWords.sort((a, b) => b.score - a.score);

    debugLog(
      `Top scored words: ${scoredWords
        .slice(0, 3)
        .map((sw) => `${sw.word} (${sw.score})`)
        .join(', ')}`
    );

    lastPlayedWord = scoredWords[0].word;
    return scoredWords[0].word;
  }

  lastPlayedWord = filteredWords[0];
  return filteredWords[0];
}

// Input a word into the game - handling both NYT and Wordly
function inputWord(word) {
  if (!word) return false;

  debugLog(`Inputting word: ${word}`);

  if (isWordly) {
    return inputWordToWordly(word);
  } else {
    return inputWordToNYT(word);
  }
}

// Input a word into Wordly.org
function inputWordToWordly(word) {
  // Get keyboard buttons
  const keyboardButtons = document.querySelectorAll('.Game-keyboard-button');

  if (!keyboardButtons || keyboardButtons.length === 0) {
    debugLog('Cannot find keyboard buttons');
    return false;
  }

  // Clear any existing input
  const backspaceKey = Array.from(keyboardButtons).find((btn) => btn.querySelector('svg use[href*="backspace"]'));
  if (backspaceKey) {
    for (let i = 0; i < 5; i++) {
      backspaceKey.click();
      // Small delay to make typing more natural
      setTimeout(() => {}, 10);
    }
  }

  // Input each letter with a delay
  for (let i = 0; i < word.length; i++) {
    setTimeout(() => {
      const letter = word[i];
      // Find the button for this letter
      const key = Array.from(keyboardButtons).find((btn) => btn.textContent.trim().toLowerCase() === letter);

      if (key) {
        key.click();
        debugLog(`Clicked key: ${letter}`);
      } else {
        debugLog(`Could not find key for letter: ${letter}`);
      }

      // After inputting the last letter, press Enter
      if (i === word.length - 1) {
        setTimeout(() => {
          const enterKey = Array.from(keyboardButtons).find((btn) => btn.textContent.trim().toLowerCase() === 'enter');

          if (enterKey) {
            debugLog('Pressing Enter key');
            enterKey.click();
          } else {
            debugLog('Could not find Enter key');
          }
        }, 200);
      }
    }, i * 100); // 100ms delay between letters
  }

  return true;
}

// Input a word into NYT Wordle
function inputWordToNYT(word) {
  // Clear the current input first by using backspace
  const backspaceKey = document.querySelector('button[data-key="←"]');
  for (let i = 0; i < 5; i++) {
    if (backspaceKey) backspaceKey.click();
  }

  // Input each letter with a delay
  for (let i = 0; i < word.length; i++) {
    setTimeout(() => {
      const letter = word[i];
      const key = document.querySelector(`button[data-key="${letter}"]`);
      if (key) {
        key.click();
      }

      // After inputting the last letter, press Enter
      if (i === word.length - 1) {
        setTimeout(() => {
          const enterKey = document.querySelector('button[data-key="↵"]');
          if (enterKey) {
            enterKey.click();
          }
        }, 200);
      }
    }, i * 100); // 100ms delay between letters
  }

  return true;
}

// Play the next move
function playNextMove() {
  if (!gameActive) {
    updateStatus('Game already completed!');
    autoPlayActive = false;
    const autoPlayBtn = document.getElementById('auto-play');
    if (autoPlayBtn) {
      autoPlayBtn.textContent = 'Auto Play';
      autoPlayBtn.style.backgroundColor = '#538d4e';
    }
    return;
  }

  const gameState = extractGameState();
  if (!gameState) {
    updateStatus('Failed to extract game state');
    return;
  }

  displayConstraints(gameState);

  if (gameState.currentAttempt >= 6) {
    updateStatus('All attempts used');
    gameActive = false;
    autoPlayActive = false;
    return;
  }

  const nextWord = getNextWordToPlay(gameState);
  if (!nextWord) {
    updateStatus('No valid word found to play');
    autoPlayActive = false;
    return;
  }

  updateStatus(`Playing: ${nextWord.toUpperCase()}`);

  // Input the word
  const success = inputWord(nextWord);
  if (!success) {
    updateStatus('Failed to input word');
    autoPlayActive = false;
    return;
  }

  // Wait longer for animation to complete and evaluation to happen
  setTimeout(() => {
    const newGameState = extractGameState();
    debugLog('Game state after playing:', newGameState);

    // Check if game is completed
    if (!gameActive) {
      updateStatus('Game completed!');
      autoPlayActive = false;
      const autoPlayBtn = document.getElementById('auto-play');
      if (autoPlayBtn) {
        autoPlayBtn.textContent = 'Auto Play';
        autoPlayBtn.style.backgroundColor = '#538d4e';
      }
      return;
    }

    // Continue auto play if active
    if (autoPlayActive) {
      setTimeout(playNextMove, 2000);
    }
  }, 3000); // Increased wait time to 3000ms
}

// Restart button for Wordly
function addRestartButton() {
  if (!isWordly) return;

  const panel = document.getElementById('wordle-autoplay-panel');
  if (!panel) return;

  const restartButton = document.createElement('button');
  restartButton.id = 'restart-game';
  restartButton.textContent = 'New Game';
  restartButton.style.cssText = `
    width: 100%;
    padding: 10px;
    background-color: #aa8d4e;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    margin-top: 10px;
  `;

  restartButton.addEventListener('click', () => {
    debugLog('Restart button clicked');
    // Reset game state
    currentAttempt = 0;
    gameActive = true;
    lastPlayedWord = '';

    // Click the restart button in the game UI
    const restartBtn = document.querySelector('.restart_btn button');
    if (restartBtn) {
      debugLog('Found restart button, clicking it');
      restartBtn.click();
      updateStatus('Started new game');
      return;
    }

    // If we can't find the button, try the "Give up" button
    const giveUpBtn = document.querySelector('button.give_up');
    if (giveUpBtn) {
      debugLog('Found give up button, clicking it');
      giveUpBtn.click();

      // Then click the restart button that appears
      setTimeout(() => {
        const newGameBtn = document.querySelector('.restart_btn button');
        if (newGameBtn) {
          newGameBtn.click();
          updateStatus('Started new game');
        }
      }, 1000);
      return;
    }

    updateStatus('Could not restart game');
  });

  panel.appendChild(restartButton);
}

// Initialize the auto-player
window.addEventListener('load', () => {
  // Wait for the game to fully initialize
  setTimeout(() => {
    debugLog('Initializing Wordle Auto-Player');
    createControlPanel();

    // Determine if we're on Wordly.org
    isWordly = window.location.hostname.includes('wordly.org');
    debugLog(`Detected site: ${isWordly ? 'Wordly.org' : 'NYT Wordle'}`);

    if (isWordly) {
      addRestartButton();
    }

    // Check if game is already in progress
    const gameState = extractGameState();
    if (gameState) {
      displayConstraints(gameState);
      updateStatus(`Game in progress - ${gameState.currentAttempt} attempts made`);
    } else {
      updateStatus('Waiting for game to start');
    }
  }, 1500);
});
