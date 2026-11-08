# Compound — Design Doc

Living document. Add use cases to the table and requirements below as they come up.

## 1. Overview
iOS app to track daily routines and todos. Local-only storage for now. Dark theme first, polished UI.

## 2. Use Cases

| ID  | Use case | Phase | Status |
|-----|----------|-------|--------|
| UC1 | Add daily/repeating routines and check them in each day | 1 | MVP built |
| UC2 | Pull data from other apps via Apple Health (steps, calories consumed) | 2 | Steps + workouts built (goal routines auto-check); calories later |
| UC3 | Calendar showing all days marked done | 1 | MVP built |
| UC4 | One-off todos (non-repeating) | 3 | Idea |
| UC5 | Reminders / local notifications per routine | 2 | Idea |
| UC6 | JSON export/import backup | 2 | Idea |
| UC7 | Lock-screen widget showing routines done today (n/total) | 2 | Code written; disabled — blocked on App Groups (see §10) |
| UC8 | Yearly view of days completed | 1 | Built |
| UC9 | Daily body-weight log + weekly average graph | 1 | Built |
| UC10 | Food photo → calories/protein estimate via Gemini API (MyFitnessPal-style logging) | 4 | Built, untested on device (see §11) |

### UC1 — Daily routines
- Create / edit / archive a routine (title, recurrence, optional reminder time).
- "Today" screen lists routines scheduled for today; tap to toggle done.
- Recurrence: daily (default), specific weekdays. Custom later.

### UC2 — Health data (Phase 2)
- Read steps (`HKQuantityTypeIdentifierStepCount`) and dietary energy (`HKQuantityTypeIdentifierDietaryEnergyConsumed`) from Apple Health.
- Food-tracking apps (e.g. MyFitnessPal) are only reachable if they write calories into Apple Health. There is no direct app-to-app API.
- Possible extension: routine with a **goal** (e.g. "10k steps") that auto-completes when the HealthKit value crosses the target.
- Constraints: requires HealthKit entitlement and a custom dev build (not Expo Go). Read permission is per data type and the user can deny.

**As built (steps + workouts):** `@kingstinct/react-native-healthkit` (read-only; background delivery off). A routine can have a goal (`routines.goal`, migration v3): `{type:'steps',target}` or `{type:'workout'}` (any workout that day). Goal routines are completed only by Health data (not tickable by hand). `src/services/healthSync.ts` refreshes on app open, on returning to foreground, every 60 s while open, and when goals change; it backfills 7 days and only ever adds completions. Steps use HealthKit statistics (de-duplicates iPhone + Watch). iOS never reveals denied read access: it just reports 0, so check Settings → Health → Data Access & Devices → Compound. Updates only while the app is open (background delivery is off; not verified whether the free team can sign that entitlement).

### UC3 — Calendar
- Month view; each day marked by completion state: none / partial / all done.
- Tap a day to see which routines were completed.

## 3. Requirements

**Functional**
- FR1: CRUD routines.
- FR2: Per-day completion toggle, with history retained.
- FR3: Today view shows only routines scheduled that day.
- FR4: Month calendar with done/partial markers.
- FR5 (P2): Health-backed goals.

**Non-functional**
- NFR1: Works fully offline; all data on device.
- NFR2: Dark theme default, follows system with light fallback.
- NFR3: Storage behind repository interfaces so a backend/sync can be added later.
- NFR4: Data export before any destructive migration.

## 4. Architecture

- **Framework:** React Native + TypeScript via Expo (Expo Router for navigation).
- **State:** Zustand.
- **Storage:** `expo-sqlite` (date-range queries, completion history). AsyncStorage rejected: key-value only.
- **Health (P2):** `HealthProvider` interface; mock impl now, HealthKit impl later (custom dev build).
- **Notifications (P2):** `expo-notifications` local. iOS caps pending local notifications at 64, so schedule on a rolling window.

```
UI (app/, components/)
  → Zustand stores (src/store)
    → Services (recurrence, health, notifications)
      → Repositories (interface)
        → SQLite implementation
```

