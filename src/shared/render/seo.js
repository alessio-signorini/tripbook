/** Crawlers listed in robots.txt when config.ai_crawlers is "disallow". */
export const AI_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'Google-Extended', 'CCBot', 'PerplexityBot', 'Applebot-Extended', 'Bytespider', 'meta-externalagent',
];

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** robots.txt: drafts are never crawled; AI crawlers blocked when configured; sitemap link. */
export function renderRobots(config) {
  let robots = 'User-agent: *\nDisallow: /drafts/\n';
  if (config.ai_crawlers === 'disallow') {
    for (const agent of AI_AGENTS) robots += `\nUser-agent: ${agent}\nDisallow: /\n`;
  }
  return `${robots}\nSitemap: ${config.base_url || ''}/sitemap.xml\n`;
}

/** sitemap.xml for the given site paths. No <lastmod>: dates are private. */
export function renderSitemap(paths, config) {
  const base = config.base_url || '';
  const urls = paths.map((p) => `  <url><loc>${xml(base + p)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
