import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const hash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

async function bundle(entry, outDir, baseName, ext, extra = {}) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    write: false,
    outdir: 'out',
    logLevel: 'silent',
    ...extra,
  });
  const file = result.outputFiles.find((f) => f.path.endsWith(`.${ext}`));
  const name = `${baseName}.${hash(file.contents)}.${ext}`;
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, name), file.contents);
  return name;
}

export const bundleJs = (entry, outDir, baseName) =>
  bundle(entry, outDir, baseName, 'js', { format: 'esm', target: 'es2020' });

export const bundleCss = (entry, outDir, baseName) =>
  bundle(entry, outDir, baseName, 'css', { target: 'es2020' });
