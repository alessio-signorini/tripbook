import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, relative, parse } from 'node:path';

export const hash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

/**
 * Bundle and minify one entry with esbuild into `outDir`.
 * The entry is written as `<baseName>.<hash8>.<ext>`. Extra outputs keep esbuild's names:
 * code-split chunks in `chunks/`, and files referenced from CSS (fonts) as `<name>-<hash>.<ext>`.
 * With `emitEntry: false` the entry is not written (its text is inlined by the caller).
 * Returns { name, text, files }: entry file name, entry contents, every written path (relative to outDir).
 */
async function bundle(entry, outDir, baseName, ext, { emitEntry = true, ...options } = {}) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    write: false,
    outdir: outDir,
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: '[name]-[hash]',
    logLevel: 'silent',
    ...options,
  });
  const entryOut = join(outDir, `${parse(entry).name}.${ext}`);
  let name = '';
  let text = '';
  const files = [];
  for (const file of result.outputFiles) {
    let rel = relative(outDir, file.path);
    if (file.path === entryOut) {
      name = rel = `${baseName}.${hash(file.contents)}.${ext}`;
      text = file.text;
      if (!emitEntry) continue;
    }
    await mkdir(dirname(join(outDir, rel)), { recursive: true });
    await writeFile(join(outDir, rel), file.contents);
    files.push(rel);
  }
  return { name, text, files };
}

/** ES module bundle. `splitting: true` turns dynamic import() targets into lazy chunks. */
export const bundleJs = (entry, outDir, baseName, { splitting = false } = {}) =>
  bundle(entry, outDir, baseName, 'js', { format: 'esm', target: 'es2020', splitting });

/** CSS bundle (@import inlined, fonts copied). `publicPath` makes url() references absolute, e.g. '/assets'. */
export const bundleCss = (entry, outDir, baseName, { publicPath, emitEntry = true } = {}) =>
  bundle(entry, outDir, baseName, 'css', { emitEntry, target: 'es2020', loader: { '.woff2': 'file' }, ...(publicPath ? { publicPath } : {}) });