```
src/app/          Expo Router screens (tabs: Today, Calendar, Routines)
src/domain/       types, recurrence logic, date helpers
src/data/         repositories + SQLite impl + migrations
src/store/        Zustand stores
src/services/     health, notifications
src/theme/        color tokens (dark/light)
src/components/   shared UI
docs/DESIGN.md
```

## 5. Data Model

- `routines`: id, title, recurrence (JSON: `{type:'daily'}` | `{type:'weekly', days:[0-6]}`), reminderTime?, goalMetric?, goalTarget?, archivedAt?, createdAt
- `completions`: id, routineId, date (`YYYY-MM-DD`, local), completedAt — unique(routineId, date)
- `weights` (v2): date (`YYYY-MM-DD`, PK, one entry per day), kg, loggedAt

- `weights` (v2): date (`YYYY-MM-DD`, PK, one entry per day), kg, loggedAt
- `meals` (v4): id, date, logged_at, title, input_type, confidence, ingredients (JSON), calories, protein_g, assumptions (JSON)

Occurrences are **computed from the recurrence rule**, not stored; only completions are logged.
A day's status = completed scheduled routines / scheduled routines for that date.

## 6. Open Questions
- What counts as a "done" day: all scheduled routines done (default) or any? Partial days are shaded either way.
- If a routine is edited/archived, should past days recompute? Default: past days keep the rule that applied then (needs `effectiveFrom` or archived-not-deleted).
- Should the day roll over at midnight or a custom hour (e.g. 4am)?

## 7. Risks
- Local-only data is lost on uninstall (iCloud backup may not cover it) → export/import (UC6).
- HealthKit needs paid-account entitlement for device builds and a dev build; plan for it in Phase 2.

## 8. Phases
1. **MVP:** routines CRUD, Today check-in, calendar, dark theme.
2. Health goals, notifications, export/import.
3. One-off todos, widgets, sync.

## 9. Build Notes
- App name: **Compound** (small daily actions compound into big results). Bundle ID intentionally kept as `com.productivitybooster.app` so iOS keeps the existing data.
- Install on iPhone: `npm run ios:release` (standalone, re-run every 7 days on the free team) or `npm run ios:debug` (needs `npx expo start --dev-client`). Script: `scripts/install-ios.sh`.
- Expo SDK 58, React Native 0.88, Expo Router (routes in `src/app/`), `@/*` alias → `src/*`.
- Runs as a **development build** on the iPhone (Expo Go is not enough: widgets, HealthKit). Free Personal Team builds expire after 7 days.
- Done-day rule implemented: "all scheduled routines done" = solid green, partial = soft green.
- Routine edit changes the rule retroactively for scheduled-day computation (open question above); archive keeps history.
- Verified on iPhone 16 Pro (iOS 27.0.1): routines, Today, calendar work. Year view + weight tracker added afterwards (typechecked).
- Schema is versioned via `PRAGMA user_version`; migrations in `src/data/db.ts` are append-only (v2 = `weights`).

## 10. Device Run + Widget (UC7)
- Widget code exists (`src/widgets/RoutineWidget.tsx`, `src/services/widgetSync.ts`, `expo-widgets`) but the plugin is **removed from `app.json`**; sync fails silently. Restore with `docs/widget-plugin.snippet.json`.
- Blocker: widgets need an **App Group**, which needs a paid Apple Developer team. Current signing: free Personal Team (no App Groups).
- Unblock option: enroll in the Apple Developer Program ($99/yr), which also removes the 7-day expiry.
- **Changing team can change the bundle ID, which iOS treats as a different app → local data is not carried over. Build UC6 export/import before switching.**
- Interim reminder options without App Groups: app icon badge = routines left today (needs `expo-notifications`, native; verify no push entitlement is added, since free teams cannot sign `aps-environment`), plus scheduled local notifications (UC5).
- Running without the Mac: the Debug build needs Metro (same Wi-Fi). A Release build embeds the JS and runs standalone; still expires after 7 days on a free team.

