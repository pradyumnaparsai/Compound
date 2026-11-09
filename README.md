<img width="1024" height="1024" alt="image" src="https://github.com/user-attachments/assets/904fb5c0-c5a4-4fe8-aa58-0eca3298d4a8" />


# Compound

A personal iOS app for tracking daily routines, todos, body weight and meals. Built with Expo / React Native. Data lives on-device (SQLite); cloud backup via Supabase is optional.

## Features

- **Routines & todos** — daily or weekday-based routines, one-off todos, reorderable lists
- **Calendar & year view** — see completed days at a glance
- **Body tab** — **Workouts** (exercise library with search and muscle/equipment filters plus your own custom exercises, workout templates with folders, drag reorder, set types, rep ranges, rest timers, supersets and pinned notes) and the **Weight** log (daily entries, weekly-average chart). kg or lb display, stored in kg. **Start a workout** from a template (or empty), log weight and reps per set with last time's numbers beside them, rest timer, PRs, finish summary, **History** of every logged workout, per-exercise progress charts, and a barbell badge on the calendar. Each exercise has a looping stick-figure animation (original, no downloaded images)
- **Meals** — photo or barcode → calories/protein estimate (Groq / Gemini, Open Food Facts); AI-named meal header shown in the diary, remove wrong items with ➖, and correct an estimate with a text follow-up
- **Atomic (voice)** — a floating button on every screen (drag it anywhere): tap, say what you need, and Atomic adds routines and tasks, logs meals, ticks things off, logs weight and sets goals, then answers out loud (natural voice via Groq, device voice as fallback). Deletes and goal changes ask first; everything else has Undo. Uses your Groq key (Whisper, chat, voice) with Gemini as chat fallback; about 1–3k tokens per command. It remembers what you tell it about yourself (name, diet, goals, schedule) to personalise answers, asks a few getting-to-know-you questions in the first chats, and you can review or delete its memory from the person icon in its sheet
- **Apple Health** — steps and workouts auto-check goal routines; finishing a template workout saves a Strength Training workout to Health
- **Hevy import** — Workout settings → Import Hevy CSV brings in your history and templates
- **Backup** — optional Supabase backup/restore

## Tech stack

Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript · Zustand · expo-sqlite · expo-speech · Supabase

## Requirements

- macOS with Xcode and CocoaPods
- Node.js 20+
- A physical iPhone (HealthKit and camera need a real device)

## Install

```bash
git clone https://github.com/pradyumnaparsai/Compound.git
cd Compound
npm install
cp .env.example .env   # optional: only needed for cloud backup
```

## Run

The app uses native modules, so Expo Go won't work — use a development build:

```bash
npx expo run:ios               # build and launch
npx expo start --dev-client    # start Metro afterwards
```

To install on a connected iPhone:

```bash
DEVICE_ID=<udid> npm run ios:release   # or ios:debug
```

Get your UDID with `xcrun devicectl list devices`. Set your own `ios.appleTeamId` and `ios.bundleIdentifier` in `app.json`.

## Configuration

| Setting | Where |
|---------|-------|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` — create the table by running `docs/supabase.sql` in your Supabase project |
| Groq / Gemini API keys (also used by Atomic; its voice needs Groq) | In-app: Meals → Settings (stored in the iOS Keychain, never in the repo) |

## Project structure

```
src/app/         screens (Expo Router)
src/components/  UI components
src/domain/      pure business logic
src/data/        SQLite + Supabase access
src/services/    health, meal analysis, backup
src/store/       Zustand stores
__tests__/       unit tests
docs/            design notes, workflow checklist, Supabase schema
```

## Scripts

`npm start` · `npm test` · `npm run lint` · `npx tsc --noEmit`

## Testing & contributing

Unit tests live in `__tests__/` (Jest + jest-expo) and cover the domain logic. Database tests (`__tests__/workoutDb.test.ts`) run the real migrations and repositories on Node's built-in SQLite (`node:sqlite`, Node 22.13+), so no extra dependency is needed. Run `npm test` before every commit.
New features follow the checklist in [`docs/FEATURE_WORKFLOW.md`](docs/FEATURE_WORKFLOW.md).

See [`docs/DESIGN.md`](docs/DESIGN.md) for design notes.

Deploying to a phone (OTA updates + weekly re-install): [`docs/DEPLOY.md`](docs/DEPLOY.md).
