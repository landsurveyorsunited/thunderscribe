// Server-authoritative meeting memory sync.
// Structured memory contains references and metadata only; transcript source
// text remains in the project's existing transcript store.

const schemaPromises = new WeakMap();

function ensureSchema(env) {
  if (!env?.DB || (typeof env !== 'object' && typeof env !== 'function')) throw new Error('Database binding unavailable');
  if (!schemaPromises.has(env)) {
    schemaPromises.set(env, env.DB.exec(`
      CREATE TABLE IF NOT EXISTS meeting_memory_meetings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT,
        title TEXT NOT NULL,
        meeting_type TEXT NOT NULL,
        source_video_id TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        allowed_user_ids TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meeting_memory_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        source_refs TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS meeting_memory_meetings_user_idx ON meeting_memory_meetings(user_id);
      CREATE INDEX IF NOT EXISTS meeting_memory_meetings_visibility_idx ON meeting_memory_meetings(visibility);
      CREATE INDEX IF NOT EXISTS meeting_memory_items_meeting_idx ON meeting_memory_items(meeting_id);
      CREATE INDEX IF NOT EXISTS meeting_memory_items_user_idx ON meeting_memory_items(user_id);
    `));
  }
  return schemaPromises.get(env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      await ensureSchema(env);
    } catch (error) {
      return Response.json({ error: 'Meeting memory is temporarily unavailable' }, { status: 503 });
    }

    const userId = request.headers.get('x-websim-user-id');
    const username = request.headers.get('x-websim-username') || '';

    if (request.method === 'GET' && url.pathname === '/api/meeting-memory') {
      const viewer = userId || '';
      const { results: meetings } = await env.DB.prepare(
        `SELECT * FROM meeting_memory_meetings AS meeting
         WHERE meeting.user_id = ? OR meeting.visibility = 'shared'
         OR (meeting.visibility = 'restricted' AND EXISTS (
           SELECT 1 FROM json_each(meeting.allowed_user_ids) AS allowed
           WHERE allowed.value = ?
         ))
         ORDER BY meeting.updated_at DESC LIMIT 100`
      ).bind(viewer, viewer).all();
      const visibleIds = meetings.map((meeting) => meeting.id);
      let items = [];
      if (visibleIds.length) {
        const placeholders = visibleIds.map(() => '?').join(',');
        const response = await env.DB.prepare(`SELECT * FROM meeting_memory_items WHERE meeting_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...visibleIds).all();
        items = response.results;
      }
      return Response.json({ meetings: meetings.map(decodeMeeting), items: items.map(decodeItem), authenticated: Boolean(userId) });
    }

    if (request.method === 'POST' && url.pathname === '/api/meeting-memory') {
      if (!userId) return Response.json({ error: 'Sign in to save organizational memory' }, { status: 401 });
      const body = await readJsonBody(request);
      if (!body.ok) return Response.json({ error: body.error }, { status: 400 });
      const meeting = normalizeMeeting(body.value?.meeting);
      if (!meeting) return Response.json({ error: 'meeting.id and meeting.sourceVideoId are required' }, { status: 400 });
      const existing = await env.DB.prepare('SELECT user_id FROM meeting_memory_meetings WHERE id = ?').bind(meeting.id).first();
      if (existing && existing.user_id !== userId) return Response.json({ error: 'Meeting is owned by another user' }, { status: 403 });
      const visibility = ['private', 'shared', 'restricted'].includes(meeting.visibility) ? meeting.visibility : 'private';
      const allowed = normalizeUserIds(meeting.allowedUserIds);
      const createdAt = meeting.createdAt || new Date().toISOString();
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO meeting_memory_meetings (id,user_id,username,title,meeting_type,source_video_id,visibility,allowed_user_ids,metadata,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, meeting_type=excluded.meeting_type, visibility=excluded.visibility, allowed_user_ids=excluded.allowed_user_ids, metadata=excluded.metadata, updated_at=excluded.updated_at
         WHERE meeting_memory_meetings.user_id = excluded.user_id`
      ).bind(meeting.id, userId, cleanText(username, 120), meeting.title, meeting.meetingType, meeting.sourceVideoId, visibility, JSON.stringify(allowed), jsonValue(meeting.metadata, {}), createdAt, updatedAt).run();
      const items = Array.isArray(body.value?.items) ? body.value.items.slice(0, 500).map(normalizeItem) : [];
      if (items.some((item) => !item)) return Response.json({ error: 'Each item must include a valid id, kind, and payload' }, { status: 400 });
      if (items.length) {
        await env.DB.batch(items.map((item) => env.DB.prepare(
          `INSERT INTO meeting_memory_items (id,user_id,meeting_id,kind,payload,source_refs,created_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, source_refs=excluded.source_refs, kind=excluded.kind
           WHERE meeting_memory_items.user_id = excluded.user_id AND meeting_memory_items.meeting_id = excluded.meeting_id`
        ).bind(item.id, userId, meeting.id, item.kind, jsonValue(item.payload, {}), JSON.stringify(item.sourceRefs), item.createdAt || updatedAt)));
      }
      return Response.json({ ok: true, meeting: { ...meeting, userId, username, visibility, allowedUserIds: allowed, updatedAt }, itemCount: items.length });
    }

    if (request.method === 'PATCH' && url.pathname === '/api/meeting-memory/access') {
      if (!userId) return Response.json({ error: 'Sign in to manage meeting access' }, { status: 401 });
      const body = await readJsonBody(request);
      if (!body.ok) return Response.json({ error: body.error }, { status: 400 });
      const meetingId = cleanText(body.value?.meetingId, 180);
      if (!meetingId) return Response.json({ error: 'meetingId is required' }, { status: 400 });
      const visibility = ['private', 'shared', 'restricted'].includes(body.value?.visibility) ? body.value.visibility : 'private';
      const allowed = normalizeUserIds(body.value?.allowedUserIds);
      const result = await env.DB.prepare('UPDATE meeting_memory_meetings SET visibility = ?, allowed_user_ids = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(visibility, JSON.stringify(allowed), new Date().toISOString(), meetingId, userId).run();
      return result.meta?.changes ? Response.json({ ok: true, visibility, allowedUserIds: allowed }) : Response.json({ error: 'Meeting not found or not owned by you' }, { status: 404 });
    }

    return new Response('Not found', { status: 404 });
  },
};

function decodeMeeting(row) {
  return { id: row.id, userId: row.user_id, username: row.username, title: row.title, meetingType: row.meeting_type, sourceVideoId: row.source_video_id, visibility: row.visibility, allowedUserIds: parse(row.allowed_user_ids, []), metadata: parse(row.metadata, {}), createdAt: row.created_at, updatedAt: row.updated_at };
}

function decodeItem(row) { return { id: row.id, userId: row.user_id, meetingId: row.meeting_id, kind: row.kind, payload: parse(row.payload, {}), sourceRefs: parse(row.source_refs, []), createdAt: row.created_at }; }
function parse(value, fallback) { try { return JSON.parse(value); } catch (e) { return fallback; } }

async function readJsonBody(request, maxBytes = 2_000_000) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) return { ok: false, error: 'Request body is too large' };
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false, error: 'Request body is too large' };
  try { return { ok: true, value: JSON.parse(text) }; } catch (error) { return { ok: false, error: 'Request body must be valid JSON' }; }
}

