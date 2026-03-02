# 🎤 Robert's Rules Order Counter — WUSA Edition

A modern web-based tool for managing speaker queues and timers during meetings that follow Robert's Rules of Order, designed for the **Waterloo Undergraduate Student Association (WUSA)**.

![Version](https://img.shields.io/badge/version-2.1-wusa-blue)

## ✨ Features

- **Dual-Priority Queue System** - Separate queues for new points and responses
- **Two Independent Timers** - Visual circular progress indicators
- **Dark Mode** - Easy on the eyes for long meetings
- **Keyboard Shortcuts** - Quick access to common actions
- **Undo Functionality** - Recover from accidental deletions
- **Session Statistics** - Track total speakers and queue length
- **Data Persistence** - Automatically saves your session
- **Sound Notifications** - Audio alerts with customizable patterns
- **Fully Responsive** - Works on desktop, tablet, and mobile
- **Accessibility Ready** - ARIA labels and screen reader support

## 🚀 Quick Start

- **Production (Vercel)**: your deployed URL from Vercel (e.g. `https://wusa-roberts-rules.vercel.app`)
- **Local (for development)**:
  1. Clone this repo
  2. Run `npm install`
  3. Run `vercel dev` to start the local dev server

## 📁 Project Structure

```
roberts-rules-tracker/
├── index.html
├── styles.css
├── script.js
├── wusa-logo.png
└── README.md
```

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start/Pause Timer 1 |
| `N` | Next Speaker |
| `R` | Reset Timer 1 |
| `M` | Toggle Sound |
| `Ctrl+Z` | Undo Last Action |
| `1` | Focus Priority 1 Input |
| `2` | Focus Priority 2 Input |
| `Esc` | Close Dialog |

## 🎯 How to Use

### Adding Speakers
1. Type a name in either Priority 1 (new points) or Priority 2 (responses)
2. Click "Add Speaker" or press Enter
3. Speaker appears in the queue

### Managing the Queue
- **Next Speaker** - Moves to the next speaker (Priority 2 first, then Priority 1)
- **Skip** - Toggle skip status without removing from queue
- **Remove** - Delete speaker from queue (can be undone)
- **Move Up/Down** - Reorder speakers within their priority
- **Clear** - Remove all speakers from a priority queue

### Using Timers
- Click preset time buttons (30s, 45s, 1min, 2min, 10min, 15min)
- Or enter custom time (minutes and seconds)
- Start/Pause/Reset as needed
- Timer warns at 10 seconds (1 beep) and completion (3 beeps)

### Session Statistics
- **Total Speakers** - Number of speakers processed this session
- **In Queue** - Current number of waiting speakers

## 🌐 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)
- ⚠️ Internet Explorer (not supported)

## 🛠️ Technologies Used

- **HTML5** - Structure
- **CSS3** - Styling with animations
- **Vanilla JavaScript** - No frameworks needed
- **Web Audio API** - Sound notifications
- **LocalStorage API** - Data persistence

## 👥 Authors

**Cyril El Feghali** & **Nicolas El Murr**

## 🐛 Known Issues

None currently! Report issues on GitHub.

## 🚧 Future Enhancements

- [ ] Export/import meeting logs as PDF
- [ ] Multi-language support
- [ ] Speaker time statistics
- [ ] Integration with video conferencing tools

## 📞 Support

For questions or suggestions, please open an issue on GitHub.

---

**Made with ❤️ for better meetings**
