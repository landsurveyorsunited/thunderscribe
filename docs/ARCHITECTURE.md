# Thunderscribe architecture

Thunderscribe is a browser-first single-page application. `index.html` is the
stable shell; `js/main.js` bootstraps the app, `js/router.js` owns hash
navigation, views render into `#view`, and services isolate persistence and
domain workflows from presentation.

## Runtime boundaries

- `js/db.js` is the persistence boundary. It prefers the Websim collection
  store when the host is available and falls back to IndexedDB for local and
  offline use. Callers should use the exported collection constants rather
  than hard-coding collection names.
- `server.js` is the server-authoritative boundary for organizational meeting
  memory. It validates payload size and shape, verifies meeting ownership on
  writes, and applies exact restricted-user checks before returning records.
- `js/services/library.js` is the read model for videos and transcript chunks.
  Its lazy index avoids rebuilding retrieval data on every view change; writes
  invalidate that index explicitly.
- `js/router.js` owns route lifecycle and passes each view a connected,
  isolated stage. A stage is committed only when its route request is still
  current, preventing a slower previous request from overwriting the page.
  `js/components/page-transition.js` contains only the visual handoff and
  reduced-motion policy.
- `js/services/ingest.js` is a restartable, per-file pipeline. Job and item
  records are persisted before processing so a failed item can be retried.
  Jobs carry a short lease and heartbeat; startup recovery requeues queued
  jobs and jobs whose previous browser session expired. Database operations
  are bounded so a stalled host cannot leave the UI waiting forever. Audio and
  video imports use a cached Whisper Web Worker and persist their uploaded
  media reference, so transcription can resume after a reload; a server-owned
  worker can replace this adapter later without changing the transcript model.
- `js/components/ui.js` owns shared UI primitives and security-sensitive
  rendering helpers. `safeUrl()` must be used for user-controlled media or
  external links; `escapeHtml()` alone only protects markup syntax.
- Views are intentionally thin orchestration layers. They may compose HTML,
  but persistence, parsing, indexing, and AI/runtime integration belong in
  services or libraries.
- `js/components/onboarding.js` owns the first-run tour. It is content-driven,
  persisted with a versioned localStorage key, and can be launched from the
  top-bar help button or Settings without coupling onboarding to route startup.

## Storage compatibility

The IndexedDB fallback uses a composite physical key (`collection:id`). This
allows two logical collections to contain the same public ID without data
loss. The collection index is used for reads and keyed lookups are used for
upserts, avoiding a full physical-store scan for ordinary collection access.
Database version 2 migrates existing v1 records in the upgrade transaction
and keeps the public record shape unchanged.

## Performance rules

1. Load a collection once per workflow and reuse the result; avoid fetching a
   whole collection inside a loop.
2. Reuse `ensureIndex()` for transcript reads and call `invalidateIndex()`
   after chunk mutations.
3. Debounce user-driven search and ignore responses that belong to an older
   query.
4. Keep expensive optional dependencies (PDF, DOCX, ZIP, AI) dynamically
   imported so the initial shell stays small.
5. Derived meeting memory is replaced on re-analysis so stale decisions and
   actions cannot survive a newer pipeline result.
6. Route data may load asynchronously, but it must render into the stage
   supplied by the router. View refreshes should call `router.render()` rather
   than writing directly to `#view`.
7. Decorative or remote metadata, such as thumbnails, must not block the
   first usable render. Show the route shell first and hydrate optional data in
   the background.

## Security rules

- Treat imported transcript text, metadata, exception messages, and URLs as
  untrusted input.
- Escape text before placing it in HTML. Sanitize generated Markdown through
  `renderMarkdown()`.
- Validate URL protocols before placing values in `href`, `src`, or media
  attributes. External links use `noopener noreferrer`.
- Keep service-worker caching scoped to same-origin GET requests and never
  cache API/private transcript paths. The `/api/` exclusion is intentionally
  broad because identity-scoped endpoints must not enter a shared shell cache.
- Keep page motion transform/opacity-only, short, and disabled for
  `prefers-reduced-motion: reduce`.

## Phase 1 domain model

The legacy `vlib_video` and `vlib_chunk` projections remain the compatibility
read model used by existing screens. New workflows also persist normalized
records through the same `js/db.js` boundary:

```text
Workspace -> Collection -> Source -> Transcript version -> Segment -> Speaker
                                      |                    |
                                      +-> Media            +-> provenance
```

`js/domain/` contains pure defaults, normalization, and creation helpers. It
does not perform persistence. Sources represent imported/captured material;
transcripts are versions of a source (`raw`, `cleaned`, `edited`, or
`published`); segments are reusable, optionally timed units. Existing plain
text remains valid without timestamps. A default workspace is created lazily
for the existing single-user experience, and collection assignment remains
optional.

Future-facing normalized records for memories, actions, decisions, artifacts,
entities, and topics are defined now so later features can use stable IDs and
provenance without changing the transcript projection again. Meeting Memory's
server boundary remains authoritative for identity, ownership, and restricted
visibility; its payloads carry a schema/type marker while retaining the API.

