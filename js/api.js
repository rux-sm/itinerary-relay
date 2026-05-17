// ======================================================
// 11) SUPABASE CLIENT + API
// ======================================================

const _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function sbErr(error, label) {
  throw new Error(`[${label}] ${error?.message || String(error)}`);
}

function p2bool(v) {
  if (typeof v === "boolean") return v;
  return String(v || "").toLowerCase() === "true";
}

function p2str(v) {
  return v == null ? "" : String(v).trim();
}

// For UPDATE: keep existing value if incoming is empty (guards against partial form load)
function mergeStr(incoming, existing) {
  const v = p2str(incoming);
  return v !== "" ? v : (p2str(existing) || "");
}

function p2date(v) {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return s || null;
}

function generateTripKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// ── withRetry (unchanged) ────────────────────────────────────────────────────

async function withRetry(
  fn,
  {
    tries = 3,
    baseDelayMs = 350,
    maxDelayMs = 2000,
    jitter = 0.25,
    totalTimeoutMs = 30000,
    shouldRetry = () => true,
  } = {},
) {
  const deadline = Date.now() + totalTimeoutMs;
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      if (Date.now() > deadline)
        throw new Error(`Operation timed out after ${totalTimeoutMs}ms`);
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === tries || !shouldRetry(err) || Date.now() > deadline) break;
      const expo = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const j = expo * jitter * (Math.random() * 2 - 1);
      const wait = Math.min(Math.max(0, expo + j), deadline - Date.now());
      if (wait <= 0) break;
      await delay(wait);
    }
  }
  throw lastErr;
}

// ── Trip param parsing ───────────────────────────────────────────────────────

// isCreate=true → p2str only (no existing to fall back to)
// isCreate=false → mergeStr (preserve existing DB value if form field came back empty)
function tripFromParams(p, base = {}, isCreate = true) {
  const m = (v, k) => isCreate ? p2str(v) : mergeStr(v, base[k]);
  return {
    tripKey:              p2str(p.tripKey)       || base.tripKey,
    tripId:               p2str(p.tripId)        || base.tripId  || "",
    destination:          m(p.destination,         "destination"),
    customer:             m(p.customer,             "customer"),
    contactName:          m(p.contactName,          "contactName"),
    phone:                m(p.phone,                "phone"),
    departureDate:        p2date(p.tripDate || p.departureDate) || base.departureDate || null,
    arrivalDate:          p2date(p.arrivalDate)  || base.arrivalDate || null,
    departureTime:        m(p.departureTime,        "departureTime"),
    spotTime:             m(p.spotTime,             "spotTime"),
    arrivalTime:          m(p.arrivalTime,          "arrivalTime"),
    itineraryStatus:      m(p.itineraryStatus,      "itineraryStatus"),
    contactStatus:        m(p.contactStatus,        "contactStatus"),
    paymentStatus:        m(p.paymentStatus,        "paymentStatus"),
    driverStatus:         m(p.driverStatus,         "driverStatus"),
    invoiceStatus:        m(p.invoiceStatus,        "invoiceStatus"),
    invoiceNumber:        m(p.invoiceNumber,        "invoiceNumber"),
    busesNeeded:          m(p.busesNeeded,          "busesNeeded"),
    tripColor:            m(p.tripColor,            "tripColor"),
    notes:                m(p.notes,               "notes"),
    itinerary:            m(p.itinerary,           "itinerary"),
    comments:             m(p.comments,            "comments"),
    req56Pass:            p2bool(p.req56Pass),
    reqSleeper:           p2bool(p.reqSleeper),
    reqLift:              p2bool(p.reqLift),
    reqRelief:            p2bool(p.reqRelief),
    reqRelief2:           p2bool(p.reqRelief2),
    reqCoDriver:          p2bool(p.reqCoDriver),
    reqHotel:             p2bool(p.reqHotel),
    reqFuelCard:          p2bool(p.reqFuelCard),
    reqWifi:              p2bool(p.reqWifi),
    envelopePickup:       m(p.envelopePickup,       "envelopePickup"),
    envelopeTripContact:  m(p.envelopeTripContact,  "envelopeTripContact"),
    envelopeTripPhone:    m(p.envelopeTripPhone,    "envelopeTripPhone"),
    envelopeTripNotes:    m(p.envelopeTripNotes,    "envelopeTripNotes"),
    itineraryPdfUrl:      p2str(p.itineraryPdfUrl) || p2str(base.itineraryPdfUrl),
    paymentType:          m(p.paymentType,          "paymentType"),
    estimatedMileage:     m(p.estimatedMileage,     "estimatedMileage"),
    drivingHours:         m(p.drivingHours,         "drivingHours"),
    onDutyHours:          m(p.onDutyHours,          "onDutyHours"),
    quotedPrice:          m(p.quotedPrice,          "quotedPrice").replace(/^\$/, ""),
    driverInfoSent:       p2bool(p.driverInfoSent),
    tripReminderSent:     p2bool(p.tripReminderSent),
    tripMiles:            m(p.tripMiles,            "tripMiles"),
    datePaid:             p2date(p.datePaid)     || base.datePaid || null,
    tripReviewed:         p2bool(p.tripReviewed),
    ref1:                 m(p.ref1, "ref1"),
    ref2:                 m(p.ref2, "ref2"),
    ref3:                 m(p.ref3, "ref3"),
    updatedAt:            new Date().toISOString(),
  };
}

