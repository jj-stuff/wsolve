// Word list URL
const WORDLE_ANSWERS_URL = 'https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/45c977427419a1e0edee8fd395af1e0a4966273b/wordle-answers-alphabetical.txt';

// Store for the word list
let wordList = [];

// Load word list on extension installation or update
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await loadWordList();
    console.log(`Loaded ${wordList.length} words for Wordle auto-player`);
  } catch (error) {
    console.error('Error loading Wordle word list:', error);
  }
});

// Load word list function
async function loadWordList() {
  const response = await fetch(WORDLE_ANSWERS_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch word list');
  }

  const text = await response.text();
  wordList = text.split('\n').filter((word) => word.length === 5);

  // Store word list in extension storage
  await chrome.storage.local.set({ wordList });

  return wordList;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getWordList') {
    // Make sure we have the word list
    if (wordList.length === 0) {
      chrome.storage.local.get('wordList', async (result) => {
        if (result.wordList && result.wordList.length > 0) {
          wordList = result.wordList;
          sendResponse({ wordList });
        } else {
          try {
            await loadWordList();
            sendResponse({ wordList });
          } catch (error) {
            console.error('Error loading word list:', error);
            sendResponse({ error: 'Failed to load word list' });
          }
        }
      });
      return true; // Will respond asynchronously
    }

    sendResponse({ wordList });
    return true;
  }
});
