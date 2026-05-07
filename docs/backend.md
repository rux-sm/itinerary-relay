/\*\*

- Dispatch Scheduler Web App (Google Apps Script)
-
- Sheets:
- - Trips
- - BusAssignments
- - Drivers
- - Buses
- - WeekNotes (NEW)
-
- Supports:
- - doPost: create/update/delete/saveWeekNote
- - doGet: listTrips/getTrip/listDrivers/listBuses/getBusAssignments/listBusAssignmentsForRange/weekData
-
- Static-site friendly:
- - JSONP support via ?callback=foo (for doGet responses)
    \*/
    /\*\* =============================
- CONFIG
- ============================= \*/
  const CONFIG = {
  SPREADSHEET_ID: "14rQW4xXfe_FQhTRDMq-N70_cV1WOjiChjrtwPIP2md8",
  SHEET_TRIPS: "Trips",
  SHEET_BUS_ASSIGN: "BusAssignments",
  SHEET_DRIVERS: "Drivers",
  SHEET_BUSES: "Buses",
  SHEET_NOTES: "WeekNotes",
  SHEET_UNAVAILABILITY: "Unavailability",
  SHEET_CHECKLIST: "Checklist",
  SHEET_LOG: "Log",
  MAX_BUSES: 10,
  ENFORCE_TRIPID_MATCH_ON_DELETE_IF_PROVIDED: true,
  ITINERARY_FOLDER_ID: "1Xj-FjP53QnfNY-bHiCaU9VLCaeNUisYv",
  };
  // Column headers (canonical)
  const HEADERS = {
  Trips: [
  "tripKey",
  "tripId",
  "destination",
  "customer",
  "contactName",
  "phone",
  "departureDate",
  "arrivalDate",
  "departureTime",
  "spotTime",
  "arrivalTime",
  "itineraryStatus",
  "contactStatus",
  "paymentStatus",
  "driverStatus",
  "invoiceStatus",
  "invoiceNumber",
  "busesNeeded",
  "tripColor",
  "notes",
  "itinerary",
  "comments",
  "req56Pass",
  "reqSleeper",
  "reqLift",
  "reqRelief",
  "reqRelief2",
  "reqCoDriver",
  "reqHotel",
  "reqFuelCard",
  "reqWifi",
  "drivingHours",
  "onDutyHours",
  "envelopePickup",
  "envelopeTripContact",
  "envelopeTripPhone",
  "envelopeTripNotes",
  "createdAt",
  "updatedAt",
  "itineraryPdfUrl",
  "paymentType",
  "estimatedMileage",
  "quotedPrice",
  "driverInfoSent",
  "tripReminderSent",
  ],

BusAssignments: ["tripKey", "busNumber", "busId", "driver1", "driver2", "driver1Status", "driver2Status", "driver3", "driver3Status", "driver4", "driver4Status"],
Drivers: ["driverId", "driverName", "driverNameFull", "phone", "active", "notes", "priority", "status"],
Buses: ["busId", "busName", "capacity", "hasLift", "hasSleeper", "active", "notes", "busColor"],
WeekNotes: ["WeekStart", "Notes", "LastUpdated"],
Unavailability: ["driverName", "dateYmd"],
Checklist: ["tripKey", "date", "envelope", "reminder", "driverInfo", "fuelCard", "hos"],
Log: ["timestamp", "tripKey", "tripId", "action", "field", "oldValue", "newValue"],
};

/\*\* =============================

- PERF: WEEK CACHE (biggest win)
- ============================= \*/
  const WEEK*CACHE_TTL_SECONDS = 300; // matches 5-min frontend poll interval
  const REF_CACHE_TTL_SECONDS = 600; // 10 min — drivers/buses change rarely
  const WEEK_CACHE_PREFIX = "weekData:v4:";
  function weekCacheKey*(startYmd, endYmd) {
  return `${WEEK_CACHE_PREFIX}${startYmd}..${endYmd}`;
  }
  function trackWeekCacheKey*(key) {
  const props = PropertiesService.getScriptProperties();
  let list = [];
  try {
  list = JSON.parse(props.getProperty("WEEK_CACHE_KEYS") || "[]");
  } catch (e) {}
  if (!list.includes(key)) list.push(key);
  // keep list bounded
  if (list.length > 200) list = list.slice(-200);
  props.setProperty("WEEK_CACHE_KEYS", JSON.stringify(list));
  }
  function invalidateWeekCache*() {
  const props = PropertiesService.getScriptProperties();
  let list = [];
  try {
  list = JSON.parse(props.getProperty("WEEK*CACHE_KEYS") || "[]");
  } catch (e) {}
  if (list.length) CacheService.getScriptCache().removeAll(list);
  props.deleteProperty("WEEK_CACHE_KEYS");
  }
  function headerIndex*(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
  const h = String(headerRow[i] || "").trim();
  if (h) map[h] = i;
  }
  return map;
  }
  /\*\* =============================
- LOCKING (reliability)
- ============================= \*/
  const LOCK*TIMEOUT_MS = 15000;
  function withLock*(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_TIMEOUT_MS);
  try {
  return fn();
  } finally {
  lock.releaseLock();
  }
  }
  /\*\* =============================
- ENTRYPOINTS
- ============================= \*/
  function doPost(e) {
  return withLock*(() => {
  try {
  const p = e && e.parameter ? e.parameter : {};
  const action = (p.action || "").toLowerCase().trim();
  ensureAllSheets*();
  if (action === "create") {
  const result = createTrip*(p);
  invalidateWeekCache*(); // ✅ cache bust on writes
  return jsonOut*({ ok: true, ...result });
  }
  if (action === "update") {
  const result = updateTrip*(p);
  invalidateWeekCache*(); // ✅ cache bust on writes
  return jsonOut*({ ok: true, ...result });
  }
  if (action === "delete") {
  const result = deleteTrip*(p);
  invalidateWeekCache*(); // ✅ cache bust on writes
  return jsonOut*({ ok: true, ...result });
  }
  if (action === "uploaditinerarypdf") {
  const result = uploadItineraryPdf*(e);
  invalidateWeekCache*();
  return jsonOut*({ ok: true, ...result });
  }
  if (action === "setchecklist") {
  const result = setChecklist*(p);
  return jsonOut*({ ok: true, ...result });
  }
  return jsonOut\_({ ok: false, error: "Unknown action. Use create|update|delete|saveWeekNote|setChecklist." });

      } catch (err) {
        return jsonOut_({ ok: false, error: String(err && err.stack ? err.stack : err) });
      }

  });
  }
  /\*\*

- Logs errors to the ErrorLogs sheet
- Creates the sheet automatically if it doesn't exist
  \*/
  function logError(e) {
  try {
  const params = e.parameter || {};
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let errorSheet = ss.getSheetByName("ErrorLogs");

      // Create ErrorLogs sheet if it doesn't exist
      if (!errorSheet) {
        errorSheet = ss.insertSheet("ErrorLogs");
        errorSheet.appendRow(["Timestamp", "Message", "Stack", "URL", "UserAgent", "Context"]);

        // Format header row
        const headerRange = errorSheet.getRange(1, 1, 1, 6);
        headerRange.setFontWeight("bold");
        headerRange.setBackground("#f3f3f3");

        // Set column widths for readability
        errorSheet.setColumnWidth(1, 150); // Timestamp
        errorSheet.setColumnWidth(2, 300); // Message
        errorSheet.setColumnWidth(3, 400); // Stack
        errorSheet.setColumnWidth(4, 200); // URL
        errorSheet.setColumnWidth(5, 250); // UserAgent
        errorSheet.setColumnWidth(6, 200); // Context
      }

      // Append error log
      errorSheet.appendRow([
        new Date(),
        params.message || "",
        params.stack || "",
        params.url || "",
        params.userAgent || "",
        params.context || "",
      ]);

      return jsonOut({ ok: true, message: "Error logged successfully" });

  } catch (err) {
  // If logging fails, still return success to avoid breaking the app
  return jsonOut({ ok: false, error: String(err) });
  }
  }
  function getChecklist*(p) {
  const date = String(p.date || "").trim();
  if (!date) return { ok: false, error: "date is required (YYYY-MM-DD)" };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_CHECKLIST);
  if (!sheet) return { ok: true, rows: [] };
  const rows = readAllAsObjects*(sheet, HEADERS.Checklist)
  .filter(r => normalizeCellDateToYMD\_(r.date) === date);
  return { ok: true, rows };
  }