// ── Bus assignment parsing ───────────────────────────────────────────────────

function assignmentsFromParams(p, tripKey) {
  const n = Math.min(10, parseInt(p.busesNeeded) || 0);
  const result = [];
  for (let i = 1; i <= n; i++) {
    const busId = p2str(p[`bus${i}`]);
    if (!busId || busId === "None") continue;
    const bus = (state.busesList || []).find((b) => String(b.busId) === busId) || {};
    result.push({
      tripKey,
      busId,
      busName:       bus.busName || "",
      busNumber:     i,
      driver1:       p2str(p[`bus${i}_driver1`]),
      driver2:       p2str(p[`bus${i}_driver2`]),
      driver3:       p2str(p[`bus${i}_driver3`]),
      driver4:       p2str(p[`bus${i}_driver4`]),
      driver1Status: p2str(p[`bus${i}_driver1Status`]),
      driver2Status: p2str(p[`bus${i}_driver2Status`]),
      driver3Status: p2str(p[`bus${i}_driver3Status`]),
      driver4Status: p2str(p[`bus${i}_driver4Status`]),
      driver1Pay:    p2str(p[`bus${i}_driver1Pay`]),
      driver2Pay:    p2str(p[`bus${i}_driver2Pay`]),
      driver3Pay:    p2str(p[`bus${i}_driver3Pay`]),
      driver4Pay:    p2str(p[`bus${i}_driver4Pay`]),
    });
  }
  return result;
}

// ── Trip ID generation ───────────────────────────────────────────────────────

