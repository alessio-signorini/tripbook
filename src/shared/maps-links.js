const BASE = 'https://www.google.com/maps';
const MAX_URL = 2048;
const MAX_STOPS_PER_ROUTE = 11; // origin + 9 waypoints + destination

const ll = (s) => `${s.lat},${s.lng}`;

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
 * Walking directions through the stops in order, as an array of URLs: [] for fewer than 2 stops,
 * one URL for up to 11 stops, several when the route is split (consecutive parts share a boundary stop).
 */
export function directionsUrl(stops) {
  if (stops.length < 2) return [];
  const chunks = [];
  for (let i = 0; i < stops.length - 1; i += MAX_STOPS_PER_ROUTE - 1) {
    chunks.push(stops.slice(i, i + MAX_STOPS_PER_ROUTE));
  }
  return chunks.map((chunk) => {
    const full = oneDirectionsUrl(chunk, true);
    return full.length <= MAX_URL ? full : oneDirectionsUrl(chunk, false);
  });
}

/** Section route links: [{ url, label }] labelled "Route in Google Maps", or "Part 1", "Part 2"… when split. */
export function routeLinks(stops) {
  const urls = directionsUrl(stops);
  return urls.map((url, i) => ({ url, label: urls.length > 1 ? `Part ${i + 1}` : 'Route in Google Maps' }));
}

export function stopDirectionsUrl(stop) {
  let url = `${BASE}/dir/?api=1&destination=${ll(stop)}&travelmode=walking`;
  if (stop.place_id) url += `&destination_place_id=${encodeURIComponent(stop.place_id)}`;
  return url;
}

/**
 * The "Open in Google Maps" target for the on-route visible stops (off-route ones are excluded):
 * walking directions through every stop in order, so the user can press Start. Routes beyond
 * 11 stops are split (see directionsUrl); this returns the first part, and the per-section
 * "Part N" links cover the rest. A single stop opens directions to it.
 * Returns { url }.
 */
export function openInMaps(routeStops) {
  const [first] = directionsUrl(routeStops);
  if (first) return { url: first };
  return { url: routeStops.length === 1 ? stopDirectionsUrl(routeStops[0]) : null };
}
