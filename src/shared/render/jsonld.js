import { stripMarkdown } from '../markdown.js';
import { allVisible } from '../visible.js';

/** JSON string, safe to embed in a script tag. No ratings, no dates. */
export function tripJsonLd(trip, ctx) {
  const stops = allVisible(trip);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: stripMarkdown(trip.note),
    url: ctx.url,
    author: { '@type': 'Person', name: ctx.config.author || '' },
    itinerary: {
      '@type': 'ItemList',
      itemListElement: stops.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Place',
          name: s.name,
          address: s.address,
          geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
        },
      })),
    },
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