async function generateTripId(depDate) {
  const d = depDate ? depDate.replace(/-/g, "") : ymd(new Date()).replace(/-/g, "");
  const prefix = `TRIP-${d}-`;
  const { data } = await _sb.from("trips").select("tripId").like("tripId", `${prefix}%`);
  const maxNum = (data || []).reduce((max, t) => {
    const n = parseInt((t.tripId || "").split("-").pop()) || 0;
    return Math.max(max, n);
  }, 0);
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

// ── Activity logging ─────────────────────────────────────────────────────────

const TRACKED_FIELDS = [
  "destination", "customer", "contactName", "phone",
  "departureDate", "arrivalDate", "departureTime", "spotTime", "arrivalTime",
  "itineraryStatus", "contactStatus", "paymentStatus", "driverStatus",
  "invoiceStatus", "invoiceNumber", "busesNeeded", "tripColor",
  "notes", "itinerary", "comments",
  "req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2",
  "reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi",
  "envelopePickup", "envelopeTripContact", "envelopeTripPhone", "envelopeTripNotes",
  "itineraryPdfUrl", "paymentType", "estimatedMileage", "drivingHours",
  "onDutyHours", "quotedPrice", "driverInfoSent", "tripReminderSent",
  "tripMiles", "datePaid", "tripReviewed", "ref1", "ref2", "ref3",
];

async function logTripChanges(action, newTrip, oldTrip) {
  const entries = [];
  const ts = new Date().toISOString();
  if (action === "create" || action === "delete") {
    entries.push({
      timestamp: ts,
      tripKey:  newTrip.tripKey,
      tripId:   newTrip.tripId,
      action,
      field: "", oldValue: "", newValue: "",
    });
  } else {
    for (const field of TRACKED_FIELDS) {
      const ov = String(oldTrip?.[field] ?? "");
      const nv = String(newTrip?.[field] ?? "");
      if (ov !== nv) {
        entries.push({
          timestamp: ts,
          tripKey:  newTrip.tripKey,
          tripId:   newTrip.tripId,
          action:   "update",
          field,
          oldValue: ov,
          newValue: nv,
        });
      }
    }
  }
  if (entries.length) await _sb.from("log").insert(entries);
}

// ── api object ───────────────────────────────────────────────────────────────

const api = {
  async listDrivers(activeOnly = true) {
    let q = _sb.from("drivers").select("*").order("priority").order("driverName");
    if (activeOnly) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) sbErr(error, "listDrivers");
    return { ok: true, drivers: data };
  },

  async listBuses(activeOnly = true) {
    let q = _sb.from("buses").select("*").order("orderNum").order("busName");
    if (activeOnly) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) sbErr(error, "listBuses");
    return { ok: true, buses: data };
  },

  async weekData(start, end) {
    const { data, error } = await _sb.rpc("week_data", { p_start: start, p_end: end });
    if (error) sbErr(error, "weekData");
    return data;
  },

  async saveWeekNote(notes) {
    const { error } = await _sb
      .from("week_notes")
      .upsert({ weekStart: "global", notes, lastUpdated: new Date().toISOString() }, { onConflict: "weekStart" });
    if (error) sbErr(error, "saveWeekNote");
    return { ok: true };
  },

  async getTrip(tripKey) {
    const { data, error } = await _sb.from("trips").select("*").eq("tripKey", tripKey).single();
    if (error) sbErr(error, "getTrip");
    return { ok: true, trip: data };
  },

  async getBusAssignments(tripKey) {
    const { data, error } = await _sb.from("bus_assignments").select("*").eq("tripKey", tripKey);
    if (error) sbErr(error, "getBusAssignments");
    return { ok: true, assignments: data };
  },

  async toggleUnavailability(driverName, dateYmd) {
    const { data: existing } = await _sb
      .from("unavailability")
      .select("id")
      .eq("driverName", driverName)
      .eq("dateYmd", dateYmd)
      .maybeSingle();
    if (existing) {
      await _sb.from("unavailability").delete().eq("id", existing.id);
    } else {
      await _sb.from("unavailability").insert({ driverName, dateYmd });
    }
    return { ok: true };
  },

  async batchUnavailability(driverName, dates, mode) {
    if (mode === "remove") {
      await _sb.from("unavailability").delete().eq("driverName", driverName).in("dateYmd", dates);
    } else {
      const rows = dates.map((d) => ({ driverName, dateYmd: d }));
      await _sb.from("unavailability").upsert(rows, { onConflict: "driverName,dateYmd", ignoreDuplicates: true });
    }
    return { ok: true };
  },

  async getChecklist(date) {
    const { data, error } = await _sb.from("checklist").select("*").eq("date", date);
    if (error) sbErr(error, "getChecklist");
    return { ok: true, checklist: data || [] };
  },

  async saveTrip(body) {
    const p = Object.fromEntries(body instanceof URLSearchParams ? body : new URLSearchParams(body));
    const action  = p2str(p.action);
    const tripKey = p2str(p.tripKey);

    // ── Delete ──────────────────────────────────────────────────────────────
    if (action === "delete") {
      const oldTrip = state.tripByKey?.[tripKey] || { tripKey, tripId: p2str(p.tripId) };
      const { error } = await _sb.from("trips").delete().eq("tripKey", tripKey);
      if (error) sbErr(error, "saveTrip.delete");
      await logTripChanges("delete", oldTrip, null);
      return { ok: true, tripKey };
    }

    // ── Create / Update ──────────────────────────────────────────────────────
    const isCreate = action === "create" || !tripKey;
    const key      = isCreate ? generateTripKey() : tripKey;
    const oldTrip  = isCreate ? null : (state.tripByKey?.[tripKey] || null);
    const base     = isCreate ? { tripKey: key } : (oldTrip || { tripKey: key });

    const trip = tripFromParams(p, base, isCreate);
    trip.tripKey = key;

    if (isCreate) {
      trip.tripId    = await generateTripId(trip.departureDate);
      trip.createdAt = new Date().toISOString();
    } else {
      trip.tripId = p2str(p.tripId) || oldTrip?.tripId || "";
    }

    const { data: savedTrip, error: tripErr } = await _sb
      .from("trips")
      .upsert(trip, { onConflict: "tripKey" })
      .select()
      .single();
    if (tripErr) sbErr(tripErr, "saveTrip.upsert");

    // ── Replace bus assignments ──────────────────────────────────────────────
    const existingAssignments = state.assignmentsByTripKey?.[key] || [];
    const incomingBusCount = parseInt(p.busesNeeded) || 0;
    // Guard: if form says 0 buses but state has assignments, something didn't load — keep existing
    if (!isCreate && incomingBusCount === 0 && existingAssignments.length > 0) {
      await logTripChanges("update", savedTrip, oldTrip);
      return { ok: true, trip: savedTrip, assignments: existingAssignments };
    }
    await _sb.from("bus_assignments").delete().eq("tripKey", key);
    const newAssignments = assignmentsFromParams(p, key);
    if (newAssignments.length) {
      const { error: aErr } = await _sb.from("bus_assignments").insert(newAssignments);
      if (aErr) sbErr(aErr, "saveTrip.assignments");
    }

    await logTripChanges(isCreate ? "create" : "update", savedTrip, oldTrip);
    _recentSaves.add(key);
    setTimeout(() => _recentSaves.delete(key), 4000);
    return { ok: true, trip: savedTrip, assignments: newAssignments };
  },

  async setChecklist(tripKey, date, saved, signal) {
    const { error } = await _sb.from("checklist").upsert(
      {
        tripKey, date,
        envelope:   !!saved.envelope,
        reminder:   !!saved.reminder,
        driverInfo: !!saved.driverInfo,
        fuelCard:   !!saved.fuelCard,
        hos:        !!saved.hos,
      },
      { onConflict: "tripKey,date" },
    );
    if (error) console.warn("[checklist] upsert error:", error.message);
    return { ok: !error };
  },
};