function setChecklist\_(p) {
const tripKey = String(p.tripKey || "").trim();
const date = String(p.date || "").trim();
if (!tripKey || !date) return { ok: false, error: "tripKey and date are required" };

const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const sheet = ss.getSheetByName(CONFIG.SHEET_CHECKLIST);
if (!sheet) return { ok: false, error: "Checklist sheet not found" };

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);
const cutoffYMD = cutoff.toISOString().slice(0, 10);
const all = readAllAsObjects*(sheet, HEADERS.Checklist);
// Single pass: drop stale rows and the existing upsert target together
const keep = all.filter((r) => {
const d = normalizeCellDateToYMD*(r.date);
if (!d || d < cutoffYMD) return false;
if (String(r.tripKey).trim() === tripKey && d === date) return false;
return true;
});
keep.push({
tripKey,
date,
envelope: String(p.envelope || "false"),
reminder: String(p.reminder || "false"),
driverInfo: String(p.driverInfo || "false"),
fuelCard: String(p.fuelCard || "false"),
hos: String(p.hos || "false"),
});
// Batch rewrite: 2 Sheets API calls instead of N deleteRow calls
const headers = HEADERS.Checklist;
sheet.clearContents();
sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
if (keep.length) {
const rows = keep.map((r) => headers.map((h) => (r[h] !== undefined ? r[h] : "")));
sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}
return { ok: true };
}

function doGet(e) {
try {
const p = e && e.parameter ? e.parameter : {};
const fn = (p.fn || "listTrips").trim();
ensureAllSheets*();
let data;
switch (fn) {
case "debugTrips":
data = debugTrips*();
break;
case "weekData":
data = weekData*(p);
break;
case "batchUnavailability": // <--- ADDED
data = batchUnavailability*(p);
break;
case "listTrips":
data = listTrips*(p);
break;
case "getTrip":
data = getTrip*(p.tripKey);
break;
case "listDrivers":
data = listDrivers*(p);
break;
case "listBuses":
data = listBuses*(p);
break;
case "getBusAssignments":
data = getBusAssignments*(p.tripKey);
break;
case "listBusAssignmentsForRange":
data = listBusAssignmentsForRange*(p);
break;
case "logError":
data = logError(e);
break;
case "saveWeekNote":
data = saveWeekNote*(p);
break;
case "updateTripItineraryPdf":
data = updateTripItineraryPdf*(p);
break;
case "getChecklist":
data = getChecklist*(p);
break;
case "listLog": {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const logSheet = ss.getSheetByName(CONFIG.SHEET_LOG);
const allRows = logSheet ? readAllAsObjects*(logSheet, HEADERS.Log) : [];
const filterKey = String(p.tripKey || "").trim();
const filtered = filterKey ? allRows.filter(r => r.tripKey === filterKey) : allRows;
data = { ok: true, log: filtered.reverse().slice(0, 500) };
break;
}
default:
data = {
ok: false,
error: "Unknown fn. Use weekData|listTrips|getTrip|listDrivers|listBuses|getBusAssignments|listBusAssignmentsForRange|listLog|logError.",
};
}
// JSONP support for static sites: ?callback=foo
if (p.callback) {
return jsonpOut*(p.callback, data);
}
return jsonOut*(data);
} catch (err) {
const payload = { ok: false, error: String(err && err.stack ? err.stack : err) };
const cb = e && e.parameter && e.parameter.callback;
if (cb) return jsonpOut*(cb, payload);
return jsonOut*(payload);
}
}
/\*\* =============================

- NORMALIZE OUTPUT (API)
- ============================= _/
  // Always return YYYY-MM-DD for dates
  function normalizeDateOut*(v) {
  const d = coerceToDate*(v);
  return d ? formatYMD*(d) : "";
  }
  function truthy*(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "on";
  }
  // Always return HH:MM (24h) for times
  function normalizeTimeOut\_(v) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v).trim();
  // 1) If already H:MM or HH:MM, normalize to HH:MM
  // Examples: "7:30" -> "07:30", "17:05" -> "17:05"
  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hh = String(Math.max(0, Math.min(23, parseInt(m[1], 10)))).padStart(2, "0");
    const mm = String(Math.max(0, Math.min(59, parseInt(m[2], 10)))).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  // 2) If Sheets stored time as a number (fraction of a day), convert safely
  if (typeof v === "number" && isFinite(v)) {
  const totalMinutes = Math.round(v _ 24 _ 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
  }
  // 3) If Sheets gave a Date object (commonly 1899-12-30 HH:MM), use its local hours/minutes
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
  const hh = String(v.getHours()).padStart(2, "0");
  const mm = String(v.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
  }
  // 4) If ISO string like 1899-12-30T12:00:00.000Z, extract HH:MM directly
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
  const mi = s.match(/T(\d{2}):(\d{2})/);
  if (mi) return `${mi[1]}:${mi[2]}`;
  }
  // 5) Parse "7:30 PM" / "7:30PM"
  const m2 = s.match(/^(\d{1,2}):(\d{2})\s_([AaPp][Mm])$/);
  if (m2) {
    let hh = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10);
    const ap = m2[3].toLowerCase();
    if (ap === "pm" && hh !== 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return "";
  }
  function normalizeTripForApi*(t) {
  const out = Object.assign({}, t);
  out.departureDate = normalizeDateOut*(t.departureDate);
  out.arrivalDate = normalizeDateOut*(t.arrivalDate);
  out.departureTime = normalizeTimeOut*(t.departureTime);
  out.spotTime = normalizeTimeOut*(t.spotTime);
  out.arrivalTime = normalizeTimeOut*(t.arrivalTime);
  return out;
  }
  /\*\* =============================
- TRIPS CRUD
- ============================= \*/
  function getBusAssignmentRow*(busSheet, tripKey) {
  const idx = findRowIndexByValue*(busSheet, "tripKey", tripKey);
  if (idx < 0) return {};
  return getRowObject\_(busSheet, HEADERS.BusAssignments, idx);
  }

function appendLog\_(ss, entry) {
const sheet = ss.getSheetByName(CONFIG.SHEET_LOG);

if (!sheet) return;
appendRowByHeaders*(sheet, HEADERS.Log, {
timestamp: new Date(),
tripKey: entry.tripKey || "",
tripId: entry.tripId || "",
action: entry.action || "",
field: entry.field || "",
oldValue: entry.oldValue || "",
newValue: entry.newValue || "",
});
}
function createTrip*(p) {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET*ID);
const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
const busSheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);
const now = new Date();
const departureDate = safeDateYMD*(p.departureDate);
const arrivalDate = safeDateYMD*(p.arrivalDate) || departureDate; // default same day if empty
if (!departureDate) throw new Error("departureDate is required (YYYY-MM-DD).");
// Respect provided tripKey from client (sanitize)
const tripKey =
String(p.tripKey || "")
.trim()
.replace(/[^\w-]/g, "") || generateTripKey*();
// Reliability: idempotent create (prevents duplicates on retry/double-submit)
const existingIdx = findRowIndexByValue*(tripsSheet, "tripKey", tripKey);
if (existingIdx > 0) {
const existing = getRowObject*(tripsSheet, HEADERS.Trips, existingIdx);
return { tripKey, tripId: existing.tripId || "" };
}
const tripId = generateTripId*(departureDate);
// Normalize persisted dates to YYYY-MM-DD strings
p.departureDate = formatYMD*(departureDate);
p.arrivalDate = formatYMD*(arrivalDate);
// Normalize persisted times to HH:MM strings (optional but improves consistency)
p.departureTime = normalizeTimeOut*(p.departureTime);
p.spotTime = normalizeTimeOut*(p.spotTime);
p.arrivalTime = normalizeTimeOut*(p.arrivalTime);
const tripRowObj = mapTripFromParams*(p, { tripKey, tripId, createdAt: now, updatedAt: now });
appendRowByHeaders*(tripsSheet, HEADERS.Trips, tripRowObj);
replaceBusAssignments*(busSheet, tripKey, p);
appendLog*(ss, { tripKey, tripId, action: "trip_added" });

