# Feature Workflow Checklist

Follow every step, in order, for **every** feature request. Tick each box before moving on.

## 1. Plan — understand the requirement
- [ ] Restate the requirement in your own words; list assumptions and open questions
- [ ] Ask the user to clarify anything ambiguous (don't guess)
- [ ] Write a short plan: files to touch, data/schema changes, edge cases, what could break
- [ ] Get user confirmation on the plan

## 2. Advisor — get the best solution
- [ ] Discuss the plan with the advisor before writing code
- [ ] Resolve any conflict between the advisor's suggestion and what the code shows, then update the plan

## 3. Implement
- [ ] Follow existing patterns (domain logic in `src/domain/`, I/O in `src/data/` and `src/services/`, state in `src/store/`)
- [ ] Use `npx expo install <pkg>` for dependencies (never `npm install <pkg>`); check Expo docs for the current SDK first
- [ ] Keep business logic in pure functions so it is unit-testable
- [ ] No hardcoded keys, URLs with credentials, device IDs or personal identifiers

## 4. Add tests
- [ ] New logic gets unit tests in `__tests__/` (never under `src/app/`; Expo Router treats every file there as a route)
- [ ] Bug fix → add a regression test that fails without the fix
- [ ] Cover edge cases: empty input, boundaries, invalid data
- [ ] Freeze time with `jest.useFakeTimers({ now })` for date-dependent code

## 5. Run everything
- [ ] `npm test` — **all** tests pass, not just the new ones
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npx expo lint` — no new warnings
- [ ] Fix failures at the root cause; never delete or weaken an existing test to make it pass

## 6. Version bump, security check, then push
- [ ] Bump the version (shown in the app footer): `npm run bump -- <major|minor|patch>`
  - **major** — big UI overhaul / redesign
  - **minor** — every new feature
  - **patch** — bug fixes and small tweaks
- [ ] Publish to the phone automatically (no confirmation needed): `npm run update -- --message "what changed"` (see `docs/DEPLOY.md`). Native changes can't go OTA: tell the user to rebuild.
- [ ] Release on git for **every** version (no confirmation needed): add a `## v<version>` section to `CHANGELOG.md` with **only the changes since the previous release**, commit, then `npm run release` (pushes `main`, tags `v<version>`, publishes the GitHub release with those notes)
- [ ] No secrets in the diff: `git diff --cached | grep -iE "secret|api[_-]?key|token|password|eyJ|sk-|AIza|gsk_"`
- [ ] `.env` is not staged (`git status`); new env vars are added to `.env.example` with empty values
- [ ] `npm audit` — fix or report high/critical findings
- [ ] `package-lock.json` only references `registry.npmjs.org`: `grep -c "walmart\|npme" package-lock.json` must print `0`
- [ ] Update `README.md` / `docs/DESIGN.md` if behaviour or setup changed
- [ ] Commit with a clear message (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) using the personal git identity
