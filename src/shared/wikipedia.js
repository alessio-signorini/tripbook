const API = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

async function call(base, params, fetchImpl) {
  const qs = new URLSearchParams({ action: 'query', format: 'json', origin: '*', redirects: '1', ...params });
  const res = await fetchImpl(`${base}?${qs}`);
  if (!res.ok) throw new Error(`Wikipedia request failed (${res.status})`);
  return res.json();
}

const firstPage = (data) => Object.values(data?.query?.pages || {})[0];
const stripTags = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Look up the lead image of a Wikipedia article plus its author and licence.
 * Returns { url, thumb, title, author, license, license_url, source_url } or null when
 * the article has no image. Throws on network errors.
 */
export async function findWikipediaPhoto(title, fetchImpl = fetch) {
  const query = String(title || '').trim();
  if (!query) return null;
  const [big, small] = await Promise.all(
    [1200, 240].map((size) =>
      call(API, { prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: String(size), titles: query }, fetchImpl),
    ),
  );
  const page = firstPage(big);
  const file = page?.pageimage;
  if (!page || !page.thumbnail || !file) return null;

  let author = '';
  let license = '';
  let licenseUrl = '';
  try {
    const info = await call(COMMONS, { prop: 'imageinfo', iiprop: 'extmetadata', titles: `File:${file}` }, fetchImpl);
    const meta = firstPage(info)?.imageinfo?.[0]?.extmetadata || {};
    author = stripTags(meta.Artist?.value);
    license = stripTags(meta.LicenseShortName?.value);
    licenseUrl = stripTags(meta.LicenseUrl?.value);
  } catch {
    // The photo is still usable; credits can be filled in by hand.
  }

  return {
    url: page.thumbnail.source,
    thumb: firstPage(small)?.thumbnail?.source || page.thumbnail.source,
    title: page.title,
    author,
    license,
    license_url: /^https?:\/\//.test(licenseUrl) ? licenseUrl : '',
    source_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
  };
}
