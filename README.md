# Simple Food Scanner

A free, offline-first calorie and macro tracker. Barcode scanning, food search, custom
foods, recipes and macro targets — no subscription, no account, no paywall.

Built because MyFitnessPal put barcode scanning behind a subscription, which is the one
feature that makes food logging fast enough to stick with.

## Stack

- **Expo SDK 57** + expo-router (iOS and Android from one TypeScript codebase)
- **expo-camera** `CameraView` for barcode scanning (EAN-8/13, UPC-A/E)
- **expo-sqlite** + **Drizzle ORM** — SQLite is the source of truth, on device
- **Open Food Facts** for product and nutrition data (ODbL)
- **TanStack Query** for network state, **zustand** for UI state

## Getting started

```bash
npm install
npx expo run:ios      # or: npx expo run:android
```

Barcode scanning needs a **development build** — it does not work in Expo Go, because
the camera's barcode scanner is a native module. `expo run:ios` / `expo run:android`
produce one.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the pure domain logic (no network, no device) |
| `npm run test:live` | Contract tests against the real Open Food Facts API |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Regenerate Drizzle migrations after a schema change |

## Architecture notes

**Local-first.** Every product you scan is written into the local `foods` table, so
re-scanning a food you have logged before works with the radio off. Network failures
fall back to that cache rather than erroring.

**Sync-ready schema.** Every user-owned table uses text UUID primary keys plus
`updated_at` / `deleted_at`. Deletes are tombstones, not row removals. Cloud sync is not
implemented, but adding it is additive rather than a migration.

**Macro snapshots.** `diary_entries` stores the macros each entry contributed at the
time it was logged. Editing a food, or refreshing its Open Food Facts record, must never
rewrite what last Tuesday's diary says you ate.

**Nutrition is stored per 100 g/ml only.** Open Food Facts publishes it that way, and
serving sizes are frequently missing upstream — the Nutella record has neither
`serving_size` nor `serving_quantity`. The `portions` table exists so a user can define
"1 slice = 32 g" once and reuse it.

## Open Food Facts rules

These are requirements from a volunteer-run service that gives away the data this app
depends on, not optimizations:

- A custom `User-Agent` (`AppName/Version (contact)`) is **mandatory** on every request.
- 15 product reads/min/IP, 10 searches/min/IP. `src/off/client.ts` enforces both with
  separate sliding-window buckets and in-flight request deduplication.
- Text search goes to `search.openfoodfacts.org` (Search-a-licious). The legacy
  `world.openfoodfacts.org/cgi/search.pl` endpoint is retired and returns 503 — do not
  "fix" a search failure by pointing back at it.
- An unknown barcode returns HTTP **404** with a `status: "failure"` body. That is a
  normal outcome, not an error: the app routes it to the custom food editor with the
  barcode prefilled.

## Attribution

Product data from [Open Food Facts](https://openfoodfacts.org), available under the
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
