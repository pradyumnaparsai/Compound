# Changelog

Each release lists only what changed since the previous release. `npm run release` publishes the matching
`## v<version>` section as the GitHub release notes.

## v1.2.1 — 2026-11-07

### Added
- **Daily meal goal** (new "Meals" option under "Completed by" when creating a routine). It checks itself off the
  day after if that day's logged calories were at most 150 over, and protein at most 15 g under, the targets.
  Targets are snapshotted from your Meals goals when the routine is created.
- An everyday **"Hit meal goal"** routine is created automatically (once) from your Meals goals, with a progress
  ring and `calories / goal · protein / goal` progress on its row.

### Fixed
- Published updates now download and apply on the first app open instead of the second.
