import { html } from './ui.js';
import { useState, useEffect } from 'preact/hooks';
import { trips, gh, saveRecord, closeModal, showModal, registerConflictHandler, toast, config } from './state.js';
import { fetchRemote, loadTheirs, overwrite, stopCount } from '../sync.js';

function ConflictBody({ id }) {
  const rec = trips.value.get(id);
  const [remote, setRemote] = useState(undefined);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchRemote(gh(), id, rec.folder).then(setRemote, () => setRemote(null));
  }, [id]);

  async function choose(fn, message) {
    setWorking(true);
    try {
      await saveRecord(await fn(gh(), rec, config.value));
      toast(message);
      closeModal();
    } catch (e) {
      toast(`Failed: ${e.message}`);
      setWorking(false);
    }
  }

  return html`<p>This trip changed on GitHub since you last loaded it.</p>
    <table class="compare">
      <tr><th></th><th>This device</th><th>On GitHub</th></tr>
      <tr><td>Title</td><td>${rec.trip.title}</td><td>${remote === undefined ? '…' : remote ? remote.trip.title : 'Not found'}</td></tr>
      <tr><td>Stops</td><td>${stopCount(rec.trip)}</td><td>${remote ? stopCount(remote.trip) : '…'}</td></tr>
    </table>
    <div class="modal-actions">
      <button class="btn" disabled=${working || !remote} onClick=${() => choose(loadTheirs, 'Loaded the GitHub version')}>Load theirs</button>
      <button class="btn btn-danger" disabled=${working} onClick=${() => choose(overwrite, 'Overwrote the GitHub version')}>Overwrite</button>
    </div>`;
}

registerConflictHandler((id) => showModal(() => html`<${ConflictBody} id=${id} />`, { title: 'Sync conflict' }));
