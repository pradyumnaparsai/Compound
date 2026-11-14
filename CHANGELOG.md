# Changelog

Each release lists only what changed since the previous release. `npm run release` publishes the matching
`## v<version>` section as the GitHub release notes.

## v1.30.3 — 2026-11-14
### Changed
- **All mocks moved to the end.** Study runs Nov 15 – Dec 16 with no mock days; the 12 mocks now fall between Dec 18 and Jan 4, alternating with lighter revision days.
- **Study days are denser.** Each DSA week is a 4–5 day bundle: LLD on two consecutive days, HLD on two consecutive days (none straddles the wedding break), 2 DSA problems a day, and on 5-day bundles an extra day with the extension pair, fundamentals and a design drill. Every LLD and HLD exercise still finishes before Dec 17.
- **Fundamentals:** Java, Databases, Spring Boot and Distributed Systems keep their study-phase slot. Kafka (Dec 17) and Production Engineering (Dec 23) moved to the mock phase because the two 4-day bundles have no room for them.
- **All 8 design drills are scheduled:** LLD Parking Lot, Splitwise, Elevator, Cab Booking and HLD URL Shortener, Distributed Cache, News Feed, Log Aggregation / Metrics Pipeline. They run alongside the main LLD exercises instead of after them.
- Behavioral: stories are drafted on Dec 21, 22, 25 and 27, retold on Dec 28, tested in the Dec 30 round and the Jan 4 behavioral mock.
### Fixed
- **Design drills now have individual checkboxes** (four steps each) instead of a single tick.

## v1.30.2 — 2026-11-14
### Changed
- **Switch prep plan rebalanced.** Recruiting and Walmart project items are removed. Behavioral (STAR stories) now starts Dec 21: stories 1–2 on Dec 21, 3–4 on Dec 23, 5–6 on Dec 28, 7–8 on Dec 31, a behavioral round in the Dec 30 mock and a full behavioral mock on Jan 4.
- **The freed time goes to design and DSA.** The fundamentals days get a design drill: LLD Parking Lot (Nov 19) and Splitwise (Dec 14), HLD URL Shortener (Nov 22) and Distributed Cache (Dec 7). Dec 31 and Jan 4 add Yellow/Red DSA revision. The LLD drills now come before the six main LLD exercises are finished.
- Every item has a planned time, and the day screen shows the total (about 2–2.5 h on practice days, 1.5–2.5 h on mock and buffer days).

## v1.30.1 — 2026-11-14
### Added
- **Switch prep on the Calendar.** Selecting a date inside the plan (Nov 15 – Jan 4) shows a "Switch prep" row with that day's focus and progress; tap it to open that day's checklist, so you can look ahead without waiting for the Today card.

## v1.30.0 — 2026-11-14
### Added
- **Switch prep.** A compact card on the Today screen (no new tab) shows today's interview-prep goal with progress, your next open item and a prep streak. Tap it for the full checklist: DSA problems, LLD/HLD exercises, fundamentals, Walmart project walkthroughs, STAR stories, mocks and recruiting steps for Nov 15 – Jan 4, with date arrows to look ahead or back.
- **Multi-day items.** Each LLD and HLD exercise spans two days ("Day 1/2 · Design", "Day 2/2 · Implementation") with a checkbox per step; checking the item ticks every step, and it counts as done once all are.
- **Roll-over.** Unfinished items from the previous 3 days show up under "Carried over" on today's list (mocks excluded). Nothing rolls across the wedding break (Nov 23–26), so there is no catch-up debt.
- Visible only when the name saved in Atomic's memory is Pradyumna (first word, case-insensitive); for anyone else the card and screen stay hidden.
- Checking off everything for the day completes the goal. Progress is saved locally and included in the cloud backup.

## v1.29.2 — 2026-11-13
### Removed
- **Workout start integration with Apple Watch / Fitness.** Starting a template workout no longer tries to start a workout on the iPhone (v1.28.0) or ask the Watch to start one. It did not work reliably and was too much machinery. Finishing a template workout still saves a Traditional Strength Training workout to Apple Health.
### Changed
- Native change: needs a rebuild (`scripts/install-ios.sh release`); `runtimeVersion` is now 7.

