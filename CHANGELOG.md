# Changelog

Each release lists only what changed since the previous release. `npm run release` publishes the matching
`## v<version>` section as the GitHub release notes.

## v1.18.0 — 2026-11-08
Needs a native rebuild (`scripts/install-ios.sh release`): the app asks Apple Health for permission to save workouts, and Hevy import adds a file picker.
### Added
- **Strength workouts in Apple Health**: finishing a workout started from a template saves a *Traditional Strength Training* workout to Health (real start and end time, shows in Fitness) and checks off your strength-workout routine for that day. Starting one also asks a paired Apple Watch to open a strength workout (only works with a Watch app, otherwise it does nothing). Workouts you edit later or import never do this.
- **Hevy import** (Workout settings → Import Hevy CSV): brings in your logged workouts as History and makes a template from each workout name you repeat (Upper 1, Lower 1, …) with its exercises and number of sets; weights and reps pre-fill from your last session. Safe to run again: nothing is added twice.
- New figures for **Lying Leg Curl, Incline Chest Press (machine), Pec Deck, Reverse Pec Deck / rear-delt machine, Leg Raise (parallel bars), Reverse Crunch, Crunch (machine) and Behind-the-back Wrist Curl**.
### Changed
- **Body tab**: two sections, **Workouts** and **Weight logging**. History now lives inside Workouts (Templates | History).
- **Start empty workout** is gone: every workout starts from a template.
### Fixed
- "Update template?" no longer pops up after every workout for templates whose weights and reps are left empty (like the imported ones).
- Exercise animations that showed the wrong movement: lying leg curl (was drawn seated), pec deck (was a press), rear-delt machines (were drawn bent over with no seat), leg-press leg positions, and exercises with custom names, which now get the right figure instead of a guess from the muscle.

## v1.17.0 — 2026-11-08
### Added
- **Start a workout**: a **Start** button on every template and **Start empty workout** (Body → Workouts). Log weight and reps per set, see last time's numbers beside each set (tap to copy), tick sets off to start the rest timer, add sets/exercises/warm-ups, reorder, replace or superset exercises mid-workout. The workout survives closing the app and resumes where you left off (banner on Today and Body).
- **Finish summary**: duration, volume, sets and any new **personal records**; offers to update the template when you changed it.
- **History**: every logged workout (Body → History), edit or delete past workouts, save one as a template; barbell badge and a day list on the calendar.
- **Progress**: per exercise, best set / estimated 1RM / volume charts, records and history (tap an exercise's menu or its picture).
- **Animated exercise figures**: each exercise has a looping stick-figure of the movement, shown as a circle next to the exercise and larger on its details page. Original artwork drawn in code, so no extra download size; respects Reduce Motion.
- ~30 more exercises, including **Preacher Curl** and **Seated Palms-Up Wrist Curl**.
- Setting: count warm-up sets in volume (off by default).
### Fixed
- Filter chips on Exercises, Add exercises and Workouts were stretched or clipped.

## v1.16.0 — 2026-11-08
### Added
- **Body tab** replaces Weight: a **Workouts | Weight** switch. Weight works as before.
- **Exercise library**: about 50 built-in exercises with search and muscle/equipment filters, plus your own custom exercises (reps, bodyweight, assisted, weight + time, time, reps only, distance + time).
- **Workout templates**: folders, drag to reorder, add exercises, per-set type (normal, warm-up, drop, failure), rep ranges, rest timer, supersets, notes (pin to keep them), duplicate and delete.
- **kg / lb** display setting and plate setup (Workout settings) for the weights in the app; everything is still stored in kg.
- Workout data is included in the cloud backup.
- Atomic understands pounds: say "log 180 pounds" (or a bare number, read in your chosen unit) and it is stored in kg.
### Notes
- Logging a live workout, history, PRs and import from Hevy follow in the next releases.
## v1.15.3 — 2026-11-08
### Changed
- The "Long-press and drag to reorder", "Long-press a routine to archive it" and "Long-press an entry to delete it" footer hints now appear only the first time (fresh install) and are gone afterwards.
## v1.15.2 — 2026-11-08
### Fixed
- Startup splash: it now uses a full-screen portrait poster with the **COMPOUND** heading, filling the whole iPhone screen instead of a cropped or mis-sized picture.
## v1.15.0 — 2026-11-08
### Added
- Startup splash: on launch the app fades in a full-screen artwork with the **COMPOUND** heading, holds briefly and fades into the home screen (~2s). Tap anywhere to skip; skipped automatically when Reduce Motion is on.
## v1.14.0 — 2026-11-08
### Added
- Diary: expand a logged meal and tap the **−** next to any item to remove it (e.g. something you logged but did not eat). Calories and macros update; removing the last item offers to delete the meal.
## v1.13.1 — 2026-11-08
### Fixed
- Over-the-air updates were not reaching the phone: v1.12.0 and v1.13.0 were published for runtime version 3, but the installed app was built with runtime 2 (the generated iOS project was never regenerated). Updates are published for runtime 2 again, so they arrive without a reinstall.
## v1.13.0 — 2026-11-08
### Changed
- **Atomic:** the assistant is now called Atomic and has a simple look that follows the app theme: a round accent-coloured button and a clean bottom card that shows only what it heard and its answer. The glowing orb, chat list and typing box are gone; it just listens and responds.
- **Better voice:** replies are read in a natural voice (Groq Orpheus) instead of the robotic device voice, and play even when the silent switch is on. If the natural voice isn't available it falls back to the best voice installed on the phone.
### Fixed
- Atomic now stops listening by itself when you finish speaking (no second tap needed); the missing answers were mostly the recording never being stopped.
- Answers appeared very late or not at all: the chat model's slow "thinking" step is now off, requests give up after 90 seconds with a visible message, and Whisper repeating its own hint on silence is ignored.
## v1.12.0 — 2026-11-08
### Added
- **AI assistant:** a floating orb on every screen (drag it anywhere; it snaps to an edge). Tap it, say what you want, and it adds routines and tasks, logs meals to the diary, checks off routines/tasks, moves tasks, logs weight and sets calorie/protein goals. It talks back (mute button in the panel) and you can type instead.
- Deletes, archives and goal changes ask for confirmation (tap or say "yes"); every other change has an Undo button.
- Meals logged by voice use the same AI estimate as the Log food screen; token use is about 1–3k per command and counts in AI usage.
### Changed
- **Requires a rebuild:** adds the native `expo-speech` module (runtime version 3). Run `scripts/install-ios.sh release` once; it now always runs `pod install`.
## v1.11.1 — 2026-11-07
### Fixed
- Swipe back no longer shows a pale line along the screen edge while the gesture is in progress; navigation surfaces now use the app background.
## v1.11.0 — 2026-11-07
### Added
- **Log food screen:** Meals → Log food. Meal-slot picker, Photo/Library/Search/Scan, describe-a-meal composer, AI review and Quick log now live here, so the Meals tab is just your day at a glance.
- **My meals** list on the Meals tab shows every meal you created (items, protein, schedule); tap one to open it.
- **Saved-meal screen:** tapping a created meal (list or Quick log chip) opens its items and totals and asks where to add it — Breakfast, Lunch, Snacks or Dinner — instead of logging it immediately. Edit and Delete are there too.
### Changed
- Quick log no longer logs a meal on tap.
## v1.10.0 — 2026-11-07
### Added
- Swipe back from anywhere on the screen to go back (modals still swipe down to dismiss).
### Changed
- AI estimate: the remove-item button now sits on the right of each item instead of the left.
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
