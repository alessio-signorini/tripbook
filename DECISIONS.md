# Decisions

- `npm test` uses `node --test "test/*.test.js"` because Node 24 no longer accepts a bare directory argument.
- Phase 1 shared-module tests live in one file, `test/shared.test.js`, instead of one file per module.
- `src/shared/` also exports `mergeConfig`, `findCollisions`, `stripMarkdown`, `openInMaps`, `shortlistCount` and `allVisible` as small helpers for later phases.
- `renderMarkdown` turns headings into bold paragraphs and drops images and unsafe link schemes, keeping the subset small.
- The embedded `#trip-data` JSON also carries each stop's `minutes` (not a date) so `trip.js` can recompute totals when the low-rating toggle changes.
- A leg connector is shown only when the stop and the next stop in the original order are both visible, so a hidden stop never leaves a wrong leg between two visible ones.
- `buildSite()` is exported from `build-site.mjs` so tests call it directly; the CLI runs only when the file is the entry point.
- Google Maps bootstrap loader lives in `src/shared/maps-loader.js` so the site and the editor share it.
