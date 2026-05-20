## Offline MBTiles map upload — Admin Settings

Add an offline-map upload to Admin → Settings. When uploaded, the app falls back to this map whenever the Google Maps API key is missing or the network is offline. Otherwise Google Maps continues to be used as today.

### What the user gets

- **Admin → Settings**: a new "Offline map (MBTiles)" section under the Google Maps API key card.
  - Upload `.mbtiles` file (drag-drop + file picker), shows current file name, size, uploaded date.
  - "Replace" and "Remove" buttons.
  - Help text explaining: used as fallback when Google Maps key is missing or device is offline.
- **All map views** (`/map/panchayath`, `/admin/mapping/panchayath`, `/admin/mapping/ward`):
  - If Google Maps key + network OK → Google Maps (unchanged).
  - Else → Leaflet renders the uploaded MBTiles, with the same panchayath / ward markers on top.
  - First view of the offline map downloads the `.mbtiles` once and caches it in IndexedDB; subsequent views work fully offline.

### Technical sketch

**Storage**
- Supabase Storage bucket `offline-maps` (private). Admin-only RLS via `is_admin(auth.uid())` for insert/update/delete; signed URLs for read.
- New table `app_settings` row `key = 'offline_mbtiles'` storing `{ path, size, uploaded_at }` JSON in `value` (existing schema supports this — `value` is text, we'll JSON-stringify).
- New SECURITY DEFINER function `get_public_offline_mbtiles_url()` returns a short-lived signed URL (or null) so anon/public map page can fetch it.

**Server function** (`src/lib/offline-map.functions.ts`)
- `getOfflineMbtilesSignedUrl()` — calls `supabaseAdmin.storage.from('offline-maps').createSignedUrl(path, 3600)`; returns `{ url, size, uploaded_at } | null`.
- Admin upload uses browser client directly (admin-only via RLS on bucket).

**Client cache** (`src/lib/mbtilesCache.ts`)
- IndexedDB key `offline_mbtiles_v1` stores `{ uploaded_at, blob }`.
- On map fallback: read cache; if `uploaded_at` matches latest server value, use cached blob; else download from signed URL and overwrite cache.

**Map rendering** (`src/components/map/OfflineMap.tsx`)
- Install `leaflet`, `@types/leaflet`, and `sql.js` (to read MBTiles tile blobs in-browser).
- Component opens the `.mbtiles` (SQLite) blob via `sql.js`, registers a custom Leaflet `TileLayer` whose `getTileUrl` returns `data:image/png;base64,...` from the `tiles` table.
- Renders given `markers` prop (same shape as current Google map markers) using Leaflet markers.

**Fallback switch** (new hook `useMapMode.ts`)
- Returns `'google' | 'offline' | 'none'`.
- `'google'` when `useGoogleMapsKey()` returns a key AND `navigator.onLine` AND no prior Google JS load error.
- `'offline'` when an offline mbtiles is configured AND (no key OR offline OR Google failed).
- `'none'` otherwise (current empty-state UI).
- Each map page renders Google component, `<OfflineMap>`, or the existing empty state based on this.

### File changes

- new: `src/components/map/OfflineMap.tsx`
- new: `src/lib/mbtilesCache.ts`
- new: `src/lib/offline-map.functions.ts`
- new: `src/hooks/use-map-mode.ts`
- edit: `src/routes/admin.settings.tsx` (add upload card)
- edit: `src/routes/map.panchayath.tsx`, `src/routes/admin.mapping.panchayath.tsx`, `src/routes/admin.mapping.ward.tsx` (use `useMapMode` + render `<OfflineMap>` fallback)
- edit: `src/components/map/MapPicker.tsx` (offline fallback shows read-only marker view; picking a new pin still requires Google or browser geolocation)
- migration: create `offline-maps` storage bucket + RLS + `get_public_offline_mbtiles_url()` function
- deps: `bun add leaflet @types/leaflet sql.js`

### Notes / limits

- Picking new pin coordinates by clicking the map still uses Google Maps; in offline mode the picker only supports the existing "Use my location" button. Stated explicitly in the UI.
- MBTiles files can be large (50–500 MB typical for a district). First offline load downloads once; cached in IndexedDB afterwards. We'll warn admins in the upload UI.
- `sql.js` ships a ~1 MB WASM file; loaded lazily only when offline map is needed.