## Persistence and migrations

`js/data/schema.js` is the single source of schema versions, collection names,
and enums. `js/data/migrations.js` is a registry of deterministic record
transforms. The IndexedDB fallback is now version 3: v1 records retain their
public IDs and composite `collection:id` physical keys, while v3 adds safe
legacy metadata (`schemaVersion`, source/transcript compatibility fields).
Websim collections remain the preferred backend; normalization is additive and
does not wipe or rename legacy records. `js/data/validators.js` returns
structured errors instead of throwing for user-facing validation failures.

`js/services/foundation.js` bridges legacy videos/chunks to Source, Transcript,
Segment, and Speaker records. It performs collection reads in batches and is
non-blocking during the first shell render. Source deletion through the library
removes associated normalized transcript/segments and legacy video/chunks;
shared speaker records are retained.

## Ingest and events

`js/services/ingest.js` persists jobs/items before processing and exposes the
stages `queued`, `validating`, `transcribing`, `source-created`, `parsing`, `normalizing`,
`segmenting`, `indexing`, `analyzing`, `complete`, `failed`, and `cancelled`.
Legacy status fields remain on records for old views. Each item tracks current
and completed stages, failed stage, progress, attempt count, and a bounded safe
error. AbortController cancellation, retry, duplicate detection, and stable
normalized IDs are supported. `js/services/events.js` provides the small
domain-event seam used for ingest, transcript changes, index invalidation, and
AI task lifecycle notifications.

## AI boundary

All browser chat inference is routed through `js/services/ai/ai-router.js`.
`model-registry.js` currently preserves Websim AI as the default adapter;
`image-router.js` provides the same seam for image generation. Task definitions
live in `task-registry.js`, context is bounded by `content-boundary.js`, and
`response-validator.js` parses/validates structured output before callers use
it. Imported transcript/document text is explicitly quoted as untrusted
evidence and cannot override application instructions, permissions, or tool
authorization. The router adds timeout, cancellation, context-size, retryable
provider, and rate-limit error codes. `provenance.js` provides normalized
source/transcript/segment/time/quote-hash evidence references.

AI cleanup creates a `cleaned` transcript version and normalized derivative
segments. Legacy formatted fields remain as a compatibility projection so the
current transcript UI behaves as before; raw segment text is preserved.

## Search, export, and diagnostics

`js/services/retrieval.js` remains the lazy lexical implementation. The new
`js/services/search/search-service.js` contract accepts lexical/semantic modes,
filters, and scope, so semantic retrieval can be added without a view rewrite.
`js/services/export/` defines a schema-versioned archive manifest and a
serializable library export boundary. `js/services/integrity.js` reports
broken references without deleting records. Settings exposes minimal storage,
runtime, and integrity diagnostics.

## Phase 2 transcript workspace

The transcript route keeps `/videos/:id/transcript` as its compatibility URL and
also accepts `/transcript/:id`. It is now a responsive workspace rather than a
text-only page: a navigation rail, transcript center, and intelligence panel
share one normalized Source → Transcript Version → Segment → Speaker graph.
The legacy video/chunk projection is still read when a migrated record has not
yet been hydrated.

`js/services/media/` owns playback state. `PlaybackController` is the single
clock for a source, persists the last position and preferred rate locally, and
can attach to native audio/video. `media-time.js` maps the current time to an
active segment with binary search. The waveform is a non-critical enhancement;
native player controls and transcript-only sources remain usable when media or
waveform metadata is unavailable. Route disposal detaches listeners, timers,
waveform subscriptions, and media resources.

Transcript follow mode is explicit. Playback updates only the active segment;
manual browsing suspends following and exposes a Return to current moment
control. Timestamp buttons and evidence links seek without autoplay. Moment
links use the existing hash route with `start`/`t` query parameters, preserving
router freshness.

Editing is derivative-only. Editing a raw transcript creates an `edited`
version with copied segments and parent/derived lineage; the raw version is
never overwritten. Segment edits retain previous text/change metadata. Speaker
rename, merge, and per-segment reassignment update stable Speaker references.
Notes, highlights, chapters, actions, decisions, and clips are first-class
records with Source/Transcript/Segment provenance.

The intelligence panel uses the existing AI Router and content boundary. The
transcript workspace passes a selection or transcript evidence packet to Ask;
answers are rendered as sanitized text and evidence links resolve back to a
segment and timestamp. Chapter generation is a validated `generate-chapters`
task with a deterministic local grouping fallback. Derived chapters carry the
transcript version so later edits can mark them stale rather than presenting
old analysis as current.

Phase 3 hooks are the normalized segment retrieval scope, provenance links,
topic/entity fields, chapter records, and transcript-scoped AI context. Global
semantic retrieval, cross-transcript entity/speaker intelligence, and collection
knowledge remain intentionally deferred.