const CREATION*FIELDS = [
"destination", "customer", "contactName", "phone",
"departureDate", "arrivalDate", "departureTime", "spotTime", "arrivalTime",
"itineraryStatus", "contactStatus", "paymentStatus", "driverStatus", "invoiceStatus",
"invoiceNumber", "busesNeeded", "notes", "comments",
"req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2",
"reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi",
"envelopePickup", "envelopeTripContact", "envelopeTripPhone",
];
for (const field of CREATION_FIELDS) {
const val = String(tripRowObj[field] || "");
if (val && val !== "false") {
appendLog*(ss, { tripKey, tripId, action: "field_changed", field, oldValue: "", newValue: val });
}
}

return { tripKey, tripId };

}
function updateTrip\_(p) {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
const busSheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);

const tripKey = String(p.tripKey || "").trim().replace(/[^\w-]/g, "");
if (!tripKey) throw new Error("tripKey is required for update.");
const rowIndex = findRowIndexByValue*(tripsSheet, "tripKey", tripKey);
if (rowIndex < 0) throw new Error(`Trip not found for tripKey: ${tripKey}`);
const now = new Date();
const existing = getRowObject*(tripsSheet, HEADERS.Trips, rowIndex);

const depD*forId = safeDateYMD*(p.departureDate) || coerceToDate*(existing.departureDate) || new Date();
let tripId = String(existing.tripId || "").trim();
if (!tripId) {
tripId = generateTripId*(depD_forId);
}

const depD = safeDateYMD*(p.departureDate) || coerceToDate*(existing.departureDate);
const arrD = safeDateYMD*(p.arrivalDate) || coerceToDate*(existing.arrivalDate) || depD;
if (depD) p.departureDate = formatYMD*(depD);
if (arrD) p.arrivalDate = formatYMD*(arrD);

p.departureTime = normalizeTimeOut*(p.departureTime || existing.departureTime);
p.spotTime = normalizeTimeOut*(p.spotTime || existing.spotTime);
p.arrivalTime = normalizeTimeOut\_(p.arrivalTime || existing.arrivalTime);
p.tripKey = tripKey;
if ("tripId" in p) delete p.tripId;

// --- NEW PDF DELETION LOGIC ---
const existingPdfUrl = existing.itineraryPdfUrl || "";
const incomingPdfUrl = p.hasOwnProperty("itineraryPdfUrl") ? p.itineraryPdfUrl : existingPdfUrl;

if (existingPdfUrl && !incomingPdfUrl) {
deleteOldPdfIfItExists\_(existingPdfUrl);
}
// ------------------------------

const tripRowObj = mapTripFromParams\_(p, {
tripKey,
tripId,
createdAt: existing.createdAt || "",
updatedAt: now,
itineraryPdfUrl: incomingPdfUrl
});

updateRowByHeaders\_(tripsSheet, HEADERS.Trips, rowIndex, tripRowObj);

const TRACKED_FIELDS = [
"destination", "customer", "contactName", "phone",
"departureDate", "arrivalDate", "departureTime", "spotTime", "arrivalTime",
"itineraryStatus", "contactStatus", "paymentStatus", "driverStatus", "invoiceStatus",
"invoiceNumber", "busesNeeded", "tripColor", "notes", "itinerary", "comments",
"req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2", "reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi",
"envelopePickup", "envelopeTripContact", "envelopeTripPhone", "envelopeTripNotes",
"itineraryPdfUrl",
"paymentType", "estimatedMileage", "quotedPrice",
"driverInfoSent", "tripReminderSent",
];

const DATE*FIELDS = new Set(["departureDate", "arrivalDate"]);
const TIME_FIELDS = new Set(["departureTime", "spotTime", "arrivalTime"]);
for (const field of TRACKED_FIELDS) {
const oldVal = DATE_FIELDS.has(field)
? String(ymdFromCell*(existing[field]) || "")
: TIME*FIELDS.has(field)
? String(normalizeTimeOut*(existing[field]) || "")
: String(existing[field] || "");

const newVal = String(tripRowObj[field] || "");
if (oldVal !== newVal) {
appendLog\_(ss, { tripKey, tripId, action: "field_changed", field, oldValue: oldVal, newValue: newVal });
}
}

if (incomingPdfUrl && !existingPdfUrl) {
appendLog\_(ss, { tripKey, tripId, action: "itinerary_uploaded", newValue: incomingPdfUrl });
}

const existingBusRow = getBusAssignmentRow*(busSheet, tripKey);
const DRIVER_FIELDS = [
"driver1", "driver2", "driver3", "driver4",
"driver1Status", "driver2Status", "driver3Status", "driver4Status",
];
replaceBusAssignments*(busSheet, tripKey, p);
for (const field of DRIVER*FIELDS) {
const oldVal = String(existingBusRow[field] || "");
const newVal = String(p[field] || "");
if (oldVal !== newVal) {
appendLog*(ss, { tripKey, tripId, action: "field_changed", field, oldValue: oldVal, newValue: newVal });
}
}

return { tripKey, tripId };
}

function deleteTrip*(p) {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
const busSheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);
const tripKey = String(p.tripKey || "")
.trim()
.replace(/[^\w-]/g, "");
if (!tripKey) throw new Error("tripKey is required for delete.");
// OPTIONAL SAFETY (PATCH): if caller provides tripId, verify it matches the row before deleting.
if (CONFIG.ENFORCE_TRIPID_MATCH_ON_DELETE_IF_PROVIDED) {
const providedTripId = String(p.tripId || "").trim();
if (providedTripId) {
const idx = findRowIndexByValue*(tripsSheet, "tripKey", tripKey);
if (idx < 0) throw new Error(`Trip not found for tripKey: ${tripKey}`);
const existing = getRowObject*(tripsSheet, HEADERS.Trips, idx);
const existingTripId = String(existing.tripId || "").trim();
if (existingTripId && existingTripId !== providedTripId) {
throw new Error(
`Refusing delete: tripId mismatch for tripKey ${tripKey} (provided=${providedTripId}, existing=${existingTripId})`,
);
}
}
}
deleteBusAssignmentsForTrip*(busSheet, tripKey);
const deleteIdx = findRowIndexByValue*(tripsSheet, "tripKey", tripKey);
const deletedRow = deleteIdx >= 0 ? getRowObject*(tripsSheet, HEADERS.Trips, deleteIdx) : {};
const deletedTripId = String(deletedRow.tripId || p.tripId || "");
// Delete trip row by filtering + rewrite (safer than deleteRow shifting)
ensureHeaders*(tripsSheet, HEADERS.Trips);
const values = tripsSheet.getDataRange().getValues();
if (values.length <= 1) return { tripKey, deleted: false, note: "No trips to delete" };
const header = values[0].map(String);
const idxKey = header.indexOf("tripKey");
if (idxKey < 0) throw new Error("Trips sheet missing tripKey header.");
const keep = [values[0]];
let removed = false;
for (let r = 1; r < values.length; r++) {
if (String(values[r][idxKey] || "").trim() === tripKey) {
removed = true;
continue;
}
keep.push(values[r]);
}
tripsSheet.clearContents();
tripsSheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
if (removed) {
appendLog*(ss, { tripKey, tripId: deletedTripId, action: "trip_deleted" });
}
return { tripKey, deleted: removed };
}

function saveWeekNote\_(p) {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
let sheet = ss.getSheetByName(CONFIG.SHEET_NOTES);
if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NOTES);

ensureHeaders\_(sheet, HEADERS.WeekNotes);

const noteText = String(p.notes || "").trim();
const now = new Date();
const values = sheet.getDataRange().getValues();

let foundRow = -1;
for (let i = 1; i < values.length; i++) {
if (String(values[i][0]).trim() === "global") { foundRow = i + 1; break; }
}

if (foundRow > 0) {
sheet.getRange(foundRow, 2).setValue(noteText);
sheet.getRange(foundRow, 3).setValue(now);
} else {
sheet.appendRow(["global", noteText, now]);
}

PropertiesService.getScriptProperties().setProperty("GLOBAL*NOTE", noteText);
invalidateWeekCache*();
return { ok: true, saved: true };

}
function normalizeWeekStartKey\_(val) {
if (!val) return "";

// If it's already YYYY-MM-DD, return it
const s = String(val).trim();
if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

// Try to parse as date
const d = safeDateYMD*(val);
return d ? formatYMD*(d) : "";
}
/\*\*

