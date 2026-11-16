import { readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig, validateTrip } from '../shared/schema.js';
import { tripPath, listingCrumbs, findCollisions } from '../shared/paths.js';
import { renderTripPage } from '../shared/render/trip.js';
import { renderListing, sortedTrips } from '../shared/render/listing.js';
import { renderRedirect } from '../shared/render/redirect.js';
import { renderTripMarkdown } from '../shared/render/trip-md.js';
import { renderLlmsTxt, renderLlmsFull } from '../shared/render/llms.js';
import { renderRobots, renderSitemap } from '../shared/render/seo.js';
import { renderLayout } from '../shared/render/layout.js';
import { bundleJs, bundleCss } from './bundle.mjs';
import { isMain, arg, run, usage } from './cli.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadFolder(dataDir, folder, errors) {
  let names = [];
  try {
    names = (await readdir(join(dataDir, folder))).filter((n) => n.endsWith('.json')).sort();
  } catch {}
  const trips = [];
  for (const name of names) {
    const file = `${folder}/${name}`;
    let trip;
    try {
      trip = await readJson(join(dataDir, folder, name));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${e.message})`);
      continue;
    }
    const problems = validateTrip(trip, file);
    errors.push(...problems);
    if (!problems.length) trips.push({ file, trip });
  }
  return trips;
}

async function write(out, relPath, content) {
  const target = join(out, relPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function buildSite({ data, out, log = console.log }) {
  const version = (await readJson(join(root, 'package.json'))).version;
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  let rawConfig = {};
  try {
    rawConfig = await readJson(join(data, 'config.json'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`config.json: ${e.message}`);
  }
  const config = mergeConfig(rawConfig);

  const errors = [];
  const published = await loadFolder(data, 'published', errors);
  const drafts = await loadFolder(data, 'drafts', errors);
  if (errors.length) {
    throw Object.assign(new Error(`Build failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`), { errors });
  }

  const pub = published.map((p) => ({ ...p, path: tripPath(p.trip, config) }));
  const drf = drafts.map((d) => ({ ...d, path: tripPath(d.trip, config) }));
  const collisions = [...findCollisions(pub), ...findCollisions(drf)];
  if (collisions.length) {
    throw Object.assign(new Error(`Build failed:\n${collisions.map((e) => `  - ${e}`).join('\n')}`), { errors: collisions });
  }

  const assets = await buildAssets(join(out, 'assets'));
  const base = config.base_url || '';

  let mdCount = 0;
  for (const { trip, path } of pub) {
    await write(out, `${path.slice(1)}index.html`, renderTripPage(trip, { config, assets, path, draft: false, version }));
    await write(out, `${path.slice(1)}index.md`, renderTripMarkdown(trip, { config, url: `${base}${path}` }));
    mdCount++;
  }
  for (const { trip, path } of drf) {
    await write(out, `drafts${path}index.html`, renderTripPage(trip, { config, assets, path, draft: true, version }));
  }

  const items = pub.map(({ trip, path }) => ({ trip, path }));
  const listingPaths = new Map([['/', { crumbs: [], heading: config.site_title }]]);
  for (const { trip } of pub) {
    for (const crumb of listingCrumbs(trip, config)) {
      if (!listingPaths.has(crumb.path)) listingPaths.set(crumb.path, { heading: crumb.name, crumbs: null, last: crumb });
    }
  }
  for (const [path, info] of listingPaths) {
    const subset = items.filter((i) => i.path.startsWith(path));
    let crumbs = [];
    if (path !== '/') {
      const sample = subset[0].trip;
      const all = listingCrumbs(sample, config);
      crumbs = all.slice(0, all.findIndex((c) => c.path === path) + 1);
    }
    await write(out, `${path.slice(1)}index.html`, renderListing(subset, { config, assets, version, canonical: `${base}${path}`, crumbs, heading: info.heading }));
  }

  const livePaths = new Set(pub.map((p) => p.path));
  let redirects = 0;
  for (const { trip, path } of pub) {
    for (const old of trip.old_paths) {
      if (livePaths.has(old) || listingPaths.has(old)) continue;
      await write(out, `${old.slice(1)}index.html`, renderRedirect(path));
      redirects++;
    }
  }

  await write(out, '404.html', notFound(config, assets, version));
  await write(out, 'robots.txt', renderRobots(config));
  await write(out, 'sitemap.xml', renderSitemap([...listingPaths.keys(), ...pub.map((p) => p.path)], config));

  if (config.ai_crawlers !== 'disallow') {
    await write(out, 'llms.txt', renderLlmsTxt(sortedTrips(items), { config }));
    await write(out, 'llms-full.txt', renderLlmsFull(items, { config }));
  }

  const summary = { published: pub.length, drafts: drf.length, listings: listingPaths.size, redirects, markdown: mdCount };
  log(`Built site: ${summary.published} published, ${summary.drafts} drafts, ${summary.listings} listing pages, ${summary.redirects} redirects, ${summary.markdown} Markdown files`);
  return summary;
}

/**
 * Bundle the trip page script and the site CSS into out/assets. The CSS is returned as text to inline
 * in every page; its font files are written next to it, and the Latin heading font is preloaded.
 */
async function buildAssets(dir) {
  const js = await bundleJs(join(root, 'src/site/trip/main.js'), dir, 'trip');
  const css = await bundleCss(join(root, 'src/site/site.css'), dir, 'site', { publicPath: '/assets', emitEntry: false });
  const font = css.files.find((f) => /^space-grotesk-700-latin-[^.]+\.woff2$/.test(f) && !f.includes('latin-ext'));
  return { js: `/assets/${js.name}`, cssText: css.text.trim(), font: font && `/assets/${font}` };
}

function notFound(config, assets, version) {
  return renderLayout({
    title: `Not found · ${config.site_title}`,
    robots: 'noindex',
    og: false,
    body: '<main class="listing"><h1>Page not found</h1><p><a href="/">Back to all trips</a></p></main>',
    config,
    assets,
    version,
  });
}

if (isMain(import.meta.url)) {
  const data = arg('data');
  const out = arg('out');
  if (!data || !out) usage('build-site.mjs --data <dir> --out <dir>');
  run(buildSite({ data: resolve(data), out: resolve(out) }));
}