// ======================================================
// CONFLICT DETECTION
// ======================================================
function checkPotentialConflicts(trip, assignments) {
  const depY = ymd(parseYMD(trip.departureDate));
  const arrY = ymd(parseYMD(trip.arrivalDate) || parseYMD(trip.departureDate));

  for (const a of assignments) {
    const busId = String(a.busId || "").trim();
    if (!busId || busId === "None" || busId === "WAITING_LIST") continue;

    const existingTrips = state.trips.filter(
      (t) => String(t.tripKey) !== String(trip.tripKey),
    );

    for (const t of existingTrips) {
      const tDepY = ymd(parseYMD(t.departureDate));
      const tArrY = ymd(parseYMD(t.arrivalDate) || parseYMD(t.departureDate));

      if (depY <= tArrY && arrY >= tDepY) {
        const tAssigns = state.assignmentsByTripKey[t.tripKey] || [];
        if (tAssigns.some((ta) => String(ta.busId).trim() === busId)) {
          return {
            busId,
            dateRange: depY === arrY ? depY : `${depY} to ${arrY}`,
            otherTrip: t.destination || "another trip",
          };
        }
      }
    }
  }
  return null;
}

// ======================================================
// DRIVER DOUBLE-BOOKING DETECTION
// ======================================================
function checkDriverDoubleBookings() {
  if (!dom.busGrid || !state.busRows?.length) return;

  const currentTripKey = String(dom.tripKey?.value || "").trim();
  const depStr = $("tripDate")?.value || "";
  const arrStr = $("arrivalDate")?.value || depStr;

  const conflicts = new Set();
  const reliefConflicts = new Set();

  if (depStr) {
    const depDate = parseYMD(depStr);
    const arrDate = parseYMD(arrStr) || depDate;
    if (depDate && arrDate) {
      const depY = ymd(depDate);
      const arrY = ymd(arrDate);

      for (const t of state.trips) {
        if (String(t.tripKey) === currentTripKey) continue;
        const tDep = parseYMD(t.departureDate);
        const tArr = parseYMD(t.arrivalDate) || tDep;
        if (!tDep) continue;
        if (depY <= ymd(tArr) && arrY >= ymd(tDep)) {
          const tAssigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
          for (const ta of tAssigns) {
            const d1 = String(ta.driver1 || "").trim();
            const d2 = String(ta.driver2 || "").trim();
            if (d1 && d1 !== "None") conflicts.add(d1);
            if (d2 && d2 !== "None") conflicts.add(d2);
            const d3 = String(ta.driver3 || "").trim();
            const d4 = String(ta.driver4 || "").trim();
            if (d3 && d3 !== "None") reliefConflicts.add(d3);
            if (d4 && d4 !== "None") reliefConflicts.add(d4);
          }
        }
      }
    }
  }

  for (const name of conflicts) reliefConflicts.delete(name);

  state.driverConflicts = conflicts;
  state.driverReliefConflicts = reliefConflicts;

  state.busRows.forEach((r) => {
    [r.d1Sel, r.d2Sel].forEach((sel) => {
      const v = String(sel.value || "").trim();
      const isPrimary = v && v !== "None" && conflicts.has(v);
      const isRelief  = v && v !== "None" && reliefConflicts.has(v);
      const isConflict = isPrimary || isRelief;
      const wrapper = sel.closest(".select-dropdown");
      const trigger = wrapper?.querySelector(".select-trigger");
      if (wrapper) wrapper.classList.toggle("driver-conflict", !!isConflict);
      if (trigger) {
        trigger.title = isPrimary
          ? `${v} is already assigned as a driver on these dates`
          : isRelief
          ? `${v} is already assigned as a relief driver on these dates`
          : "";
      }
    });
  });
}

