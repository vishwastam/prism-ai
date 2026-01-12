# Prism AI

**Privacy HUD for AI interfaces. Detect and redact sensitive data before you hit send.**

A minimal Chrome extension that protects your privacy when using ChatGPT, Claude, and Gemini. It runs entirely on-device with zero data collection.

## Features

### Minimal Pill HUD
- Tiny floating indicator that stays out of your way
- Shows real-time privacy score (0-100)
- Color-coded status: green (safe), amber (caution), red (alert)
- Expands on click to reveal details and actions
- Auto-adapts to dark/light mode

### Smart Redaction
- One-click redaction of detected sensitive data
- Click any flagged item to redact individually
- "Redact All" button for bulk protection
- Keyboard shortcut: `Cmd/Ctrl + Shift + R`

### Risk Explanations
- Click on detected items to understand *why* they're flagged
- Clear explanations of potential risks
- Actionable buttons to redact or dismiss

### Detection Categories

**Critical (Red)**
- API keys, AWS credentials, private keys
- Passwords, JWT tokens, bearer tokens
- Social Security Numbers, credit cards
- GitHub/Slack tokens

**Sensitive (Amber)**
- Email addresses, phone numbers
- Street addresses, ZIP codes
- Full names, dates of birth

**Contextual (Blue)**
- IP addresses, internal URLs
- Company names, project codenames
- Database connection strings

### Ghost Mode
- Blur all input fields for privacy in public spaces
- Keyboard shortcut: `Cmd/Ctrl + Shift + G`

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `prism-ai` folder

## Usage

1. Visit ChatGPT, Claude, or Gemini
2. The Prism pill appears in the bottom-right corner
3. Start typing - the pill updates in real-time
4. Click the pill to expand and see details
5. Click on flagged items to see explanations and redact

### Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Redact All | `Cmd + Shift + R` | `Ctrl + Shift + R` |
| Ghost Mode | `Cmd + Shift + G` | `Ctrl + Shift + G` |
| Close/Dismiss | `Escape` | `Escape` |

## Privacy

- **100% on-device** - All detection runs locally in your browser
- **Zero data collection** - Nothing is sent anywhere, ever
- **No analytics** - We don't track usage
- **Open source** - Audit the code yourself

## Supported Platforms

- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Google Gemini (gemini.google.com)

## File Structure

```
prism-ai/
├── manifest.json     # Extension config
├── content.js        # Detection & UI logic
├── prism.css         # Styling
├── popup.html        # Extension popup
├── popup_js.js       # Popup logic
├── background.js     # Service worker
└── icons/            # Extension icons
```

## License

MIT