- Helper: Normalize a cell value (which might be a Date object or string) to YYYY-MM-DD
  \*/
  function normalizeCellDateToYMD\_(cellValue) {
  if (!cellValue) return "";

// If it's a Date object
if (Object.prototype.toString.call(cellValue) === "[object Date]" && !isNaN(cellValue.getTime())) {
return formatYMD\_(cellValue);
}

// If it's already a string in YYYY-MM-DD format
const s = String(cellValue).trim();
if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

// Try to parse it
const d = safeDateYMD*(s);
return d ? formatYMD*(d) : "";
} /\*\* =============================

- READ API
- ============================= \*/
  function listTrips*(p) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
  const all = readAllAsObjects*(tripsSheet, HEADERS.Trips);
  const start = safeDateYMD*(p.start);
  const end = safeDateYMD*(p.end);
  let trips = all;
  if (start && end) {
  trips = all.filter((t) => {
  const depObj = coerceToDate*(t.departureDate);
  const arrObj = coerceToDate*(t.arrivalDate) || depObj;
  if (!depObj) return false;
  return !(arrObj < start || depObj > end);
  });
  }
  return { ok: true, trips: trips.map(normalizeTripForApi*) };
  }
  function getTrip*(tripKey) {
  if (!tripKey) return { ok: false, error: "tripKey required" };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET*ID);
  const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
  const rowIndex = findRowIndexByValue*(tripsSheet, "tripKey", String(tripKey).trim());
  if (rowIndex < 0) return { ok: false, error: "Trip not found" };
  const trip = getRowObject*(tripsSheet, HEADERS.Trips, rowIndex);
  return { ok: true, trip: normalizeTripForApi*(trip) };
  }
  function listDrivers*(p) {
  const activeOnly = String(p.activeOnly || "").toLowerCase() === "true";
  const cacheKey = `listDrivers:v1:${activeOnly}`;
  const cache = CacheService.getScriptCache();
  const hit = p.bustCache !== "true" && cache.get(cacheKey);
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_DRIVERS);
  const all = readAllAsObjects*(sheet, HEADERS.Drivers);
  const drivers = activeOnly
  ? all.filter((d) => String(d.active).toLowerCase() === "true" || d.active === true)
  : all;
  const result = { ok: true, drivers };
  cache.put(cacheKey, JSON.stringify(result), REF*CACHE_TTL_SECONDS);
  return result;
  }
  function listBuses*(p) {
  const activeOnly = String(p.activeOnly || "").toLowerCase() === "true";
  const cacheKey = `listBuses:v1:${activeOnly}`;
  const cache = CacheService.getScriptCache();
  const hit = p.bustCache !== "true" && cache.get(cacheKey);
  if (hit) return JSON.parse(hit);
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET*ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_BUSES);
  const all = readAllAsObjects*(sheet, HEADERS.Buses);
  const buses = activeOnly
  ? all.filter((b) => String(b.active).toLowerCase() === "true" || b.active === true)
  : all;
  const result = { ok: true, buses };
  cache.put(cacheKey, JSON.stringify(result), REF*CACHE_TTL_SECONDS);
  return result;
  }
  function getBusAssignments*(tripKey) {
  if (!tripKey) return { ok: false, error: "tripKey required" };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);
  const headers = HEADERS.BusAssignments;
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, assignments: [] };
  // Read actual header row for name-based mapping (order-independent)
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const col = headerRow.indexOf("tripKey") + 1;
  if (col < 1) return { ok: true, assignments: [] };
  const cells = sheet
  .getRange(2, col, last - 1, 1)
  .createTextFinder(String(tripKey).trim())
  .matchEntireCell(true)
  .findAll();
  const rows = cells.map((cell) => {
  const vals = sheet.getRange(cell.getRow(), 1, 1, headerRow.length).getValues()[0];
  const obj = {};
  headers.forEach((h) => {
  const idx = headerRow.indexOf(h);
  obj[h] = idx >= 0 ? vals[idx] : "";
  });
  return obj;
  });
  rows.sort((a, b) => Number(a.busNumber) - Number(b.busNumber));
  return { ok: true, assignments: rows };
  }

/\*\*

- weekData (FAST + CACHED)
- Returns trips + bus assignments + unavailability for trips overlapping [start,end] in ONE call.
  \*/
  function weekData*(p) {
  const startD = safeDateYMD*(p.start);
  const endD = safeDateYMD\_(p.end);
  if (!startD || !endD) return { ok: false, error: "start and end are required (YYYY-MM-DD)" };

// Use normalized YMD strings for cheap comparisons
const start = formatYMD*(startD);
const end = formatYMD*(endD);

// ✅ Cache hit
const cache = CacheService.getScriptCache();
const key = weekCacheKey\_(start, end);
const cached = cache.get(key);
if (cached) {
const obj = JSON.parse(cached);
obj.\_cache = "HIT";
const freshNote = PropertiesService.getScriptProperties().getProperty("GLOBAL_NOTE");
if (freshNote !== null) obj.weekNotes = freshNote;
return obj;
}

const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
const asnSheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);
const notesSheet = ss.getSheetByName(CONFIG.SHEET_NOTES) || ss.insertSheet(CONFIG.SHEET_NOTES);

// NEW: Fetch unavailability
const unavailability = getUnavailability\_(start, end);

// One read per sheet
const tripsVals = tripsSheet.getDataRange().getValues();
const asnVals = asnSheet.getDataRange().getValues();

// Fetch persistent note
const noteVals = notesSheet.getDataRange().getValues();
let weekNote = "";
for (let i = 1; i < noteVals.length; i++) {
if (String(noteVals[i][0]).trim() === "global") {
weekNote = String(noteVals[i][1] || "");
break;
}
}
PropertiesService.getScriptProperties().setProperty("GLOBAL_NOTE", weekNote);

if (tripsVals.length < 2) {
const empty = { ok: true, trips: [], assignments: [], weekNotes: weekNote, unavailability, _cache: "MISS" };
const payloadEmpty = JSON.stringify(empty);
if (payloadEmpty.length < 95000) {
cache.put(key, payloadEmpty, WEEK_CACHE_TTL_SECONDS);
trackWeekCacheKey_(key);
}
return empty;
}

const tripsHdr = headerIndex*(tripsVals[0]);
const asnHdr = headerIndex*(asnVals[0] || []);
const idx = (hmap, name) => (name in hmap ? hmap[name] : -1);

// Trips indices
const iTripKey = idx(tripsHdr, "tripKey");
const iTripId = idx(tripsHdr, "tripId");
const iDest = idx(tripsHdr, "destination");
const iCust = idx(tripsHdr, "customer");
const iContact = idx(tripsHdr, "contactName");
const iPhone = idx(tripsHdr, "phone");
const iDepDate = idx(tripsHdr, "departureDate");
const iArrDate = idx(tripsHdr, "arrivalDate");
const iDepTime = idx(tripsHdr, "departureTime");
const iSpotTime = idx(tripsHdr, "spotTime");
const iArrTime = idx(tripsHdr, "arrivalTime");
const iItinStatus = idx(tripsHdr, "itineraryStatus");
const iContactStatus = idx(tripsHdr, "contactStatus");
const iPaymentStatus = idx(tripsHdr, "paymentStatus");
const iDriverStatus = idx(tripsHdr, "driverStatus");
const iInvoiceStatus = idx(tripsHdr, "invoiceStatus");
const iInvoiceNumber = idx(tripsHdr, "invoiceNumber");
const iBusesNeeded = idx(tripsHdr, "busesNeeded");
const iTripColor = idx(tripsHdr, "tripColor");
const iNotes = idx(tripsHdr, "notes");
const iItinerary = idx(tripsHdr, "itinerary");
const iComments = idx(tripsHdr, "comments");
const iReq56Pass = idx(tripsHdr, "req56Pass");
const iReqSleeper = idx(tripsHdr, "reqSleeper");
const iReqLift = idx(tripsHdr, "reqLift");
const iReqRelief = idx(tripsHdr, "reqRelief");
const iReqRelief2 = idx(tripsHdr, "reqRelief2");
const iReqCoDriver = idx(tripsHdr, "reqCoDriver");
const iReqHotel = idx(tripsHdr, "reqHotel");
const iReqFuelCard = idx(tripsHdr, "reqFuelCard");
const iReqWifi = idx(tripsHdr, "reqWifi");
const iDrivingHours = idx(tripsHdr, "drivingHours");
const iOnDutyHours  = idx(tripsHdr, "onDutyHours");
const iCreatedAt = idx(tripsHdr, "createdAt");
const iUpdatedAt = idx(tripsHdr, "updatedAt");
const iItineraryPdfUrl = idx(tripsHdr, "itineraryPdfUrl");
const iEnvelopePickup = idx(tripsHdr, "envelopePickup");
const iEnvelopeTripContact = idx(tripsHdr, "envelopeTripContact");
const iEnvelopeTripPhone = idx(tripsHdr, "envelopeTripPhone");
const iEnvelopeTripNotes = idx(tripsHdr, "envelopeTripNotes");
const iPaymentType = idx(tripsHdr, "paymentType");
const iEstimatedMileage = idx(tripsHdr, "estimatedMileage");
const iQuotedPrice = idx(tripsHdr, "quotedPrice");
const iDriverInfoSent = idx(tripsHdr, "driverInfoSent");
const iTripReminderSent = idx(tripsHdr, "tripReminderSent");

