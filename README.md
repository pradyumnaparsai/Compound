# Compound

iOS app (Expo / React Native) for daily routines, todos, weight tracking and AI-assisted meal logging. Data is stored locally (SQLite); optional cloud backup via Supabase.

## Requirements

- macOS with Xcode and CocoaPods
- Node.js 20+
- iPhone (HealthKit and camera need a real device)

## Install

```bash
git clone https://github.com/pradyumnaparsai/Compound.git
cd Compound
npm install
cp .env.example .env   # optional: fill in Supabase values for backup
```

## Run

Uses native modules, so Expo Go won't work — build a dev client:

```bash
npx expo run:ios                 # build and launch
npx expo start --dev-client      # start Metro afterwards
```

Install on a connected iPhone:

```bash
DEVICE_ID=<udid> npm run ios:release   # or ios:debug
```

Find your UDID with `xcrun devicectl list devices`. Set your own `ios.appleTeamId` and `bundleIdentifier` in `app.json`.

## Configuration

| Item | Where |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` — run `docs/supabase.sql` in your Supabase project |
| Groq / Gemini API keys (meal analysis) | In-app → Meals → Settings (stored in Keychain) |

## Scripts

`npm start` · `npm run lint` · `npx tsc --noEmit`

See [`docs/DESIGN.md`](docs/DESIGN.md) for design notes.
