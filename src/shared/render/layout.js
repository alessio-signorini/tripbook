import { escapeHtml as esc } from '../format.js';

function analytics(id) {
  const safe = JSON.stringify(id).replace(/</g, '\\u003c');
  return (
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}"></script>\n` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${safe});</script>`
  );
}

/** Stylesheet: inlined <style> when the build passes the CSS text (no render-blocking request), else a <link>. */
function stylesheet(assets) {
  if (assets.cssText) return `<style>${assets.cssText.replace(/<\/style/gi, '<\\/style')}</style>`;
  return `<link rel="stylesheet" href="${esc(assets.css)}">`;
}

/**
 * Page shell shared by trip, listing and 404 pages.
 * opts: { title, description, lang, canonical, image, body, bodyAttrs, config, draft, robots, markdownHref, jsonld, version,
 *         preconnect: [origin], assets: { css | cssText, font?, js? } }
 * `assets.font` is preloaded (the heading font); `preconnect` warms up third-party origins (Google Maps).
 */
export function renderLayout(opts) {
  const { config, assets, draft = false } = opts;
  const siteName = config.site_title || 'Trips';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(opts.title)}</title>`,
    opts.description != null ? `<meta name="description" content="${esc(opts.description)}">` : '',
    `<meta name="generator" content="tripbook ${esc(opts.version || '')}">`,
    opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : '',
    draft || opts.robots === 'noindex' ? '<meta name="robots" content="noindex">' : '',
    opts.og === false ? '' : openGraph(opts, siteName),
    ...(opts.preconnect || []).map((origin) => `<link rel="preconnect" href="${esc(origin)}" crossorigin>`),
    assets.font ? `<link rel="preload" href="${esc(assets.font)}" as="font" type="font/woff2" crossorigin>` : '',
    stylesheet(assets),
    opts.markdownHref ? `<link rel="alternate" type="text/markdown" href="${esc(opts.markdownHref)}">` : '',
    opts.jsonld ? `<script type="application/ld+json">${opts.jsonld}</script>` : '',
    !draft && config.google_analytics_id ? analytics(config.google_analytics_id) : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html lang="${esc(opts.lang || config.default_lang || 'en')}">
<head>
${head}
</head>
<body${opts.bodyAttrs ? ' ' + opts.bodyAttrs : ''}>
${opts.body}
</body>
</html>
`;
}

function openGraph(opts, siteName) {
  return [
    `<meta property="og:title" content="${esc(opts.title)}">`,
    `<meta property="og:description" content="${esc(opts.description || '')}">`,
    opts.canonical ? `<meta property="og:url" content="${esc(opts.canonical)}">` : '',
    `<meta property="og:site_name" content="${esc(siteName)}">`,
    '<meta property="og:type" content="website">',
    opts.image ? `<meta property="og:image" content="${esc(opts.image)}">` : '',
    `<meta name="twitter:card" content="${opts.image ? 'summary_large_image' : 'summary'}">`,
    opts.image ? `<meta name="twitter:image" content="${esc(opts.image)}">` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export { esc };