## v1.29.1 — 2026-11-12
### Changed
- **"Hit meal goal" now uses its allowance from 9 PM** instead of waiting for the day to end: from 9 PM it checks itself off if calories are at most 150 over and protein at most 15 g under the targets. Reaching both targets earlier still checks it immediately. Checked every minute while the app is open, and on next open otherwise.

## v1.29.0 — 2026-11-12
### Changed
- **"Hit meal goal" now checks itself off today, as soon as your logged calories and protein both reach the targets** (calories can be at most 150 over). Past days are still judged the day after, with the same slack (150 kcal over, 15 g protein under).

## v1.28.0 — 2026-11-12
### Added
- **Starting a template workout now starts a live Traditional Strength Training session on the iPhone (iOS 26+),** so you no longer have to start one by hand. Finishing the workout ends the session and saves it to Apple Health with the real start and end; cancelling it discards the session. On older iOS, or if no session is running, the workout is saved to Health at the end as before.
### Changed
- Native change: needs a rebuild (`scripts/install-ios.sh release`); `runtimeVersion` is now 5.

## v1.27.0 — 2026-11-12
### Added
- **Repeated meals are grouped.** On the Meals tab, the same meal logged more than once in a section shows as one row with combined calories and protein and an `x2` badge; tap it to see and edit each entry.

## v1.26.1 — 2026-11-12
### Fixed
- **Calories no longer turn red for being a little over.** On the Meals tab the calorie count and bar stay normal until you are more than 150 cal over the goal, matching the 150 cal slack the daily meal-goal routine already allows.

## v1.26.0 — 2026-11-12
### Changed
- **Fireworks on workout completion.** Finishing a workout now launches a fireworks show instead of confetti (reduce-motion still skips it).
- **Rest between sets is opt-in.** Exercises no longer get a default 90s rest: the timer only starts when the template sets a rest time for that exercise. New template exercises start with rest off; ad-hoc exercises have none. Existing templates keep whatever rest they already saved (tap the rest chip to turn it off).

### Fixed
- **Smoother Workout history scrolling.** History rows are memoised, thumbnails no longer loop-animate in the list, list rendering is windowed, and loading more workouts no longer jumps the list back to the top after a fresh workout.

## v1.25.0 — 2026-11-12
### Added
- **Greeting with your name.** "Good afternoon, <name>" uses the name Atomic has saved in its memory (nothing extra shows if none is saved).
- **Atomic Habits quote** on the Routines tab: a short line about small habits compounding, a different one on each app launch.

### Changed
- **Completion confetti.** Ticking a routine or task now pops a ring and a tight burst of confetti from the checkbox itself instead of a scatter across the screen. The big 80%-of-the-day celebration is unchanged.

## v1.24.2 — 2026-11-12
### Changed
- **Routines tab.** Removed the "New routine" button under the list and the reorder/archive hint text; the floating "+" creates routines.

## v1.24.1 — 2026-11-12
### Changed
- **Meals diary.** Removed the "+" next to Breakfast, Lunch, Snacks and Dinner; the floating "+" is the single way to log food.

## v1.24.0 — 2026-11-12
### Added
- **Confetti.** A small burst on every routine/task you tick off, and a big celebration the first time each day you reach 80% of your routines and tasks.
- **Workout milestones.** The workout summary says "Congratulations on logging your Nth workout!", with a bigger celebration at the 1st, 10th, 25th, 50th and every 50th after.
- **Reorder routines.** Long-press and drag routines on the Routines tab; archive moved to a ⋯ menu on each row.
- **New routine button** under the last routine on the Routines tab.

### Changed
- **Floating button is contextual.** On Meals it logs food (for the day you are viewing) and on Routines it creates a routine; long-press it there to open Atomic. Other tabs are unchanged.
- **After a workout** "Done" lands on Body → History with the workout you just logged highlighted, not on the templates.
- **Routines header** loses the "+" (settings and backup stay); Meals loses its inline "Log food" button (the floating button does it).
- **Meals diary** collapses expanded meals when you leave the tab.