## 11. Planned features (notes)
- **UC2 Health:** needs HealthKit capability (check Personal Team supports it) + native lib; see §2.
- **UC9 Weight:** units are kg for now (open: lb toggle). Weeks start Sunday. Later: sync body mass with Apple Health.
- **UC10 Food photo logging (Gemini):**
  - A Google consumer subscription (Google One / AI Pro) does not include Gemini **API** quota. A key comes from Google AI Studio (free tier exists; free-tier data may be used to improve Google products).
  - Never bundle the key in the app. Either the user pastes their own key (stored with `expo-secure-store`) or calls go through a small proxy.
  - Photo-based calorie/macro estimates are approximate (portion size is the main error); show them as editable estimates, not precise values.
  - MyFitnessPal has no public write API; it only shares data through Apple Health. Own food log + optional write to Apple Health is the feasible path.
  - Needs camera/photo-picker (`expo-image-picker`, native) and network.
  - **As built:** Meals tab (`src/app/(tabs)/meals.tsx`). Photo (camera/library via `expo-image-picker`, quality 0.5, base64) + optional barcode/product + note → `src/services/mealAnalyzer.ts` calls Gemini REST `generateContent` with the dietitian system prompt (verbatim) and `responseMimeType: application/json`. Output is validated in `src/domain/meal.ts`; totals are recomputed from ingredients (model totals ignored). User reviews/edits ingredients, then saves to `meals`. API key + model id live in `expo-secure-store`. Default model `gemini-3.8-flash` was supplied by the user from Google's docs; change it in Meals → Settings. New native modules (`expo-image-picker`, `expo-secure-store`) → needs a dev-build rebuild. Apple Health write-back not built.
  - **Providers:** Groq is tried first when a Groq key is saved (`qwen/qwen3.8-27b`, OpenAI-compatible `chat/completions`, `image_url` data URL, JSON mode; id from Groq's vision docs, user-chosen), then Gemini (the selected model only, no fallback models) when a Gemini key is saved. One retry per target on 429/5xx/timeout; any other error or bad output skips to the next target. Constants (store keys, default models, endpoints, timeouts, system prompt) live in `src/services/mealAnalyzerConstants.ts`. The model that produced a result is shown in the review card. Keys + model ids live in `expo-secure-store`.
  - **Goals, macros, barcode, saved meals (v5):**
    - Daily calorie + protein goals (`settings` key `goals`, set in Meals → Settings) drive two progress rings on the Meals tab. Carbs/fat are tracked too (`meals.carbs_g/fat_g`) but not goal-driven.
    - **Prompt changes (user request):** vegetarian, no eggs/meat/fish profile; removed the "+10% overestimate" rule and the default 1 tbsp hidden oil (now 1 tsp, and only when frying/sautéing is visible); output adds `carbs_g`/`fat_g`. This deviates from the originally pasted prompt.
    - **Barcode/name lookup:** `src/app/scan.tsx` (modal) uses `expo-camera` `CameraView` (EAN-13/8, UPC-A/E) or manual digits, then Open Food Facts (`world.openfoodfacts.org/api/v2/product/<code>`; name search via `search.openfoodfacts.org`). No key; sends a `User-Agent`. Per-100 g values are scaled to the grams eaten (default = pack weight). UPC-A/EAN-13 spellings are both tried. If only "as prepared" values exist it warns; if nutrition is missing the user types the label values. Every logged barcode is cached locally (`food_cache`) with the user's corrected values, so repeat scans are instant and offline. Products not in OFF (many Indian items) fall back to manual label entry.
    - **Saved meals** (`saved_meals`): save from the AI review card, a logged meal (long-press) or the scan screen; tapping one logs it with no API call.
    - **Protein routine goal:** a routine can be "Completed by → Protein" (`{type:'protein',target}`); `src/services/mealGoalSync.ts` auto-checks it when that day's logged protein reaches the target (7-day backfill, adds only, re-run when meals change). Apple Health sync ignores this goal type.
    - New native module `expo-camera` → rebuild.

  - **Meal builder + scheduled meals (v1.8, migration v9 `meal_schedules`):**
    - Meals tab → Quick log → **New meal** opens `src/app/meal-builder.tsx`: name, then repeatedly Search/Scan (`/scan?target=builder` adds the food to `useMealDraft` instead of logging it), then save as a `saved_meals` row (multi-ingredient; long-press a chip → Edit/Delete). Logging it is still one tap.
    - **Auto-log:** a `meal_schedules` row (`time` HH:mm, `days` JSON weekdays or NULL = every day, `enabled`, `created_at`, `last_applied` date key). iOS can't run JS while the app is closed and `expo-notifications` would need a native rebuild, so `src/services/mealSchedule.ts` **catches up**: on launch, on foreground, every 60 s while open and when schedules change it logs each schedule whose time has passed today, stamped at the scheduled time (slot derived from that time). Only today is considered (missed days are skipped, no backfill); an occurrence earlier than the schedule's creation is skipped. Pure rules in `src/domain/mealSchedule.ts` (`dueSchedules`).
    - Duplicate guard: `last_applied` is claimed atomically in SQLite before the meal is added (released if the add fails). Deleting an auto-logged entry therefore does not bring it back the same day. Deleting a saved meal deletes its schedules. `meal_schedules` is part of the cloud backup.
    - UI manages one schedule per meal (the data model allows several). Time is typed as 24 h with preset chips (no native time picker installed).

## 12. Atomic (voice assistant)
- **UI:** `src/components/atomic/` — `AtomicHost` (draggable round button in the app accent colour, mounted in `src/app/_layout.tsx` above the `<Stack>`, hidden on native-modal and camera routes), `AtomicPanel` (bottom sheet showing only the latest "heard" line, the answer, confirm/undo and one mic button; no chat history, no typing), `AtomicButton` (one soft ring pulses while listening/speaking). Colours come from `useTheme()`, so light/dark follow the app. Tap the button → panel opens and starts recording.
- **Flow:** `useVoiceInput` (Groq Whisper, short vocabulary hint; a transcript that merely echoes the hint is treated as silence) → `src/services/assistant.ts` (one JSON-mode chat call: Groq first, Gemini fallback; same keys/models as meal analysis; tokens go through `recordUsage`; for `qwen/qwen3.8*` reasoning is turned off with `reasoning_effort: none` + `reasoning_format: hidden`, otherwise it "thinks" for many seconds) → `src/domain/assistant.ts` validates the untrusted reply into typed `Action`s and resolves references (short ids like `r2`/`t1`, or fuzzy titles) → `src/services/assistantActions.ts` applies them through the existing Zustand stores → `src/services/speak.ts` reads the reply aloud.
- **Runner guarantees (`assistantRunner.ts`, covered by `__tests__/assistantRunner.test.ts`):** every request ends with a visible answer or error; a 90 s watchdog aborts a stuck request with "That took too long"; closing the panel aborts work in flight.
- **Voice:** `speak.ts` uses Groq Orpheus (`canopylabs/orpheus-v1-english`, voice `hannah`, WAV) in ≤200-character chunks (`domain/tts.ts`), prefetching the next chunk while one plays through `expo-audio`; units and dates are rewritten for speech ("22 g" → "22 grams"). On any failure it backs off (5 min, or 1 h for 400/403/404) and uses `expo-speech`, preferring an Enhanced/Premium installed voice. If Groq refuses (e.g. model terms not accepted for the key) a one-line note is shown once. Playback sets `playsInSilentMode`, so the silent switch no longer mutes it.
- **Token cost:** chat is text only; context is ids + titles (≤40 routines, ≤40 open tasks, ≤20 recent meals) plus the last 3 exchanges, ≈1–3k tokens per command. Whisper and Orpheus aren't token-billed (Orpheus is billed per character).
- **Safety:** adds, check-offs, reschedules and weight apply immediately with Undo. `set_goals`, `archive_routine`, `delete_task`, `delete_meal` wait for a tap or a spoken yes/no (`confirmIntent`). Unresolvable or ambiguous references are skipped and reported, never guessed. `log_meal` runs the existing `analyzeMeal` (text note); totals are recomputed from its ingredients.
- **Native:** `expo-speech` is only the fallback voice; `speak.ts` loads it lazily, so no runtime-version bump is needed (runtime stays `"2"`; the installed build's `Expo.plist` must match `app.json`, see `docs/DEPLOY.md`).
- **Not built:** wake word, navigation commands, editing meal items by voice, un-archive undo.