function cleanText(value, max = 240) {
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text.slice(0, max);
}

function normalizeUserIds(value) {
  return Array.isArray(value) ? [...new Set(value.map((id) => cleanText(id, 180)).filter(Boolean))].slice(0, 50) : [];
}

function jsonValue(value, fallback, max = 150_000) {
  try {
    const text = JSON.stringify(value && typeof value === 'object' ? value : fallback);
    return text.length <= max ? text : JSON.stringify(fallback);
  } catch (error) {
    return JSON.stringify(fallback);
  }
}

function normalizeMeeting(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id, 180);
  const sourceVideoId = cleanText(value.sourceVideoId, 180);
  if (!id || !sourceVideoId) return null;
  return {
    id,
    sourceVideoId,
    title: cleanText(value.title || 'Untitled meeting', 240) || 'Untitled meeting',
    meetingType: cleanText(value.meetingType || 'meeting', 80) || 'meeting',
    visibility: value.visibility,
    allowedUserIds: value.allowedUserIds,
    metadata: value.metadata,
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
  };
}

function normalizeItem(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id, 240);
  const kind = cleanText(value.kind || 'memory', 80);
  if (!id || !kind || !value.payload || typeof value.payload !== 'object') return null;
  return { id, kind, payload: { schemaVersion: 3, type: kind, ...value.payload }, sourceRefs: Array.isArray(value.sourceRefs) ? value.sourceRefs.map((ref) => cleanText(ref, 180)).filter(Boolean).slice(0, 40) : [], createdAt: cleanText(value.createdAt, 40) || null };
}
