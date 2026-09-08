# QA checklist

The project has no build step or package manager by design. Run the following
checks from `/workspace` before handing off a change:

```sh
# Syntax-check every source file and run deterministic core tests.
node scripts/check.mjs

# Syntax-check every browser module.
for f in $(rg --files js -g '*.js'); do node --check "$f" || exit 1; done

# Render the default route and inspect console output.
screenshot --width 1440 --height 900

# Check the narrow layout when a responsive change is involved.
screenshot --width 390 --height 844
```

Manual smoke coverage:

1. Load Home, Library, Search, Ask, Imports, Settings, and a deep-linked
   transcript route.
2. Rapidly navigate between several routes while one route is still loading;
   the slower route must never replace the current page.
3. Confirm each route enters smoothly and that reduced-motion mode removes the
   animation without delaying navigation.
4. Confirm the destination shell/skeleton appears immediately even when data
   loading is slow; thumbnails and secondary counts may fill in afterward.
5. Import a small plain-text transcript, reload, open it, search it, and
   delete it.
6. Record a short microphone clip, import it, wait for Whisper model loading,
   and verify timestamped transcript segments are indexed.
7. Import a short MP3/WAV/WEBM/MP4 file and verify the audio track is decoded,
   transcribed, and playable from the resulting transcript.
8. Open and dismiss a modal with Escape, click outside it, and tab through it.
9. Toggle dark/light mode and verify it survives a reload.
10. Disable the network after the shell has loaded and verify cached navigation
   still renders without exposing API responses to the service worker. In
   particular, confirm `/api/meeting-memory` is a network request, not a
   cache hit.

Automated coverage lives in `tests/core.test.mjs` and intentionally targets
the pure parsing, chunking, formatting, and URL-validation contracts. Keep
new domain logic pure where practical so it can be covered without a browser
or a package manager.

## Persistence QA

- Load legacy IndexedDB v1/v2 records after upgrade; verify public IDs and
  `collection:id` physical keys survive.
- Verify the same public ID can exist in separate logical collections.
- Interrupt an import, reload, retry the failed item, and confirm completed
  normalized records are reused safely.
- Import duplicate content and verify no legacy or normalized records are
  corrupted.
- Delete a source/transcript and verify associated chunks, segments, and
  collection assignments follow the documented cascade; shared speakers stay.
- Make offline writes, reload, and reconnect without duplicate records.

## Router QA

- Rapidly switch routes, use browser back/forward, and open deep transcript
  links while a slower route is loading.
- Confirm stale route and stale search responses cannot commit over the current
  stage; modals dismiss cleanly during route changes.

## Ingestion QA

- Test TXT, Markdown, SRT, VTT, CSV, JSON, DOCX/PDF where available, malformed
  and empty files, large plain text, duplicate names, abort, parse failure, and
  retry. Test media upload, model download failure, unsupported codecs,
  transcription cancellation, and reload after media upload.
- Verify Source is persisted before parsing, stage progress is accessible, and
  a failed stage is retained for retry.

## AI QA

- Simulate provider timeout, invalid JSON, empty output, oversized context,
  rate limiting, cancellation, malformed structured output, and transcript
  prompt injection. Verify clean retryable errors and no persistence of invalid
  structures.

## Security QA

- Import `<script>alert(1)</script>`, `javascript:alert(1)`, unsafe Markdown,
  unsafe URLs, and hostile filenames. Verify none execute or become active
  links. API responses remain excluded from service-worker caching.

## Accessibility and responsive QA

- Keyboard-only navigation, visible focus, modal focus trap/Escape, labels,
  live status messaging, reduced motion, sufficient contrast, and 200% zoom.
- Check 1440×900, 390×844, 430×932, 768×1024, and 844×390 where practical.

## Automated foundation checks

`node scripts/check.mjs` also covers source/transcript/segment normalization,
schema migration, structured validation, unsafe URL validation, AI content
boundaries, provenance, and event behavior. Sanitized fixtures live under
`tests/fixtures/`; no real transcript data is stored in tests.

## Phase 2 intelligent transcript workspace

### Media and synchronization

- Open native audio, native video, external video, and transcript-only sources.
- Verify transcript shell renders before waveform or AI enrichment.
- Play/pause, seek by timestamp, skip ±10 seconds, change rate, mute, and use
  keyboard controls; verify no autoplay on route load.
- Confirm active segment lookup, follow mode, manual scroll suspension, Return
  to current moment, deep-linked `?t=`/`?start=`, and route cleanup.
- Break media metadata/waveform loading and verify the transcript remains usable.

### Editing and speakers

- Rename and merge speakers, reassign one segment, reload, and verify stable
  references and aliases.
- Edit a raw segment and confirm an editable derivative is created while raw
  text remains unchanged. Save, cancel, reload, and exercise a failed save.
- Switch transcript versions and confirm the active version is visible.

### Notes, highlights, chapters, and provenance

- Add a note at the current moment and from selected text; highlight and
  bookmark a segment; reload and verify timestamps and segment IDs remain.
- Generate, rename, persist, and navigate chapters. Simulate AI failure and
  verify deterministic/local fallback or a localized error.
- Create an action and decision from a selection and confirm each keeps valid
  Source/Transcript/Segment evidence without silently creating organizational
  memory.

### Ask and evidence

- Ask a transcript-scoped question and a selection-scoped question. Verify
  unsupported claims are not presented as facts, source text cannot override
  instructions, and evidence links focus/seek the cited segment.
- Test timeout, cancellation, invalid JSON, empty output, oversized context,
  rate limit, and offline AI availability.

### Responsive and accessibility

- Check 1440×900, 768×1024, 430×932, 390×844, and 844×390. Mobile must keep
  readable transcript text, accessible sticky controls, and usable panel tabs.
- Keyboard-only test player, timestamps, search, editing, selection actions,
  speaker controls, panels, and Escape behavior. Verify visible focus, live
  save/processing status, reduced motion, 200% zoom, and no hover-only action.

### Performance and privacy

- Load a fixture with thousands of segments; search, scroll, select, navigate
  chapters, and track playback without full-route rerenders every tick.
- Confirm waveform hydration is deferred, no collection reads occur inside a
  render loop, and no complete transcript/prompt/private response is logged.
- Import malicious HTML, JavaScript URLs, hostile Markdown, and unsafe media
  URLs; verify content stays inert and external links remain safe.
