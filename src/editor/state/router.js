import { signal } from '@preact/signals';

/**
 * Hash routes: #/ (trips), #/trip/<id>, #/capture, #/capture/<tripId>~<sectionId>, #/settings, #/setup.
 * Returns { name, id?, add_to? }.
 */
export function parseHash(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'trip' && parts[1]) return { name: 'trip', id: parts[1] };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'setup') return { name: 'setup' };
  if (parts[0] === 'capture') return { name: 'capture', add_to: parts[1] || null };
  return { name: 'trips' };
}

export const route = signal(parseHash());
export const navigate = (hash) => (location.hash = hash);
