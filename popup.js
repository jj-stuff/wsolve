document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const wordInput = document.getElementById('wordInput');
  const wordGrid = document.getElementById('wordGrid');
  const wordList = document.getElementById('wordList');
  const solveBtn = document.getElementById('solveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const errorMsg = document.getElementById('errorMsg');

  // State
  let currentRow = 0;
  let rows = [];
  const WORD_LENGTH = 5;
  const MAX_ROWS = 6;

  // Create grid
  initializeGrid();

  // Event listeners
  wordInput.addEventListener('keypress', handleInputKeypress);
  solveBtn.addEventListener('click', getSuggestions);
  resetBtn.addEventListener('click', resetGame);

  // Initialize the grid
  function initializeGrid() {
    wordGrid.innerHTML = '';
    rows = [];

    for (let i = 0; i < MAX_ROWS; i++) {
      const row = [];

      for (let j = 0; j < WORD_LENGTH; j++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = i;
        cell.dataset.col = j;
        cell.addEventListener('click', toggleCellState);

        wordGrid.appendChild(cell);
        row.push(cell);
      }

      rows.push(row);
    }

    currentRow = 0;
  }

  // Handle input keypress (Enter)
  function handleInputKeypress(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const word = wordInput.value.toLowerCase().trim();

    if (word.length !== WORD_LENGTH) {
      showError('Please enter a 5-letter word');
      return;
    }

    if (currentRow >= MAX_ROWS) {
      showError('Maximum guesses reached');
      return;
    }

    // Fill current row with the word
    for (let i = 0; i < WORD_LENGTH; i++) {
      rows[currentRow][i].textContent = word[i];
    }

    // Move to next row
    currentRow++;

    // Clear input
    wordInput.value = '';

    // Get suggestions
    getSuggestions();
  }

  // Toggle cell state (white -> green -> yellow -> gray -> white)
  function toggleCellState() {
    const cell = this;

    if (!cell.textContent) return;

    if (!cell.classList.contains('green') && !cell.classList.contains('yellow') && !cell.classList.contains('gray')) {
      cell.classList.add('green');
    } else if (cell.classList.contains('green')) {
      cell.classList.remove('green');
      cell.classList.add('yellow');
    } else if (cell.classList.contains('yellow')) {
      cell.classList.remove('yellow');
      cell.classList.add('gray');
    } else {
      cell.classList.remove('gray');
    }

    // Update suggestions when cell state changes
    getSuggestions();
  }

  // Get suggestions from the background script
  function getSuggestions() {
    // Clear error
    showError('');

    // Collect constraints from the grid
    const constraints = collectConstraints();

    // Send message to background script
    chrome.runtime.sendMessage({ type: 'getSuggestions', constraints }, (response) => {
      if (response.error) {
        showError(response.error);
        return;
      }

      displaySuggestions(response.suggestions);
    });
  }

  // Collect constraints from the grid
  function collectConstraints() {
    const correctPositions = {};
    const presentLetters = {};
    const absentLetters = [];

    // Iterate through all filled rows
    for (let i = 0; i < currentRow; i++) {
      for (let j = 0; j < WORD_LENGTH; j++) {
        const cell = rows[i][j];
        const letter = cell.textContent.toLowerCase();

        if (!letter) continue;

        if (cell.classList.contains('green')) {
          // Correct position (green)
          correctPositions[j] = letter;
        } else if (cell.classList.contains('yellow')) {
          // Present but wrong position (yellow)
          if (!presentLetters[letter]) {
            presentLetters[letter] = [];
          }
          presentLetters[letter].push(j);
        } else if (cell.classList.contains('gray')) {
          // Absent letter (gray)
          if (!absentLetters.includes(letter)) {
            absentLetters.push(letter);
          }
        }
      }
    }

    return {
      correctPositions,
      presentLetters,
      absentLetters,
    };
  }

  // Display suggestions
  function displaySuggestions(suggestions) {
    wordList.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
      showError('No suggestions found');
      return;
    }

    suggestions.forEach((word) => {
      const wordItem = document.createElement('div');
      wordItem.className = 'word-item';
      wordItem.textContent = word;
      wordItem.addEventListener('click', () => {
        wordInput.value = word;
      });

      wordList.appendChild(wordItem);
    });
  }

  // Reset game
  function resetGame() {
    initializeGrid();
    wordInput.value = '';
    showError('');

    // Reset suggestions
    wordList.innerHTML = '';
    const defaultWords = ['Start', 'By', 'Entering', 'Your', 'First', 'Guess'];
    defaultWords.forEach((word) => {
      const wordItem = document.createElement('div');
      wordItem.className = 'word-item';
      wordItem.textContent = word;
      wordList.appendChild(wordItem);
    });
  }

  // Show error message
  function showError(message) {
    errorMsg.textContent = message;
  }
});
