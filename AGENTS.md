# AGENTS.md

Guidance for Codex when working in this repository.

---

## What this app is

**ETB Trip Schedule** is a dispatch scheduling web app for Escamilla Tour Buses. Dispatchers use it to:
- View a weekly grid of trips assigned to buses/drivers
- Create, edit, and delete trips
- Assign buses and drivers to trips, track driver confirmation status
- Print envelopes, next-day reports, and daily maintenance plans
- Mark driver unavailability by dragging over a weekly grid
- Track per-trip checklists (envelope, reminder, driver info, fuel card, HOS)
- View an activity log of all field changes

It is a **pure static site** — no build step, no framework, no npm, no TypeScript. Just HTML, CSS, and vanilla JS files served statically, backed by a Google Apps Script web app that reads/writes a Google Sheet.

---

## Running the app

```sh
npx serve .
# or
python3 -m http.server 8080
```

Open `index.html` in a browser. The `.Codex/launch.json` dev server config runs `npx serve .` on an auto-selected port.

There is no build step, no compilation, and no test suite.

## Formatting

```sh
npx prettier --write .
```

---

## JS Architecture

### Critical constraint: no modules

There is **no `import`/`export`**, no bundler, no ES modules. Every JS file is loaded via `<script defer>` in `index.html`. All functions and variables are **global**. Script load order is the only dependency system.

### Module files and load order

Scripts must be loaded in this exact order in `index.html` (each depends on globals from all previous):

| Order | File | Contents |
|-------|------|----------|
| 1 | `js/config.js` | `CONFIG` object, `CACHE` localStorage abstraction, theme IIFE, version display |
| 2 | `js/state.js` | Single `state` object (~84 properties) — all mutable app state lives here |
| 3 | `js/dom.js` | `$()` helper, `dom` object with 120+ cached element refs, `SELECTORS` |
| 4 | `js/utils.js` | Date/time utils, general utils, modal a11y helpers (`openModalA11y`, `closeModalA11y`, `trapModalFocus`), response sanitization (`sanitizeWeekResp`) |
| 5 | `js/api.js` | `fetchAPI`, `withRetry`, `api` object (10 methods), conflict detection, error logger |
| 6 | `js/status.js` | Toast/status notice system, progress bar, sync status |
| 7 | `js/panels.js` | Card/panel show-hide, side panel mode, `enforceDesktopEditing` |
| 8 | `js/schedule.js` | Schedule grid render, bar positioning, conflict UI (`buildAgendaRows`, `_renderAgendaInner`) |
| 9 | `js/drivers.js` | Driver week grid, drag unavailability selection, checklist/TODO card |
| 10 | `js/trip-form.js` | Trip form state, bus row building, dirty tracking, `confirmDiscardIfDirty` |
| 11 | `js/modals.js` | Itinerary modal, trip details modal, driver modals |
| 12 | `js/envelope.js` | Envelope formatting, two layout templates, print |
| 13 | `js/print.js` | Three print schedule layouts |
| 14 | `js/log.js` | Activity log, `loadDriversAndBuses` |
| 15 | `js/reports.js` | Next-day report, daily maintenance plan |
| 16 | `js/context-menu.js` | Context menus, quick-edit popover |
| 17 | `js/glass-select.js` | Custom glass dropdown wrapper for `<select>` elements |
| 18 | `js/events.js` | All event wiring (`wireEvents`, `wireDelegatedBarEvents`, `wireSettingsMenu`) |
| 19 | `js/week.js` | Week navigation, week data caching, `loadPrefs`, `updateWeekDates` |
| 20 | `js/app.js` | Boot IIFE — initializes everything, `fitDateTitle` |

**When adding a new file**: place its `<script defer src="...">` tag in the correct position in `index.html`. Adding it in the wrong order will cause "X is not defined" errors at boot.

### State