## v1.23.0 — 2026-11-09
### Changed
- **Meal target.** The Meals tab button is now a bullseye and opens "Meal target", which holds only your daily calorie/protein/carb/fat goals.
- **AI settings moved to Routines.** The settings icon on the Routines tab now holds everything shared by meals, voice and the assistant: Groq/Gemini keys and models, key tests, daily usage and limits, plus a link to Assistant memory. Log food shows separate banners for "Set daily goals" and "Add an API key".
- **Manage workouts.** Templates, exercises and workout settings are reached from one Manage screen on the Workouts tab.
- Exercise figures: cable exercises (crossover, cable raise) now show the cable and handle; incline press poses corrected.

## v1.22.0 — 2026-11-09
### Added
- **Talkback.** Atomic now keeps the conversation going: after it finishes speaking it listens again by itself, so you no longer tap the mic for every turn. Toggle it with the mic icon in the Atomic sheet header (on by default, remembered). It stops listening after a silent take or an error, or when you tap to interrupt, cancel or close the sheet; tap the mic to resume.
### Fixed
- Tapping the Atomic button now shows "Listening…" straight away instead of flashing the idle screen first.
- Closing Atomic while the mic is still starting no longer leaves it recording.

## v1.21.0 — 2026-11-09
### Added
- **Atomic remembers you.** In the first chats it asks one short question at a time (name, how you like replies, diet, fitness goals, daily schedule), saves what you say, and tailors its answers to it. Say "remember …", "forget …" or "forget everything" any time; Skip/Later stops a topic being asked again. Memory is kept on the device, included in the cloud backup and sent to your AI provider with each Atomic request.
- **Memory screen** (person icon in the Atomic sheet): see everything Atomic knows, delete single facts or forget all.
### Changed
- Strength routines no longer show the schedule/"No strength workout logged yet" line on Today and Calendar (the Routines tab still labels them).
### Fixed
- Opening a finished workout and leaving without changes no longer blocks starting a new workout.
- Workout history no longer shows duplicate entries when scrolling fast; finishing or discarding a workout can no longer be undone by a late autosave.
- A failed database open is retried instead of breaking the app until restart; damaged saved meals/routines no longer stop the lists from loading.
- A backdated meal keeps the diary in order; Today, Calendar and Meals roll over to the new day if left open past midnight.
- Auto backup no longer fires twice when the app is backgrounded; voice recordings are deleted after transcription.
### Removed
- Unused code and image assets (about 0.4 MB); the strength-workout count text.
- Smaller database work: new indexes for workout history and meals, and the barcode food cache is capped at 500 items.

## v1.20.0 — 2026-11-09
### Added
- Meals tab now shows the day's diary (Breakfast / Lunch / Snacks / Dinner) under the calories, macros and Log food button — no separate Diary screen.
- Day stepper on the Meals tab and in Log food: log or correct food for past days or any future day (e.g. late-night food counted against tomorrow).
- Edit on a diary entry: rename the meal and remove items with the − icon.
### Changed
- My meals moved into Log food and replaces Quick log (one list: tap to add, long-press to edit/delete, New meal, schedules).
- After logging (AI, search, scan or My meals) you land back on the Meals tab with totals updated.
### Removed
- "Log again" on diary entries; the Diary screen; the Quick log chips; the My meals list on the Meals tab.

## v1.19.1 — 2026-11-09
### Changed
- Startup splash plays at normal speed and runs 3s (was 2s with the clip sped up 2x). The clip is trimmed to 3s.
- Removed the Gemini watermark from the splash video (bottom-right corner).

## v1.19.0 — 2026-11-09
Needs a native rebuild (`scripts/install-ios.sh release`): adds `expo-video` and bumps `runtimeVersion` to 4. Not published OTA.
### Changed
- Startup splash now plays the BruceLee.mov clip (muted, sped up to fit 2s) with the COMPOUND title, then fades to the home screen. Tap to skip; skipped with Reduce Motion; never blocks the app if the video fails to load.

## v1.18.1 — 2026-11-08
### Fixed
- App crashed on launch after the v1.18.0 rebuild (`Library not loaded: @rpath/React.framework/React`). `scripts/install-ios.sh` now builds the Expo modules from source instead of using the precompiled ExpoModulesWorklets framework.

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
