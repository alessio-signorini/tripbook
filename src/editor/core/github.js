export class ConflictError extends Error {
  constructor(message = 'The file changed on GitHub since it was last loaded.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class GithubError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GithubError';
    this.status = status;
  }
}

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n';

const API = 'https://api.github.com';

/** Only config.json, drafts/*.json and published/*.json at the repo root are ever touched. */
export function createGithub({ owner, repo, branch, token }) {
  const base = `${API}/repos/${owner}/${repo}`;
  let currentBranch = branch;

  async function request(method, url, body) {
    const res = await globalThis.fetch(url.startsWith('http') ? url : base + url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.status === 204 ? null : res.json();
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      message = (await res.json()).message || message;
    } catch {}
    throw new GithubError(res.status, message);
  }

  const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const isShaMismatch = (e) => e.status === 409 || (e.status === 422 && /sha|does not match/i.test(e.message));

  const api = {
    async getRepo() {
      const r = await request('GET', '');
      currentBranch = currentBranch || r.default_branch;
      return { default_branch: r.default_branch, full_name: r.full_name };
    },

    async listFolder(folder) {
      try {
        const items = await request('GET', `/contents/${folder}?ref=${encodeURIComponent(currentBranch)}`);
        return items.filter((i) => i.type === 'file' && i.name.endsWith('.json')).map((i) => ({ name: i.name, path: i.path, sha: i.sha }));
      } catch (e) {
        if (e.status === 404) return [];
        throw e;
      }
    },

    /** Returns { data, sha } or null when the file does not exist. */
    async getFile(path) {
      try {
        const f = await request('GET', `/contents/${encodePath(path)}?ref=${encodeURIComponent(currentBranch)}`);
        return { data: JSON.parse(fromBase64(f.content)), sha: f.sha };
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    async putFile(path, json, sha, message) {
      try {
        const r = await request('PUT', `/contents/${encodePath(path)}`, {
          message,
          content: toBase64(serialize(json)),
          branch: currentBranch,
          ...(sha ? { sha } : {}),
        });
        return r.content.sha;
      } catch (e) {
        if (e instanceof GithubError && isShaMismatch(e)) throw new ConflictError();
        throw e;
      }
    },

    async deleteFile(path, sha, message) {
      try {
        await request('DELETE', `/contents/${encodePath(path)}`, { message, sha, branch: currentBranch });
      } catch (e) {
        if (e instanceof GithubError && isShaMismatch(e)) throw new ConflictError();
        throw e;
      }
    },

    /** Move a file between folders in a single commit. Returns the new sha of toPath. */
    async moveFile(fromPath, toPath, json, expectedFromSha, message) {
      const ref = await request('GET', `/git/ref/heads/${encodeURIComponent(currentBranch)}`);
      const commit = await request('GET', `/git/commits/${ref.object.sha}`);
      const current = await api.getFile(fromPath);
      if (expectedFromSha ? !current || current.sha !== expectedFromSha : current) throw new ConflictError();
      const entries = [{ path: toPath, mode: '100644', type: 'blob', content: serialize(json) }];
      if (current) entries.push({ path: fromPath, mode: '100644', type: 'blob', sha: null });
      const tree = await request('POST', '/git/trees', { base_tree: commit.tree.sha, tree: entries });
      const created = await request('POST', '/git/commits', { message, tree: tree.sha, parents: [ref.object.sha] });
      await request('PATCH', `/git/refs/heads/${encodeURIComponent(currentBranch)}`, { sha: created.sha });
      return (await api.getFile(toPath)).sha;
    },

    async dispatchRebuild() {
      try {
        await request('POST', '/actions/workflows/site.yml/dispatches', { ref: currentBranch });
      } catch (e) {
        if (e.status === 403 || e.status === 404) throw new GithubError(403, 'Token lacks Actions permission');
        throw e;
      }
    },
  };
  return api;
}
