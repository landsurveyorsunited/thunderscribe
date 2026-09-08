// Runtime orchestration boundary. Views depend on this contract, not on
// individual plugin implementations, so remote adapters can be swapped later.

import { PLUGIN_MAP, pluginStatus } from '../plugins/registry.js';

const LOG_KEY = 'thunderscribe:plugin-events';
function readLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } }
export function getRuntimeStatus() { return pluginStatus(); }
export function getRecentEvents() { return readLog().slice(-12).reverse(); }

export function emitPluginEvent(type, payload = {}) {
  const event = { id: crypto.randomUUID?.() || String(Date.now()), at: new Date().toISOString(), type, ...payload };
  localStorage.setItem(LOG_KEY, JSON.stringify([...readLog(), event].slice(-60)));
  window.dispatchEvent(new CustomEvent('thunderscribe:plugin-event', { detail: event }));
  return event;
}

export async function runDryPipeline(source = 'sample-recording.wav') {
  const sequence = [
    ['ws-audio-transcribe-recording', 'accepted'],
    ['ws-audio-speech-detector', 'speech intervals detected'],
    ['ws-audio-transcript-noise-repair', 'interference report attached'],
    ['ws-audio-transcript-punctuation', 'editorial punctuation restored'],
    ['ws-audio-transcript-cleanup', 'filler and repetition pass complete'],
    ['ws-audio-transcript-structured-rewriter', 'structured notes generated'],
    ['ws-audio-transcript-meeting-summary', 'executive summary generated'],
    ['ws-audio-transcript-action-items', 'action register generated'],
    ['ws-audio-transcript-quote-extractor', 'evidence quotes indexed'],
    ['ws-audio-transcript-caption-exporter', 'VTT export staged'],
  ];
  emitPluginEvent('pipeline.started', { source, mode: 'dry-run' });
  for (const [pluginId, message] of sequence) {
    const plugin = PLUGIN_MAP.get(pluginId);
    await new Promise((resolve) => setTimeout(resolve, 90));
    emitPluginEvent('plugin.completed', { pluginId, label: plugin?.name, message, mode: 'dry-run' });
  }
  return emitPluginEvent('pipeline.completed', { source, mode: 'dry-run', outputs: ['structured-notes', 'executive-summary', 'action-register', 'quotes', 'vtt'] });
}
