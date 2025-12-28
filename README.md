# KiddyMeds - Children's Medicine Tracker

A privacy-focused, offline-first Progressive Web App (PWA) designed to help parents track medicine administration and symptoms for their children.

## Features

- **Medicine Tracking**: Quick-log common medicines (Tylenol, Motrin, etc.) and create custom shortcuts.
- **Symptom Monitoring**: Track symptoms like fever, cough, and daily metrics (fluids, appetite, etc.).
- **Smart Timers**: See exactly how much time has passed since the last dose to prevent double-dosing.
- **Privacy First**: All data is stored locally on your device. No cloud, no accounts, no tracking.
- **Offline Capable**: Works perfectly without an internet connection.
- **Doctor Reports**: Generate simple, text-based summaries to copy and paste for healthcare providers.
- **Multi-Child Support**: Manage independent logs for multiple children.
- **Backup & Restore**: Export your data to JSON for independent backups.

## Usage

1. **Web**: Open `index.html` in any modern browser.
2. **Install**: For the best experience, use "Add to Home Screen" on your mobile device to install it as an app.

## Development

This project consists of a minimal PWA structure:
- `index.html`: Contains all application logic, styling, and markup.
- `manifest.json`: Web App Manifest for installation support.
- `sw.js`: Service Worker for offline caching.

To test PWA features locally, serve the directory via HTTP:
```bash
python3 -m http.server
```

## Disclaimer

**Educational and Personal Use Only**

This software is designed for personal organization and educational purposes only. It does not provide medical advice, diagnosis, or treatment.

- **No Warranty**: The software is provided "as is", without warranty of any kind, express or implied.
- **Not a Medical Device**: Do not rely on this app for critical medical decisions.
- **Consult a Professional**: Always follow the advice of a qualified healthcare provider regarding dosages and treatment frequencies.

Use at your own risk. The developers are not liable for any errors, omissions, or data loss.