All mutable state lives in `state` (`js/state.js`). Key properties:
- `state.trips` — array of trip objects for the current week
- `state.tripByKey` — map of tripKey → trip (for O(1) lookup)
- `state.assignmentsByTripKey` — map of tripKey → array of bus assignments
- `state.driversList` / `state.busesList` — reference data
- `state.unavailabilityByDriver` — map of driverName → { dateYmd: true }
- `state.pendingWrite` — set during save/delete; guards against double-submit
- `state.weekCache` — in-memory week data cache (Map)
- `state.weekInFlight` — in-flight request deduplication (Map of key → Promise)

---

## Data Flow

### Primary read: `weekData`

The main data fetch is `api.weekData(start, end)` → GAS `weekData_()`. Returns everything for a week in one call:
```
{ trips[], assignments[], weekNotes, unavailability[], _cache: "HIT"|"MISS" }
```
Applied atomically in `applyWeekRespToState()`. Trips and assignments always arrive and are applied together — they are never out of sync.

### Three-layer cache

1. **In-memory** (`state.weekCache`) — Map of week key → `{ ts, resp }`. TTL: 5 min. Fastest.
2. **localStorage** (`CACHE` object in `config.js`) — JSON + expiry timestamp. TTL: 7 days. Survives page reload.
3. **GAS CacheService** (server-side) — TTL: 5 min for weekData, 10 min for drivers/buses.

Pattern: memory cache → localStorage cache → network. On network failure, stale cache is returned with `__stale: true`.

### Stale-while-revalidate

`fetchWeekDataCached()` serves from cache immediately, then re-fetches in background. Adjacent weeks (±2) are prefetched after the current week loads.

### In-flight deduplication

`state.weekInFlight` maps week keys to in-progress Promises. Duplicate requests for the same week share one Promise instead of firing multiple network requests.

### Optimistic UI + verification

Writes follow this sequence:
1. Apply change to `state` immediately → re-render
2. POST to GAS via `fetch()` (JSON body, `text/plain` content-type to avoid CORS preflight)
3. On success: server returns confirmed trip/assignment data → replace optimistic state with server response
4. On failure: rollback state from `state.pendingWrite.originalTrips`

`state.pendingWrite` is set for the duration. Any handler that saves or deletes a trip must check it first — including indirect triggers like quick edit or any code that calls `dom.saveBtn.click()`. The form submit handler's own guard does not protect against state being mutated before the click fires.

### Reference data caching (drivers/buses)

`loadDriversAndBuses()` in `log.js`:
- Serves from localStorage cache when fresh (TTL: 1 hour each)
- Falls back to network fetch via `api.listDrivers` / `api.listBuses`
- GAS also caches these for 10 min server-side
- `forceRefresh: true` bypasses all caches (used by Settings → Refresh)

---

## Backend

### Overview

Google Apps Script web app. Source in **`docs/backend.md`** — this is the canonical source of truth and must be **manually copied** into the GAS script editor and deployed as a new version. It is not deployed from this repo.

### Deployment workflow

1. Edit `docs/backend.md`
2. Copy the JS content into the GAS editor (script.google.com)
3. **Deploy → Manage deployments → edit → New version**
4. The endpoint URL never changes between versions

### Endpoints

- `doGet` — all reads: `weekData`, `listTrips`, `getTrip`, `listDrivers`, `listBuses`, `getBusAssignments`, `getChecklist`, `listLog`, `batchUnavailability`, `saveWeekNote`
- `doPost` — all writes: `create`, `update`, `delete`, `setChecklist`, `uploadItineraryPdf`
- All writes must call `invalidateWeekCache_()`. Two valid patterns: (1) call `withLock_(fn)` inside the write function — `invalidateWeekCache_()` goes inside the lock; (2) for functions that do slow external I/O before the spreadsheet write (e.g. `uploadItineraryPdf_`), call `invalidateWeekCache_()` at the `doPost` dispatch level after the function returns. Do not add a new write action that follows neither pattern.
- `setChecklist` does NOT invalidate week cache (checklist data is not in weekData)

### Data model (Google Sheets)

