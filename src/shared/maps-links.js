const BASE = 'https://www.google.com/maps';
const MAX_URL = 2048;
const MAX_SHORTLIST = 20;
const MAX_STOPS_PER_ROUTE = 11; // origin + 9 waypoints + destination

const ll = (s) => `${s.lat},${s.lng}`;

export function shortlistUrl(stops) {
  const ids = stops.filter((s) => s.place_id).map((s) => s.place_id).slice(0, MAX_SHORTLIST);
  if (ids.length === 0) return null;
  return `${BASE}/@?api=1&map_action=shortlist&place_ids=${ids.map(encodeURIComponent).join(',')}`;
}

/** Number of stops a shortlist URL would cover. */
export function shortlistCount(stops) {
  return Math.min(stops.filter((s) => s.place_id).length, MAX_SHORTLIST);
}

function oneDirectionsUrl(stops, withPlaceIds) {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);
  let url = `${BASE}/dir/?api=1&origin=${ll(origin)}&destination=${ll(destination)}`;
  if (waypoints.length) url += `&waypoints=${waypoints.map((s) => encodeURIComponent(ll(s))).join('|')}`;
  url += '&travelmode=walking';
  if (withPlaceIds && stops.every((s) => s.place_id)) {
    url += `&origin_place_id=${encodeURIComponent(origin.place_id)}`;
    url += `&destination_place_id=${encodeURIComponent(destination.place_id)}`;
    if (waypoints.length) url += `&waypoint_place_ids=${waypoints.map((s) => encodeURIComponent(s.place_id)).join('|')}`;
  }
  return url;
}

/**
 * Walking directions through the stops in order.
 * Returns null (fewer than 2 stops), a string, or an array of strings when the
 * route needs several chunks (consecutive chunks share a boundary stop).
 */
export function directionsUrl(stops) {
  if (stops.length < 2) return null;
  const chunks = [];
  for (let i = 0; i < stops.length - 1; i += MAX_STOPS_PER_ROUTE - 1) {
    chunks.push(stops.slice(i, i + MAX_STOPS_PER_ROUTE));
  }
  const urls = chunks.map((chunk) => {
    const full = oneDirectionsUrl(chunk, true);
    return full.length <= MAX_URL ? full : oneDirectionsUrl(chunk, false);
  });
  return urls.length === 1 ? urls[0] : urls;
}

export function stopDirectionsUrl(stop) {
  let url = `${BASE}/dir/?api=1&destination=${ll(stop)}&travelmode=walking`;
  if (stop.place_id) url += `&destination_place_id=${encodeURIComponent(stop.place_id)}`;
  return url;
}

/**
 * The "Open in Google Maps" target for a set of visible stops:
 * the shortlist when it covers at least half of them, else the first directions URL through
 * the on-route stops (routeStops).
 * Returns { url }.
 */
export function openInMaps(stops, routeStops = stops) {
  const list = shortlistUrl(stops);
  if (list && shortlistCount(stops) * 2 >= stops.length) {
    return { url: list };
  }
  const dir = directionsUrl(routeStops);
  const url = Array.isArray(dir) ? dir[0] : dir;
  if (url) return { url };
  return { url: stops.length === 1 ? stopDirectionsUrl(stops[0]) : null };
}
