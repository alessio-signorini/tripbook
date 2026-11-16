# Data model

Everything Tripbook stores is JSON in your data repo, at the repo root:

```
config.json            site and editor settings
drafts/<id>.json       trips built at unlisted /drafts/... URLs
published/<id>.json    public trips
```

The **folder is the status** and the **file name is the trip `id`**, which never changes. The editor reads and writes only these paths.

## Trip

```json
{
  "v": 1,
  "id": "3f6c2a1e-8b1d-4c39-9a51-2d0e8f7b6c44",
  "slug": "pisa-in-one-walk",
  "kind": "guide",
  "title": "Pisa in one walk: from the station to the Leaning Tower",
  "note": "Arriving by train? This route takes you north through the old town.",
  "lang": "en",
  "location": { "country": "Italy", "country_code": "IT", "region": "", "city": "Pisa" },
  "photo": null,
  "old_paths": [],
  "sections": [
    {
      "id": "s-1",
      "title": "Station to the Tower",
      "note": "Flat and easy; about 2 km on foot.",
      "style": "route",
      "auto_date": null,
      "stops": [
        {
          "id": "p-1",
          "place_id": null,
          "name": "Pisa Centrale",
          "address": "Piazza della Stazione, Pisa",
          "city": "Pisa", "region": "Toscana", "country": "Italy", "country_code": "IT",
          "lat": 43.7085, "lng": 10.3984,
          "coords_source": "place",
          "minutes": null,
          "leg_to_next": "3 min walk",
          "note": "Start here if you arrive by train.",
          "rating": null,
          "off_route": false,
          "captured_at": null
        }
      ]
    }
  ],
  "created_at": "2026-11-15T10:00:00Z",
  "updated_at": "2026-11-15T10:00:00Z"
}
```

| Field | Rules |
|---|---|
| `v` | Integer ≥ 1, the schema version. A build refuses a trip whose `v` is newer than it supports and tells you to release a newer tripbook. |
| `id` | Non-empty; must equal the file name without `.json`. |
| `slug` | Lowercase letters, digits and single dashes. The editor derives it from the title until you edit it. |
| `kind` | `"guide"` (a recommendation) or `"log"` (a record of a trip). |
| `title`, `note`, `lang` | `note` is Markdown and may be empty. `lang` defaults to `"en"`. |
| `location` | `country` required; `country_code` is 2 uppercase letters or empty; `region` and `city` optional. They build the URL. |
| `photo` | Optional. `null`, or `{ url, thumb, title, author, license, license_url, source_url }` with https URLs. Chosen in the editor from a Wikipedia article's lead image. Used as the share image and as a thumbnail on listing cards; credits are listed on the index. |
| `old_paths` | URLs this trip used to have; each gets a redirect page. The editor appends to it when a published trip's URL changes. |
| `sections[]` | `id` unique in the trip; `title` and `note` (Markdown) may be empty; `style` is `"route"` (numbered path, legs, route link) or `"list"` (pins only); `auto_date` is `YYYY-MM-DD` or `null` (editor use only). |
| `stops[]` | `id` unique in the trip; `name` required; `lat` in [-90, 90], `lng` in [-180, 180]; `place_id` string or `null`; `coords_source` is `"device"`, `"place"` or `"pin"`; `minutes` positive integer or `null`; `leg_to_next` string or `null`; `note` Markdown; `rating` integer 1–5 or `null`; `captured_at` ISO string or `null`. |
| `stops[].off_route` | Optional `true`. In a `route` section, marks a recommended place that is not on the walking route (see below). Ignored in `list` sections. |

Unknown fields are allowed and preserved, so newer data stays readable by older tools. The same shapes are JSDoc types (`Trip`, `Section`, `Stop`, `Photo`, `Location`) at the top of `src/shared/schema.js`, next to `validateTrip`.

### Ratings and low-rated places

A rating of 1 or 2 is *low*. Guides hide low-rated places by default and logs show them; the reader can flip that with a switch on the page. Hidden stops are still in the HTML (marked `hidden`), and the numbers, counts, times, legs, map markers and Google Maps links all follow the switch. The editor always shows everything.

### Off-route places

An `off_route` stop stays in the list at the position you give it, with its time, rating, address and note. It is labelled with a letter (A, B, C… across the whole trip) instead of a number, drawn as a white pin with a gray outline, and left out of the dashed route line, the leg connectors and the **Route in Google Maps** link. It still counts in the stop total and time. When a trip has off-route places, the page shows a second switch, **Show places off the path**, on by default.

## `config.json`

All fields are optional; the defaults live in `src/shared/schema.js` (`DEFAULT_CONFIG`).

| Field | Default | Meaning |
|---|---|---|
| `site_title` | `"Trips"` | Site name |
| `author` | `""` | Shown in the page header on mobile and in Markdown/JSON-LD |
| `base_url` | `""` | Absolute site URL, e.g. `https://trips.example.com` (canonical URLs, sitemap, `llms.txt`) |
| `google_maps_api_key` | `""` | Browser key restricted by referrer, so it is not a secret |
| `google_maps_map_id` | `"DEMO_MAP_ID"` | Map ID (JavaScript type) |
| `google_analytics_id` | `""` | GA4 ID; the snippet goes on published trips and listing pages only |
| `time_presets` | `[10, 30, 45, 60]` | Minutes chips in the editor |
| `nearby_radius_m`, `nearby_max_results` | `75`, `10` | Capture's nearby search |
| `default_kind`, `default_lang` | `"log"`, `"en"` | Defaults for new trips |
| `country_slugs` | `{"US":"usa","GB":"uk","AE":"uae"}` | Country code → URL segment |
| `ai_crawlers` | `"allow"` | `"disallow"` blocks known AI crawlers in `robots.txt` and skips `llms.txt` |

## URLs

`/<country>/<region?>/<city?>/<slug>/`: region and city are left out when empty. The country segment is `country_slugs[country_code]` if present, else the slugified country name. Slugs lowercase, strip accents and join with dashes (`Città` becomes `citta`).

- `/italy/pisa/4-hours-layover/`, `/usa/california/santa-barbara/perfect-day/`
- Drafts use the same path under `/drafts/`. Publishing makes the draft URL disappear.
- Listing pages exist for every proper prefix: `/italy/`, `/italy/pisa/`, and `/` for everything.
- Two published trips (or two drafts) that resolve to the same URL fail the build, naming both files.

## What the site build writes

For each published trip: `index.html`, `index.md` (a Markdown version), JSON-LD in the page. For the site: listing pages, `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and `assets/` (the hashed trip page script and the heading font; CSS is inlined in every page). Drafts get a page only, with `noindex`, and appear in no listing, sitemap or `llms` file.

## Privacy rules

- **No dates or times** are ever rendered: no visit times, no "updated" stamps, no sitemap `lastmod`. `captured_at`, `auto_date`, `created_at` and `updated_at` exist in the JSON only.
- **Only the build output is served.** The workflow uploads `_site/` alone; `config.json`, `drafts/`, `published/` and the workflow are never published. A test fails if the output contains any `.json` file.
- The Maps key is a referrer-restricted browser key; the editor token never leaves the device except to `api.github.com`.