8 sheets, defined in the `HEADERS` constant in `docs/backend.md`:

| Sheet | Key columns |
|-------|-------------|
| `Trips` | `tripKey` (PK), all trip fields |
| `BusAssignments` | `tripKey` (FK), `busNumber`, `busId`, `driver1-4`, `driver1-4Status`, `driver1-4Pay` |
| `Drivers` | `driverId`, `driverName`, `active`, `priority` |
| `Buses` | `busId`, `busName`, `hasLift`, `hasSleeper`, `active` |
| `WeekNotes` | `WeekStart="global"`, `Notes`, `LastUpdated` |
| `Unavailability` | `driverName`, `dateYmd` |
| `Checklist` | `tripKey`, `date`, `envelope`, `reminder`, `driverInfo`, `fuelCard`, `hos` |
| `Log` | `timestamp`, `tripKey`, `tripId`, `action`, `field`, `oldValue`, `newValue` |

`tripKey` is the primary key for trips (timestamp-random string). `tripId` is a human-readable ID (`TRIP-YYYYMMDD-0001`) generated at create time and never changes.

### Backend utility functions (reuse these)

- `readAllAsObjects_(sheet, headers)` — reads all rows as objects
- `findRowIndexByValue_(sheet, headerName, value)` — finds a row by column value
- `updateRowByHeaders_(sheet, headers, rowIndex, obj)` — updates a row in place
- `appendRowByHeaders_(sheet, headers, obj)` — appends a new row
- `openModalA11y` / `closeModalA11y` — modal focus management (frontend)
- `withLock_(fn)` — wraps a function in a script lock (backend)
- `invalidateWeekCache_()` — clears all GAS CacheService week entries (backend)

---

## Modal system

All modals use `openModalA11y(el, preferredFocusEl)` / `closeModalA11y(el)` from `utils.js`. These handle:
- `el.hidden` toggle
- Focus save/restore via `modalReturnFocusMap`
- `requestAnimationFrame` focus on open

A single consolidated Escape handler in `wireEvents()` (`events.js`) covers all 7 modals in priority order. Do not add per-modal `document.addEventListener("keydown")` for Escape.

---

## CSS Design System (Rux UI)

Full spec in `docs/RUX_UI.md`. **3-tier token architecture**, all with `--rux-` prefix:

```
Tier 1  --rux-{category}-{key}      Primitives (color seeds, spacing, radius, size scales)
Tier 2  --rux-{category}-{n|role}   Semantics (surface levels, text/border/status roles)
Tier 3  --rux-{comp}-{property}     Components (element-scoped, consume Tier 2 only)
```

- Component CSS must only reference **Tier 3** tokens
- Use `oklch()` for all color values
- Use full readable words; only exception is `bg` for background
- Short component prefixes (`btn`, `fld`, `trp`) are namespaces, not abbreviations

**Migration in progress**: `css/variables.css` and all component CSS files still use the old naming convention (pre-May 2026). New work should use the active convention. Don't mix conventions within a file.

Old → new examples: `--rux-surface-panel` → `--rux-bg-3`, `--tripbar-height` → `--rux-trp-height`, `--btn-background` → `--rux-btn-bg-primary`

---

## Key patterns to follow

- **No new per-element event listeners on dynamically rebuilt lists** — use event delegation on the stable parent container instead
- **All `localStorage` calls must be wrapped in try/catch** — private browsing throws on access
- **`state.pendingWrite` must be checked at the top of any save/delete handler**
- **New trip fields**: add to `HEADERS.Trips` in `docs/backend.md`, `mapTripFromParams_`, `weekData_` object literal, `sanitizeWeekResp` in `utils.js`, and the trip form in `trip-form.js`
- **New bus assignment fields**: add to `HEADERS.BusAssignments`, `replaceBusAssignments_`, `weekData_` assignment object, and `sanitizeWeekResp`
- **Do not add Escape keydown listeners per-modal** — add to the consolidated handler in `wireEvents()`
