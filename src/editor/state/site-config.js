import { configRec } from './signals.js';
import { toast } from './ui.js';
import { gh } from './connection.js';
import { saveConfigRecord } from '../core/store.js';

/** Commit config.json. Throws ConflictError when `sha` is stale. */
export async function pushConfig(cfg, sha) {
  const newSha = await gh().putFile('config.json', cfg, sha, 'Config: update');
  const rec = { config: cfg, sha: newSha };
  configRec.value = rec;
  await saveConfigRecord(rec);
}

export async function pullConfig() {
  const f = await gh().getFile('config.json');
  const rec = f ? { config: f.data, sha: f.sha } : { config: {}, sha: null };
  configRec.value = rec;
  await saveConfigRecord(rec);
  return rec;
}

/** Trigger the data repo's site workflow (needs a token with Actions: Read and write). */
export async function rebuildSite() {
  try {
    await gh().dispatchRebuild();
    toast('Rebuild started. The site updates in about a minute.');
  } catch (e) {
    toast(e.message);
  }
}
