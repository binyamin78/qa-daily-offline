# Security and privacy

## How the app handles data

- **No network access.** The Android app does not request the `INTERNET` permission, so the operating system blocks every network connection. You can confirm this on any APK:
  ```bash
  aapt2 dump permissions app-release.apk
  ```
- **The permission can't come back.** The manifest strips `INTERNET`, `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` with `tools:node="remove"`, and `tests/manifest.test.ts` fails CI if that changes.
- **WebView stays quiet.** Google Safe Browsing lookups and WebView metrics uploads are turned off.
- **Data stays on the device.** Settings, the current draft and report history are stored in the app's private `localStorage`, are excluded from Google cloud backup, and are removed when the app is uninstalled. Direct phone-to-phone transfer on Android 12+ still carries them over.
- **Sending is always your choice.** WhatsApp, *Share* and *Copy* hand the report text to the app you pick. QA Daily Offline never sends anything by itself.
- **Permissions in use**: notifications, exact alarms and boot-completed, all only for the optional daily reminder.
- **No analytics, ads or third-party SDKs.**

## Supported versions

Only the latest release receives fixes. Please update before reporting an issue.

| Version | Network permission |
|---|---|
| 1.0, 1.1 | ⚠️ declares `INTERNET` (unused by the app code; used by WebView background traffic) |
| 1.2 and later | none |

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting instead: **Security → Report a vulnerability** in this repository. Include the app version, Android version and steps to reproduce. You can expect a first response within a few days.
