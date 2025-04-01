# Wordle Auto-Player Chrome Extension

A Chrome extension that automatically plays and solves Wordle puzzles using an optimized algorithm. The extension supports both the official NYT Wordle and Wordly.org.

## Features

- **Smart Word Selection**: Uses information theory to make optimal guesses
- **Automatic Play**: Can play the entire game automatically or make moves one by one
- **Multi-Site Support**: Works with both NYT Wordle and Wordly.org
- **Game State Detection**: Automatically detects the current state of the game
- **Real-Time Feedback**: Shows constraints and suggestions as you play
- **Debug Mode**: Detailed logging to help troubleshoot any issues
- **New Game Button**: Easily restart games on Wordly.org

## Installation

1. **Download or Clone the Repository**

   - Download as ZIP and extract to a folder

2. **Load the Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top-right corner
   - Click "Load unpacked" and select the extension folder
   - The extension should now appear in your Chrome toolbar

## Usage

### Playing on NYT Wordle

1. Navigate to [NYT Wordle](https://www.nytimes.com/games/wordle/index.html)
2. You'll see the Wordle Auto-Player panel in the top-right corner
3. Click "Play Next Move" to make a single move, or "Auto Play" to solve the entire puzzle

### Playing on Wordly.org

1. Navigate to [Wordly.org](https://wordly.org/)
2. The extension panel will appear in the top-right corner
3. Use "Play Next Move" or "Auto Play" as before
4. When the game is complete, use the "New Game" button to restart

## How It Works

The extension uses a constraint-based algorithm that:

1. Starts with statistically optimal first words (like "CRATE", "STARE", or "ADIEU")
2. Analyzes feedback from each guess (green, yellow, gray letters)
3. Filters the word list based on the constraints
4. Ranks remaining words by their information gain potential
5. Selects the word most likely to narrow down possible solutions

## Algorithm Details

The solver uses several techniques to make optimal guesses:

- **Constraint Propagation**: Eliminates words that don't match the pattern of revealed hints
- **Letter Frequency Analysis**: Prioritizes words with common letters to maximize information gain
- **Position Analysis**: Takes into account both correct and incorrect letter positions
- **Information Theory**: Ranks words based on how much they'll reduce the possible solution space

Each guess is carefully chosen to narrow down the possible solutions as quickly as possible.

## Troubleshooting

- **Extension Not Working**: Make sure you're on the correct website (NYT Wordle or Wordly.org)
- **Words Not Being Played**: Check the browser console (F12) for detailed logs
- **Incorrect State Detection**: If the game state isn't being detected correctly, try refreshing the page
- **Word Not Found Errors**: Some sites may have different word lists - the extension will try another word

## Debug Panel

The extension includes a debug panel at the bottom of the control panel that shows:

- Current game state
- Number of attempts made
- Detected letter constraints
- Error messages (if any)

This information can be helpful for troubleshooting issues.

## License

MIT License

---

## Disclaimer

This extension is for educational purposes and to enhance your Wordle experience. Please use responsibly and don't use it to artificially boost your Wordle stats or ruin the fun for others.
