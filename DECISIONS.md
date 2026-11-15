# Decisions

- `npm test` uses `node --test "test/*.test.js"` because Node 24 no longer accepts a bare directory argument.
- Phase 1 shared-module tests live in one file, `test/shared.test.js`, instead of one file per module.
- `src/shared/` also exports `mergeConfig`, `findCollisions`, `stripMarkdown`, `openInMaps`, `shortlistCount` and `allVisible` as small helpers for later phases.
- `renderMarkdown` turns headings into bold paragraphs and drops images and unsafe link schemes, keeping the subset small.
