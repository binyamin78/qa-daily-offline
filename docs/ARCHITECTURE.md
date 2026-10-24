# Architecture

QA Daily Offline is a single-page React app packaged as an Android app with Capacitor. There is no backend: every feature is computed on the device from two things, **the current form** and **the history of sent reports**.

```
            ┌────────────── App.tsx (state + screens) ───────────────┐
 form ─────▶│ FormData (draft)        combined sections (multi-project)│
            │        │                                                │
            │        ▼                                                │
            │ projectContext.sectionContext(history, form)            │
            │   ├─ daily.toReportItem      → numbers for this report  │
            │   ├─ daily.computeChange     → "since yesterday"        │
            │   ├─ daily.blockerAges       → "(day N)"                │
            │   └─ insights.forecastCompletion → pace forecast        │
            │        │                                                │
            │        ▼                                                │
            │ offlineReportService.generateOfflineReport(sections,    │
            │        { language, extras })  → report text (HE / EN)   │
            └────────────────────────┬────────────────────────────────┘
                                     │ copy / share / WhatsApp
                                     ▼
                     history entry { text, items: ReportItem[] }
                                     │
                                     ▼
                       storage (localStorage, validated on load)
```

## Data model (`types.ts`)

| Type | Purpose |
|---|---|
| `FormData` | What the user types. All values are strings, exactly as in the inputs. |
| `ReportItem` | Structured numbers for one project in one sent report (progress, bugs, open bugs, tests, blockers, target date). |
| `HistoryEntry` | One sent report: the final text plus a `ReportItem` per project. Entries from before v1.2 have no items and are ignored by charts. |
| `AppSettings` | Projects, templates, theme, report language, reminder. |

## Key decisions

### Offline-first, no permission
The app never needs the network, so the `INTERNET` permission was removed. This turns "we don't send your data" from a promise into something the OS enforces, and keeps the attack surface minimal.

### History is the source of truth
Everything that changes over time (charts, forecast, "since yesterday", blocker age, open-bug balance, the today dashboard) is **derived** from history rather than stored separately. `days.projectDays` reduces history to *the latest report per project per day*, so re-sending a report never double-counts.

### Defensive storage
`storage.ts` treats `localStorage` as untrusted: every value is parsed in `try/catch`, type-checked field by field, and merged into defaults. Old drafts gain new fields automatically, unknown fields are dropped, and corrupt data falls back to defaults instead of crashing.

### Pure, testable logic
All calculations live in `services/` as pure functions that take `now` as a parameter. The UI only wires them together. This is what makes the 42 Vitest tests possible without a browser.

## The calculations

**Pace forecast** (`insights.forecastCompletion`): a least-squares line through the last 14 report days (today's unsent value replaces today's point). Completion date = last day + ⌈(100 − progress) / slope⌉. Returns `stalled` when the slope is under 0.05%/day and `not-enough-data` with fewer than two distinct days.

**Since yesterday** (`daily.computeChange`): compares the current report with the last report from an *earlier day*. The new-bug average uses up to 7 previous report days and is shown only with at least two.

**Blocker age** (`daily.blockerAges`): blockers are split per line (or `;`), normalised (case and whitespace), and counted back through consecutive report days that mention them. A gap where the blocker is missing restarts the count.

**Open bugs** (`daily.openBugsOf`): `manual value` if given, otherwise `previous open + new − closed` (never below 0). The starting point is the last report before today, so sending twice in one day gives the same result.

**Test execution** (`daily.testStats`): executed = passed + failed; run % = executed / planned; pass rate = passed / executed.

## Reports and languages

`reportText.ts` holds every fixed string in Hebrew and English, including the sentence builders for change lines and test summaries. The app UI stays Hebrew; only the generated text changes language. User-typed content is never translated.

## Android specifics

- `@capacitor/app`: hardware back button closes the top layer; `appStateChange` re-plans reminders when the app resumes.
- `@capacitor/share`: native share sheet.
- `@capacitor/local-notifications`: reminders are scheduled one per chosen weekday for the next 14 days; today's is skipped once a report was sent, so the reminder only fires when it's needed.
- Edge-to-edge: safe-area padding via `env(safe-area-inset-*)` with Capacitor's CSS-variable fallback.

## Testing

`npm test` runs Vitest. Suites:

| File | Covers |
|---|---|
| `report.test.ts` | Report text in Hebrew and English, multi-project, deadlines, field helpers |
| `storage.test.ts` | Defaults, corrupt JSON, migrations from older versions, validation |
| `insights.test.ts` | Daily series, forecast cases, weekly summary |
| `daily.test.ts` | Open-bug balance, test stats, blocker age, change since yesterday, today dashboard |
