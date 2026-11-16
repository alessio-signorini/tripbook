export const SCHEMA_VERSION = 1;

export const DEFAULT_CONFIG = {
  site_title: 'Trips',
  author: '',
  base_url: '',
  google_maps_api_key: '',
  google_maps_map_id: 'DEMO_MAP_ID',
  google_analytics_id: '',
  time_presets: [15, 30, 40, 60, 90],
  nearby_radius_m: 75,
  nearby_max_results: 10,
  default_kind: 'log',
  default_lang: 'en',
  country_slugs: { US: 'usa', GB: 'uk', AE: 'uae' },
  ai_crawlers: 'allow',
};

export function mergeConfig(config) {
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isStr = (v) => typeof v === 'string';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function isIso(v) {
  return isStr(v) && v !== '' && !Number.isNaN(Date.parse(v));
}

/**
 * Validate a trip. `file` (optional) is the file name, e.g. "pisa.json";
 * used for the id check and the version message.
 * Returns an array of readable error strings (empty when valid).
 */
export function validateTrip(trip, file = '') {
  const errors = [];
  const prefix = file ? `${file}: ` : '';
  const err = (msg) => errors.push(prefix + msg);

  if (!isObj(trip)) {
    err('trip must be a JSON object');
    return errors;
  }

  if (!Number.isInteger(trip.v) || trip.v < 1) {
    err('"v" must be an integer >= 1');
  } else if (trip.v > SCHEMA_VERSION) {
    return [
      `${file}: uses schema v${trip.v}, this tripbook release supports v${SCHEMA_VERSION}. Run scripts/release.sh to update the site build.`,
    ];
  }

  if (!isStr(trip.id) || trip.id === '') err('"id" must be a non-empty string');
  else if (file && trip.id !== file.replace(/^.*\//, '').replace(/\.json$/, '')) {
    err(`"id" (${trip.id}) must equal the file name without .json`);
  }
  if (!isStr(trip.slug) || !SLUG_RE.test(trip.slug)) err('"slug" must be lowercase letters, digits and single dashes');
  if (trip.kind !== 'guide' && trip.kind !== 'log') err('"kind" must be "guide" or "log"');
  if (!isStr(trip.title) || trip.title.trim() === '') err('"title" must be a non-empty string');
  if (!isStr(trip.note)) err('"note" must be a string');
  if (!isStr(trip.lang) || trip.lang === '') err('"lang" must be a non-empty string');

  const loc = trip.location;
  if (!isObj(loc)) {
    err('"location" must be an object');
  } else {
    if (!isStr(loc.country) || loc.country.trim() === '') err('"location.country" must be a non-empty string');
    if (!isStr(loc.country_code) || !(loc.country_code === '' || /^[A-Z]{2}$/.test(loc.country_code))) {
      err('"location.country_code" must be 2 uppercase letters or empty');
    }
    if (!isStr(loc.region)) err('"location.region" must be a string');
    if (!isStr(loc.city)) err('"location.city" must be a string');
  }

  if (trip.photo !== undefined && trip.photo !== null) {
    const ph = trip.photo;
    if (!isObj(ph) || !/^https:\/\//.test(ph.url || '') || !(ph.thumb === undefined || /^https:\/\//.test(ph.thumb))) {
      err('"photo" must be null or an object with an https "url" (and optional https "thumb")');
    } else if (['title', 'author', 'license', 'license_url', 'source_url'].some((k) => ph[k] !== undefined && !isStr(ph[k]))) {
      err('"photo" credit fields must be strings');
    }
  }

  if (!Array.isArray(trip.old_paths) || !trip.old_paths.every((p) => isStr(p) && p.startsWith('/') && p.endsWith('/'))) {
    err('"old_paths" must be an array of strings starting and ending with "/"');
  }

  if (!Array.isArray(trip.sections)) {
    err('"sections" must be an array');
    return errors;
  }

  const sectionIds = new Set();
  const stopIds = new Set();
  trip.sections.forEach((s, si) => {
    const sp = `sections[${si}]`;
    if (!isObj(s)) return err(`${sp} must be an object`);
    if (!isStr(s.id) || s.id === '') err(`${sp}.id must be a non-empty string`);
    else if (sectionIds.has(s.id)) err(`${sp}.id "${s.id}" is used twice`);
    else sectionIds.add(s.id);
    if (!isStr(s.title)) err(`${sp}.title must be a string`);
    if (!isStr(s.note)) err(`${sp}.note must be a string`);
    if (s.style !== 'route' && s.style !== 'list') err(`${sp}.style must be "route" or "list"`);
    if (!(s.auto_date === null || (isStr(s.auto_date) && DATE_RE.test(s.auto_date)))) {
      err(`${sp}.auto_date must be YYYY-MM-DD or null`);
    }
    if (!Array.isArray(s.stops)) return err(`${sp}.stops must be an array`);
    s.stops.forEach((p, pi) => {
      const pp = `${sp}.stops[${pi}]`;
      if (!isObj(p)) return err(`${pp} must be an object`);
      if (!isStr(p.id) || p.id === '') err(`${pp}.id must be a non-empty string`);
      else if (stopIds.has(p.id)) err(`${pp}.id "${p.id}" is used twice`);
      else stopIds.add(p.id);
      if (!isStr(p.name) || p.name.trim() === '') err(`${pp}.name must be a non-empty string`);
      if (!(typeof p.lat === 'number' && p.lat >= -90 && p.lat <= 90)) err(`${pp}.lat must be a number between -90 and 90`);
      if (!(typeof p.lng === 'number' && p.lng >= -180 && p.lng <= 180)) err(`${pp}.lng must be a number between -180 and 180`);
      if (!(p.place_id === null || isStr(p.place_id))) err(`${pp}.place_id must be a string or null`);
      if (!['device', 'place', 'pin'].includes(p.coords_source)) err(`${pp}.coords_source must be "device", "place" or "pin"`);
      if (!(p.minutes === null || (Number.isInteger(p.minutes) && p.minutes > 0))) err(`${pp}.minutes must be a positive integer or null`);
      if (!(p.leg_to_next === null || isStr(p.leg_to_next))) err(`${pp}.leg_to_next must be a string or null`);
      if (!isStr(p.note)) err(`${pp}.note must be a string`);
      if (!(p.rating === null || (Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 5))) err(`${pp}.rating must be an integer 1-5 or null`);
      if (!(p.captured_at === null || isIso(p.captured_at))) err(`${pp}.captured_at must be an ISO date string or null`);
    });
  });

  return errors;
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function newStop(fields = {}) {
  return {
    id: `p-${crypto.randomUUID().slice(0, 8)}`,
    place_id: null,
    name: '',
    address: '',
    city: '',
    region: '',
    country: '',
    country_code: '',
    lat: 0,
    lng: 0,
    coords_source: 'pin',
    minutes: null,
    leg_to_next: null,
    note: '',
    rating: null,
    captured_at: null,
    ...fields,
  };
}

export function newSection(fields = {}) {
  return {
    id: `s-${crypto.randomUUID().slice(0, 8)}`,
    title: '',
    note: '',
    style: 'list',
    auto_date: null,
    stops: [],
    ...fields,
  };
}

export function newTrip(fields = {}, config = DEFAULT_CONFIG) {
  const now = nowIso();
  return {
    v: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    slug: '',
    kind: config.default_kind || 'log',
    title: '',
    note: '',
    lang: config.default_lang || 'en',
    location: { country: '', country_code: '', region: '', city: '' },
    photo: null,
    old_paths: [],
    sections: [],
    created_at: now,
    updated_at: now,
    ...fields,
  };
}