const trips = [];
const tripKeysInRange = new Set();

for (let r = 1; r < tripsVals.length; r++) {
const row = tripsVals[r];
if (!row || row.length === 0) continue;
const k = String(row[iTripKey] || "").trim();
if (!k) continue;

    const dep = ymdFromCell_(row[iDepDate]);
    const arr = ymdFromCell_(row[iArrDate]) || dep;
    if (!dep) continue;
    if (arr < start || dep > end) continue;

    trips.push({
      tripKey: k,
      tripId: iTripId >= 0 ? row[iTripId] || "" : "",
      destination: iDest >= 0 ? row[iDest] || "" : "",
      customer: iCust >= 0 ? row[iCust] || "" : "",
      contactName: iContact >= 0 ? row[iContact] || "" : "",
      phone: iPhone >= 0 ? row[iPhone] || "" : "",
      departureDate: dep,
      arrivalDate: arr,
      departureTime: iDepTime >= 0 ? normalizeTimeOut_(row[iDepTime]) : "",
      spotTime: iSpotTime >= 0 ? normalizeTimeOut_(row[iSpotTime]) : "",
      arrivalTime: iArrTime >= 0 ? normalizeTimeOut_(row[iArrTime]) : "",
      itineraryStatus: iItinStatus >= 0 ? row[iItinStatus] || "" : "",
      contactStatus: iContactStatus >= 0 ? row[iContactStatus] || "" : "",
      paymentStatus: iPaymentStatus >= 0 ? row[iPaymentStatus] || "" : "",
      driverStatus: iDriverStatus >= 0 ? row[iDriverStatus] || "" : "",
      invoiceStatus: iInvoiceStatus >= 0 ? row[iInvoiceStatus] || "" : "",
      invoiceNumber: iInvoiceNumber >= 0 ? row[iInvoiceNumber] || "" : "",
      busesNeeded: iBusesNeeded >= 0 ? row[iBusesNeeded] || "" : "",
      tripColor: iTripColor >= 0 ? row[iTripColor] || "" : "",
      notes: iNotes >= 0 ? row[iNotes] || "" : "",
      itinerary: iItinerary >= 0 ? row[iItinerary] || "" : "",
      comments: iComments >= 0 ? row[iComments] || "" : "",
      req56Pass: iReq56Pass >= 0 ? truthy_(row[iReq56Pass]) : false,
      reqSleeper: iReqSleeper >= 0 ? truthy_(row[iReqSleeper]) : false,
      reqLift: iReqLift >= 0 ? truthy_(row[iReqLift]) : false,
      reqRelief: iReqRelief >= 0 ? truthy_(row[iReqRelief]) : false,
      reqRelief2: iReqRelief2 >= 0 ? truthy_(row[iReqRelief2]) : false,
      reqCoDriver: iReqCoDriver >= 0 ? truthy_(row[iReqCoDriver]) : false,
      reqHotel: iReqHotel >= 0 ? truthy_(row[iReqHotel]) : false,
      reqFuelCard: iReqFuelCard >= 0 ? truthy_(row[iReqFuelCard]) : false,
      reqWifi: iReqWifi >= 0 ? truthy_(row[iReqWifi]) : false,
      createdAt: iCreatedAt >= 0 ? row[iCreatedAt] || "" : "",
      updatedAt: iUpdatedAt >= 0 ? row[iUpdatedAt] || "" : "",
      itineraryPdfUrl: iItineraryPdfUrl >= 0 ? row[iItineraryPdfUrl] || "" : "",
      envelopePickup: iEnvelopePickup >= 0 ? row[iEnvelopePickup] || "" : "",
      envelopeTripContact: iEnvelopeTripContact >= 0 ? row[iEnvelopeTripContact] || "" : "",
      envelopeTripPhone: iEnvelopeTripPhone >= 0 ? row[iEnvelopeTripPhone] || "" : "",
      envelopeTripNotes: iEnvelopeTripNotes >= 0 ? row[iEnvelopeTripNotes] || "" : "",
      paymentType:       iPaymentType       >= 0 ? row[iPaymentType]       || "" : "",
      estimatedMileage:  iEstimatedMileage  >= 0 ? row[iEstimatedMileage]  || "" : "",
      quotedPrice:       iQuotedPrice       >= 0 ? row[iQuotedPrice]       || "" : "",
      driverInfoSent:    iDriverInfoSent    >= 0 ? truthy_(row[iDriverInfoSent])   : false,
      tripReminderSent:  iTripReminderSent  >= 0 ? truthy_(row[iTripReminderSent]) : false,
    });

    tripKeysInRange.add(k);

}

// Assignments indices
const aTripKey = idx(asnHdr, "tripKey");
const aBusNumber = idx(asnHdr, "busNumber");
const aBusId = idx(asnHdr, "busId");
const aDriver1 = idx(asnHdr, "driver1");
const aDriver2 = idx(asnHdr, "driver2");
const aDriver3 = idx(asnHdr, "driver3");
const aDriver4 = idx(asnHdr, "driver4");
const aDriver1Status = idx(asnHdr, "driver1Status");
const aDriver2Status = idx(asnHdr, "driver2Status");
const aDriver3Status = idx(asnHdr, "driver3Status");
const aDriver4Status = idx(asnHdr, "driver4Status");

const assignments = [];
if (asnVals.length > 1 && tripKeysInRange.size) {
for (let r = 1; r < asnVals.length; r++) {
const row = asnVals[r];
const k = String(row[aTripKey] || "").trim();
if (!k || !tripKeysInRange.has(k)) continue;
const busId = String(row[aBusId] || "").trim();
if (!busId || busId.toLowerCase() === "none") continue;
assignments.push({
tripKey: k,
busNumber: String(row[aBusNumber] || "").trim(),
busId,
driver1: String(row[aDriver1] || "").trim(),
driver2: String(row[aDriver2] || "").trim(),
driver3: aDriver3 >= 0 ? String(row[aDriver3] || "").trim() : "",
driver4: aDriver4 >= 0 ? String(row[aDriver4] || "").trim() : "",
driver1Status: aDriver1Status >= 0 ? String(row[aDriver1Status] || "").trim() : "",
driver2Status: aDriver2Status >= 0 ? String(row[aDriver2Status] || "").trim() : "",
driver3Status: aDriver3Status >= 0 ? String(row[aDriver3Status] || "").trim() : "",
driver4Status: aDriver4Status >= 0 ? String(row[aDriver4Status] || "").trim() : "",
});
}
assignments.sort((x, y) => {
const b = String(x.busId).localeCompare(String(y.busId));
if (b) return b;
return Number(x.busNumber) - Number(y.busNumber);
});
}

const resp = { ok: true, trips, assignments, weekNotes: weekNote, unavailability, _cache: "MISS" };
const payload = JSON.stringify(resp);
if (payload.length < 95000) {
cache.put(key, payload, WEEK_CACHE_TTL_SECONDS);
trackWeekCacheKey_(key);
}
return resp;
}
/\*\*

