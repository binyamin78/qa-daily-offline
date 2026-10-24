# Security and privacy

## How the app handles data

- **No network access.** The Android app does not request the `INTERNET` permission, so the operating system blocks every network connection. You can confirm this on any APK:
  ```bash
  aapt2 dump permissions app-release.apk
  ```
- **Data stays on the device.** Settings, the current draft and report history are stored in the app's private `localStorage` and are removed when the app is uninstalled.
- **Sending is always your choice.** WhatsApp, *Share* and *Copy* hand the report text to the app you pick. QA Daily Offline never sends anything by itself.
- **Permissions in use**: notifications, exact alarms and boot-completed, all only for the optional daily reminder.
- **No analytics, ads or third-party SDKs.**

## Supported versions

Only the latest release receives fixes. Please update before reporting an issue.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting instead: **Security → Report a vulnerability** in this repository. Include the app version, Android version and steps to reproduce. You can expect a first response within a few days.
