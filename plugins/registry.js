// Integration manifest for the transcript processing stack.
// Adapters expose a stable contract and can hand off to a WebSim bridge when present.

export const PIPELINE_STAGES = [
  { id: 'ingest', label: 'Ingest', detail: 'Files, recordings, and live sources' },
  { id: 'repair', label: 'Repair', detail: 'Speech activity and interference cleanup' },
  { id: 'shape', label: 'Shape', detail: 'Punctuation, structure, and scene context' },
  { id: 'assist', label: 'Assist', detail: 'Summaries, actions, quotes, and translation' },
  { id: 'publish', label: 'Publish', detail: 'Captions, notes, and review packages' },
  { id: 'observe', label: 'Observe', detail: 'Events, health, and rollback signals' },
];

export const PLUGINS = [
  { id: 'ws-audio-speech-detector', name: 'Speech detector', category: 'Audio', stage: 'repair', role: 'Voice activity detection for recordings and voice chat.', command: '/add ws-audio-speech-detector --threshold=0.6', inputs: 'Audio frames', outputs: 'Speech intervals', tone: 'teal' },
  { id: 'ws-audio-transcript-noise-repair', name: 'Noise repair', category: 'Audio', stage: 'repair', role: 'Flags overlap, silence, music, and environmental interference.', command: '/add ws-audio-transcript-noise-repair --profile=field-recording', inputs: 'Audio + raw text', outputs: 'Repair report', tone: 'teal' },
  { id: 'ws-music-ml', name: 'Music ML', category: 'Audio', stage: 'assist', role: 'Optional ambient beds and style-transfer utilities.', command: '/add ws-music-ml --style=ambient', inputs: 'Audio / style', outputs: 'Music asset', tone: 'violet' },
  { id: 'ws-voice-chat', name: 'Voice chat', category: 'Audio', stage: 'ingest', role: 'Low-latency spatial voice input.', command: '/add ws-voice-chat --bandwidth=64', inputs: 'Live voice', outputs: 'Audio stream', tone: 'teal' },
  { id: 'ws-audio-mixer-console', name: 'Mixer console', category: 'Audio', stage: 'repair', role: 'Balances multiple sources and busses before analysis.', command: '/add ws-audio-mixer-console --busses=4', inputs: 'Audio sources', outputs: 'Mixed stems', tone: 'teal' },
  { id: 'ws-server-sync', name: 'Server sync', category: 'Networking', stage: 'observe', role: 'Deterministic state sync and rollback for collaborative runs.', command: '/add ws-server-sync --tick=30', inputs: 'Pipeline events', outputs: 'Synced state', tone: 'violet' },
  { id: 'ws-audio-video-transcriber', name: 'Video transcriber', category: 'Audio', stage: 'ingest', role: 'Extracts selected video tracks with preserved timecodes.', command: '/add ws-audio-video-transcriber --video=webinar.mp4 --track=main-audio', inputs: 'Video file', outputs: 'Timed transcript', tone: 'amber' },
  { id: 'ws-audio-transcribe-recording', name: 'Recording transcriber', category: 'Audio', stage: 'ingest', role: 'Transcribes uploads with timestamps and language hints.', command: '/add ws-audio-transcribe-recording --source=interview.wav --lang=auto', inputs: 'Audio file', outputs: 'Timed transcript', tone: 'amber' },
  { id: 'ws-audio-transcript-video-scene-index', name: 'Scene index', category: 'Audio', stage: 'shape', role: 'Links transcript segments to scenes, slides, OCR, and visual events.', command: '/add ws-audio-transcript-video-scene-index --signals=scenes,slides,ocr', inputs: 'Video + transcript', outputs: 'Scene index', tone: 'violet' },
  { id: 'ws-audio-synthesizer', name: 'Audio synthesizer', category: 'Audio', stage: 'assist', role: 'Real-time synthesis with filters and effects.', command: '/add ws-audio-synthesizer --preset=ambient-pad --bpm=60', inputs: 'Control events', outputs: 'Audio stream', tone: 'violet' },
  { id: 'ws-voice-synthesis', name: 'Voice synthesis', category: 'Audio', stage: 'publish', role: 'Multilingual text-to-speech for accessible playback.', command: '/add ws-voice-synthesis --lang=en-US --voice=neutral', inputs: 'Approved text', outputs: 'Voice track', tone: 'violet' },
  { id: 'ws-audio-transcript-translation', name: 'Translation', category: 'Audio', stage: 'assist', role: 'Translates while preserving speakers, timestamps, and terminology.', command: '/add ws-audio-transcript-translation --target=es --layout=bilingual', inputs: 'Structured transcript', outputs: 'Bilingual transcript', tone: 'amber' },
  { id: 'ws-audio-transcript-caption-exporter', name: 'Caption exporter', category: 'Audio', stage: 'publish', role: 'Exports SRT, WebVTT, TTML, and accessible caption packages.', command: '/add ws-audio-transcript-caption-exporter --format=vtt --maxChars=42', inputs: 'Reviewed transcript', outputs: 'Caption package', tone: 'amber' },
  { id: 'ws-video-caption-generator', name: 'Caption generator', category: 'Video Generation', stage: 'publish', role: 'Generates accurate captions with speaker labels.', command: '/add ws-video-caption-generator --lang=en', inputs: 'Video audio', outputs: 'Labeled captions', tone: 'amber' },
  { id: 'ws-audio-transcript-punctuation', name: 'Punctuation', category: 'Audio', stage: 'shape', role: 'Restores casing, punctuation, paragraphs, and sentence boundaries.', command: '/add ws-audio-transcript-punctuation --style=editorial', inputs: 'Raw transcript', outputs: 'Readable transcript', tone: 'teal' },
  { id: 'ws-audio-transcript-structured-rewriter', name: 'Structured rewriter', category: 'Audio', stage: 'shape', role: 'Creates headings and coherent paragraphs while retaining timestamps.', command: '/add ws-audio-transcript-structured-rewriter --schema=structured-notes --tone=clear-neutral', inputs: 'Clean transcript', outputs: 'Structured notes', tone: 'teal' },
  { id: 'ws-audio-transcript-cleanup', name: 'Transcript cleanup', category: 'Audio', stage: 'repair', role: 'Removes filler, false starts, repetitions, and artifacts.', command: '/add ws-audio-transcript-cleanup --level=editorial --preserve=quotes,uncertainty', inputs: 'Raw transcript', outputs: 'Clean transcript', tone: 'teal' },
  { id: 'ws-audio-transcript-meeting-summary', name: 'Meeting summary', category: 'Audio', stage: 'assist', role: 'Produces executive overviews, decisions, context, and open questions.', command: '/add ws-audio-transcript-meeting-summary --format=executive', inputs: 'Structured transcript', outputs: 'Executive summary', tone: 'amber' },
  { id: 'ws-audio-transcript-action-items', name: 'Action items', category: 'Audio', stage: 'assist', role: 'Extracts owners, deadlines, and follow-ups with evidence timestamps.', command: '/add ws-audio-transcript-action-items --strictness=conservative', inputs: 'Structured transcript', outputs: 'Action register', tone: 'amber' },
  { id: 'ws-audio-transcript-quote-extractor', name: 'Quote extractor', category: 'Audio', stage: 'assist', role: 'Finds notable, evidence-rich passages with speaker attribution.', command: '/add ws-audio-transcript-quote-extractor --criteria=insightful,verbatim', inputs: 'Transcript + speakers', outputs: 'Quote set', tone: 'amber' },
];

export const PLUGIN_MAP = new Map(PLUGINS.map((plugin) => [plugin.id, plugin]));
export function pluginsForStage(stage) { return PLUGINS.filter((plugin) => plugin.stage === stage); }
export function pluginStatus() {
  let runtime = null;
  try { runtime = window.websim || null; } catch (e) { runtime = null; }
  const bridge = runtime?.plugins;
  const getPlugin = bridge && typeof bridge.get === 'function' ? (id) => bridge.get(id) : () => null;
  return { websim: Boolean(runtime), bridge: Boolean(bridge), configured: PLUGINS.length, connected: bridge ? PLUGINS.filter((plugin) => Boolean(bridge[plugin.id] || getPlugin(plugin.id))).length : 0 };
}