- Returns all bus assignments where the parent trip overlaps [start,end].
- Query:
- ?fn=listBusAssignmentsForRange&start=YYYY-MM-DD&end=YYYY-MM-DD
  \*/
  function listBusAssignmentsForRange*(p) {
  const start = safeDateYMD*(p.start);
  const end = safeDateYMD*(p.end);
  if (!start || !end) return { ok: false, error: "start and end are required (YYYY-MM-DD)" };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
  const asnSheet = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN);
  const trips = readAllAsObjects*(tripsSheet, HEADERS.Trips);
  const asn = readAllAsObjects*(asnSheet, HEADERS.BusAssignments);
  const tripDates = new Map();
  for (const t of trips) {
  const k = String(t.tripKey || "").trim();
  if (!k) continue;
  const dep = coerceToDate*(t.departureDate);
  const arr = coerceToDate\_(t.arrivalDate) || dep;
  if (!dep) continue;
  tripDates.set(k, { dep, arr });
  }
  const out = [];
  for (const a of asn) {
  const k = String(a.tripKey || "").trim();
  if (!k) continue;
  const td = tripDates.get(k);
  if (!td) continue;
  if (td.arr < start || td.dep > end) continue;
  const busId = String(a.busId || "").trim();
  if (!busId || busId.toLowerCase() === "none") continue;
  out.push({
  tripKey: k,
  busNumber: String(a.busNumber || "").trim(),
  busId,
  driver1: String(a.driver1 || "").trim(),
  driver2: String(a.driver2 || "").trim(),
  driver3: String(a.driver3 || "").trim(),
  driver4: String(a.driver4 || "").trim(),
  driver1Status: String(a.driver1Status || "").trim(),
  driver2Status: String(a.driver2Status || "").trim(),
  driver3Status: String(a.driver3Status || "").trim(),
  driver4Status: String(a.driver4Status || "").trim(),
  });
  }
  out.sort((x, y) => {
  const b = String(x.busId).localeCompare(String(y.busId));
  if (b) return b;
  const k = String(x.tripKey).localeCompare(String(y.tripKey));
  if (k) return k;
  return Number(x.busNumber) - Number(y.busNumber);
  });
  return { ok: true, assignments: out };
  }
  /\*\* =============================
- BUS ASSIGNMENTS
- ============================= \*/
  function replaceBusAssignments*(busSheet, tripKey, p) {
  ensureHeaders*(busSheet, HEADERS.BusAssignments);
  deleteBusAssignmentsForTrip*(busSheet, tripKey);
  const busesNeeded = clampInt*(p.busesNeeded, 1, CONFIG.MAX*BUSES, 1);
  // Optional uniqueness: avoid assigning same busId twice in the same trip
  const seenBusIds = new Set();
  for (let i = 1; i <= busesNeeded; i++) {
  const busId = String(p[`bus${i}`] || "").trim();
  const driver1 = String(p[`bus${i}_driver1`] || "").trim();
  const driver2 = String(p[`bus${i}_driver2`] || "").trim();
  const driver3 = String(p[`bus${i}_driver3`] || "").trim();
  const driver4 = String(p[`bus${i}_driver4`] || "").trim();
  if (!busId || busId.toLowerCase() === "none") continue;
  if (seenBusIds.has(busId)) continue;
  seenBusIds.add(busId);
  const driver1Status = String(p[`bus${i}_driver1Status`] || "Pending").trim();
  const driver2Status = String(p[`bus${i}_driver2Status`] || "Pending").trim();
  const driver3Status = String(p[`bus${i}_driver3Status`] || "").trim();
  const driver4Status = String(p[`bus${i}_driver4Status`] || "").trim();
  const rowObj = {
  tripKey: tripKey,
  busNumber: i,
  busId: busId,
  driver1: driver1 || "None",
  driver2: driver2 || "None",
  driver1Status: driver1Status,
  driver2Status: driver2Status,
  driver3: driver3 || "",
  driver3Status: driver3Status,
  driver4: driver4 || "",
  driver4Status: driver4Status,
  };
  appendRowByHeaders*(busSheet, HEADERS.BusAssignments, rowObj);
  }
  }
  function deleteBusAssignmentsForTrip*(busSheet, tripKey) {
  ensureHeaders*(busSheet, HEADERS.BusAssignments);
  const range = busSheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return;
  const header = values[0].map(String);
  const idxTripKey = header.indexOf("tripKey");
  if (idxTripKey < 0) return;
  const keep = [values[0]];
  const target = String(tripKey).trim();
  for (let r = 1; r < values.length; r++) {
  const rowKey = String(values[r][idxTripKey] || "").trim();
  if (rowKey !== target) keep.push(values[r]);
  }
  busSheet.clearContents();
  busSheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
  }
  /\*\* =============================
- TRIP MAPPING / ID GENERATION
- ============================= \*/
  function mapTripFromParams*(p, base) {
  const incomingNotes = String(p.notes || "").trim();
  const incomingComments = String(p.comments || "").trim();
  return {
  tripKey: base.tripKey,
  tripId: base.tripId,
  destination: String(p.destination || "").trim(),
  customer: String(p.customer || "").trim(),
  contactName: String(p.contactName || "").trim(),
  phone: String(p.phone || "").trim(),
  departureDate: String(p.departureDate || "").trim(),
  arrivalDate: String(p.arrivalDate || "").trim(),
  departureTime: String(p.departureTime || "").trim(),
  spotTime: String(p.spotTime || "").trim(),
  arrivalTime: String(p.arrivalTime || "").trim(),
  itineraryStatus: String(p.itineraryStatus || "Not requested").trim(),
  contactStatus: String(p.contactStatus || "Missing").trim(),
  paymentStatus: String(p.paymentStatus || "Unpaid").trim(),
  driverStatus: String(p.driverStatus || p.driverInfoSent || "Pending").trim(),
  invoiceStatus: String(p.invoiceStatus || "Pending").trim(),
  invoiceNumber: String(p.invoiceNumber || "").trim(),
  busesNeeded: clampInt*(p.busesNeeded, 1, CONFIG.MAX_BUSES, 1),
  tripColor: String(p.tripColor || "").trim(),
  notes: incomingNotes,
  itinerary: String(p.itinerary || "").trim(),
  comments: incomingComments,
  req56Pass: String(p.req56Pass || "").toLowerCase() === "true",
  reqSleeper: String(p.reqSleeper || "").toLowerCase() === "true",
  reqLift: String(p.reqLift || "").toLowerCase() === "true",
  reqRelief: String(p.reqRelief || "").toLowerCase() === "true",
  reqRelief2: String(p.reqRelief2 || "").toLowerCase() === "true",
  reqCoDriver: String(p.reqCoDriver || "").toLowerCase() === "true",
  reqHotel: String(p.reqHotel || "").toLowerCase() === "true",
  reqFuelCard: String(p.reqFuelCard || "").toLowerCase() === "true",
  reqWifi: String(p.reqWifi || "").toLowerCase() === "true",
  envelopePickup: String(p.envelopePickup || "").trim(),
  envelopeTripContact: String(p.envelopeTripContact || "").trim(),
  envelopeTripPhone: String(p.envelopeTripPhone || "").trim(),
  envelopeTripNotes: String(p.envelopeTripNotes || "").trim(),
  paymentType: String(p.paymentType || "").trim(),
  estimatedMileage: String(p.estimatedMileage || "").trim(),
  quotedPrice: String(p.quotedPrice || "").trim(),
  driverInfoSent: String(p.driverInfoSent || "").toLowerCase() === "true",
  tripReminderSent: String(p.tripReminderSent || "").toLowerCase() === "true",
  createdAt: base.createdAt,

      updatedAt: base.updatedAt,
      itineraryPdfUrl: base.itineraryPdfUrl || "", // <--- FIXED: Map PDF URL to the database

  };
  }

