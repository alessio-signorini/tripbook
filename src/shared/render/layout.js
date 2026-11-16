import { escapeHtml as esc } from '../format.js';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap';

function analytics(id) {
  const safe = JSON.stringify(id).replace(/</g, '\\u003c');
  return (
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}"></script>\n` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${safe});</script>`
  );
}

/**
 * Page shell.
 * opts: { title, description, lang, canonical, body, bodyAttrs, config, assets:{css,js},
 *         draft, kind: 'trip'|'listing', markdownHref, jsonld, version }
 */
export function renderLayout(opts) {
  const { config, assets, draft = false } = opts;
  const siteName = config.site_title || 'Trips';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(opts.title)}</title>`,
    `<meta name="description" content="${esc(opts.description || '')}">`,
    `<meta name="generator" content="tripbook ${esc(opts.version || '')}">`,
    opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : '',
    draft ? '<meta name="robots" content="noindex">' : '',
    `<meta property="og:title" content="${esc(opts.title)}">`,
    `<meta property="og:description" content="${esc(opts.description || '')}">`,
    opts.canonical ? `<meta property="og:url" content="${esc(opts.canonical)}">` : '',
    `<meta property="og:site_name" content="${esc(siteName)}">`,
    '<meta property="og:type" content="website">',
    opts.image ? `<meta property="og:image" content="${esc(opts.image)}">` : '',
    `<meta name="twitter:card" content="${opts.image ? 'summary_large_image' : 'summary'}">`,
    opts.image ? `<meta name="twitter:image" content="${esc(opts.image)}">` : '',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${FONTS}">`,
    `<link rel="stylesheet" href="${esc(assets.css)}">`,
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

export { esc };
