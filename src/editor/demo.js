import { ConflictError, serialize } from './github.js';

const KEY = 'tripbook.demo.files';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};
const write = (files) => localStorage.setItem(KEY, JSON.stringify(files));
const clone = (v) => JSON.parse(JSON.stringify(v));
const newSha = () => `demo-${Math.random().toString(36).slice(2, 10)}`;

/** Fill the fake repo from `{ config, files: { 'drafts/x.json': trip, ... } }` (built by build-editor --demo). */
export function seedDemo(data) {
  const files = {};
  if (data.config) files['config.json'] = { data: data.config, sha: newSha() };
  for (const [path, json] of Object.entries(data.files || {})) files[path] = { data: json, sha: newSha() };
  write(files);
}

export const clearDemo = () => localStorage.removeItem(KEY);

/**
 * In-memory stand-in for the GitHub client (same methods), kept in localStorage.
 * Lets you try Sync, Publish, Delete and conflicts locally without a repo or token.
 */
export function createFakeGithub() {
  const check = (files, path, sha) => {
    const cur = files[path];
    if (cur && sha !== cur.sha) throw new ConflictError();
  };
  return {
    async getRepo() {
      return { default_branch: 'main', full_name: 'demo/trips' };
    },
    async listFolder(folder) {
      return Object.entries(read())
        .filter(([path]) => path.startsWith(`${folder}/`))
        .map(([path, f]) => ({ name: path.slice(folder.length + 1), path, sha: f.sha }));
    },
    async getFile(path) {
      const f = read()[path];
      return f ? { data: clone(f.data), sha: f.sha } : null;
    },
    async putFile(path, json, sha) {
      const files = read();
      check(files, path, sha);
      const next = newSha();
      files[path] = { data: JSON.parse(serialize(json)), sha: next };
      write(files);
      return next;
    },
    async deleteFile(path, sha) {
      const files = read();
      check(files, path, sha);
      delete files[path];
      write(files);
    },
    async moveFile(fromPath, toPath, json, expectedFromSha) {
      const files = read();
      if (!files[fromPath] || files[fromPath].sha !== expectedFromSha) throw new ConflictError();
      delete files[fromPath];
      const next = newSha();
      files[toPath] = { data: JSON.parse(serialize(json)), sha: next };
      write(files);
      return next;
    },
    async dispatchRebuild() {},
  };
}