function generateTripKey*() {
return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
function generateTripId*(departureDateObj) {
// Format: TRIP-YYYYMMDD-#### (sequence per day)
// Uses Script Properties + doPost lock to prevent collisions.
const ymd = formatYMDCompact*(departureDateObj); // YYYYMMDD
const props = PropertiesService.getScriptProperties();
const key = `SEQ*${ymd}`;
  const cur = parseInt(props.getProperty(key) || "0", 10);
  const next = (isNaN(cur) ? 0 : cur) + 1;
  props.setProperty(key, String(next));
  return `TRIP-${ymd}-${String(next).padStart(4, "0")}`;
}
function nextDailySequence\_(tripsSheet, ymdCompact) {
// Deprecated: no longer used (kept to avoid breaking references).
return 1;
}
/\*\* =============================

- SHEET HELPERS
- ============================= \*/
  // REPLACEMENT FOR `uploadItineraryPdf_` in your Google Apps Script

function uploadItineraryPdf\_(e) {
const p = e && e.parameter ? e.parameter : {};
const tripKey = String(p.tripKey || "").trim();
if (!tripKey) throw new Error("tripKey is required");

if (!CONFIG.ITINERARY_FOLDER_ID) {
throw new Error("ITINERARY_FOLDER_ID is not configured");
}

if (!e || !e.postData || !e.postData.contents) {
throw new Error("No file data in request body");
}

let data;
try {
data = JSON.parse(e.postData.contents);
} catch (err) {
throw new Error("Failed to parse request body as JSON");
}

const base64Data = data.base64Data;
if (!base64Data) {
throw new Error("No base64Data found in payload");
}

const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
const contentType = data.mimeType || "application/pdf";
const filename = data.filename || "itinerary.pdf";

// --- THE BULLETPROOF METHOD ---
// We use the raw Google Drive REST API to upload the file, bypassing DriveApp entirely.
const token = ScriptApp.getOAuthToken();
const urlApi = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

// Construct the multipart body
const boundary = "-------314159265358979323846";
const metadata = {
name: filename,
mimeType: contentType,
parents: [CONFIG.ITINERARY_FOLDER_ID] // Upload directly into your specific folder
};

let requestBody = "--" + boundary + "\r\n";
requestBody += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
requestBody += JSON.stringify(metadata) + "\r\n";
requestBody += "--" + boundary + "\r\n";
requestBody += 'Content-Type: ' + contentType + '\r\n';
requestBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
requestBody += base64String + "\r\n";
requestBody += "--" + boundary + "--";

const options = {
method: "post",
headers: {
Authorization: "Bearer " + token,
"Content-Type": "multipart/related; boundary=" + boundary
},
payload: requestBody,
muteHttpExceptions: true
};

const response = UrlFetchApp.fetch(urlApi, options);
const result = JSON.parse(response.getContentText());

if (response.getResponseCode() !== 200) {
throw new Error("REST API Upload failed: " + JSON.stringify(result));
}

const fileId = result.id;

// Set permissions strictly using the API to make it "Anyone with link can view"
const permUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
UrlFetchApp.fetch(permUrl, {
method: "post",
headers: { Authorization: "Bearer " + token },
contentType: "application/json",
payload: JSON.stringify({ type: "anyone", role: "reader" }),
muteHttpExceptions: true
});

const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;

// Save URL to Spreadsheet
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET*ID);
const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
const rowIndex = findRowIndexByValue*(tripsSheet, "tripKey", tripKey);

if (rowIndex > 0) {
const headerRow = tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).getValues()[0].map(String);
const colPdfUrl = headerRow.indexOf("itineraryPdfUrl");
const colStatus = headerRow.indexOf("itineraryStatus");
if (colPdfUrl >= 0) {
tripsSheet.getRange(rowIndex, colPdfUrl + 1).setValue(viewUrl);
}
if (colStatus >= 0) {
tripsSheet.getRange(rowIndex, colStatus + 1).setValue("Received");
}
}

return { tripKey, itineraryPdfUrl: viewUrl };
}

function updateTripItineraryPdf*(p) {
return withLock*(() => {
const tripKey = String(p.tripKey || "").trim();
const url = String(p.itineraryPdfUrl || "").trim();
if (!tripKey) return { ok: false, error: "tripKey required" };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tripsSheet = ss.getSheetByName(CONFIG.SHEET_TRIPS);
    ensureHeaders_(tripsSheet, HEADERS.Trips);

    const rowIndex = findRowIndexByValue_(tripsSheet, "tripKey", tripKey);
    if (rowIndex < 0) return { ok: false, error: "Trip not found" };

    const header =
      tripsSheet.getRange(1, 1, 1, tripsSheet.getLastColumn()).getValues()[0].map(String);
    const colIndex = header.indexOf("itineraryPdfUrl");
    if (colIndex < 0) return { ok: false, error: "itineraryPdfUrl column not found" };

      const existingUrl = String(tripsSheet.getRange(rowIndex, colIndex + 1).getValue() || "").trim();

if (existingUrl) {
deleteOldPdfIfItExists\_(existingUrl);
}

    tripsSheet.getRange(rowIndex, colIndex + 1).setValue(url);

    // Invalidate week cache so next load sees the new URL
    invalidateWeekCache_();

    return { ok: true };

});
}

function ensureAllSheets*() {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const trips = ss.getSheetByName(CONFIG.SHEET_TRIPS) || ss.insertSheet(CONFIG.SHEET_TRIPS);
const bus = ss.getSheetByName(CONFIG.SHEET_BUS_ASSIGN) || ss.insertSheet(CONFIG.SHEET_BUS_ASSIGN);
const drivers = ss.getSheetByName(CONFIG.SHEET_DRIVERS) || ss.insertSheet(CONFIG.SHEET_DRIVERS);
const buses = ss.getSheetByName(CONFIG.SHEET_BUSES) || ss.insertSheet(CONFIG.SHEET_BUSES);
const notes = ss.getSheetByName(CONFIG.SHEET_NOTES) || ss.insertSheet(CONFIG.SHEET_NOTES);
const unavail = ss.getSheetByName(CONFIG.SHEET_UNAVAILABILITY) || ss.insertSheet(CONFIG.SHEET_UNAVAILABILITY);
const checklist = ss.getSheetByName(CONFIG.SHEET_CHECKLIST) || ss.insertSheet(CONFIG.SHEET_CHECKLIST);
const log = ss.getSheetByName(CONFIG.SHEET_LOG) || ss.insertSheet(CONFIG.SHEET_LOG);
ensureHeaders*(trips, HEADERS.Trips);
ensureHeaders*(bus, HEADERS.BusAssignments);
ensureHeaders*(drivers, HEADERS.Drivers);
ensureHeaders*(buses, HEADERS.Buses);
ensureHeaders*(notes, HEADERS.WeekNotes);
ensureHeaders*(unavail, HEADERS.Unavailability);
ensureHeaders*(checklist, HEADERS.Checklist);
ensureHeaders*(log, HEADERS.Log);
}
function ensureHeaders*(sheet, headers) {
const data = sheet.getDataRange().getValues();
if (data.length === 0) {
sheet.appendRow(headers);
return;
}
const existing = data[0] || [];
const emptyRow = existing.every((x) => x === "" || x === null);
if (emptyRow) {
sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
return;
}
let changed = false;
const set = new Set(existing.map((h) => String(h).trim()));
headers.forEach((h) => {
if (!set.has(h)) {
existing.push(h);
set.add(h);
changed = true;
}
});
if (changed) {
sheet.getRange(1, 1, 1, existing.length).setValues([existing]);
}
}
function readAllAsObjects*(sheet, canonicalHeaders) {
ensureHeaders*(sheet, canonicalHeaders);
const values = sheet.getDataRange().getValues();
if (values.length <= 1) return [];
const header = values[0].map(String);
const out = [];
for (let r = 1; r < values.length; r++) {
const row = values[r];
if (row.every((v) => v === "" || v === null)) continue;
const obj = {};
canonicalHeaders.forEach((h) => {
const idx = header.indexOf(h);
obj[h] = idx >= 0 ? row[idx] : "";
});
out.push(obj);
}
return out;
}
function appendRowByHeaders*(sheet, canonicalHeaders, obj) {
ensureHeaders*(sheet, canonicalHeaders);
const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
const row = header.map((h) => (obj[h] !== undefined ? obj[h] : ""));
sheet.appendRow(row);
}
function updateRowByHeaders*(sheet, canonicalHeaders, rowIndex, obj) {
ensureHeaders*(sheet, canonicalHeaders);
const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
const row = header.map((h) => (obj[h] !== undefined ? obj[h] : ""));
sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
}
function getRowObject*(sheet, canonicalHeaders, rowIndex) {
ensureHeaders*(sheet, canonicalHeaders);
const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
const obj = {};
canonicalHeaders.forEach((h) => {
const idx = header.indexOf(h);
obj[h] = idx >= 0 ? row[idx] : "";
});
return obj;
}
function findRowIndexByValue\_(sheet, headerName, value) {
const v = String(value || "").trim();
if (!v) return -1;
const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
const idx = header.indexOf(headerName);
if (idx < 0) return -1;
const col = idx + 1;
const last = sheet.getLastRow();
if (last < 2) return -1;
const cell = sheet
.getRange(2, col, last - 1, 1)
.createTextFinder(v)
.matchEntireCell(true)
.findNext();
return cell ? cell.getRow() : -1;
}
/\*\* =============================

