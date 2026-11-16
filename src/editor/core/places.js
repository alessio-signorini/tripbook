import { loadMaps } from '../../shared/maps-loader.js';

const FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents', 'primaryTypeDisplayName'];

export function distanceM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** components: [{ long, short, types }] -> { city, region, country, country_code } */
export function fromComponents(components = []) {
  const find = (type) => components.find((c) => c.types.includes(type));
  const city = find('locality') || find('postal_town') || find('administrative_area_level_3') || find('administrative_area_level_2');
  return {
    city: city?.long || '',
    region: find('administrative_area_level_1')?.long || '',
    country: find('country')?.long || '',
    country_code: find('country')?.short || '',
  };
}

const latLng = (l) => ({ lat: typeof l.lat === 'function' ? l.lat() : l.lat, lng: typeof l.lng === 'function' ? l.lng() : l.lng });

/** A Places API (New) Place -> stop fields (plus display-only `type`). */
export function mapPlace(place) {
  const pos = latLng(place.location);
  return {
    place_id: place.id,
    name: place.displayName || '',
    address: place.formattedAddress || '',
    ...fromComponents((place.addressComponents || []).map((c) => ({ long: c.longText, short: c.shortText, types: c.types }))),
    lat: +pos.lat.toFixed(6),
    lng: +pos.lng.toFixed(6),
    coords_source: 'place',
    type: place.primaryTypeDisplayName || '',
  };
}

/** "43.711, 10.399" (also with parentheses or a semicolon) -> { lat, lng }, else null. */
export function parseCoordinates(text) {
  const m = String(text).trim().match(/^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

/** A Geocoder result -> stop fields for a dropped pin. */
export function mapGeocode(result, pos, source = 'device') {
  const first = (result?.formatted_address || '').split(',')[0].trim();
  return {
    place_id: null,
    name: first || 'Dropped pin',
    address: result?.formatted_address || '',
    ...fromComponents((result?.address_components || []).map((c) => ({ long: c.long_name, short: c.short_name, types: c.types }))),
    lat: +pos.lat.toFixed(6),
    lng: +pos.lng.toFixed(6),
    coords_source: source,
    type: '',
  };
}

export class LocationError extends Error {
  constructor(kind) {
    super(
      { denied: 'Location permission was denied.', unavailable: 'Your location is unavailable.', timeout: 'Getting your location timed out.' }[kind] || 'Location failed.',
    );
    this.kind = kind;
  }
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new LocationError('unavailable'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new LocationError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  });
}

const withDistance = (stops, center) => (center ? stops.map((s) => ({ ...s, distance: distanceM(center, s) })) : stops);

export async function nearby(center, config) {
  const importLibrary = loadMaps(config.google_maps_api_key);
  const { Place, SearchNearbyRankPreference } = await importLibrary('places');
  const { places } = await Place.searchNearby({
    fields: FIELDS,
    locationRestriction: { center, radius: config.nearby_radius_m },
    maxResultCount: config.nearby_max_results,
    rankPreference: SearchNearbyRankPreference.POPULARITY,
  });
  return withDistance(places.map(mapPlace), center);
}

export async function textSearch(textQuery, center, config) {
  const importLibrary = loadMaps(config.google_maps_api_key);
  const { Place } = await importLibrary('places');
  const { places } = await Place.searchByText({ textQuery, fields: FIELDS, ...(center ? { locationBias: center } : {}), maxResultCount: 10 });
  return withDistance(places.map(mapPlace), center);
}

export async function reverseGeocode(pos, config, source = 'device') {
  const importLibrary = loadMaps(config.google_maps_api_key);
  const { Geocoder } = await importLibrary('geocoding');
  const { results } = await new Geocoder().geocode({ location: pos });
  return mapGeocode(results[0], pos, source);
}
