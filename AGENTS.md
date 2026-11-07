This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npm test                    # run all unit tests (Jest, jest-expo)
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Feature workflow (MANDATORY for every feature request)

Details and checkboxes: `docs/FEATURE_WORKFLOW.md`. Follow these steps in order, every time:

1. **Plan** — restate the requirement, ask the user to clarify anything ambiguous, write a short plan, get confirmation.
2. **Advisor** — discuss the plan with the advisor for the best solution before coding.
3. **Implement** — follow existing patterns; keep logic in pure functions.
4. **Add tests** — unit tests in `__tests__/` (never in `src/app/`) for new logic; regression test for bug fixes.
5. **Run all tests** — `npm test`, `npx tsc --noEmit`, `npx expo lint`. Never delete or weaken existing tests to get green.
6. **Version bump, OTA publish, security, then push** — after tests/tsc/lint pass, ALWAYS bump the version with `npm run bump -- <major|minor|patch>` (major = big UI overhaul, minor = every new feature, patch = fixes) and publish to the phone with `npm run update -- --message "..."` (`docs/DEPLOY.md`). Do this automatically, WITHOUT asking the user — they do not run it themselves (they only run `scripts/install-ios.sh release` weekly for Apple's 7-day signing). Skip the OTA only for native changes (needs a rebuild: tell the user). Scan the diff for secrets, `npm audit`, ensure `.env` is unstaged and `package-lock.json` has no internal registry URLs (`grep -c "walmart\|npme" package-lock.json` = 0). Never wait for the user to confirm on the phone first. Then, for EVERY version release, WITHOUT asking: add a `## v<version>` section to `CHANGELOG.md` listing only the changes since the previous release, commit (`feat:`/`fix:`/… + a `chore: release v<version>` commit), and run `npm run release` — it pushes `main`, tags `v<version>` and publishes the GitHub release with those notes (`docs/DEPLOY.md`).

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
