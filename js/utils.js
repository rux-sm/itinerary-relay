// ======================================================
// 5) BASIC UTILS
// ======================================================
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function debounce(fn, wait = 120) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeUUID() {
  try {
    return crypto.randomUUID();
  } catch { }
  return `tk_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clipText(s, n = 240) {
  const t = String(s || "").trim();
  return !t ? "" : t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

function asArray(x) {
  return Array.isArray(x) ? x : [];
}

function asStr(x) {
  return x == null ? "" : String(x);
}

function asInt(x, def = 0) {
  const n = parseInt(x, 10);
  return isNaN(n) ? def : n;
}

const MODAL_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalReturnFocusMap = new WeakMap();

function getFocusableIn(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

function openModalA11y(modalEl, preferredFocusEl) {
  if (!modalEl) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    modalReturnFocusMap.set(modalEl, active);
  }

  modalEl.hidden = false;
  requestAnimationFrame(() => {
    if (preferredFocusEl instanceof HTMLElement && !preferredFocusEl.disabled) {
      preferredFocusEl.focus();
      return;
    }
    const [first] = getFocusableIn(modalEl);
    if (first) first.focus();
  });
}

function closeModalA11y(modalEl) {
  if (!modalEl) return;
  modalEl.hidden = true;

  const returnEl = modalReturnFocusMap.get(modalEl);
  modalReturnFocusMap.delete(modalEl);
  if (returnEl instanceof HTMLElement && document.contains(returnEl)) {
    returnEl.focus();
  }
}

function trapModalFocus(modalEl, event) {
  const focusables = getFocusableIn(modalEl);
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

// ======================================================
// 6) DATE + WEEK UTILS
// ======================================================
function toLocalDateInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDateForToast(dateStr) {
  if (!dateStr) return "";
  const d = parseYMD(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ymd(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeek(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();

  if (!state.weekStartsOnMonday) {
    date.setDate(date.getDate() - day);
    return date;
  }
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function getDayIds() {
  return state.weekStartsOnMonday
    ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
}

function getWeekDates(base = state.currentDate) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(ymd(addDays(base, i)));
  return out;
}

function getWeekRange(base = state.currentDate) {
  const dates = getWeekDates(base);
  return {
    start: dates[0],
    end: dates[6],
    notesKey: dates[state.weekStartsOnMonday ? 0 : 1],
  };
}

function parseYMD(s) {
  if (!s) return null;
  const iso = String(s).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ======================================================
// 7) TIME UTILS
// ======================================================
function normalizeTime(t) {
  if (!t) return "";
  if (t instanceof Date && !isNaN(t.getTime())) {
    return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  }
  const s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (m) {
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const ap = m[4].toLowerCase();
    if (ap === "pm" && hh !== 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const mIso = s.match(/T(\d{2}):(\d{2})/);
    if (mIso) return `${mIso[1]}:${mIso[2]}`;
  }

  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    return `${String(d2.getHours()).padStart(2, "0")}:${String(d2.getMinutes()).padStart(2, "0")}`;
  }
  return "";
}

function formatTime12(timeValue) {
  const hhmm = normalizeTime(timeValue);
  if (!hhmm) return "";
  let [hh, mm] = hhmm.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function truthyRequirement(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "on";
}

function setRequirementTogglesFromTrip(t = {}) {
  const ids = ["req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2", "reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi", "driverInfoSent", "tripReminderSent"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute("aria-pressed", truthyRequirement(t[id]) ? "true" : "false");
  });
}

function resetRequirementToggles() {
  document.querySelectorAll(".rux-btn--toggle").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
  });
}

// ======================================================
// 7.5) ASSIGNMENT NORMALIZATION
// ======================================================
function normalizeAssignment(a) {
  if (!a || typeof a !== "object") return null;
  return {
    busId: String(a.busId || "").trim(),
    busNumber: Number(a.busNumber) || 0,
    driver1: String(a.driver1 || "").trim(),
    driver2: String(a.driver2 || "").trim(),
    driver3: String(a.driver3 || "").trim(),
    driver4: String(a.driver4 || "").trim(),
    driver1Status: String(a.driver1Status || "").trim(),
    driver2Status: String(a.driver2Status || "").trim(),
    driver3Status: String(a.driver3Status || "").trim(),
    driver4Status: String(a.driver4Status || "").trim(),
    driver1Pay: String(a.driver1Pay || "").trim(),
    driver2Pay: String(a.driver2Pay || "").trim(),
    driver3Pay: String(a.driver3Pay || "").trim(),
    driver4Pay: String(a.driver4Pay || "").trim(),
  };
}

// ======================================================
// 8) LIFT UTILS
// ======================================================
function truthyLift(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;

  const s = String(v).trim().toLowerCase();
  return (
    s === "true" ||
    s === "yes" ||
    s === "y" ||
    s === "1" ||
    s === "on" ||
    s === "lift" ||
    s === "x" ||
    s === "✅"
  );
}

function computeLiftSet() {
  const set = new Set();

  for (const b of state.busesList || []) {
    const rawHasLift =
      b.hasLift ?? b.lift ?? b.wheelchairLift ?? b.wheelchair ?? b.wcLift ?? b.accessible;

    const has = truthyLift(rawHasLift);
    const busKey = String(b.busId ?? b.id ?? b.busNumber ?? "").trim();

    if (has && busKey) set.add(busKey);
  }

  return set;
}

function truthySleeper(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;

  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "sleeper";
}

function computeSleeperSet() {
  const set = new Set();

  for (const b of state.busesList || []) {
    const rawHasSleeper = b.hasSleeper ?? b.sleeper;
    const has = truthySleeper(rawHasSleeper);
    const busKey = String(b.busId ?? b.id ?? b.busNumber ?? "").trim();

    if (has && busKey) set.add(busKey);
  }
  return set;
}

// ======================================================
// 9) PLATFORM / LAYOUT UTILS
// ======================================================
function isMobileOnly() {
  return false;
}

function stackOffset(rowH, barH, step, laneCount) {
  const stackH = barH + (laneCount - 1) * step;
  return Math.max(0, Math.round((rowH - 1 - stackH) / 2));
}

function waitForAgendaPaint(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (state.weekRenderDoneResolver === done) state.weekRenderDoneResolver = null;
      resolve();
    }, timeoutMs);

    function done() {
      clearTimeout(t);
      resolve();
    }

    state.weekRenderDoneResolver = done;
  });
}

// ======================================================
// 10) RESPONSE SANITIZING / OK NORMALIZATION
// ======================================================
function safeOk(resp) {
  if (!resp || typeof resp !== "object") return false;
  const ok = resp.ok;
  if (ok === true) return true;
  const s = String(ok).trim().toLowerCase();
  return s === "true" || s === "ok" || s === "1";
}

function sanitizeWeekResp(resp) {
  const ok = safeOk(resp);

  function validYmd(s) {
    const d = parseYMD(asStr(s).slice(0, 10));
    return d ? ymd(d) : "";
  }

  const trips = asArray(resp?.trips)
    .map((t) => {
      const tripKey = asStr(t?.tripKey).trim();
      return {
        ...t,
        tripKey,
        destination: asStr(t?.destination).trim(),
        customer: asStr(t?.customer).trim(),
        contactName: asStr(t?.contactName).trim(),
        phone: asStr(t?.phone).trim(),
        departureDate: validYmd(t?.departureDate),
        arrivalDate: validYmd(t?.arrivalDate),
        departureTime: normalizeTime(t?.departureTime),
        spotTime: normalizeTime(t?.spotTime),
        arrivalTime: normalizeTime(t?.arrivalTime),
        busesNeeded: String(clamp(asInt(t?.busesNeeded, 0), 0, 10) || ""),
        tripColor: asStr(t?.tripColor).trim(),
        itineraryStatus: asStr(t?.itineraryStatus).trim(),
        contactStatus: asStr(t?.contactStatus).trim(),
        paymentStatus: asStr(t?.paymentStatus).trim(),
        driverStatus: asStr(t?.driverStatus).trim(),
        invoiceStatus: asStr(t?.invoiceStatus).trim(),
        invoiceNumber: asStr(t?.invoiceNumber).trim(),
        paymentType: asStr(t?.paymentType),
        estimatedMileage: asStr(t?.estimatedMileage),
        drivingHours: asStr(t?.drivingHours),
        onDutyHours:  asStr(t?.onDutyHours),
        quotedPrice: asStr(t?.quotedPrice).replace(/^\$/, ""),
        driverInfoSent: !!t?.driverInfoSent && t?.driverInfoSent !== "false",
        tripReminderSent: !!t?.tripReminderSent && t?.tripReminderSent !== "false",
        tripMiles: asStr(t?.tripMiles),
        datePaid: validYmd(t?.datePaid),
        notes: asStr(t?.notes),
        comments: asStr(t?.comments),
        itinerary: asStr(t?.itinerary),
        itineraryPdfUrl: asStr(t?.itineraryPdfUrl).trim(),
        envelopePickup: asStr(t?.envelopePickup),
        envelopeTripContact: asStr(t?.envelopeTripContact),
        envelopeTripPhone: asStr(t?.envelopeTripPhone),
        envelopeTripNotes: asStr(t?.envelopeTripNotes),
      };
    })
    .filter((t) => t.tripKey);

  const assignments = asArray(resp?.assignments)
    .map((a) => ({
      tripKey: asStr(a?.tripKey).trim(),
      busId: asStr(a?.busId).trim(),
      driver1: asStr(a?.driver1).trim(),
      driver2: asStr(a?.driver2).trim(),
      driver3: asStr(a?.driver3).trim(),
      driver4: asStr(a?.driver4).trim(),
      driver1Status: asStr(a?.driver1Status).trim(),
      driver2Status: asStr(a?.driver2Status).trim(),
      driver3Status: asStr(a?.driver3Status).trim(),
      driver4Status: asStr(a?.driver4Status).trim(),
      driver1Pay: asStr(a?.driver1Pay).trim(),
      driver2Pay: asStr(a?.driver2Pay).trim(),
      driver3Pay: asStr(a?.driver3Pay).trim(),
      driver4Pay: asStr(a?.driver4Pay).trim(),
      busNumber: Number(a?.busNumber) || 0,
    }))
    .filter((a) => a.tripKey);

  const weekNotes = asStr(resp?.weekNotes);

  const unavailability = asArray(resp?.unavailability)
    .map((u) => ({
      driverName: asStr(u?.driverName).trim(),
      dateYmd: asStr(u?.dateYmd).trim(),
    }))
    .filter((u) => u.driverName && u.dateYmd);

  return { ok, trips, assignments, weekNotes, unavailability, error: resp?.error };
}
