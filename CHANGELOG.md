# Changelog

Each release lists only what changed since the previous release. `npm run release` publishes the matching
`## v<version>` section as the GitHub release notes.

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