- DATE / FORMAT HELPERS
- ============================= \*/
  function safeDateYMD*(s) {
  if (!s) return null;
  const str = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
  }
  function ymdFromCell*(v) {
  if (v === null || v === undefined || v === "") return "";
  // If it's already YYYY-MM-DD (or starts with it), keep it
  const s = String(v).trim();
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  // Otherwise try to coerce to a Date and format
  const d = coerceToDate_(v);
  return d ? formatYMD_(d) : "";
}
function formatYMD_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatYMDCompact_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
  }
  function clampInt\_(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
  }
  /\*\* =============================
- OUTPUT HELPERS (JSON/JSONP)
- ============================= \*/
  function jsonOut*(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }
  function jsonpOut*(callback, obj) {
  const cb = String(callback).replace(/[^\w$.]/g, "");
  const payload = `${cb}(${JSON.stringify(obj)});`;
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  /\*\* =============================
- DEBUG / TEST
- ============================= _/
  function TEST*validateSpreadsheetId() {
  const id = String(CONFIG.SPREADSHEET_ID || "").trim();
  Logger.log("ID=" + id);
  if (!id || id.length < 20) throw new Error("SPREADSHEET_ID looks empty/too short.");
  if (id.includes("http")) throw new Error("SPREADSHEET_ID must be ONLY the ID, not a URL.");
  const ss = SpreadsheetApp.openById(id);
  Logger.log("Opened: " + ss.getName());
  }
  function debugTrips*() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET*ID);
  const sh = ss.getSheetByName(CONFIG.SHEET_TRIPS);
  const values = sh.getDataRange().getValues();
  return { ok: true, spreadsheet: ss.getName(), sheet: sh.getName(), rows: values.length };
  }
  function coerceToDate*(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
  return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  const s = String(v).trim();
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const mm = Number(m[1]),
      dd = Number(m[2]),
      yy = Number(m[3]);
    const d = new Date(yy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function MIGRATE_normalizeTripsDatesAndTimes() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SHEET_TRIPS);
  if (!sh) throw new Error("Trips sheet not found");
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "America/Chicago";
  const range = sh.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return;
  const header = values[0].map(String);
  const idxDepDate = header.indexOf("departureDate");
  const idxArrDate = header.indexOf("arrivalDate");
  const idxDepTime = header.indexOf("departureTime");
  const idxArrTime = header.indexOf("arrivalTime");
  if (idxDepDate < 0 || idxArrDate < 0 || idxDepTime < 0 || idxArrTime < 0) {
    throw new Error("Missing one of the required columns: departureDate, arrivalDate, departureTime, arrivalTime");
  }
  let changed = 0;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Dates -> YYYY-MM-DD
    const depD = coerceToDate_(row[idxDepDate]);
    const arrD = coerceToDate_(row[idxArrDate]);
    const depOut = depD ? formatYMD_(depD) : "";
    const arrOut = arrD ? formatYMD_(arrD) : depOut || "";
    if (row[idxDepDate] !== depOut) {
      row[idxDepDate] = depOut;
      changed++;
    }
    if (row[idxArrDate] !== arrOut) {
      row[idxArrDate] = arrOut;
      changed++;
    }
    // Times -> HH:MM (try to preserve what Sheets intended using spreadsheet timezone)
    row[idxDepTime] = normalizeTimeCell_(row[idxDepTime], tz);
    row[idxArrTime] = normalizeTimeCell_(row[idxArrTime], tz);
  }
  range.setValues(values);
  Logger.log("Migration complete. Cells normalized: " + changed);
}
function normalizeTimeCell_(v, tz) {
  if (v === null || v === undefined || v === "") return "";
  // Already HH:MM
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // Date object (common for Sheets time-of-day)
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
  return Utilities.formatDate(v, tz, "HH:mm");
  }
  // ISO string -> extract HH:MM directly
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  }
  // Fraction of day number
  if (typeof v === "number" && isFinite(v)) {
  const totalMinutes = Math.round(v _ 24 _ 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
  }
  // Fallback: try parse "7:30 PM"
  const m2 = s.match(/^(\d{1,2}):(\d{2})\s_([AaPp][Mm])$/);
  if (m2) {
    let hh = parseInt(m2[1], 10);
    const mm = parseInt(m2[2], 10);
    const ap = m2[3].toLowerCase();
    if (ap === "pm" && hh !== 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return "";
  }

/\*\* =============================

- DRIVER UNAVAILABILITY
- ============================= \*/

function batchUnavailability*(p) {
return withLock*(() => {
const driverName = String(p.driverName || "").trim();
const dates = String(p.dates || "")
.split(",")
.filter(Boolean);
const mode = p.mode; // "add" or "remove"

    if (!driverName || !dates.length) return { ok: false, error: "Missing driverName or dates" };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEET_UNAVAILABILITY);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_UNAVAILABILITY);
      sheet.appendRow(HEADERS.Unavailability);
      sheet.getRange("A1:B1").setFontWeight("bold");
    }

    const data = sheet.getDataRange().getValues();

    if (mode === "remove") {
      // Delete rows in reverse to maintain index integrity
      for (let i = data.length - 1; i >= 1; i--) {
        const cellDate = normalizeCellDateToYMD_(data[i][1]); // FIX: normalize date
        if (String(data[i][0]) === driverName && dates.indexOf(cellDate) > -1) {
          sheet.deleteRow(i + 1);
        }
      }
    } else {
      // Add only if not already present
      const existing = new Set(
        data.filter((r) => String(r[0]) === driverName).map((r) => normalizeCellDateToYMD_(r[1])), // FIX: normalize date
      );
      dates.forEach((d) => {
        if (!existing.has(d)) sheet.appendRow([driverName, d]);
      });
    }

    // Crucial: clear cache so the reload shows the updates!
    invalidateWeekCache_();

    return { ok: true };

});
}

function getUnavailability\_(startStr, endStr) {
try {
const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
const sheet = ss.getSheetByName(CONFIG.SHEET_UNAVAILABILITY);
if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const results = [];

    for (let i = 1; i < data.length; i++) {
      // FIX: Use normalizeCellDateToYMD_ to handle Date objects properly
      const d = normalizeCellDateToYMD_(data[i][1]);
      if (d && d >= startStr && d <= endStr) {
        results.push({
          driverName: String(data[i][0]),
          dateYmd: d,
        });
      }
    }
    return results;

} catch (e) {
return [];
}
}

function deleteOldPdfIfItExists\_(oldUrl) {
if (!oldUrl || !oldUrl.includes("drive.google.com")) return;

try {
const match = oldUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
if (match && match[1]) {
DriveApp.getFileById(match[1]).setTrashed(true);
}
} catch (err) {
console.error("Failed to delete old PDF:", err);
}
}

function forceDriveAuth() {
DriveApp.getRootFolder();
}

function fixPdfPermissions() {
const folderId = "1Xj-FjP53QnfNY-bHiCaU9VLCaeNUisYv";
const token = ScriptApp.getOAuthToken();
let pageToken = null;
let count = 0;

do {
let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name),nextPageToken&pageSize=100`;
if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    const data = JSON.parse(resp.getContentText());

    for (const file of (data.files || [])) {
      UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
        method: "post",
        headers: { Authorization: "Bearer " + token },
        contentType: "application/json",
        payload: JSON.stringify({ type: "anyone", role: "reader" }),
        muteHttpExceptions: true
      });
      Logger.log("Updated: " + file.name);
      count++;
    }

    pageToken = data.nextPageToken || null;

} while (pageToken);

Logger.log("Done. " + count + " files updated.");
}
