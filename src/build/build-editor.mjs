import { readFile, readdir, rm, mkdir, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { bundleJs, bundleCss, hash } from './bundle.mjs';
import { isMain, arg, flag, run, usage } from './cli.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await listFiles(join(dir, e.name), `${prefix}${e.name}/`)));
    else out.push(`${prefix}${e.name}`);
  }
  return out;
}

export async function buildEditor({ out, demo = false, log = console.log }) {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const src = join(root, 'src/editor');

  const js = (await bundleJs(join(src, 'main.js'), out, 'app', { splitting: true })).name;
  const css = (await bundleCss(join(src, 'editor.css'), out, 'editor')).name;
  // Preview renders a trip page in an iframe with the site's own script and stylesheet.
  const tripJs = (await bundleJs(join(root, 'src/site/trip/main.js'), join(out, 'preview'), 'trip')).name;
  const siteCss = (await bundleCss(join(root, 'src/site/site.css'), join(out, 'preview'), 'site', { publicPath: '/preview' })).name;

  const index = (await readFile(join(src, 'index.html'), 'utf8')).replace('{{CSS}}', css).replace('{{JS}}', js);
  await writeFile(join(out, 'index.html'), index);
  await cp(join(src, 'manifest.webmanifest'), join(out, 'manifest.webmanifest'));
  if (existsSync(join(src, 'icons'))) await cp(join(src, 'icons'), join(out, 'icons'), { recursive: true });

  const build = { version: pkg.version, commit: commit(), preview: { trip_js: `preview/${tripJs}`, site_css: `preview/${siteCss}` } };
  await writeFile(join(out, 'build.json'), JSON.stringify(build, null, 2) + '\n');
  await writeFile(join(out, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/"><script>location.replace("/")</script>\n');

  if (demo) {
    const data = join(root, 'examples/data');
    const payload = { config: JSON.parse(await readFile(join(data, 'config.json'), 'utf8')), files: {} };
    for (const folder of ['drafts', 'published']) {
      for (const name of (await readdir(join(data, folder))).filter((n) => n.endsWith('.json'))) {
        payload.files[`${folder}/${name}`] = JSON.parse(await readFile(join(data, folder, name), 'utf8'));
      }
    }
    await mkdir(join(out, 'demo'), { recursive: true });
    await writeFile(join(out, 'demo/data.json'), JSON.stringify(payload));
  }

  const files = (await listFiles(out)).filter((f) => f !== 'sw.js' && f !== '404.html' && !f.endsWith('.map') && !f.startsWith('demo/')).sort();
  const shell = ['/', ...files.map((f) => `/${f}`)];
  const version = hash(files.join('\n'));
  const sw = (await readFile(join(src, 'sw.js'), 'utf8')).replace('__CACHE_VERSION__', `tripbook-${version}`).replace('__SHELL__', JSON.stringify(shell, null, 2));
  await writeFile(join(out, 'sw.js'), sw);

  log(`Built editor ${build.version} (${build.commit}): ${files.length + 1} files`);
  return build;
}

if (isMain(import.meta.url)) {
  const out = arg('out');
  if (!out) usage('build-editor.mjs --out <dir> [--demo]');
  run(buildEditor({ out: resolve(out), demo: flag('demo') }));
}
