# Changelog

All notable changes to QA Daily Offline. Versions follow `versionName` in `android/app/build.gradle`.

## [1.3] - 2026-10-24

### Added
- **Today dashboard** at the top of the app: one card per project with status, progress, days to the target date, pace forecast, open bugs, long-running blockers, and whether today's report was sent. Tapping a card switches to that project.
- **Since yesterday** line in the form and the report: progress delta, new bugs vs. the 7-report average, open bugs, tests run, pass rate, status change, new and resolved blockers.
- **Blocker age**: one blocker per line, shown as "(day N)" in the report and highlighted in red from day 3.
- **Test execution**: planned / passed / failed for the current cycle, with run percentage and pass rate.
- **Bug balance**: new and closed/verified bugs; open bugs are calculated from the previous report, with a manual override.
- **Open bugs chart** in the insights view; the weekly summary now includes closed bugs, open bugs and test execution.
- English README with screenshots; the Hebrew README moved to `README.he.md`.

### Changed
- Blockers and test counts now carry over with the project until they change.
- The bugs line in the report now reads "N new · N closed · N open".

### Fixed
- Selecting a project from the dashboard reloads its blockers instead of treating them as resolved.
- Dark mode: progress percentages were hard to read.
- Chart date labels were clipped in right-to-left layout.

## [1.2] - 2026-10-24

### Added
- **Daily status** (on track / at risk / blocked) at the top of every report.
- **Quick templates** for "checked areas", editable in settings.
- **Multi-project report**: several projects in one message, overall status set by the worst one.
- **Per-project memory**: version, progress, target date and open issues reload from the project's last report.
- **Insights view**: progress chart, pace forecast with a late-deadline warning (also in the form and the report), and a weekly summary to share.
- **Daily reminder** via local notifications, skipped once today's report was sent.
- **Dark mode** (system / light / dark).
- **Report language**: Hebrew or English.
- **Automated tests** with Vitest.

## [1.1] - 2026-10-23

### Added
- **Report history**: every report that is sent or copied is saved and can be re-shared.
- **Share sheet** to any app, and WhatsApp that falls back to the website when the app is missing.
- **Start new report** keeps project, version, progress, target date and open issues.
- Deadline countdown and progress bar.
- New clipboard logo and green splash screen.

### Changed
- Removed the `INTERNET` permission: Android now blocks all network access for the app.

### Fixed
- Android back button closed the app instead of the open dialog.
- Versions such as `2.10.1` could not be typed.
- Corrupt saved data crashed the app on start.
- A deleted project stayed selected; duplicate projects could be added.
- Clipboard copy now has a fallback and reports failures.
- Manual edits to the report survive going back to the form.
- Content no longer slides under the status bar on Android 15+.

## [1.0] - 2026-10-22

- First signed Android release: daily QA form, WhatsApp-ready report, fully offline.

[1.3]: https://github.com/binyamin78/qa-daily-offline/releases/tag/v1.3
[1.2]: https://github.com/binyamin78/qa-daily-offline/releases/tag/v1.2
[1.1]: https://github.com/binyamin78/qa-daily-offline/releases/tag/v1.1
[1.0]: https://github.com/binyamin78/qa-daily-offline/releases/tag/v1.0