// ======================================================
// REAL-TIME SUBSCRIPTIONS
// ======================================================

const _recentSaves = new Set();

function onTripChange(payload) {
  if (state.pendingWrite) return;
  const trip = payload.eventType === "DELETE" ? payload.old : payload.new;
  if (!trip?.tripKey) return;
  if (_recentSaves.has(trip.tripKey)) return;

  if (payload.eventType === "DELETE") {
    state.trips = state.trips.filter((t) => t.tripKey !== trip.tripKey);
    delete state.tripByKey[trip.tripKey];
    delete state.assignmentsByTripKey[trip.tripKey];
    scheduleAgendaReflow();
    return;
  }

  const { start, end } = getWeekRange();
  const dep = trip.departureDate;
  const arr = trip.arrivalDate || dep;
  if (!dep || dep > end || arr < start) {
    if (dep) clearCacheForTrip(dep);
    return;
  }

  const sanitized = sanitizeWeekResp({ ok: true, trips: [trip], assignments: [] }).trips[0];
  if (!sanitized) return;
  state.tripByKey[sanitized.tripKey] = sanitized;
  const idx = state.trips.findIndex((t) => t.tripKey === sanitized.tripKey);
  if (idx >= 0) state.trips[idx] = sanitized;
  else state.trips.push(sanitized);
  scheduleAgendaReflow();
}

function onAssignmentChange(payload) {
  const row = payload.new || payload.old;
  const tripKey = row?.tripKey;
  if (!tripKey || state.pendingWrite?.tripKey === tripKey) return;
  if (_recentSaves.has(tripKey)) return;
  api.getBusAssignments(tripKey).then((resp) => {
    if (resp.assignments) {
      state.assignmentsByTripKey[tripKey] = resp.assignments
        .map(normalizeAssignment)
        .filter(Boolean);
      scheduleAgendaReflow();
    }
  });
}

let _realtimeInit = false;
let _presenceChannel = null;

function initRealtime() {
  if (_realtimeInit) return;
  _realtimeInit = true;

  _sb.channel("trip-board-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, onTripChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "bus_assignments" }, onAssignmentChange)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") console.info("[realtime] connected");
    });

  _presenceChannel = _sb.channel("trip-board-presence");
  _presenceChannel
    .on("presence", { event: "sync" }, () => {
      if (typeof onPresenceSync === "function") {
        onPresenceSync(_presenceChannel.presenceState());
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && state.profile?.id) {
        await _presenceChannel.track({
          userId:      state.profile.id,
          displayName: state.profile.displayName,
          avatarColor: state.profile.avatarColor,
          avatarUrl:   state.profile.avatarUrl,
        });
      }
    });
}

async function retrackPresence() {
  if (!_presenceChannel || !state.profile?.id) return;
  await _presenceChannel.track({
    userId:      state.profile.id,
    displayName: state.profile.displayName,
    avatarColor: state.profile.avatarColor,
    avatarUrl:   state.profile.avatarUrl,
  });
}

// ======================================================
// ERROR LOGGING
// ======================================================
const errorLogger = {
  async log(error, context = {}) {
    console.error("[errorLogger]", error?.message || error, context);
  },
};

window.addEventListener("error", (e) => {
  errorLogger.log(e.error || e.message, {
    type: "global_error",
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  errorLogger.log(e.reason, {
    type: "unhandled_rejection",
  });
});
