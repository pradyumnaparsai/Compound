# Changelog

Each release lists only what changed since the previous release. `npm run release` publishes the matching
`## v<version>` section as the GitHub release notes.

## v1.9.0 — 2026-11-07
### Changed
- Meal builder: the auto-log time is now picked with a native time wheel instead of typing "HH:MM". The quick-pick time chips still work and stay in sync with the wheel.
## v1.8.1 — 2026-11-07
### Changed
- Removed the confusing "Grams per unit — your estimate" field from the food editor. Foods with a pack/serving weight (or a known whole-food size like an apple) still show "Number of units".
## v1.8.0 — 2026-11-07

### Added
- **Meal builder:** Meals → Quick log → New meal. Name a meal, then search or scan foods and keep adding them; save it and log the whole meal in one tap. Long-press a quick-log chip to edit or delete it.
- **Auto-log meals:** switch on "Log automatically" for a meal, pick a time (and optionally weekdays) and it is added to your diary for you, e.g. a daily protein shake. iOS can't run the app in the background, so it's logged (stamped at the set time) the next time you open the app after that time; only today is logged, missed days are skipped. Changing a schedule restarts it from its next occurrence.
- Schedules are included in the cloud backup (new `meal_schedules` table).

## v1.7.1 — 2026-11-07

### Fixed
- Keyboard now dismisses on the Today screen when you scroll or press Done after adding a task.
- "Done today" card and progress bar now count today's and overdue tasks along with routines.

## v1.7.0 — 2026-11-07

### Added
- Meal estimate now gets a short header name (e.g. "Dal Rice Thali") instead of the first item's name. It is editable and shows in the Diary.
- ➖ button on every estimated item to remove a wrongly estimated food before logging.
- Refine box on the estimate: type a correction ("curry is rajma, rice is half") and the AI updates the current items using the photo and your correction.

## v1.6.2 — 2026-11-07

### Fixed
- Tapping the ✕ (discard) on an analysed meal now also clears the prompt text, not just the AI result.

## v1.6.1 — 2026-11-07

### Fixed
- Search food: added a clear (✕) button to the search box. It clears only the search text and keeps focus in the field.

## v1.6.0 — 2026-11-07

### Added
- Meal settings: saved Groq and Gemini keys are shown masked (last 4 characters) with a Show/Hide toggle.
- **Test** button per provider: sends a text and a tiny-image request through the same path as meal analysis and
  shows the exact API error (e.g. wrong key, unknown model, model without image support). Counts toward usage.
- Every failed provider attempt is now logged, so a silent Groq → Gemini fallback has a visible reason.

### Changed
- Removed the hard-coded Gemini fallback models; only the selected model is tried per provider.
- Meal analyzer constants moved to `src/services/mealAnalyzerConstants.ts`.

## v1.5.1 — 2026-11-07

### Fixed
- Mic: the recording is now uploaded as plain bytes instead of a file reference, which failed with "No internet
  connection" even when online. Unreadable or too-short recordings get their own short message.

## v1.5.0 — 2026-11-07

Needs a rebuild (`scripts/install-ios.sh release`): adds the `expo-audio` native module, so `runtimeVersion` is now `2`.

### Added
- **Mic button** on the Meals "Describe a meal" box and the food Search box. Tap to speak, tap again to stop.
  On Meals the transcript is added to the box and analysed straight away ("4 packets of blue Lays, 80 g each" ->
  calories). On Search it fills the query. Transcription uses your saved Groq key (Whisper).

### Fixed
- The keyboard no longer covers the text boxes on Meals, Search, Settings, Weight and Backup; the Meals box scrolls
  into view when focused.
- Errors are short and calm: a friendly one-line message in a soft card (with Retry) instead of red text with
  provider/HTTP details. Actions that used to fail silently (saving a meal, task, routine or weight, quick log,
  delete/move) now say so.

## v1.4.0 — 2026-11-07

### Added
- Separate **Photo / Library / Search / Scan** buttons on the Meals tab. Search and Scan are now their own screens
  (no toggle); the Diary "add" button opens Search.
- **Units for searched foods**: the editor always offers a "Grams per unit" field when the product lists no pack or
  serving weight, with typical piece weights suggested for plain foods (apple, banana, egg, roti, ...). Your unit size
  is remembered per barcode.
- **Indian products first** in food search (India-scoped and global queries merged and ranked).

### Fixed
- Food text search no longer matches loosely or shows stale results while typing: every typed word must match the
  start of a brand/name word, accents and punctuation are ignored, and late responses for older text are dropped.

## v1.2.1 — 2026-11-07

### Added
- **Daily meal goal** (new "Meals" option under "Completed by" when creating a routine). It checks itself off the
  day after if that day's logged calories were at most 150 over, and protein at most 15 g under, the targets.
  Targets are snapshotted from your Meals goals when the routine is created.
- An everyday **"Hit meal goal"** routine is created automatically (once) from your Meals goals, with a progress
  ring and `calories / goal · protein / goal` progress on its row.

### Fixed
- Published updates now download and apply on the first app open instead of the second.
