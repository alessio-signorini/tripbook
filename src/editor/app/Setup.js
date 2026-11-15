import { html } from './ui.js';
import { useState } from 'preact/hooks';
import { settings, saveConnection, navigate, toast, refresh } from './state.js';
import { createGithub } from '../github.js';

export function Setup() {
  const s = settings.value;
  const [slug, setSlug] = useState(s.owner && s.repo ? `${s.owner}/${s.repo}` : '');
  const [token, setToken] = useState(s.token);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState(null);
  const [working, setWorking] = useState(false);

  const parse = () => {
    const m = slug.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
    return m ? { owner: m[1], repo: m[2] } : null;
  };

  async function test() {
    const target = parse();
    if (!target) return setResult({ ok: false, message: 'Enter the data repo as owner/name.' });
    if (!token.trim()) return setResult({ ok: false, message: 'Enter your token.' });
    setWorking(true);
    try {
      const gh = createGithub({ ...target, branch: '', token: token.trim() });
      const repo = await gh.getRepo();
      const drafts = await gh.listFolder('drafts');
      const cfg = await gh.getFile('config.json');
      setResult({ ok: true, branch: repo.default_branch, message: `Connected to ${repo.full_name} (${repo.default_branch}). ${drafts.length} drafts, config.json ${cfg ? 'found' : 'not found'}.` });
    } catch (e) {
      setResult({ ok: false, message: e.status === 401 ? 'GitHub rejected the token.' : e.status === 404 ? 'Repo not found, or the token cannot see it.' : e.message });
    } finally {
      setWorking(false);
    }
  }

  async function save() {
    if (!result?.ok) return;
    saveConnection({ ...parse(), branch: result.branch, token: token.trim() });
    toast('Saved');
    navigate('#/');
    refresh();
  }

  return html`<section class="screen">
    <h1>Connect your data repo</h1>
    <p class="hint">Your trips are stored as JSON files in a private GitHub repo. The token stays on this device and is only sent to api.github.com.</p>
    <label class="field"><span>Data repo</span>
      <input type="text" placeholder="you/trips" value=${slug} autocapitalize="none" autocomplete="off" onInput=${(e) => { setSlug(e.target.value); setResult(null); }} />
    </label>
    <div class="field"><span>Token</span>
      <div class="row">
        <input type=${show ? 'text' : 'password'} aria-label="Token" value=${token} autocomplete="off" onInput=${(e) => { setToken(e.target.value); setResult(null); }} />
        <button class="btn" type="button" onClick=${() => setShow(!show)}>${show ? 'Hide' : 'Show'}</button>
      </div>
    </div>
    <p class="hint">Create a fine-grained token at <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.
      Repository access: only your data repo. Contents: Read and write. Optional Actions: Read and write (for the Rebuild button).</p>
    <div class="row">
      <button class="btn" onClick=${test} disabled=${working}>${working ? 'Testing…' : 'Test connection'}</button>
      <button class="btn btn-primary" onClick=${save} disabled=${!result?.ok}>Save</button>
    </div>
    ${result && html`<p class=${result.ok ? 'ok' : 'error'} role="status">${result.message}</p>`}
  </section>`;
}
