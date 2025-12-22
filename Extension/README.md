# Seam - AI Conversations to X Thread Generator

A Chrome Extension that lets you select text from your AI conversations and generate X threads from them.

![Seam](https://img.shields.io/badge/Seam-v1.0-6366f1?style=flat-square)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-10b981?style=flat-square)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-8b5cf6?style=flat-square)

## Features

- 🎯 **Text Selection**: Select any text from your AI conversations
- 🧵 **Thread Generation**: Automatically generate X threads (8-14 tweets) from your selection
- ✏️ **Full Editing**: Edit, reorder, add, delete, and split tweets
- 📊 **Character Counter**: Real-time character count with over-limit warnings
- 📋 **Easy Copying**: Copy thread with optional numbering (1/, 2/, ...)
- 💾 **Persistence**: Your last capture and thread are saved automatically
- 🔒 **Privacy First**: No data transmitted anywhere - everything stays local

## Installation

### Load as Unpacked Extension

1. **Download/Clone** this repository to your local machine

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** (toggle in top-right corner)

4. **Click "Load unpacked"** and select the `Seam` folder

5. **Pin the extension** (optional but recommended):
   - Click the puzzle piece icon in Chrome toolbar
   - Find Seam and click the pin icon

## Usage

### Step 1: Select Text from Your AI Conversation

1. Navigate to any AI conversation page:
   - `https://chatgpt.com/*`
   - `https://chat.openai.com/*`
   - Or any other AI conversation platform

2. Look for the **Seam overlay** in the bottom-right corner

3. Click **"Select text"** to enable selection mode

4. **Highlight the text** you want to capture (drag to select)

5. Click **"Capture"** to save the selection

6. A toast notification will confirm how many messages were captured

### Step 2: Generate Thread

1. **Click the Seam extension icon** in your toolbar to open the popup

2. You'll see your capture summary (message count and timestamp)

3. Click **"Generate Thread"**

4. Your thread will appear as editable tweet boxes

### Step 3: Edit Your Thread

Each tweet has these controls:
- **⬆️ Move Up**: Reorder tweet higher in the thread
- **⬇️ Move Down**: Reorder tweet lower in the thread
- **➕ Add**: Insert a new tweet below this one
- **✕ Delete**: Remove this tweet

If a tweet is over 280 characters:
- The character count turns **red**
- A **"Split tweet"** button appears - click it to auto-split at a sensible boundary

### Step 4: Copy Thread

1. Toggle **"Add numbering"** if you want "1/", "2/", etc. prefixes

2. Click **"Copy Thread"**

3. **Paste** into X or your notes!

The copied text has blank lines between tweets for easy pasting.

## Troubleshooting

### "No messages captured" or empty selection

**Problem**: The selection didn't capture any messages.

**Solutions**:
1. **Scroll to load messages**: Some AI platforms lazy-load conversation history. Scroll through the entire conversation first to ensure all messages are loaded in the DOM.

2. **Try selecting again**: Click "Select text" and try highlighting the text you want to capture.

3. **Check the page**: Make sure you're on a supported AI conversation page (the URL should contain `chatgpt.com` or `chat.openai.com`).

### Overlay not appearing

**Problem**: You don't see the Seam overlay on the page.

**Solutions**:
1. **Refresh the page**: The content script might not have loaded yet.

2. **Check permissions**: In `chrome://extensions/`, make sure Seam has access to the site.

3. **Disable conflicting extensions**: Some extensions might interfere with the overlay.

### Thread generation produces poor results

**Problem**: The generated thread doesn't accurately represent the conversation.

**Solutions**:
1. **Select more context**: Include more messages in your selection.

2. **Edit after generation**: The editor is fully functional - modify tweets as needed.

3. **Regenerate**: Click "Regenerate" to try a fresh thread.

### Clicks not registering during selection

**Problem**: Clicking on messages doesn't select them.

**Solutions**:
1. **Click on the message container**: Try clicking on different parts of the message bubble.

2. **Avoid clicking on buttons**: Don't click on the Copy/Edit/Regenerate buttons within messages.

3. **Wait for hover highlight**: A dashed outline should appear when hovering over selectable elements.

## How the Thread Generator Works

The current implementation uses a **local, rule-based generator** (no API required):

### Algorithm Overview

1. **Key Point Extraction**
   - Parses the conversation into sentences
   - Scores sentences based on:
     - Indicator words ("important", "because", "therefore", etc.)
     - Sentence length (prefers medium-length)
     - Content type (prefers assistant responses)
   - Extracts bullet points and numbered lists
   - Deduplicates and ranks by importance

2. **Narrative Structure**
   - **Hook**: Attention-grabbing opening (question, bold statement, or topic intro)
   - **Context**: Brief setup of what's being discussed
   - **Main Points**: Core insights from the conversation
   - **Close**: Summary or key takeaway

3. **Tweet Optimization**
   - Targets 200-260 characters per tweet
   - Smart splitting at sentence/word boundaries
   - Removes markdown artifacts and UI junk
   - Targets 10-12 tweets (range: 8-14)

### Swapping in an API/LLM

The generator is designed to be easily replaced. Look for this section in `popup.js`:

```javascript
/**
 * TODO: Replace this local generator with an API call for better results.
 * 
 * This is a rule-based generator that produces decent threads without
 * requiring any external API.
 */
function generateThread(messages) {
  // Current implementation...
}
```

To integrate an LLM API:

1. Create a new function (e.g., `generateThreadWithAPI`)
2. Format the messages as a prompt
3. Call your API (OpenAI, Anthropic, etc.)
4. Parse the response into an array of tweets
5. Replace the call in `handleGenerate()`

Example integration point:

```javascript
async function generateThreadWithAPI(messages) {
  const prompt = formatMessagesForPrompt(messages);
  
  const response = await fetch('YOUR_API_ENDPOINT', {
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Generate an X thread...' },
        { role: 'user', content: prompt }
      ]
    })
  });
  
  const data = await response.json();
  return parseTweetsFromResponse(data);
}
```

## File Structure

```
Seam/
├── manifest.json      # Extension configuration (MV3)
├── background.js      # Service worker for storage operations
├── content.js         # Overlay UI and range selection
├── content.css        # Overlay and selection styles
├── popup.html         # Extension popup markup
├── popup.js           # Thread generation and editing logic
├── popup.css          # Popup styles
├── icons/             # Extension icons (optional)
│   └── generate-icons.html  # Open in browser to create icons
└── README.md          # This file
```

## Adding Icons (Optional)

The extension works without icons, but you can add them for a polished look:

1. Open `icons/generate-icons.html` in your browser
2. Click the download links for each icon size (16, 48, 128)
3. Save them in the `icons/` folder
4. Add this to `manifest.json`:

```json
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

## Permissions

Seam requests minimal permissions:

- **`storage`**: To persist your last capture and generated thread
- **Host permissions** for `chatgpt.com` and `chat.openai.com`: To inject the overlay and capture text

**No data is ever transmitted to external servers.**

## Security & Privacy

### API Keys in Source Code

This extension includes X/Twitter API credentials (API Key and Secret) in the source code. This is **safe and standard practice** for OAuth 1.0a applications:

- **App-level credentials**: The API Key and Secret identify the application, not individual users
- **User authentication**: Each user authenticates separately with their own X account
- **User data security**: Access tokens are stored locally per-user and cannot be accessed by others
- **What the keys do**: They only identify which app is making API requests

**Important notes:**
- The keys cannot access user accounts without user authentication
- Users must connect their own X account to post threads
- All user data (captures, threads) stays on your local machine
- The only risk is API quota usage if the extension is widely shared

### OAuth Permissions

When connecting your X account, Twitter shows a list of permissions including:
- See Posts from your timeline
- See your X profile information
- Follow and unfollow accounts
- Update your profile
- Create and delete Posts
- And more...

**Important:** Seam only uses the "Create and delete Posts" permission to post your threads. We do not:
- Read your timeline
- Access your profile information
- Follow/unfollow accounts
- Modify your settings
- Access any other data

The full permission list is shown because OAuth 1.0a doesn't support granular scopes - it's an all-or-nothing permission model. However, the extension code only makes API calls to post tweets, nothing else.

If you're concerned about API quota limits, you can:
1. Monitor usage in your Twitter Developer Portal
2. Set up rate limit alerts
3. Consider using a backend proxy for production use

## Development

### Making Changes

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Seam card
4. Reload the page to see content script changes

### Architecture Notes

- **Content Script** (`content.js`): Injected into AI conversation pages. Handles the overlay UI and text selection.

- **Background Service Worker** (`background.js`): Handles all `chrome.storage.local` operations. Receives messages from both content script and popup.

- **Popup** (`popup.html/js/css`): Standalone UI for viewing captures, generating threads, and editing. Communicates with background via `chrome.runtime.sendMessage`.

### DOM Selection Strategy

AI platforms' UIs change frequently. The extension uses text selection APIs for reliable capture:

1. `[data-message-author-role]` - Most reliable when present
2. `[data-testid*="conversation-turn"]` - Common pattern
3. `article[data-testid]` - Fallback
4. Class-based patterns - Last resort

## License

MIT License - feel free to use, modify, and distribute.

## Changelog

### v1.0.0
- Initial release
- Range selection with visual feedback
- Local thread generation (8-14 tweets)
- Full tweet editing (reorder, add, delete, split)
- Character counting with over-limit warnings
- Copy with optional numbering
- Persistent state storage

