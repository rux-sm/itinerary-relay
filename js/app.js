// ======================================================
// 1) THEME
// ======================================================
function initThemeSystem() {
  const html = document.documentElement;
  const toggles = [
    document.getElementById("themeToggle"),
    document.getElementById("themeToggle2"),
  ].filter(Boolean);

  const savedTheme = localStorage.getItem("theme") || "dark";
  html.setAttribute("data-theme", savedTheme);

  const updateIcons = (theme) => {
    const iconName = theme === "light" ? "dark_mode" : "light_mode";
    toggles.forEach((btn) => {
      // For themeToggle2 (dropdown), the icon is the first span.
      // For themeToggle (topbar), it's also the first/only span.
      const span = btn.querySelector("span");
      if (span) span.textContent = iconName;
    });
  };

  // Initial state
  updateIcons(savedTheme);

  const switchTheme = () => {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";

    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);

    updateIcons(newTheme);
  };

  toggles.forEach((btn) => {
    if (btn) btn.addEventListener("click", switchTheme);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeSystem);
} else {
  initThemeSystem();
}

// ── Empty-field class toggle (date/time inputs + default selects) ────
// Adds/removes .is-empty so CSS can dim unfilled placeholders
(function initEmptyFieldTracking() {
  const DATE_TIME = 'input[type="date"], input[type="time"]';
  const PLACEHOLDER_SELECTS = "#busesNeeded, #tripColor";
  const ALL = DATE_TIME + ", " + PLACEHOLDER_SELECTS;

  function sync(el) {
    el.classList.toggle("is-empty", !el.value);
  }
  function syncAll() {
    document.querySelectorAll(ALL).forEach(sync);
  }
  document.addEventListener("change", (e) => {
    if (e.target.matches(ALL)) sync(e.target);
  });
  // Run on load and after any programmatic .reset()
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAll);
  } else {
    syncAll();
  }
  // Re-sync when forms are reset or trip data is loaded
  document.addEventListener("reset", () => requestAnimationFrame(syncAll));
  // Expose for manual calls after programmatic value changes
  window.syncEmptyFields = syncAll;
})();

// ======================================================
// 2) CONFIG
// ======================================================
const CONFIG = {
  APP_NAME: "ETB Schedule",
  APP_VERSION: "",
  ENDPOINT:
    "https://script.google.com/macros/s/AKfycbzSsVByHnMuzdmaITv2Ht-q1hUQ0y5cVVIEzV6E-h7-1EhnVWJDYlhj5K4RhY0wldBk/exec",
  BUS_LANES: ["218", "763", "470", "133", "506", "746", "607", "897", "898", "474"],
  MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  JSONP_TIMEOUT: 20000,

  WEEK_CACHE_MAX_AGE_MS: 5 * 60 * 1000, // 5 minutes
  CONFLICT_DEFER_BARS_THRESHOLD: 70, // defer conflict scan if many bars
  CACHE_TTL_DRIVERS: 60 * 60 * 1000, // 1 hour
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

function getVersionLabel() {
  const version = String(CONFIG.APP_VERSION || "").trim();
  if (!version) return "";
  return `v${version}`;
}

function initAppVersionDisplay() {
  const versionLabel = getVersionLabel();
  const fullTitle = versionLabel ? `${CONFIG.APP_NAME} ${versionLabel}` : `${CONFIG.APP_NAME}`;

  document.title = fullTitle;

  const headerBadge = document.getElementById("appVersionBadge");
  if (headerBadge) {
    headerBadge.textContent = versionLabel;
    headerBadge.classList.toggle("u-hidden", !versionLabel);
  }

  const menuItem = document.getElementById("appVersionMenuItem");
  if (menuItem) {
    menuItem.textContent = versionLabel ? `Version ${versionLabel}` : "Version";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppVersionDisplay);
} else {
  initAppVersionDisplay();
}

const CACHE = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() > data.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return data.value;
    } catch {
      return null;
    }
  },
  set(key, value, ttlMs) {
    try {
      const payload = {
        value,
        expiry: Date.now() + ttlMs,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch { }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch { }
  },
  clearAll() {
    try {
      // Clear drivers/buses/weeks but maybe keep prefs?
      // For simplicity, we just clear specific keys we know about
      // or loop through keys. Let's precise-clear to be safe.
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("cache_") || k.startsWith("week_")) {
          localStorage.removeItem(k);
        }
      });
    } catch { }
  },
};

// ======================================================
// 3) DOM
// ======================================================
const $ = (id) => document.getElementById(id);

const dom = {
  weekStartSunBtn: $("weekStartSunBtn"),
  weekStartMonBtn: $("weekStartMonBtn"),

  tripForm: document.querySelector('[data-js="trip-form"]') || $("tripForm"),
  hiddenIframe: $("hidden_iframe"),

  action: $("action"),
  tripKey: $("tripKey"),
  tripId: $("tripId"),
  tripIdBadge: $("tripIdBadge"),

  saveBtn: $("saveBtn"),
  deleteBtn: $("deleteBtn"),
  newBtn: $("newBtn"),
  requirementsSection:
    document.querySelector('[data-js="trip-requirements-section"]') || $("requirementsSection"),
  itineraryModal: $("itineraryModal"),
  itineraryField: $("itinerary"),
  itineraryModalField: $("itineraryModalField"),
  itineraryCopyBtn: $("itineraryCopyBtn"),
  itinerarySaveBtn: $("itinerarySaveBtn"),
  itineraryPdfUrlInput: $("itineraryPdfUrl"),

  busesNeeded: $("busesNeeded"),
  busGrid: document.querySelector('[data-js="trip-bus-grid"]') || $("busGrid"),
  assignmentsOverridesSection:
    document.querySelector('[data-js="trip-assignments-section"]') ||
    $("assignmentsOverridesSection"),

  agendaBody: document.querySelector('[data-js="schedule-agenda-body"]') || $("agendaBody"),

  tripInputBtn: $("tripInputBtn"),
  panelStart: document.querySelector('[data-js="panel-sidebar-left"]') || $("panelStart"),
  panelEnd: document.querySelector('[data-js="panel-sidebar-right"]') || $("panelEnd"),

  headerWeek: $("headerWeek"), // Added for date title updates
  weekWrapper: $("dateWrapper"), // Added for width sync
  weekSyncStatus: $("weekSyncStatus"),
  weekPicker: $("weekPicker"),
  agendaLeftBtn: $("agendaLeftBtn"),

  todayBtn: $("todayBtn"),
  prevWeekBtn: $("prevWeekBtn"),
  nextWeekBtn: $("nextWeekBtn"),

  conflictPanel:
    document.querySelector('[data-js="schedule-conflict-panel"]') || $("conflictPanel"),
  conflictList: document.querySelector('[data-js="schedule-conflict-list"]') || $("conflictList"),
  conflictBadge:
    document.querySelector('[data-js="schedule-conflict-badge"]') || $("overflowBadge"),

  tripDetailsModal: $("tripDetailsModal"),
  tripDetailsBody: $("tripDetailsBody"),

  driverWeekCard: document.querySelector('[data-js="panel-card-drivers"]') || $("driverWeekCard"),
  notesCard: document.querySelector('[data-js="panel-card-notes"]') || $("notesCard"),
  notesWeekTitle: $("notesWeekTitle"),
  scheduleNotes: $("scheduleNotes"),
  saveNotesBtn: $("saveNotesBtn"),
  tripInfoCard: document.querySelector('[data-js="panel-card-trip-info"]') || $("tripInfoCard"),
  driverWeekHeadRow:
    document.querySelector('[data-js="driver-week-head-row"]') || $("driverWeekHeadRow"),
  driverWeekBody: document.querySelector('[data-js="driver-week-body"]') || $("driverWeekBody"),

  driversBtn: $("driversBtn"),
  notesBtn: $("notesBtn"),
  todoBtn: $("todoBtn"),
  todayHighlightBtn: $("todayHighlightBtn"),
  todoCard: document.querySelector('[data-js="panel-card-todo"]') || $("todoCard"),
  todoHeader: $("todoHeader"),
  todoList: $("todoList"),
  logBtn: $("logBtn"),
  logRefreshBtn: $("logRefreshBtn"),
  logClearFilterBtn: $("logClearFilterBtn"),
  logFilterBadge: $("logFilterBadge"),
  logCard: document.querySelector('[data-js="panel-card-log"]') || $("logCard"),
  logList: $("logList"),
  waitingListBtn: $("waitingListBtn"),
  quoteBtn: $("quoteBtn"),
  waitingBody: document.querySelector('[data-js="schedule-waiting-body"]') || $("waitingBody"),
  waitingCard: $("waitingCard"),

  // Quote Calculator
  quoteCard: document.querySelector('[data-js="panel-card-quote"]') || $("quoteCard"),
  quoteLDRate: $("quoteLDRate"),
  quoteDeadMiles: $("quoteDeadMiles"),
  quoteTripType: $("quoteTripType"),
  quoteReliefDriver: $("quoteReliefDriver"),
  quoteHalfDay: $("quoteHalfDay"),
  quoteDaysContainer: $("quoteDaysContainer"),
  quoteAddDayBtn: $("quoteAddDayBtn"),
  quoteDaysBreakdown: $("quoteDaysBreakdown"),
  quoteMileageCost: $("quoteMileageCost"),
  quoteDriver1Pay: $("quoteDriver1Pay"),
  quoteDriver2Row: $("quoteDriver2Row"),
  quoteDriver2Pay: $("quoteDriver2Pay"),
  quoteFinalTotal: $("quoteFinalTotal"),

  // Settings Menu
  settingsBtn: $("settingsBtn"),
  settingsMenu: $("settingsMenu"),
  todayBtn2: $("todayBtn2"),
  themeToggle: $("themeToggle"),
  themeText2: $("themeText2"),
  printBtn2: $("printBtn2"),
  printBtn2Full: $("printBtn2Full"),
  weekStartToggle: $("weekStartToggle"),
  refreshBtn2: $("refreshBtn2"),
  nextDayReportBtn: $("nextDayReportBtn"),
  // Next Day Report Modal
  nextDayReportModal: $("nextDayReportModal"),
  nextDayReportBody: $("nextDayReportBody"),
  closeNextDayReportBtn: $("closeNextDayReportBtn"),
  closeNextDayReportBackdrop: $("closeNextDayReportBackdrop"),
  printNextDayReportBtn: $("printNextDayReportBtn"),
  nextDayReportDateInput: $("nextDayReportDateInput"),

  // Daily Maintenance Plan Modal
  dailyMaintenancePlanBtn: $("dailyMaintenancePlanBtn"),
  dailyMaintenancePlanModal: $("dailyMaintenancePlanModal"),
  dailyMaintenancePlanBody: $("dailyMaintenancePlanBody"),
  closeDailyMaintenancePlanBtn: $("closeDailyMaintenancePlanBtn"),
  closeDailyMaintenancePlanBackdrop: $("closeDailyMaintenancePlanBackdrop"),
  printDailyMaintenancePlanBtn: $("printDailyMaintenancePlanBtn"),
  dailyMaintenancePlanDateInput: $("dailyMaintenancePlanDateInput"),

  // Driver Contact Modal
  driverContactModal: $("driverContactModal"),
  driverContactBody: $("driverContactBody"),
  driverReminderBody: $("driverReminderBody"),
  closeDriverContactBtn: $("closeDriverContactBtnFooter"),
  closeDriverContactBackdrop: $("closeDriverContactBackdrop"),
  copyDriverContactBtn: $("copyDriverContactBtn"),
  copyDriverReminderBtn: $("copyDriverReminderBtn"),
  tripInfoBody: $("tripInfoBody"),
  copyTripInfoBtn: $("copyTripInfoBtn"),
  driverWeekScheduleModal: $("driverWeekScheduleModal"),
  driverWeekSchedulePreview: $("driverWeekSchedulePreview"),
  copyDriverWeekScheduleBtn: $("copyDriverWeekScheduleBtn"),

  // Envelope Modal
  envelopeModal: $("envelopeModal"),
  envelopeModalPages: $("envelopeModalPages"),
  envelopeAssignmentSelect: $("envelopeAssignmentSelect"),
  envelopeFormatSelect: $("envelopeFormatSelect"),
  envelopeSaveBtn: $("envelopeSaveBtn"),
  envelopePrintBtn: $("envelopePrintBtn"),
  envelopeYellowBtn: $("envelopeYellowBtn"),
  envelopeWhiteBtn: $("envelopeWhiteBtn"),
  closeEnvelopeBtn: $("closeEnvelopeBtn"),
  closeEnvelopeBackdrop: $("closeEnvelopeBackdrop"),

  // Context Menu
  ctxMenu: $("tripContextMenu"),
  ctxHeader: $("ctxHeader"),
  ctxEditBtn: $("ctxEditBtn"),
  ctxViewBtn: $("ctxViewBtn"),
  ctxEnvelopeBtn: $("ctxEnvelopeBtn"),
  ctxOpenItineraryPdfBtn: $("ctxOpenItineraryPdfBtn"),
  ctxEditTripInfoBtn: $("ctxEditTripInfoBtn"),
  ctxAttachItineraryPdfBtn: $("ctxAttachItineraryPdfBtn"),
  ctxRemoveItineraryPdfBtn: $("ctxRemoveItineraryPdfBtn"),
  ctxContactNotRequiredBtn: $("ctxContactNotRequiredBtn"),
  ctxItineraryNotRequiredBtn: $("ctxItineraryNotRequiredBtn"),
  ctxCopyBtn: $("ctxCopyBtn"),

  // Cell Context Menu
  cellCtxMenu: $("cellContextMenu"),
  ctxNewTripBtn: $("ctxNewTripBtn"),

  // Hidden file input for itinerary PDF upload
  itineraryPdfInput: $("itineraryPdfInput"),
};

const SELECTORS = {
  layoutPanelsHook: '[data-js="layout-panels"]',
  scheduleAgendaHeaderHook: '[data-js="schedule-agenda-header"]',
  scheduleMainCardHook: '[data-js="schedule-main-card"]',
  scheduleGridTableHook: '[data-js="schedule-grid-table"]',
  scheduleGridWrapHook: '[data-js="schedule-grid-wrap"]',
};

function getLayoutPanelsEl() {
  return document.querySelector(SELECTORS.layoutPanelsHook);
}

function getScheduleGridWrapEl() {
  return document.querySelector(SELECTORS.scheduleGridWrapHook);
}

function getScheduleGridTableEl() {
  return document.querySelector(SELECTORS.scheduleGridTableHook);
}

function getScheduleAgendaHeaderEl() {
  return document.querySelector(SELECTORS.scheduleAgendaHeaderHook);
}

function getScheduleMainCardEl() {
  return document.querySelector(SELECTORS.scheduleMainCardHook);
}

function warnOnMissingRequiredHooks() {
  const requiredHooks = [
    ["layout panels", SELECTORS.layoutPanelsHook],
    ["schedule main card", SELECTORS.scheduleMainCardHook],
    ["schedule agenda header", SELECTORS.scheduleAgendaHeaderHook],
    ["schedule grid wrapper", SELECTORS.scheduleGridWrapHook],
    ["schedule grid table", SELECTORS.scheduleGridTableHook],
  ];

  const missing = requiredHooks.filter(([, selector]) => !document.querySelector(selector));
  if (!missing.length) return;

  console.warn(
    "Missing required data-js hooks:",
    missing.map(([name, selector]) => `${name} (${selector})`),
  );
}

// ======================================================
// 4) STATE
// ======================================================
const state = {
  currentDate: new Date(),
  weekStartsOnMonday: false,

  busesList: [],
  driversList: [],
  busRows: [],
  driverConflicts: new Set(),

  trips: [],
  assignmentsByTripKey: {},
  tripByKey: {},
  busRowIndex: new Map(),

  pendingWrite: null,
  verifyFallbackTimer: null,
  toastTimer: null,
  weekLoadSafetyTimer: null,
  statusNoticeExpiryTimer: null,
  activeStatusNotice: null,
  statusNoticeToken: 0,
  baseWeekSyncStatus: {
    mode: "loading",
    message: "Loading\u2026",
    progress: null,
    indeterminate: true,
  },

  progressCreepTimer: null,
  weekRenderDoneResolver: null,

  barElByKey: new Map(),
  renderPass: 0,

  weekCache: new Map(),
  weekInFlight: new Map(),
  weekReqId: 0,

  barMetrics: null,
  lastColMetrics: null,

  pendingConflictJob: null,

  // Pending trip key for itinerary PDF upload
  pendingItineraryTripKey: null,

  // Notes tracking
  notesDirty: false,
  savedNotesValue: "",
  notesLoaded: false,

  // Trip form dirty tracking
  tripFormDirty: false,

  // Abort controller for cancelling in-flight requests on week change
  activeAbortController: null,

  // Flag to prevent duplicate event listener wiring
  formListenersWired: false,

  // Driver unavailability tracking
  unavailabilityByDriver: {}, // { "Driver Name": { "YYYY-MM-DD": true } }

  dragSelection: {
    active: false,
    driver: null,
    mode: null, // "add" or "remove"
    dates: new Set(),
  },

  lastFocusedElement: null,

  // Card panel assignments: tracks which card is in which panel (left/right)
  // Format: { "trip" | "drivers" | "notes": "left" | "right" | null }
  cardPanelAssignments: {},
};

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
  // Format: "Mon, Jan 2"
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
  const ids = ["req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2", "reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi", "driverInfoSent", "tripReminderSent", "tripReviewed"];
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
  return window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth <= 900;
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
        departureDate: asStr(t?.departureDate).slice(0, 10),
        arrivalDate: asStr(t?.arrivalDate).slice(0, 10),
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
        // Core text fields
        paymentType: asStr(t?.paymentType),
        estimatedMileage: asStr(t?.estimatedMileage),
        drivingHours: asStr(t?.drivingHours),
        onDutyHours:  asStr(t?.onDutyHours),
        quotedPrice: asStr(t?.quotedPrice),
        driverInfoSent: !!t?.driverInfoSent && t?.driverInfoSent !== "false",
        tripReminderSent: !!t?.tripReminderSent && t?.tripReminderSent !== "false",
        tripReviewed: !!t?.tripReviewed && t?.tripReviewed !== "false",
        tripMiles: asStr(t?.tripMiles),
        datePaid: asStr(t?.datePaid).trim().slice(0, 10),
        notes: asStr(t?.notes),
        comments: asStr(t?.comments),
        itinerary: asStr(t?.itinerary),
        itineraryPdfUrl: asStr(t?.itineraryPdfUrl).trim(),
        // Envelope-specific fields (optional; may not be present in older data)
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

  // Preserve weekNotes for caching
  const weekNotes = asStr(resp?.weekNotes);

  // Preserve unavailability data
  const unavailability = asArray(resp?.unavailability)
    .map((u) => ({
      driverName: asStr(u?.driverName).trim(),
      dateYmd: asStr(u?.dateYmd).trim(),
    }))
    .filter((u) => u.driverName && u.dateYmd);

  return { ok, trips, assignments, weekNotes, unavailability, error: resp?.error };
}

// ======================================================
// 11) FETCH + RETRY + API
// ======================================================

/**
 * Modern fetch-based API call with automatic retry and timeout
 * Benefits over JSONP:
 * - 10% faster (no script element overhead)
 * - Better error detection (HTTP status codes)
 * - CSP compatible (no script injection)
 * - No global namespace pollution
 * - Request cancellation support
 */
async function fetchAPI(fn, params = {}, timeoutMs = CONFIG.JSONP_TIMEOUT) {
  return withRetry(
    async (attempt) => {
      const url = new URL(CONFIG.ENDPOINT);
      url.searchParams.set("fn", fn);

      // Add cache buster
      url.searchParams.set("_", Date.now().toString());

      // Add all parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          mode: "cors",
          cache: "no-cache",
          credentials: "omit",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          err.status = response.status;
          err.url = url.toString();
          throw err;
        }

        return await response.json();
      } catch (err) {
        clearTimeout(timeoutId);

        // Better error messages
        if (err.name === "AbortError") {
          const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
          timeoutErr.url = url.toString();
          throw timeoutErr;
        }

        if (err instanceof TypeError && err.message.includes("fetch")) {
          const networkErr = new Error("Network error - check connection");
          networkErr.url = url.toString();
          networkErr.originalError = err;
          throw networkErr;
        }

        throw err;
      }
    },
    {
      tries: 3,
      baseDelayMs: 500,
      totalTimeoutMs: 60000, // Total timeout for all tries (3 * 20s = 60s)
      shouldRetry: (err) => {
        // Don't retry client errors (4xx)
        if (err.status && err.status >= 400 && err.status < 500) return false;
        return true;
      },
    },
  );
}

/**
 * Retry wrapper with exponential backoff
 * Now works better with fetch's faster error detection
 * Includes total timeout to prevent excessive operation duration
 */
async function withRetry(
  fn,
  {
    tries = 3,
    baseDelayMs = 350,
    maxDelayMs = 2000,
    jitter = 0.25,
    totalTimeoutMs = 30000,
    shouldRetry = (err) => true,
  } = {},
) {
  const deadline = Date.now() + totalTimeoutMs;
  let lastErr;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      // Check if we've exceeded total timeout
      if (Date.now() > deadline) {
        throw new Error(`Operation timed out after ${totalTimeoutMs}ms`);
      }
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

/**
 * Main API - Modern fetch-based implementation
 */
const api = {
  listDrivers(activeOnly = true, bustCache = false) {
    const params = { activeOnly: activeOnly ? "true" : "false" };
    if (bustCache) params.bustCache = "true";
    return fetchAPI("listDrivers", params);
  },

  listBuses(activeOnly = true, bustCache = false) {
    const params = { activeOnly: activeOnly ? "true" : "false" };
    if (bustCache) params.bustCache = "true";
    return fetchAPI("listBuses", params);
  },

  weekData(start, end, notesKey) {
    return withRetry(
      async () => {
        return await fetchAPI("weekData", { start, end, notesKey });
      },
      {
        tries: 3,
        shouldRetry: (err) => {
          // Retry on timeout or network errors, but not on 4xx errors
          if (err.status >= 400 && err.status < 500) return false;
          return true;
        },
      },
    );
  },

  saveWeekNote(notes) {
    return fetchAPI("saveWeekNote", { notes });
  },

  getTrip(tripKey) {
    return withRetry(
      async () => {
        const resp = await fetchAPI("getTrip", { tripKey });
        if (resp && resp.ok === false) {
          throw new Error(resp.error || "Trip not found");
        }
        return resp;
      },
      { tries: 2, totalTimeoutMs: 65000 },
    );
  },

  getBusAssignments(tripKey) {
    return withRetry(
      async () => {
        const resp = await fetchAPI("getBusAssignments", { tripKey });
        if (resp && resp.ok === false) {
          throw new Error(resp.error || "Assignments not found");
        }
        return resp;
      },
      { tries: 2, totalTimeoutMs: 65000 },
    );
  },

  toggleUnavailability(driverName, dateYmd) {
    return fetchAPI("toggleUnavailability", { driverName, dateYmd });
  },

  batchUnavailability(driverName, dates, mode) {
    return fetchAPI("batchUnavailability", {
      driverName,
      dates: dates.join(","),
      mode,
    });
  },

  getChecklist(date) {
    return fetchAPI("getChecklist", { date });
  },

  async setChecklist(tripKey, date, saved) {
    const body = new URLSearchParams({
      action: "setChecklist",
      tripKey,
      date,
      envelope:   String(!!saved.envelope),
      reminder:   String(!!saved.reminder),
      driverInfo: String(!!saved.driverInfo),
      fuelCard:   String(!!saved.fuelCard),
      hos:        String(!!saved.hos),
    });
    const resp = await fetch(CONFIG.ENDPOINT, {
      method: "POST",
      body,
      mode: "cors",
      credentials: "omit",
    }).then((r) => r.json());
    if (!resp?.ok) console.warn("[checklist setChecklist] GAS error:", resp?.error, resp);
    return resp;
  },
};

/**
 * Proactive Conflict Check
 * Returns conflict details if trip overlaps with existing trip on same bus
 */
function checkPotentialConflicts(trip, assignments) {
  const depY = ymd(parseYMD(trip.departureDate));
  const arrY = ymd(parseYMD(trip.arrivalDate) || parseYMD(trip.departureDate));

  for (const a of assignments) {
    const busId = String(a.busId || "").trim();
    if (!busId || busId === "None" || busId === "WAITING_LIST") continue;

    // Filter out the current trip if we are updating
    const existingTrips = state.trips.filter((t) => String(t.tripKey) !== String(trip.tripKey));

    for (const t of existingTrips) {
      const tDepY = ymd(parseYMD(t.departureDate));
      const tArrY = ymd(parseYMD(t.arrivalDate) || parseYMD(t.departureDate));

      // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
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

  // Rebuild the set of driver names booked on other overlapping trips
  const conflicts = new Set();      // primary: driver1 / driver2
  const reliefConflicts = new Set(); // relief only: driver3 / driver4

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
        // Overlap: StartA <= EndB && EndA >= StartB
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

  // Primary wins: if already in primary conflicts, remove from relief
  for (const name of conflicts) reliefConflicts.delete(name);

  state.driverConflicts = conflicts;
  state.driverReliefConflicts = reliefConflicts;

  // Apply/remove conflict highlight on each driver dropdown trigger
  state.busRows.forEach((r) => {
    [r.d1Sel, r.d2Sel].forEach((sel) => {
      const v = String(sel.value || "").trim();
      const isPrimary = v && v !== "None" && conflicts.has(v);
      const isRelief = v && v !== "None" && reliefConflicts.has(v);
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
// ERROR LOGGING (Production Debugging)
// ======================================================

/**
 * Error logging system - tracks production errors to Google Sheets
 * Logs include: timestamp, message, stack trace, URL, and user agent
 * Errors are logged to "ErrorLogs" sheet in your Google Spreadsheet
 */
const errorLogger = {
  async log(error, context = {}) {
    try {
      const errorData = {
        message: error?.message || String(error),
        stack: error?.stack || "",
        url: context.url || window.location.href,
        userAgent: navigator.userAgent,
        context: JSON.stringify(context),
      };

      // Log to backend (non-blocking, silently fails if unavailable)
      await fetchAPI("logError", errorData);
    } catch (e) {
      // Silently fail - don't break app if logging fails
    }
  },
};

// Global error handlers - automatically log errors in production
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
    promise: String(e.promise),
  });
});

// ======================================================
// 12) STATUS NOTICES + LOADING PROGRESS
// ======================================================

function mapToastVariantToSyncMode(variant = "info") {
  const v = String(variant || "info").toLowerCase();
  if (v === "sync") return "sync";
  if (v === "idle") return "idle";
  if (v === "danger" || v === "error") return "error";
  if (v === "warning") return "stale";
  if (v === "loading") return "loading";
  if (v === "success") return "idle";
  return "sync";
}

function getToastVisualOptions(variant = "info") {
  const v = String(variant || "info").toLowerCase();
  if (v === "loading" || v === "sync") {
    return { indeterminate: true, progress: null };
  }
  if (v === "success") {
    return { indeterminate: false, progress: 100 };
  }
  return { indeterminate: false, progress: null };
}

function getHeaderStatusPriority(kind = "info", explicitPriority = null, scope = "notice") {
  if (Number.isFinite(explicitPriority)) return Number(explicitPriority);

  const key = String(kind || "info").toLowerCase();
  const maps = {
    notice: {
      error: 60,
      danger: 60,
      loading: 50,
      success: 40,
      info: 30,
      warning: 25,
      stale: 25,
      sync: 10,
      idle: 0,
    },
    base: {
      error: 45,
      stale: 20,
      loading: 15,
      sync: 10,
      idle: 0,
    },
  };

  return maps[scope]?.[key] ?? 0;
}

function buildWeekSyncStatusEntry(mode = "idle", detail = "", options = {}) {
  const textMap = {
    idle: "Up to date",
    sync: "Updating in background...",
    loading: "Loading week...",
    stale: "Showing cached data",
    error: "Update failed",
  };
  const safeMode = ["idle", "sync", "loading", "stale", "error"].includes(mode) ? mode : "idle";
  const baseText = textMap[safeMode] || textMap.idle;
  const detailText = String(detail || "").trim();
  const label = options.replaceMessage
    ? detailText || baseText
    : detailText
      ? `${baseText} ${detailText}`
      : baseText;

  return {
    mode: safeMode,
    message: label,
    indeterminate:
      options.indeterminate != null
        ? !!options.indeterminate
        : safeMode === "loading" || safeMode === "sync",
    progress: options.progress != null ? options.progress : null,
  };
}

function renderWeekSyncStatusEntry(entry) {
  if (!entry) return;
  setWeekSyncStatusMessage(entry.mode, entry.message, {
    progress: entry.progress,
    indeterminate: entry.indeterminate,
  });
}

function renderCurrentWeekSyncStatus() {
  renderWeekSyncStatusEntry(state.activeStatusNotice?.entry || state.baseWeekSyncStatus);
}

function clearStatusNoticeExpiryTimer() {
  if (!state.statusNoticeExpiryTimer) return;
  clearTimeout(state.statusNoticeExpiryTimer);
  state.statusNoticeExpiryTimer = null;
}

function scheduleStatusNoticeAutoExpire({ token, entry, source }) {
  clearStatusNoticeExpiryTimer();

  if (!entry) return;
  if (!(entry.mode === "loading" || entry.mode === "sync")) return;

  const timeoutMs = source === "week-load" ? 12000 : 10000;

  state.statusNoticeExpiryTimer = setTimeout(() => {
    const active = state.activeStatusNotice;
    if (!active || active.token !== token) return;
    if (!(active.entry?.mode === "loading" || active.entry?.mode === "sync")) return;

    stopProgressCreep();
    clearHeaderStatusNotice(token);
    setWeekSyncStatus("idle", "", { force: true });
  }, timeoutMs);
}

function canApplyHeaderStatusNotice(priority, source, force = false) {
  const active = state.activeStatusNotice;
  if (force || !active) return true;
  if (source && active.source === source) return true;
  return priority >= active.priority;
}

function activateHeaderStatusNotice(entry, { priority, source = "toast" } = {}) {
  const token = ++state.statusNoticeToken;
  state.activeStatusNotice = {
    token,
    priority,
    source,
    entry,
  };
  renderCurrentWeekSyncStatus();
  scheduleStatusNoticeAutoExpire({ token, entry, source });
  return token;
}

function clearHeaderStatusNotice(token) {
  if (token != null && state.activeStatusNotice?.token !== token) return false;
  state.activeStatusNotice = null;
  clearStatusNoticeExpiryTimer();
  renderCurrentWeekSyncStatus();
  return true;
}

function setWeekSyncStatusVisual({ progress = null, indeterminate = false } = {}) {
  if (!dom.weekSyncStatus) return;

  const hasProgress = Number.isFinite(progress);
  const clamped = hasProgress ? Math.max(0, Math.min(100, Number(progress))) : 0;

  dom.weekSyncStatus.classList.toggle("has-progress", hasProgress);
  dom.weekSyncStatus.classList.toggle("is-indeterminate", !!indeterminate && !hasProgress);
  dom.weekSyncStatus.style.setProperty("--sync-progress", `${clamped}%`);
}

function setWeekSyncStatusMessage(
  mode = "idle",
  message = "",
  { progress = null, indeterminate = false } = {},
) {
  const allowed = new Set(["idle", "sync", "loading", "stale", "error"]);
  const safeMode = allowed.has(mode) ? mode : "idle";
  const textMap = {
    idle: "Up to date",
    sync: "Updating in background...",
    loading: "Loading week...",
    stale: "Showing cached data",
    error: "Update failed",
  };
  const label = String(message || "").trim() || textMap[safeMode];

  if (!dom.weekSyncStatus) return;
  dom.weekSyncStatus.textContent = label;
  dom.weekSyncStatus.classList.remove("is-idle", "is-sync", "is-loading", "is-stale", "is-error");
  dom.weekSyncStatus.classList.add(`is-${safeMode}`);
  setWeekSyncStatusVisual({ progress, indeterminate });
}

function showHeaderStatusNotice(
  message,
  variant = "info",
  {
    sticky = false,
    duration = 1400,
    source = "toast",
    priority = null,
    progress = null,
    indeterminate = null,
    force = false,
  } = {},
) {
  if (!dom.weekSyncStatus) return false;

  const mode = mapToastVariantToSyncMode(variant);
  const defaultVisuals = getToastVisualOptions(variant);
  const entry = {
    mode,
    message: String(message || "").trim(),
    progress: progress != null ? progress : defaultVisuals.progress,
    indeterminate: indeterminate != null ? !!indeterminate : defaultVisuals.indeterminate,
  };
  const resolvedPriority = getHeaderStatusPriority(variant, priority, "notice");

  if (!canApplyHeaderStatusNotice(resolvedPriority, source, force)) return false;

  if (state.toastTimer) clearTimeout(state.toastTimer);

  const token = activateHeaderStatusNotice(entry, { priority: resolvedPriority, source });

  if (sticky) {
    state.toastTimer = null;
    return true;
  }

  state.toastTimer = setTimeout(
    () => {
      clearHeaderStatusNotice(token);
    },
    Math.max(0, Number(duration) || 0),
  );

  return true;
}

function toast(message, variant = "info", duration = 1400) {
  showHeaderStatusNotice(message, variant, { sticky: false, duration });
}

function toastShow(message, variant = "info", opts = {}) {
  showHeaderStatusNotice(message, variant, { ...opts, sticky: true });
}

function toastHide(delayMs = 0, { source = "toast" } = {}) {
  const token = state.activeStatusNotice?.source === source ? state.activeStatusNotice.token : null;
  if (token == null) return; // don't touch the timer if it belongs to a different source

  if (state.toastTimer) clearTimeout(state.toastTimer);

  const hideNow = () => {
    clearHeaderStatusNotice(token);
  };

  if (delayMs > 0) state.toastTimer = setTimeout(hideNow, delayMs);
  else hideNow();
}

function toastProgress(pct, label, opts = {}) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const message =
    label != null && String(label).trim()
      ? String(label).trim()
      : `Loading... ${Math.floor(clamped)}%`;
  showHeaderStatusNotice(message, "loading", {
    ...opts,
    sticky: true,
    progress: clamped,
    indeterminate: false,
  });
}

function stopProgressCreep() {
  if (state.progressCreepTimer) clearInterval(state.progressCreepTimer);
  state.progressCreepTimer = null;
}

function startProgressCreep({
  from = 70,
  to = 95,
  everyMs = 250,
  label = "Verifying… ",
  toastOpts = {},
} = {}) {
  stopProgressCreep();

  toastProgress(from, `${label}${from}%`, toastOpts);
  let current = from;

  state.progressCreepTimer = setInterval(() => {
    const remaining = to - current;
    if (remaining <= 0.2) return;

    const bump = Math.max(0.3, remaining * 0.12);
    current = Math.min(to, current + bump);

    toastProgress(current, `${label}${Math.floor(current)}%`, toastOpts);
  }, everyMs);
}

// ======================================================
// 13) STATUS SELECT CLASSES & ICONS
// ======================================================
function getEffectiveDriverStatus(t) {
  const assigns = state.assignmentsByTripKey?.[String(t?.tripKey)] || [];
  const statuses = [];
  for (const a of assigns) {
    const d1 = String(a.driver1 || "").trim();
    const d2 = String(a.driver2 || "").trim();
    const d3 = String(a.driver3 || "").trim();
    const d4 = String(a.driver4 || "").trim();
    if (d1 && d1 !== "None") statuses.push(String(a.driver1Status || "").trim() || "Pending");
    if (d2 && d2 !== "None") statuses.push(String(a.driver2Status || "").trim() || "Pending");
    if (d3 && d3 !== "None") statuses.push(String(a.driver3Status || "").trim() || "Pending");
    if (d4 && d4 !== "None") statuses.push(String(a.driver4Status || "").trim() || "Pending");
  }
  if (statuses.length === 0) return (t?.driverStatus || "Pending").trim();
  const statusOrder = { Pending: 0, Assigned: 1, Confirmed: 2 };
  return statuses.reduce((a, b) => ((statusOrder[a] ?? 0) <= (statusOrder[b] ?? 0) ? a : b));
}

function getStatusIcon(fieldId, statusValue) {
  const s = String(statusValue || "")
    .trim()
    .toLowerCase();
  if (fieldId === "driverStatus") {
    if (s === "assigned") return "sentiment_neutral";
    if (s === "confirmed") return "sentiment_satisfied";
    if (s === "driver info sent") return "mood";
    return "sentiment_dissatisfied"; // default fallback for pending/empty
  }

  if (!s || s === "none") return "";

  if (fieldId === "itineraryStatus") {
    return "attach_file_off"; // Base icon, overridden by has-pdf logic elsewhere
  }
  if (fieldId === "contactStatus") {
    return "phone_enabled"; // Base icon
  }
  if (fieldId === "paymentStatus") {
    if (s === "contract signed") return "edit_document";
    if (s === "pending quote" || s === "quoted") return "draft";
    if (s === "po received") return "request_quote";
    if (s === "not required") return "scan_delete";
    return "description";
  }
  if (fieldId === "invoiceStatus") {
    return "attach_money";
  }
  return "";
}

function updateStatusSelect(el) {
  if (!el) return;

  const id = el.id || (el.name && el.name.endsWith("Status") ? "driverStatus" : "");
  const v = String(el.value || "")
    .trim()
    .toLowerCase();

  const classes = [
    "status-pending",
    "status-ok",
    "status-assigned",
    "status-confirmed",
    "status-blue",
  ];
  el.classList.remove(...classes);
  const trigger = el.closest?.(".select-dropdown")?.querySelector(".select-trigger");
  if (trigger) trigger.classList.remove(...classes);
  if (!v) return;

  let addClass = "";
  if (id === "driverStatus" || (id && id.includes("driver"))) {
    if (v === "pending") addClass = "status-pending";
    else if (v === "assigned") addClass = "status-assigned";
    else if (v === "confirmed") addClass = "status-ok";
    else addClass = "status-ok";
  } else if (id === "paymentStatus") {
    if (v === "pending quote") addClass = "status-pending";
    else if (v === "quoted") addClass = "status-assigned";
    else addClass = "status-ok";
  } else if (id === "invoiceStatus") {
    if (v === "pending invoice") addClass = "status-pending";
    else if (v === "invoiced") addClass = "status-assigned";
    else if (v === "deposit received") addClass = "status-blue";
    else if (v === "paid in full") addClass = "status-ok";
  } else {
    addClass = v === "pending" ? "status-pending" : "status-ok";
  }
  if (addClass) {
    el.classList.add(addClass);
    if (trigger) trigger.classList.add(addClass);
  }
}

function setSelectToPlaceholder(id) {
  const el = $(id);
  if (!el) return;
  el.selectedIndex = 0;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function hasSelectedBusForTrip() {
  const busSel = dom.busGrid?.querySelector("select[name='bus1']");
  if (!busSel) return false;
  const v = String(busSel.value || "").trim();
  return v && v !== "None";
}

function confirmDiscardIfDirty(msg = "You have unsaved trip changes. Discard them?") {
  if (!state.tripFormDirty) return true;
  return confirm(msg);
}

function maybeApplyPendingDefaults() {
  if (!dom.tripForm || dom.action?.value !== "create") return;

  const dep = $("tripDate")?.value;
  if (!dep || !hasSelectedBusForTrip()) return;

  const ids = [
    "itineraryStatus",
    "contactStatus",
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
  ];
  let changed = false;

  ids.forEach((id) => {
    const el = $(id);
    if (!el || el.value) return;

    if (id === "paymentStatus") el.value = "Pending Quote";
    else if (id === "invoiceStatus") el.value = "Pending Invoice";
    else el.value = "Pending";

    el.dispatchEvent(new Event("change", { bubbles: true }));
    changed = true;
  });

  if (changed) ids.forEach((id) => updateStatusSelect($(id)));
}

function updateInvoiceNumberColor() {
  const numInput = $("invoiceNumber");
  if (!numInput) return;
  const icon = numInput.closest(".invoice-num-wrap")?.querySelector(".invoice-num-icon");
  numInput.classList.remove("status-pending", "status-assigned", "status-ok");
  if (icon) icon.style.color = "";
  const invoiceStatus = String($("invoiceStatus")?.value || "").trim().toLowerCase();
  if (!invoiceStatus) return;
  const hasNumber = !!numInput.value.trim();
  let cls, iconColor;
  if (invoiceStatus === "paid in full") {
    cls = "status-ok"; iconColor = "var(--rux-status-green)";
  } else if (hasNumber) {
    cls = "status-assigned"; iconColor = "var(--rux-status-yellow)";
  } else {
    cls = "status-pending"; iconColor = "var(--rux-status-red)";
  }
  numInput.classList.add(cls);
  if (icon) icon.style.color = iconColor;
}

function updateInvoiceNumberVisibility() {
  const el = $("invoiceStatus");
  const numGroup = $("invoiceNumberGroup");
  const numInput = $("invoiceNumber");
  if (!el || !numGroup) return;

  const v = String(el.value || "")
    .trim()
    .toLowerCase();
  // Show if Invoiced, Deposit Received, or Paid in Full
  const show = v === "invoiced" || v === "deposit received" || v === "paid in full";

  if (numInput) {
    if (!numInput.value) numInput.classList.add("is-empty");
  }

  // Intentionally DO NOT clear numInput.value when hiding, so toggling status
  // does not wipe an already-entered invoice number.
  updateInvoiceNumberColor();
}

function refreshEmptyStateUI() {
  const ids = [
    "destination",
    "customer",
    "contactName",
    "phone",
    "tripDate",
    "arrivalDate",
    "departureTime",
    "arrivalTime",
    "busesNeeded",
    "itineraryStatus",
    "contactStatus",
    "paymentStatus",
    "contactStatus",
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
    "invoiceNumber",
    "tripColor",
    "itinerary",
    "paymentType",
    "estimatedMileage",
    "quotedPrice",
    "tripMiles",
    "datePaid",
    "notes",
    "comments",
  ];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;

    const v = el.value ?? "";
    const empty = el.tagName === "TEXTAREA" ? !String(v).trim() : !String(v);
    el.classList.toggle("is-empty", empty);
  }
}

function syncEmptyStateForForm() {
  const form = dom.tripForm;
  if (!form) return;

  const fields = Array.from(form.querySelectorAll("input, select, textarea")).filter(
    (el) => el.id && el.type !== "hidden",
  );

  function isEmpty(el) {
    const v = el.value ?? "";
    if (el.tagName === "TEXTAREA") return !String(v).trim();
    if (el.tagName === "SELECT") return !String(v);
    return !String(v);
  }

  function syncOne(el) {
    el.classList.toggle("is-empty", isEmpty(el));
  }

  // Always sync current state
  fields.forEach(syncOne);

  // Only wire event listeners once to prevent memory leak
  if (!state.formListenersWired) {
    state.formListenersWired = true;

    fields.forEach((el) => {
      const markDirtyAndSync = () => {
        state.tripFormDirty = true;
        syncOne(el);
      };

      el.addEventListener("input", markDirtyAndSync);
      el.addEventListener("change", markDirtyAndSync);
      el.addEventListener("blur", () => syncOne(el));
    });

    const invSel = $("invoiceStatus");
    if (invSel) {
      invSel.addEventListener("change", () => {
        updateInvoiceNumberVisibility();
        updateStatusSelect(invSel);
      });
    }

    const invNumInput = $("invoiceNumber");
    if (invNumInput) {
      invNumInput.addEventListener("input", updateInvoiceNumberColor);
    }

    // Auto-set Contact status to Received when both Trip contact and Trip contact phone are filled
    const syncContactStatusFromEnvelope = () => {
      const contactSel = $("contactStatus");
      const envelopeContact = String($("envelopeTripContact")?.value || "").trim();
      const envelopePhone = String($("envelopeTripPhone")?.value || "").trim();
      if (contactSel && envelopeContact && envelopePhone) {
        contactSel.value = "Received";
        contactSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    [$("envelopeTripContact"), $("envelopeTripPhone")].filter(Boolean).forEach((el) => {
      el.addEventListener("input", syncContactStatusFromEnvelope);
      el.addEventListener("change", syncContactStatusFromEnvelope);
    });

    form.addEventListener("reset", () =>
      setTimeout(() => {
        fields.forEach(syncOne);
        state.tripFormDirty = false;
      }, 0),
    );
  }
}

// ======================================================
// 14) WEEK START UI + HEADER ORDER
// ======================================================
function syncWeekStartUI() {
  const isMon = state.weekStartsOnMonday;

  if (dom.weekStartMonBtn)
    dom.weekStartMonBtn.setAttribute("aria-pressed", isMon ? "true" : "false");
  if (dom.weekStartSunBtn)
    dom.weekStartSunBtn.setAttribute("aria-pressed", isMon ? "false" : "true");

  // Update toggle button icon and text
  if (dom.weekStartToggle) {
    const icon = dom.weekStartToggle.querySelector(".dropdown__icon");
    if (icon) {
      icon.textContent = isMon ? "toggle_on" : "toggle_off";
      icon.classList.toggle("is-active", isMon);
    }
  }
}

function applyWeekStart(isMonday) {
  state.weekStartsOnMonday = !!isMonday;

  try {
    localStorage.setItem("weekStartMonday", state.weekStartsOnMonday ? "1" : "0");
  } catch { }

  syncWeekStartUI();

  // NORMALIZE ANCHOR: Use a date in the middle of our current 7-day span
  // to find the start-of-week that covers the same days visually.
  const middleOfCurrentWeek = addDays(state.currentDate, 3);
  state.currentDate = startOfWeek(middleOfCurrentWeek);

  setHeaderOrder();
  buildAgendaRows();
  scheduleAgendaReflow();
  updateWeekDates();

  // Force driver panel to re-render its headers/days for the new week Start
  updateDriverWeekIfVisible();
  updateTodoCardIfVisible();
}

function setHeaderOrder() {
  const theadRow = document.querySelector(".schedule-grid thead tr");
  if (!theadRow) return;

  const cells = Array.from(theadRow.children);
  const corner = cells[0];
  const byId = {};
  for (const th of cells.slice(1)) if (th.id) byId[th.id] = th;

  while (theadRow.firstChild) theadRow.removeChild(theadRow.firstChild);
  theadRow.appendChild(corner);
  for (const id of getDayIds()) if (byId[id]) theadRow.appendChild(byId[id]);

  state.lastColMetrics = null;
}

function updateWeekTitle() {
  const start = new Date(state.currentDate);
  const end = addDays(start, 6);

  const monthOpt = { month: "long" };
  const startMonth = start.toLocaleDateString("en-US", monthOpt);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  let html;

  // Scenario 1: Same Month & Year (Feb 3 – 9, 2026)
  if (start.getMonth() === end.getMonth() && startYear === endYear) {
    html =
      `<span class="wk-month">${startMonth}</span> ` +
      `<span class="wk-dates">${start.getDate()} – ${end.getDate()},</span> ` +
      `<span class="wk-year">${startYear}</span>`;
  }
  // Scenario 2: Different Month, Same Year (Feb 24 – Mar 2, 2026)
  else if (startYear === endYear) {
    const endMonth = end.toLocaleDateString("en-US", monthOpt);
    html =
      `<span class="wk-month">${startMonth}</span> ` +
      `<span class="wk-dates">${start.getDate()}</span> ` +
      `<span class="wk-sep">–</span> ` +
      `<span class="wk-month">${endMonth}</span> ` +
      `<span class="wk-dates">${end.getDate()},</span> ` +
      `<span class="wk-year">${startYear}</span>`;
  }
  // Scenario 3: Different Year (Dec 29, 2025 – Jan 4, 2026)
  else {
    const endMonth = end.toLocaleDateString("en-US", monthOpt);
    html =
      `<span class="wk-month">${startMonth}</span> ` +
      `<span class="wk-dates">${start.getDate()},</span> ` +
      `<span class="wk-year">${startYear}</span> ` +
      `<span class="wk-sep">–</span> ` +
      `<span class="wk-month">${endMonth}</span> ` +
      `<span class="wk-dates">${end.getDate()},</span> ` +
      `<span class="wk-year">${endYear}</span>`;
  }

  if (dom.headerWeek) {
    dom.headerWeek.innerHTML = html;
  }
}

function updateNotesWeekTitle() {
  if (!dom.notesWeekTitle) return;

  const { start, end } = getWeekRange();
  const startDate = parseYMD(start);
  const endDate = parseYMD(end);
  if (!startDate || !endDate) {
    dom.notesWeekTitle.textContent = "Weekly Notes";
    return;
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  let label = "";
  if (sameMonth) {
    const month = startDate.toLocaleDateString("en-US", { month: "short" });
    label = `${month} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
  } else if (sameYear) {
    const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    label = `${startLabel}-${endLabel}, ${startDate.getFullYear()}`;
  } else {
    const startLabel = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const endLabel = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    label = `${startLabel}-${endLabel}`;
  }

  dom.notesWeekTitle.textContent = `Week ${label}`;
}

// ======================================================
// 15) WEEK CACHE + STALE GUARDS
// ======================================================
const WEEK_CACHE_VERSION = "v2"; // Bump to invalidate old cache (e.g. assignments without driver1Status/driver2Status)
function weekKey(start, end) {
  return `${start}..${end}`;
}
function weekCacheKey(start, end) {
  return `week_${WEEK_CACHE_VERSION}_${weekKey(start, end)}`;
}

function getCachedWeek(key, maxAgeMs = CONFIG.WEEK_CACHE_MAX_AGE_MS) {
  const hit = state.weekCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > maxAgeMs) return null;
  return hit.resp;
}

function getAnyCachedWeek(key) {
  return state.weekCache.get(key)?.resp || null;
}

async function fetchWeekDataCached(start, end, notesKey, force = false) {
  const key = weekKey(start, end);

  if (!force) {
    const fresh = getCachedWeek(key);
    if (fresh) return fresh;
  }

  if (state.weekInFlight.has(key)) return state.weekInFlight.get(key);

  const p = (async () => {
    try {
      const raw = await api.weekData(start, end, notesKey);
      const resp = sanitizeWeekResp(raw);

      if (!resp.ok) {
        const err = new Error(resp.error || "weekData returned ok:false");
        err.resp = raw;
        throw err;
      }

      // Save to Memory Cache
      state.weekCache.set(key, { ts: Date.now(), resp });

      // Save to Persistent Cache (7 days)
      CACHE.set(weekCacheKey(start, end), resp, 7 * 24 * 60 * 60 * 1000);

      return resp;
    } catch (err) {
      const stale = getAnyCachedWeek(key);
      if (stale) return { ...stale, __stale: true };
      throw err;
    } finally {
      state.weekInFlight.delete(key);
    }
  })();

  state.weekInFlight.set(key, p);
  return p;
}

function applyWeekRespToState(resp) {
  const ok = !!resp?.ok;

  let trips = ok ? asArray(resp.trips) : [];

  // DEFENSIVE: Filter out any pending-delete trips to prevent zombie resurrection
  if (state.pendingWrite?.action === "delete" && state.pendingWrite?.tripKey) {
    const deletingKey = String(state.pendingWrite.tripKey);
    trips = trips.filter((t) => String(t.tripKey || "").trim() !== deletingKey);
  }

  state.trips = trips
  state.trips = state.trips
    .map((t) => ({
      ...t,
      tripKey: String(t.tripKey || "").trim(),
      departureTime: normalizeTime(t.departureTime),
      arrivalTime: normalizeTime(t.arrivalTime),
    }))
    .filter((t) => t.tripKey);

  state.tripByKey = {};
  for (const t of state.trips) state.tripByKey[t.tripKey] = t;

  const asnList = ok ? asArray(resp.assignments) : [];

  // DEFENSIVE: Also filter assignments for pending-delete trips
  if (state.pendingWrite?.action === "delete" && state.pendingWrite?.tripKey) {
    const deletingKey = String(state.pendingWrite.tripKey);
    asnList = asnList.filter((a) => String(a.tripKey || "").trim() !== deletingKey);
  }

  state.assignmentsByTripKey = {};
  for (const a of asnList) {
    const k = String(a.tripKey || "").trim();
    if (!k) continue;
    const normalized = normalizeAssignment(a);
    if (normalized) (state.assignmentsByTripKey[k] ||= []).push(normalized);
  }

  // Refresh note only when not dirty — preserves in-progress edits
  if (dom.scheduleNotes && !state.notesDirty) {
    const notesValue = resp.weekNotes || "";
    if (notesValue !== state.savedNotesValue) {
      dom.scheduleNotes.value = notesValue;
      state.savedNotesValue = notesValue;
    }
  }

  // Populate Unavailability
  state.unavailabilityByDriver = {};
  if (ok && resp.unavailability) {
    for (const u of asArray(resp.unavailability)) {
      const name = String(u.driverName || "").trim();
      const date = String(u.dateYmd || "").trim();
      if (!name || !date) continue;
      (state.unavailabilityByDriver[name] ||= {})[date] = true;
    }
  }
}

let _prefetchTimer = null;

const RADIUS_WEEKS = 2;

function prefetchAdjacentWeeks() {
  const base = state.currentDate;
  for (let w = -RADIUS_WEEKS; w <= RADIUS_WEEKS; w++) {
    if (w === 0) continue;
    const targetDate = addDays(base, w * 7);
    const start = ymd(targetDate);
    const end = ymd(addDays(targetDate, 6));

    // ✅ FIX: Calculate Monday for the adjacent week
    const { notesKey } = getWeekRange(targetDate); // We will update getWeekRange to support a date arg
    fetchWeekDataCached(start, end, notesKey).catch(() => { });
  }
}

// ======================================================
// 16) BAR RENDER TOAST + LOADING DIMMER
// ======================================================
let scheduleRenderToastTimer = null;

function showScheduleRenderToastDelayed() {
  clearTimeout(scheduleRenderToastTimer);

  // Header status progress is now owned by week-load/trip-load pipelines.
  // Keep this timer for render lifecycle parity, but do not emit standalone render notices.
  scheduleRenderToastTimer = setTimeout(() => { }, 120);
}

function hideScheduleRenderToast() {
  clearTimeout(scheduleRenderToastTimer);
  scheduleRenderToastTimer = null;

  if (typeof state.weekRenderDoneResolver === "function") {
    const r = state.weekRenderDoneResolver;
    state.weekRenderDoneResolver = null;
    r();
  }
}

function setBarsHidden(hidden) {
  const wrap = getScheduleGridWrapEl();
  wrap?.classList?.toggle("is-loading-bars", !!hidden);
}

// ======================================================
// 17) BAR ELEMENT REUSE HELPERS
// ======================================================
function clearBarsNow() {
  dom.agendaBody?.querySelectorAll(".schedule-grid__row-bars").forEach((b) => (b.innerHTML = ""));
  state.barElByKey?.clear?.();
}

function barKey(tripKey, busId, driver1, driver2) {
  return `${tripKey}|${busId}|${driver1 || ""}|${driver2 || ""}`;
}

function pruneOldBars(pass) {
  for (const [k, el] of state.barElByKey) {
    if (el._renderPass !== pass) {
      el.remove();
      state.barElByKey.delete(k);
    }
  }
}

function getBarMetrics() {
  const rootCss = getComputedStyle(document.documentElement);
  const barH = parseFloat(rootCss.getPropertyValue("--tripbar-height")) || 100;

  let step = parseFloat(rootCss.getPropertyValue("--tripbar-lane-step"));
  if (!step || Number.isNaN(step)) step = barH + 10;

  return { barH, step };
}
function getBarMetricsCached() {
  return state.barMetrics || (state.barMetrics = getBarMetrics());
}

// ======================================================
// 18) AGENDA GRID BUILD + COLUMN METRICS CACHE
// ======================================================
function buildAgendaRows() {
  if (!dom.agendaBody) return;

  const liftSet = computeLiftSet();
  const sleeperSet = computeSleeperSet();

  // Calculate today's column index for highlighting
  const todayYmd = ymd(new Date());
  const weekDates = getWeekDates(state.currentDate);
  const todayColIndex = weekDates.indexOf(todayYmd); // -1 if not in this week

  dom.agendaBody.innerHTML = "";
  state.busRowIndex = new Map();

  const dayIds = getDayIds();

  // DYNAMIC BUSES: Trust the API/Sheet order
  // We slice() just to make a shallow copy so we don't mutate the original state if we push to it.
  const buses = (state.busesList || []).slice();

  // Fallback if API failed but we still want to render *something*
  if (buses.length === 0 && CONFIG.BUS_LANES && CONFIG.BUS_LANES.length > 0) {
    CONFIG.BUS_LANES.forEach((id) => buses.push({ busId: id }));
  }

  buses.forEach((busObj, idx) => {
    const busId = busObj.busId;
    state.busRowIndex.set(String(busId), idx);

    const tr = document.createElement("tr");
    tr.className = "schedule-grid__row";

    // Data-driven coloring - apply as left border on row (enterprise style)
    const colorVal =
      busObj.busColor ||
      busObj.buscolor ||
      busObj.BusColor ||
      busObj["Bus Color"] ||
      busObj["bus color"];
    if (colorVal) {
      tr.style.setProperty("--bus-accent-color", String(colorVal).trim());
      tr.classList.add("schedule-grid__row--has-bus-color");
    }

    const tdBus = document.createElement("td");
    tdBus.className = "schedule-grid__bus-cell schedule-grid__cell";

    const wrap = document.createElement("div");
    wrap.className = "schedule-grid__bus-indicator";

    const num = document.createElement("span");
    num.className = "schedule-grid__bus-num";
    num.textContent = busId;

    wrap.appendChild(num);

    const icons = document.createElement("div");
    icons.className = "schedule-grid__bus-icons";

    const busKey = String(busId ?? "").trim();
    if (liftSet.has(busKey)) {
      const icon = document.createElement("span");
      icon.className = "schedule-grid__bus-icon icon-bus icon-bus--lift material-symbols-outlined";
      icon.textContent = "accessible";
      icon.title = "Wheelchair lift equipped";
      icon.setAttribute("aria-label", "Wheelchair lift equipped");
      icons.appendChild(icon);
    }

    if (sleeperSet.has(busKey)) {
      const icon = document.createElement("span");
      icon.className =
        "schedule-grid__bus-icon icon-bus icon-bus--sleeper material-symbols-outlined";
      icon.textContent = "airline_seat_flat";
      icon.title = "Sleeper bus";
      icon.setAttribute("aria-label", "Sleeper bus");
      icons.appendChild(icon);
    }

    if (icons.childElementCount) wrap.appendChild(icons);
    tdBus.appendChild(wrap);
    tr.appendChild(tdBus);

    for (let i = 0; i < 7; i++) {
      const td = document.createElement("td");
      td.className = "schedule-grid__day-cell schedule-grid__cell";
      td.dataset.dayId = dayIds[i];
      if (i === todayColIndex) td.classList.add("schedule-grid__day-cell--today");
      tr.appendChild(td);
    }

    tr.cells[1].classList.add("week-start-cell");

    const bars = document.createElement("div");
    bars.className = "schedule-grid__row-bars";
    tr.cells[1].appendChild(bars);

    dom.agendaBody.appendChild(tr);
  });

  // WAITING LIST ROW -> Render into SAME table (it's a tbody now)
  const waitingBody = dom.waitingBody;
  if (waitingBody) {
    waitingBody.innerHTML = "";

    // Explicitly map WAITING_LIST to a row index?
    // Actually, `state.busRowIndex` is used to look up `dom.agendaBody.rows[i]`.
    // Since we are now in a DIFFERENT table, we can't use `state.busRowIndex` pointing to a row number for the MAIN table.
    // We should treat WAITING_LIST specially in renderAgenda.
    // So we invoke a special render for it here.

    const tr = document.createElement("tr");
    tr.className = "waiting-list-row schedule-grid__row";

    const tdBus = document.createElement("td");
    tdBus.className = "schedule-grid__bus-cell schedule-grid__cell";
    tdBus.innerHTML = `<div class="schedule-grid__bus-indicator"><span class="material-symbols-outlined">low_priority</span></div>`;
    tr.appendChild(tdBus);

    for (let i = 0; i < 7; i++) {
      const td = document.createElement("td");
      td.className = "schedule-grid__day-cell schedule-grid__cell";
      td.dataset.dayId = dayIds[i];
      if (i === todayColIndex) td.classList.add("schedule-grid__day-cell--today");
      tr.appendChild(td);
    }

    // Border logic
    tr.cells[1].classList.add("week-start-cell");

    const bars = document.createElement("div");
    bars.className = "schedule-grid__row-bars";
    tr.cells[1].appendChild(bars);

    // Spacer row — true DOM gap above the waiting list row.
    // Lives in #waitingBody so it vanishes with it when toggled off.
    const spacer = document.createElement("tr");
    spacer.className = "schedule-grid__wl-spacer";
    const spacerCell = document.createElement("td");
    spacerCell.colSpan = 8; // 1 bus col + 7 day cols
    spacer.appendChild(spacerCell);
    waitingBody.appendChild(spacer);
    waitingBody.appendChild(tr);
  }

  clearBarsNow();
  state.lastColMetrics = null;
}

function ensureAgendaGrid() {
  if (!dom.agendaBody) return false;

  let expected = 0;
  // Basic buses
  if (state.busesList && state.busesList.length > 0) {
    expected = state.busesList.length;
  } else {
    expected = CONFIG.BUS_LANES.length;
  }
  // The main body should strictly match the buses list

  const okMain = dom.agendaBody.rows && dom.agendaBody.rows.length === expected;

  // Check waiting body too
  const waitingBody = dom.waitingBody;
  // It's in the same table now, so just check if it exists
  const okWait = !!waitingBody;

  if (!okMain || !okWait) buildAgendaRows();

  return dom.agendaBody.rows.length === expected;
}

function getColMetricsCached() {
  const firstBodyRow = dom.agendaBody?.rows?.[0];
  if (!firstBodyRow || firstBodyRow.cells.length < 8) return null;

  const startCell = firstBodyRow.cells[1];
  const r = startCell.getBoundingClientRect();
  const container = getScheduleGridWrapEl();
  const containerW = container?.clientWidth ?? 0;
  const key = `${r.left}:${r.width}:${containerW}:${dom.agendaBody?.rows?.length || 0}`;

  if (state.lastColMetrics?.key === key) return state.lastColMetrics.col;

  const baseRect = r;
  const starts = [];
  const widths = [];
  let total = 0;

  for (let i = 1; i <= 7; i++) {
    const cell = firstBodyRow.cells[i];
    if (!cell) continue;

    const cellRect = cell.getBoundingClientRect();
    const w = cellRect.width;
    starts.push(cellRect.left - baseRect.left);
    widths.push(w);
    total += w;
  }

  state.lastColMetrics = { key, col: { starts, widths, total } };
  return state.lastColMetrics.col;
}

function syncRowBarsWidth(col) {
  if (!col || !dom.agendaBody) return;
  const total = col.total ?? col.widths.reduce((a, b) => a + (b || 0), 0);

  // Sync main table rows
  dom.agendaBody.querySelectorAll(".schedule-grid__row-bars").forEach((bars) => {
    bars.style.width = `${total}px`;
  });

  // Sync waiting list rows
  const wb = dom.waitingBody;
  if (wb) {
    wb.querySelectorAll(".schedule-grid__row-bars").forEach((bars) => {
      bars.style.width = `${total}px`;
    });
  }
}

function positionBarWithinOverlay(bar, bars, col, startIdx, endIdx, overrides) {
  const el = bar.closest("#printRoot") || document.documentElement;
  const root = getComputedStyle(el);

  const parseCss = (val, fallback) => {
    const p = parseFloat(val);
    return isNaN(p) ? fallback : p;
  };

  const insetAll = parseCss(root.getPropertyValue("--tripbar-inset"), 6);
  const insetL =
    overrides?.insetL !== undefined
      ? overrides.insetL
      : parseCss(root.getPropertyValue("--tripbar-inset-left"), insetAll);
  const insetR =
    overrides?.insetR !== undefined
      ? overrides.insetR
      : parseCss(root.getPropertyValue("--tripbar-inset-right"), insetAll);

  const insetT =
    overrides?.insetT !== undefined
      ? overrides.insetT
      : parseCss(root.getPropertyValue("--tripbar-inset-top"), 0);

  const insetB =
    overrides?.insetB !== undefined
      ? overrides.insetB
      : parseCss(root.getPropertyValue("--tripbar-inset-bottom"), 3);

  // Simplified: exactly match the calculated start and width without extends
  const leftPx = Math.max(0, (col.starts[startIdx] ?? 0) + insetL);

  let spanW = 0;
  for (let i = startIdx; i <= endIdx; i++) spanW += col.widths[i] ?? 0;

  const numCols = endIdx - startIdx + 1;
  const widthExtra = (overrides?.barWidthExtraPerCol ?? 0) * numCols;
  let widthPx = Math.max(0, spanW - insetL - insetR + widthExtra);

  // Guard rails to prevent overflow beyond the row overlay (use overlayWidth when set, e.g. letter print)
  const totalCol = col.total ?? col.widths?.reduce((a, b) => a + (b || 0), 0) ?? 0;
  const max = Math.max(0, col.overlayWidth ?? totalCol);
  const EPS = 0; // No safety margin - bars fill the column width

  if (leftPx >= max) {
    bar.style.left = `${max}px`;
    bar.style.width = `0px`;
    return;
  }

  widthPx = Math.max(0, Math.min(widthPx, max - leftPx - EPS));

  bar.style.left = `${leftPx}px`;
  bar.style.width = `${widthPx}px`;
  bar.style.top = `${insetT}px`;
  bar.style.height = `calc(100% - ${insetT + insetB}px)`;
}

// ======================================================
// 19) CONFLICT UI
// ======================================================
function clearConflictStyles() {
  if (!dom.agendaBody) return;
  for (let r = 0; r < dom.agendaBody.rows.length; r++) {
    const row = dom.agendaBody.rows[r];
    row.cells[0]?.classList?.remove("bus-conflict");
    for (let c = 1; c <= 7; c++) row.cells[c]?.classList?.remove("conflict");
  }
}

function showConflictsPanel(conflicts) {
  const hasConflicts = !!(conflicts && conflicts.length > 0);
  dom.conflictPanel?.classList.toggle("is-hidden", !hasConflicts);
  // Update the small badge summary as well
  if (dom.conflictBadge) {
    if (!hasConflicts) {
      dom.conflictBadge.classList.add("is-hidden");
    } else {
      const count = conflicts.length;
      dom.conflictBadge.textContent = count === 1 ? "1 conflict" : `${count} conflicts`;
      dom.conflictBadge.classList.remove("is-hidden");
    }
  }

  if (!hasConflicts) {
    dom.conflictList.innerHTML = "";
    return;
  }

  const html = conflicts
    .map((c, idx) => {
      const when = escHtml(c.dayLabel);
      const bus = escHtml(c.busId);

      const tripsHtml = c.items
        .map((it) => {
          const t = it.trip || {};
          const title = escHtml(t.destination || "Trip");
          const cust = escHtml(t.customer || "");
          const d1 = escHtml(it.driver1 || "—");
          const d2 = escHtml(it.driver2 || "—");
          const tripKey = escHtml(String(it.tripKey || ""));

          return `
          <div class="trip-chip conflict-indicator" data-tripkey="${tripKey}" role="button" tabindex="0">
            <div class="title">⚠ ${title}</div>
            <div class="meta">${cust}${cust ? " • " : ""}Bus ${bus} • ${d1}${d2 && d2 !== "—" ? " / " + d2 : ""}</div>
          </div>
        `;
        })
        .join("");

      return `
      <div class="conflict-group">
        <div class="conflict-title">Bus ${bus} — ${when}</div>
        <div class="help">${c.items.length} trip(s) overlap</div>
        ${tripsHtml}
      </div>
    `;
    })
    .join("");

  dom.conflictList.innerHTML = html;

  dom.conflictList.querySelectorAll("[data-tripkey]").forEach((el) => {
    const open = () => {
      if (isMobileOnly()) return openTripDetailsModal(el.dataset.tripkey);
      if (!confirmDiscardIfDirty()) return;
      openTripForEdit(el.dataset.tripkey);
    };

    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

// ======================================================
// 20) AGENDA RENDER + REFLOW
// ======================================================
function rerenderAgendaAfterLayout() {
  showScheduleRenderToastDelayed();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderAgenda();
      requestAnimationFrame(() => hideScheduleRenderToast());
    });
  });
}

const scheduleAgendaReflow = debounce(() => {
  rerenderAgendaAfterLayout();
}, 50);

function renderAgenda() {
  try {
    _renderAgendaInner();
  } catch (err) {
    console.error("renderAgenda failed:", err);
    // Show error state with retry option
    if (dom.agendaBody) {
      dom.agendaBody.innerHTML = `
        <tr><td colspan="8" class="schedule-error__cell">
          <div class="schedule-error__message">Failed to render schedule</div>
          <button onclick="location.reload()" class="rux-btn rux-btn--primary">Reload Page</button>
        </td></tr>
      `;
    }
    toast("Render error - try refreshing", "danger", 3000);
  }
}

function _renderAgendaInner() {
  if (!ensureAgendaGrid()) return;

  state.pendingConflictJob = null;

  clearConflictStyles();
  showConflictsPanel([]);

  const week = getWeekDates();
  const weekStart = week[0];
  const weekEnd = week[6];

  const weekIndex = new Map(week.map((d, i) => [d, i]));

  const col = getColMetricsCached();
  if (!col) {
    scheduleAgendaReflow();
    return;
  }

  syncRowBarsWidth(col);

  const barsByRowIdx = new Map();
  for (let i = 0; i < dom.agendaBody.rows.length; i++) {
    const r = dom.agendaBody.rows[i];
    const bars = r.querySelector(".schedule-grid__row-bars");
    if (bars) barsByRowIdx.set(i, bars);
  }

  // Waiting List Mapping
  const waitingBody = dom.waitingBody;
  const wRow = waitingBody?.querySelector(".waiting-list-row");
  if (wRow) {
    const wBars = wRow.querySelector(".schedule-grid__row-bars");
    if (wBars) barsByRowIdx.set("WAITING", wBars);
  }

  const rootCss = getComputedStyle(document.documentElement);
  const { barH, step } = getBarMetricsCached();

  const rowH =
    dom.agendaBody?.rows?.[0]?.cells?.[1]?.getBoundingClientRect()?.height ||
    parseFloat(rootCss.getPropertyValue("--schedule-row-height")) ||
    110;

  const fragByRow = new Map();
  const barsByBus = new Map();

  state.renderPass++;
  const pass = state.renderPass;

  const visibleTrips = state.trips
    .map((t) => {
      const dep = parseYMD(t.departureDate);
      const arr = parseYMD(t.arrivalDate) || dep;
      return { ...t, _dep: dep, _arr: arr };
    })
    .filter((t) => t._dep && t._arr)
    .filter((t) => !(ymd(t._arr) < weekStart || ymd(t._dep) > weekEnd));

  let barsEstimate = 0;
  for (const t of visibleTrips) {
    const assigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
    barsEstimate += assigns.length;
    if (barsEstimate > CONFIG.CONFLICT_DEFER_BARS_THRESHOLD) break;
  }
  const deferConflicts = barsEstimate > CONFIG.CONFLICT_DEFER_BARS_THRESHOLD;

  let cellCounts = null;
  let cellItems = null;

  if (!deferConflicts) {
    cellCounts = {};
    cellItems = {};

    for (const t of visibleTrips) {
      const depY = ymd(t._dep);
      const arrY = ymd(t._arr);

      const start = depY < weekStart ? weekStart : depY;
      const end = arrY > weekEnd ? weekEnd : arrY;

      const startIdx = weekIndex.get(start);
      const endIdx = weekIndex.get(end);
      if (startIdx == null || endIdx == null) continue;

      const assigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
      for (const a of assigns) {
        const busId = String(a.busId || "").trim();
        if (state.busRowIndex.get(busId) === undefined) continue;

        for (let d = startIdx; d <= endIdx; d++) {
          const key = `${busId}|${d}`;
          cellCounts[key] = (cellCounts[key] || 0) + 1;
          (cellItems[key] ||= []).push({
            tripKey: t.tripKey,
            driver1: a.driver1 && a.driver1 !== "None" ? a.driver1 : "—",
            driver2: a.driver2 && a.driver2 !== "None" ? a.driver2 : "—",
            trip: t,
          });
        }
      }
    }
  }

  // ---- Handoff detection: find days where one trip ends and another begins on same bus ----
  function snapToThird(frac) {
    return frac < 0.5 ? 1 / 3 : 2 / 3;
  }

  function timeToFrac(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return (h * 60 + m) / 1440;
  }

  const busDayArrivals = {};   // "busId:dayIdx" → [{frac, tripKey, isSingleDay}]
  const busDayDepartures = {}; // "busId:dayIdx" → [{frac, tripKey, isSingleDay}]

  for (const t of visibleTrips) {
    const tDepY = ymd(t._dep);
    const tArrY = ymd(t._arr);
    const tIsSD = tDepY === tArrY;
    const tStart = tDepY < weekStart ? weekStart : tDepY;
    const tEnd   = tArrY > weekEnd   ? weekEnd   : tArrY;
    const tSi = weekIndex.get(tStart);
    const tEi = weekIndex.get(tEnd);
    if (tSi == null || tEi == null) continue;
    const tAssigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
    for (const ta of tAssigns) {
      const tBusId = String(ta.busId || "").trim();
      if (!tBusId || tBusId === "WAITING_LIST") continue;
      if (t.arrivalTime) {
        const frac = timeToFrac(t.arrivalTime);
        if (frac != null)
          (busDayArrivals[`${tBusId}:${tEi}`] ||= []).push({ frac, tripKey: t.tripKey, isSingleDay: tIsSD });
      }
      if (t.departureTime) {
        const frac = timeToFrac(t.departureTime);
        if (frac != null)
          (busDayDepartures[`${tBusId}:${tSi}`] ||= []).push({ frac, tripKey: t.tripKey, isSingleDay: tIsSD });
      }
    }
  }

  const handoffByBus = {};

  for (const key of Object.keys(busDayArrivals)) {
    if (!busDayDepartures[key]) continue;
    const colonIdx = key.lastIndexOf(":");
    const hBusId = key.slice(0, colonIdx);
    const dayIdx = Number(key.slice(colonIdx + 1));
    const arrs = busDayArrivals[key];
    const deps = busDayDepartures[key];

    let bestArrFrac = -Infinity, bestArrIsSD = false, bestArrTripKey = null;
    let bestDepFrac = Infinity,  bestDepIsSD = false, bestDepTripKey = null;
    let hasValidPair = false;

    for (const arr of arrs) {
      for (const dep of deps) {
        if (arr.tripKey === dep.tripKey) continue; // skip self-match (single-day trips)
        if (arr.frac > dep.frac) continue;          // times overlap — not a handoff
        hasValidPair = true;
        if (arr.frac > bestArrFrac) { bestArrFrac = arr.frac; bestArrIsSD = arr.isSingleDay; bestArrTripKey = arr.tripKey; }
        if (dep.frac < bestDepFrac) { bestDepFrac = dep.frac; bestDepIsSD = dep.isSingleDay; bestDepTripKey = dep.tripKey; }
      }
    }
    if (!hasValidPair) continue;

    let arrFrac = snapToThird(bestArrFrac);
    let depFrac = snapToThird(bestDepFrac);

    if (bestArrIsSD && bestDepIsSD) {
      arrFrac = 0.5; depFrac = 0.5;
    } else if (bestArrIsSD) {
      arrFrac = 2 / 3; depFrac = Math.max(depFrac, 2 / 3);
    } else if (bestDepIsSD) {
      depFrac = 1 / 3; arrFrac = Math.min(arrFrac, 1 / 3);
    } else if (arrFrac > depFrac) {
      arrFrac = 0.5; depFrac = 0.5;
    }

    handoffByBus[hBusId] ||= {};
    handoffByBus[hBusId][dayIdx] = { arrFrac, depFrac, arrTripKey: bestArrTripKey, depTripKey: bestDepTripKey };
  }
  // ---- End handoff detection ----

  // Remove handoff days from synchronous conflict counts — handoff pairs don't actually conflict.
  if (cellCounts) {
    for (const [hBusId, days] of Object.entries(handoffByBus)) {
      for (const [dayStr, ho] of Object.entries(days)) {
        const key = `${hBusId}|${dayStr}`;
        if (!cellCounts[key] || cellCounts[key] <= 1) continue;
        const items = cellItems?.[key] || [];
        const keep = items.filter(it => it.tripKey !== ho.arrTripKey && it.tripKey !== ho.depTripKey);
        const removed = items.length - keep.length;
        if (removed > 0) {
          cellCounts[key] = Math.max(0, cellCounts[key] - removed);
          if (cellItems) cellItems[key] = keep;
        }
      }
    }
  }

  const lanesByBus = {};
  function allocateLane(busId, startIdx, endIdx, exceptDay = -1) {
    lanesByBus[busId] ||= [];
    const lanes = lanesByBus[busId];

    for (let li = 0; li < lanes.length; li++) {
      const occ = lanes[li];
      let ok = true;
      for (let d = startIdx; d <= endIdx; d++) {
        if (d === exceptDay) continue;
        if (occ[d]) { ok = false; break; }
      }
      if (ok) {
        for (let d = startIdx; d <= endIdx; d++) {
          if (d !== exceptDay) occ[d] = true;
        }
        return li;
      }
    }

    const newOcc = Array(7).fill(false);
    for (let d = startIdx; d <= endIdx; d++) {
      if (d !== exceptDay) newOcc[d] = true;
    }
    lanes.push(newOcc);
    return lanes.length - 1;
  }

  for (const t of visibleTrips) {
    const depY = ymd(t._dep);
    const arrY = ymd(t._arr);

    const start = depY < weekStart ? weekStart : depY;
    const end = arrY > weekEnd ? weekEnd : arrY;

    const startIdx = weekIndex.get(start);
    const endIdx = weekIndex.get(end);
    if (startIdx == null || endIdx == null) continue;

    const assigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
    if (!assigns.length) continue;

    const continuesLeft = depY < weekStart;
    const continuesRight = arrY > weekEnd;

    // Sort by schedule row order: top row = 1/2, next = 2/2, etc. (order as rendered in agenda)
    const sortedAssigns = [...assigns].sort((a, b) => {
      const busIdA = String(a.busId || "").trim();
      const busIdB = String(b.busId || "").trim();
      const rowA = busIdA === "WAITING_LIST" ? 9999 : (state.busRowIndex.get(busIdA) ?? 9999);
      const rowB = busIdB === "WAITING_LIST" ? 9999 : (state.busRowIndex.get(busIdB) ?? 9999);
      return rowA - rowB;
    });

    for (let assignIdx = 0; assignIdx < sortedAssigns.length; assignIdx++) {
      const a = sortedAssigns[assignIdx];
      const busId = String(a.busId || "").trim();

      let bars = null;
      let lane = 0;
      let rowIdx = null;

      if (busId === "WAITING_LIST") {
        rowIdx = "WAITING";
        bars = barsByRowIdx.get("WAITING");

        // We can reuse the same allocator relative to "WAITING_LIST"
        lane = allocateLane(busId, startIdx, endIdx);
      } else {
        rowIdx = state.busRowIndex.get(busId);
        if (rowIdx === undefined) continue;
        bars = barsByRowIdx.get(rowIdx);
        // If this trip is the "departing" trip in a handoff on its first day,
        // skip that day in lane allocation so it shares lane 0 with the arriving trip.
        const isHandoffDepTrip = depY >= weekStart &&
          handoffByBus[busId]?.[startIdx]?.depTripKey === t.tripKey;
        lane = allocateLane(busId, startIdx, endIdx, isHandoffDepTrip ? startIdx : -1);
      }

      if (!bars) continue;

      const d1 = a.driver1 && a.driver1 !== "None" ? a.driver1 : "";
      const d2 = a.driver2 && a.driver2 !== "None" ? a.driver2 : "";
      const d3 = a.driver3 && a.driver3 !== "None" ? a.driver3 : "";
      const d4 = a.driver4 && a.driver4 !== "None" ? a.driver4 : "";

      const key = barKey(t.tripKey, busId, d1, d2);
      let bar = state.barElByKey.get(key);

      if (!bar) {
        bar = document.createElement("div");
        bar.className = "schedule-grid__trip-bar";
        bar.setAttribute("draggable", "false");

        // Helper: fixed slot row
        function makeRow(slotMod) {
          const el = document.createElement("div");
          el.className = `schedule-grid__trip-bar__row schedule-grid__trip-bar__row--${slotMod}`;
          return el;
        }

        // 7 fixed rows
        const r1 = makeRow("1");
        const r2 = makeRow("2");
        const r3 = makeRow("3");
        const r4 = makeRow("4");
        const r5 = makeRow("5");
        const r6 = makeRow("6");
        const r7 = makeRow("7");

        // Row 1: Multi-bus badge (top-left) + Title
        const multiBadge = document.createElement("span");
        multiBadge.className = "schedule-grid__trip-bar__multi-badge";
        multiBadge.setAttribute("aria-hidden", "true");
        r1.appendChild(multiBadge);

        const paidBadge = document.createElement("span");
        paidBadge.className = "schedule-grid__trip-bar__paid-badge material-symbols-outlined is-hidden";
        paidBadge.setAttribute("aria-hidden", "true");
        paidBadge.textContent = "check_circle";
        r1.appendChild(paidBadge);
        const line1 = document.createElement("div");
        line1.className = "schedule-grid__trip-bar__title";
        r1.appendChild(line1);

        // Row 2: Customer (sub)
        const line2 = document.createElement("div");
        line2.className = "schedule-grid__trip-bar__sub";
        r2.appendChild(line2);

        // Row 3: Contact name (sub)
        const line3 = document.createElement("div");
        line3.className = "schedule-grid__trip-bar__sub schedule-grid__trip-bar__contact";
        r3.appendChild(line3);

        // Row 4: Time row (left/right)
        const timeRow = document.createElement("div");
        timeRow.className = "schedule-grid__trip-bar__time-row";
        const left = document.createElement("span");
        left.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--left";
        const center = document.createElement("span");
        center.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--center";
        const right = document.createElement("span");
        right.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--right";
        timeRow.append(left, center, right);
        r4.appendChild(timeRow);

        // Row 5: Status icons
        const statusRow = document.createElement("div");
        statusRow.className = "schedule-grid__trip-bar__status-row";

        function makeMini(content, isIcon = false) {
          const b = document.createElement("span");
          b.className = "schedule-grid__trip-bar__mini-badge icon-status";
          const g = document.createElement("span");
          if (isIcon) {
            g.className =
              "schedule-grid__trip-bar__badge-glyph icon-badge-glyph material-symbols-outlined schedule-grid__trip-bar__badge-icon";
          } else {
            g.className = "schedule-grid__trip-bar__badge-glyph";
          }
          g.textContent = content;
          b.appendChild(g);
          return b;
        }

        const bI = makeMini("attach_file_off", true); // Itinerary
        bI.addEventListener("click", (e) => {
          if (bI.classList.contains("has-pdf")) {
            e.stopPropagation();
            const tk = bar.dataset.tripkey;
            const trip = state.tripByKey?.[tk];
            if (trip && trip.itineraryPdfUrl) {
              window.open(trip.itineraryPdfUrl, "_blank");
            }
          }
        });
        const bC = makeMini("phone_enabled", true); // Contact
        const b$ = makeMini("description", true); // Payment / Approval
        const bD1 = makeMini("person", true); // Driver 1
        const bD2 = makeMini("person", true); // Driver 2 (co-driver)
        const bD3 = makeMini("emergency_home", true); // Relief 1
        const bD4 = makeMini("emergency_home", true); // Relief 2
        const bInv = makeMini("attach_money", true); // Invoice
        const invText = document.createElement("span");
        invText.className = "schedule-grid__trip-bar__mini-badge-text icon-invoice-text";
        bInv.appendChild(invText);
        bInv._text = invText;

        bInv.classList.add("is-hidden"); // start hidden

        const bReviewed = makeMini("task_alt", true); // Trip Reviewed
        bReviewed.classList.add("is-hidden"); // hidden until reviewed

        const barReqIcons = document.createElement("div");
        barReqIcons.className = "schedule-grid__trip-bar__req-icons";

        const statusBadgesWrap = document.createElement("div");
        statusBadgesWrap.className = "schedule-grid__trip-bar__status-badges";
        statusBadgesWrap.append(barReqIcons, b$, bI, bC, bInv, bReviewed);
        statusRow.append(statusBadgesWrap);

        r5.appendChild(statusRow);

        // Row 6: Notes / pre-drivers
        const preDriversRow = document.createElement("div");
        preDriversRow.className = "schedule-grid__trip-bar__pre-drivers";
        r6.appendChild(preDriversRow);

        // Row 7: Drivers — each slot = [smiley icon] [name]
        const driversRow = document.createElement("div");
        driversRow.className = "schedule-grid__trip-bar__drivers";

        const d1Slot = document.createElement("div");
        d1Slot.className = "schedule-grid__trip-bar__driver-slot";
        d1Slot.appendChild(bD1);
        const d1Name = document.createElement("span");
        d1Name.className = "schedule-grid__trip-bar__driver";
        d1Slot.appendChild(d1Name);

        const d2Slot = document.createElement("div");
        d2Slot.className = "schedule-grid__trip-bar__driver-slot";
        d2Slot.appendChild(bD2);
        const d2Name = document.createElement("span");
        d2Name.className = "schedule-grid__trip-bar__driver";
        d2Slot.appendChild(d2Name);

        const d3Slot = document.createElement("div");
        d3Slot.className = "schedule-grid__trip-bar__driver-slot";
        d3Slot.appendChild(bD3);
        const d3Name = document.createElement("span");
        d3Name.className = "schedule-grid__trip-bar__driver";
        d3Slot.appendChild(d3Name);

        const d4Slot = document.createElement("div");
        d4Slot.className = "schedule-grid__trip-bar__driver-slot";
        d4Slot.appendChild(bD4);
        const d4Name = document.createElement("span");
        d4Name.className = "schedule-grid__trip-bar__driver";
        d4Slot.appendChild(d4Name);

        driversRow.append(d1Slot, d2Slot, d3Slot, d4Slot);
        r7.appendChild(driversRow);

        // Append all 7 fixed rows to bar (critical)
        bar.append(r1, r2, r3, r4, r5, r6, r7);

        // Keep your existing references working
        bar._multiBadge = multiBadge;
        bar._paidBadge = paidBadge;
        bar._reqIcons = barReqIcons;
        bar._line1 = line1;
        bar._line2 = line2;
        bar._line3 = line3;
        bar._left = left;
        bar._center = center;
        bar._right = right;
        bar._bI = bI;
        bar._bC = bC;
        bar._b$ = b$;
        bar._bD1 = bD1;
        bar._bD2 = bD2;
        bar._bD3 = bD3;
        bar._bD4 = bD4;
        bar._bInv = bInv;
        bar._bReviewed = bReviewed;
        bar._preDrivers = preDriversRow;
        bar._drivers = driversRow;
        bar._d1Slot = d1Slot;
        bar._d2Slot = d2Slot;
        bar._d3Slot = d3Slot;
        bar._d4Slot = d4Slot;
        bar._d1Name = d1Name;
        bar._d2Name = d2Name;
        bar._d3Name = d3Name;
        bar._d4Name = d4Name;

        bar.dataset.tripkey = String(t.tripKey || "");
        bar.setAttribute("role", "button");
        bar.setAttribute("tabindex", "0");

        state.barElByKey.set(key, bar);
      }

      bar._renderPass = pass;
      bar.dataset.busid = busId;
      bar.dataset.lane = String(lane);

      let list = barsByBus.get(busId);
      if (!list) {
        list = [];
        barsByBus.set(busId, list);
      }
      list.push(bar);

      bar.dataset.sidx = String(startIdx);
      bar.dataset.eidx = String(endIdx);

      function setBadge(badgeEl, statusValue) {
        const s = String(statusValue || "")
          .trim()
          .toLowerCase();

        // 1) Red: Pending, Pending Quote, Pending Invoice
        const pending = s === "pending" || s === "pending quote" || s === "pending invoice";

        // 2) Yellow: Assigned, Quoted, Invoiced
        const yellow = s === "assigned" || s === "quoted" || s === "invoiced";

        // 3) Blue: Deposit Received, Blue
        const blue = s === "deposit received" || s === "blue";

        // 4) Green: PO Received, Not Required, Paid in Full, OK
        // (Handled by !pending && !yellow && !blue && !!s in the toggle)

        badgeEl.classList.toggle("is-pending", pending);
        badgeEl.classList.toggle("is-blue", blue);
        badgeEl.classList.toggle("is-yellow", yellow);
        badgeEl.classList.toggle("is-ok", !pending && !blue && !yellow && !!s);
      }

      const effectiveDriverStatus = getEffectiveDriverStatus(t);
      if (bar._bI) setBadge(bar._bI, t.itineraryStatus);
      if (bar._bC) {
        setBadge(bar._bC, t.contactStatus);
        const contactStatus = String(t.contactStatus || "").trim().toLowerCase();
        bar._bC.classList.toggle("is-hidden", contactStatus === "not required" || contactStatus === "received");
      }
      // Customer payment bar badge logic done below instead of generic setBadge
      if (bar._bD1) setBadge(bar._bD1, a.driver1Status || "Pending");
      if (bar._bD2) setBadge(bar._bD2, a.driver2Status || "Pending");
      if (bar._bD3) setBadge(bar._bD3, a.driver3Status || "Pending");
      if (bar._bD4) setBadge(bar._bD4, a.driver4Status || "Pending");
      if (bar._bInv) setBadge(bar._bInv, t.invoiceStatus);
      if (bar._bReviewed) {
        const reviewed = !!t.tripReviewed && t.tripReviewed !== false;
        bar._bReviewed.classList.toggle("is-hidden", !reviewed);
        bar._bReviewed.classList.toggle("is-ok", reviewed);
      }

      // Custom payment status icon based on value for trip bars
      if (bar._b$) {
        const ps = String(t.paymentStatus || "").trim().toLowerCase();
        const inv = String(t.invoiceStatus || "").trim().toLowerCase();
        bar._b$.classList.remove("is-pending", "is-yellow", "is-blue", "is-ok", "is-hidden");
        
        const glyph = bar._b$.querySelector(".schedule-grid__trip-bar__badge-glyph");
        
        if (ps === "po received" || ps === "not required" || inv === "paid in full") {
          // PO received, not required, or paid in full -> hide icons
          bar._b$.classList.add("is-hidden");
        } else if (ps === "pending quote" || ps === "quoted" || ps === "pending") {
          // No contract signed -> red contract icon
          if (glyph) glyph.textContent = "edit_document";
          bar._b$.classList.add("is-pending"); // red
        } else if (ps === "contract signed") {
          // Contract signed but no PO -> red PO icon
          if (glyph) glyph.textContent = "request_quote";
          bar._b$.classList.add("is-pending"); // red
        } else {
          // Fallback
          if (glyph) glyph.textContent = "description";
          bar._b$.classList.add("is-pending"); // red
        }
      }

      // Swap itinerary status icon when a PDF URL exists
      if (bar._bI) {
        const itinStatus = String(t.itineraryStatus || "").trim().toLowerCase();
        bar._bI.classList.toggle("is-hidden", itinStatus === "not required");

        const glyph = bar._bI.querySelector(".schedule-grid__trip-bar__badge-glyph");
        if (glyph) {
          if (t.itineraryPdfUrl) {
            glyph.textContent = "attach_file";
            bar._bI.classList.add("has-pdf");
            bar._bI.title = "Open itinerary PDF";
          } else {
            glyph.textContent = "attach_file_off";
            bar._bI.classList.remove("has-pdf");
            bar._bI.title = "Itinerary status";
          }
        }
      }

      // Swap driver 1 status icon based on value
      if (bar._bD1) {
        bar._bD1.classList.remove("is-hidden");
        bar._bD1.classList.add("has-action");
        const glyph = bar._bD1.querySelector(".schedule-grid__trip-bar__badge-glyph");
        if (glyph) {
          glyph.textContent = "person";
          glyph.dataset.action = "showDriverContact";
          glyph.dataset.tripkey = t.tripKey;
          glyph.style.cursor = "pointer";
        }
      }

      // Driver 2 (co-driver) slot
      if (bar._bD2) {
        const needsD2 = t.reqCoDriver || (a.driver2 && a.driver2 !== "None");
        bar._d2Slot.classList.toggle("is-hidden", !needsD2);
        if (needsD2) {
          bar._bD2.classList.add("has-action");
          const glyph = bar._bD2.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) {
            glyph.textContent = "person";
            glyph.dataset.action = "showDriverContact";
            glyph.dataset.tripkey = t.tripKey;
            glyph.style.cursor = "pointer";
          }
        }
      }

      // Relief 1 slot
      if (bar._bD3) {
        const needsD3 = t.reqRelief || (a.driver3 && a.driver3 !== "None");
        bar._d3Slot.classList.toggle("is-hidden", !needsD3);
        if (needsD3) {
          bar._bD3.classList.add("has-action");
          const glyph = bar._bD3.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) {
            glyph.textContent = "emergency_home";
            glyph.dataset.action = "showDriverContact";
            glyph.dataset.tripkey = t.tripKey;
            glyph.style.cursor = "pointer";
          }
        }
      }

      // Relief 2 slot
      if (bar._bD4) {
        const needsD4 = t.reqRelief2 || (a.driver4 && a.driver4 !== "None");
        bar._d4Slot.classList.toggle("is-hidden", !needsD4);
        if (needsD4) {
          bar._bD4.classList.add("has-action");
          const glyph = bar._bD4.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) {
            glyph.textContent = "emergency_home";
            glyph.dataset.action = "showDriverContact";
            glyph.dataset.tripkey = t.tripKey;
            glyph.style.cursor = "pointer";
          }
        }
      }

      if (bar._bInv) {
        const inv = String(t.invoiceStatus || "")
          .trim()
          .toLowerCase();
        const showInv = inv === "invoiced" || inv === "deposit received" || inv === "paid in full";

        bar._bInv.classList.toggle("is-hidden", !showInv);
        // set number inside badge (right after icon)
        const num = String(t.invoiceNumber || "").trim();
        if (bar._bInv._text) bar._bInv._text.textContent = num;

        // always show the white text box when invoice icon is visible (even if no number)
        bar._bInv.classList.toggle("has-text", showInv);
      }

      // Requirement icons (left of status badges) from trip req flags
      const reqSpec = [
        { key: "req56Pass",  icon: "tatami_seat" },
        { key: "reqSleeper", icon: "airline_seat_flat" },
        { key: "reqLift",    icon: "accessible" },
        { key: "reqHotel",   icon: "apartment" },
        { key: "reqFuelCard", icon: "credit_card" },
        { key: "reqWifi",    icon: "wifi" },
      ];
      if (bar._reqIcons) {
        bar._reqIcons.innerHTML = "";
        reqSpec.forEach(({ key, icon }) => {
          if (!truthyRequirement(t[key])) return;
          const span = document.createElement("span");
          span.className = "schedule-grid__trip-bar__req-icon icon-req material-symbols-outlined";
          span.textContent = icon;
          span.setAttribute("aria-hidden", "true");
          bar._reqIcons.appendChild(span);
        });
      }

      bar.classList.toggle("cont-left", continuesLeft);
      bar.classList.toggle("cont-right", continuesRight);
      bar.classList.toggle("cont-single", (continuesLeft || continuesRight) && startIdx === endIdx);

      const pay = String(t.paymentStatus || "").toLowerCase();
      // Red unconfirmed if "Pending Quote" or "Quoted" (or legacy "pending")
      const isUnconfirmed = pay === "pending quote" || pay === "quoted" || pay === "pending";
      bar.classList.toggle("unconfirmed", isUnconfirmed);

      if (bar._paidBadge) {
        const payment = String(t.paymentStatus || "").trim().toLowerCase();
        const invoice = String(t.invoiceStatus || "").trim().toLowerCase();
        const isAllClear = payment === "po received" || payment === "not required" || invoice === "paid in full";

        if (isAllClear) {
          bar._paidBadge.textContent = "check_circle";
          bar._paidBadge.classList.remove("is-hidden", "is-alert");
        } else if (!isUnconfirmed) {
          bar._paidBadge.textContent = "error";
          bar._paidBadge.classList.remove("is-hidden");
          bar._paidBadge.classList.add("is-alert");
        } else {
          bar._paidBadge.classList.add("is-hidden");
          bar._paidBadge.classList.remove("is-alert");
        }
        bar.classList.toggle("has-paid-badge", isAllClear || !isUnconfirmed);
        bar._paidBadge.classList.toggle("is-solid", Boolean(t.datePaid));
      }

      const ds = String(effectiveDriverStatus || "")
        .trim()
        .toLowerCase();
      bar.classList.toggle("driverstatus-pending", ds === "pending");
      bar.classList.toggle("driverstatus-assigned", ds === "assigned");
      bar.classList.toggle("driverstatus-confirmed", ds === "confirmed");

      // Color Override
      bar.classList.remove(
        "color-orange",
        "color-yellow",
        "color-green",
        "color-cyan",
        "color-purple",
        "color-pink",
        // legacy cleanup
        "color-blue",
        "color-red",
        "color-teal",
        "color-indigo",
        "color-mint",
        "color-brown",
        "color-gray",
        "color-violet",
        "out-of-service",
        "one-way",
      );
      const tripColor = String(t.tripColor || "")
        .trim()
        .toLowerCase();
      if (tripColor === "out of service") {
        bar.classList.add("out-of-service");
      } else if (tripColor === "one-way") {
        bar.classList.add("one-way");
      } else if (tripColor) {
        bar.classList.add(`color-${tripColor}`);
      }

      let touchesConflict = false;
      if (cellCounts) {
        for (let d = startIdx; d <= endIdx; d++) {
          const k2 = `${busId}|${d}`;
          if ((cellCounts[k2] || 0) > 1) {
            touchesConflict = true;
            break;
          }
        }
      }
      bar.classList.toggle("danger", touchesConflict);

      // Multi-bus indicator: e.g. 1/3, 2/3, 3/3 (only when trip has multiple buses)
      const total = sortedAssigns.length;
      bar.classList.toggle("has-multi-bus", total > 1);
      if (bar._multiBadge) {
        if (total > 1) {
          bar._multiBadge.textContent = `${assignIdx + 1}/${total}`;
          bar._multiBadge.classList.remove("is-hidden");
        } else {
          bar._multiBadge.textContent = "";
          bar._multiBadge.classList.add("is-hidden");
        }
      }

      const dest = t.destination || "Trip";
      const cust = t.customer || "";
      bar._line1.textContent = dest;
      bar._line2.textContent = cust;

      const name = (t.contactName || "").trim();
      const phone = (t.phone || "").trim();
      bar._line3.textContent = name;

      const depTime = t.departureTime;
      const spotTime = t.spotTime;
      const arrTime = t.arrivalTime;

      const isActualSingleDay = depY === arrY;
      bar.classList.toggle("single-day", isActualSingleDay);

      // For text rendering: are we on the actual start or end day of the trip?
      const isStartDay = start === depY;
      const isEndDay = end === arrY;

      if (isActualSingleDay) {
        const tDep = formatTime12(depTime);
        const tArr = formatTime12(arrTime);
        const tSpot = formatTime12(spotTime);

        bar._left.textContent = tDep || "--";
        bar._center.textContent = tSpot || "--";
        bar._right.textContent = tArr || "--";

        bar._left.dataset.severity   = getTimeSeverity(depTime,  "depart");
        bar._center.dataset.severity = "normal";
        bar._right.dataset.severity  = getTimeSeverity(arrTime,  "arrive");
      } else {
        // Multi-Day:
        // Left side shows Dep Time (only if this bar is the trip start)
        // Right side shows Arr Time (only if this bar is the trip end)
        if (isStartDay) {
          bar._left.textContent = formatTime12(depTime) || "--";
          bar._center.textContent = formatTime12(spotTime) || "--";
          bar._left.dataset.severity   = getTimeSeverity(depTime,  "depart");
          bar._center.dataset.severity = "normal";
        } else {
          bar._left.textContent = "";
          bar._center.textContent = "";
          bar._left.dataset.severity   = "normal";
          bar._center.dataset.severity = "normal";
        }

        if (isEndDay) {
          bar._right.textContent = formatTime12(arrTime) || "--";
          bar._right.dataset.severity = getTimeSeverity(arrTime, "arrive");
        } else {
          bar._right.textContent = "";
          bar._right.dataset.severity = "normal";
        }
      }

      bar._preDrivers.textContent = t.notes ? clipText(t.notes, 500) : "";

      bar._d1Name.textContent = d1;
      bar._d2Name.textContent = (d2 && d2 !== "—") ? d2 : "";
      bar._d3Name.textContent = (d3 && d3 !== "—") ? d3 : "";
      bar._d4Name.textContent = (d4 && d4 !== "—") ? d4 : "";

      positionBarWithinOverlay(bar, bars, col, startIdx, endIdx);

      // Handoff split: proportional allocation when another trip starts/ends on the same bus
      // on this day. Takes priority over the fixed half-day logic for the shared day.
      const busHandoff = handoffByBus[busId];
      const endHandoff   = busHandoff?.[endIdx];
      const startHandoff = busHandoff?.[startIdx];
      const activeHandoffEnd   = endHandoff   && isEndDay   && endHandoff.arrTripKey   === t.tripKey;
      const activeHandoffStart = startHandoff && isStartDay && startHandoff.depTripKey === t.tripKey;

      if (activeHandoffEnd) {
        const clip = (1 - endHandoff.arrFrac) * (col.widths[endIdx] ?? 0);
        bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - clip)}px`;
        bar.dataset.handoffArr = String(endHandoff.arrFrac);
      } else {
        delete bar.dataset.handoffArr;
        // Half-day truncation: shorten bar to 1/3 of last column if trip returns 4AM–11:59AM
        const isHalfDayReturn =
          !isActualSingleDay &&
          isEndDay &&
          !!arrTime &&
          arrTime >= "04:00" &&
          arrTime < "12:00";
        bar.classList.toggle("half-day-return", isHalfDayReturn);
        if (isHalfDayReturn) {
          const currentWidth = parseFloat(bar.style.width) || 0;
          const lastColW = col.widths[endIdx] ?? 0;
          bar.style.width = `${Math.max(0, currentWidth - (lastColW * 2) / 3)}px`;
        }
      }

      if (activeHandoffStart) {
        const shift = startHandoff.depFrac * (col.widths[startIdx] ?? 0);
        bar.style.left  = `${(parseFloat(bar.style.left) || 0) + shift}px`;
        bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - shift)}px`;
        bar.dataset.handoffDep = String(startHandoff.depFrac);
      } else {
        delete bar.dataset.handoffDep;
        // Half-day departure: shift bar right by 2/3 of first column if trip departs after 10PM
        const isHalfDayDepart =
          !isActualSingleDay &&
          isStartDay &&
          !!depTime &&
          depTime >= "22:00";
        bar.classList.toggle("half-day-depart", isHalfDayDepart);
        if (isHalfDayDepart) {
          const firstColW = col.widths[startIdx] ?? 0;
          const twoThirds = (firstColW * 2) / 3;
          const currentLeft = parseFloat(bar.style.left) || 0;
          const currentWidth = parseFloat(bar.style.width) || 0;
          bar.style.left = `${currentLeft + twoThirds}px`;
          bar.style.width = `${Math.max(0, currentWidth - twoThirds)}px`;
        }
      }

      /* Tooltip removed by user request (modal is used instead) */
      // const itin = clipText(t.itinerary, 1200);
      // const namePhone = [name, phone].filter(Boolean).join(" • ");
      // bar.title = `${namePhone || "—"}\n\nITINERARY\n${itin || "—"}`;

      let frag = fragByRow.get(rowIdx);
      if (!frag) {
        frag = document.createDocumentFragment();
        fragByRow.set(rowIdx, frag);
      }
      frag.appendChild(bar);
    }
  }

  for (const [busId, list] of barsByBus) {
    const laneCount = (lanesByBus[busId] || []).length || 1;
    const top0 = stackOffset(rowH, barH, step, laneCount);

    // Waiting list row grows to fit stacked trips; others use single row height
    const isWaitingList = busId === "WAITING_LIST";
    
    // FIX: Using 'step' (110px) instead of 'rowH' (100px) for the waiting list height
    // to ensure there is enough vertical room for the stacked bars + their gaps.
    const effectiveRowH = isWaitingList ? Math.max(1, laneCount) * step : rowH;
    const maxTop = Math.max(0, effectiveRowH - barH - 1); // -1 for safety margin

    if (isWaitingList) {
      const wlTr = waitingBody?.querySelector(".waiting-list-row");
      if (wlTr) {
        const h = `${effectiveRowH}px`;
        wlTr.style.setProperty("--waiting-list-dynamic-height", h);
        for (let c = 0; c < wlTr.cells.length; c++) {
          wlTr.cells[c].style.setProperty("--waiting-list-dynamic-height", h);
        }
      }
    }

    for (const bar of list) {
      const lane = Number(bar.dataset.lane);
      if (!Number.isFinite(lane)) continue;

      let topPx = isWaitingList ? (lane * step) : (top0 + lane * step);
      // Clamp to ensure bar stays within its row bounds
      topPx = Math.max(0, Math.min(topPx, maxTop));
      bar.style.top = `${Math.round(topPx)}px`; // <— snap
    }
  }

  for (const [ri, frag] of fragByRow) {
    barsByRowIdx.get(ri)?.appendChild(frag);
  }

  // When no trips on waiting list, keep row at single height
  const wlLanes = (lanesByBus["WAITING_LIST"] || []).length;
  const wlTr0 = waitingBody?.querySelector(".waiting-list-row");
  if (wlLanes === 0 && wlTr0) {
    const h = `${rowH}px`;
    const wlTr = wlTr0;
    wlTr.style.setProperty("--waiting-list-dynamic-height", h);
    for (let c = 0; c < wlTr.cells.length; c++) {
      wlTr.cells[c].style.setProperty("--waiting-list-dynamic-height", h);
    }
  }

  pruneOldBars(pass);

  if (!deferConflicts && cellCounts && cellItems) {
    const conflicts = [];
    for (const k of Object.keys(cellCounts)) {
      if (cellCounts[k] <= 1) continue;

      const [busId, dayIdxStr] = k.split("|");
      const dayIdx = Number(dayIdxStr);

      const rowIdx = state.busRowIndex.get(busId);
      const row = dom.agendaBody.rows[rowIdx];
      if (!row) continue;

      row.cells[0].classList.add("bus-conflict");
      row.cells[dayIdx + 1]?.classList.add("conflict");

      const dateObj = addDays(state.currentDate, dayIdx);
      conflicts.push({
        busId,
        dayLabel: `${CONFIG.MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}`,
        items: cellItems[k] || [],
      });
    }

    showConflictsPanel(conflicts);
    dom.conflictBadge?.classList.toggle("is-hidden", !conflicts.length);
  } else if (deferConflicts) {
    const thisReq = state.weekReqId;
    const { start, end } = getWeekRange();
    const wk = weekKey(start, end);
    state.pendingConflictJob = { reqId: thisReq, weekKey: wk };

    const run = () => {
      if (!state.pendingConflictJob) return;
      if (state.pendingConflictJob.reqId !== state.weekReqId) return;
      const nowRange = getWeekRange();
      if (weekKey(nowRange.start, nowRange.end) !== state.pendingConflictJob.weekKey) return;

      const cc = {};
      const ci = {};

      for (const t of visibleTrips) {
        const depY = ymd(t._dep);
        const arrY = ymd(t._arr);

        const start = depY < weekStart ? weekStart : depY;
        const end = arrY > weekEnd ? weekEnd : arrY;

        const startIdx = weekIndex.get(start);
        const endIdx = weekIndex.get(end);
        if (startIdx == null || endIdx == null) continue;

        const assigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
        for (const a of assigns) {
          const busId = String(a.busId || "").trim();
          if (state.busRowIndex.get(busId) === undefined) continue;

          for (let d = startIdx; d <= endIdx; d++) {
            const key = `${busId}|${d}`;
            cc[key] = (cc[key] || 0) + 1;
            (ci[key] ||= []).push({
              tripKey: t.tripKey,
              driver1: a.driver1 && a.driver1 !== "None" ? a.driver1 : "—",
              driver2: a.driver2 && a.driver2 !== "None" ? a.driver2 : "—",
              trip: t,
            });
          }
        }
      }

      // Remove handoff days from deferred conflict counts
      for (const [hBusId, days] of Object.entries(handoffByBus)) {
        for (const [dayStr, ho] of Object.entries(days)) {
          const key = `${hBusId}|${dayStr}`;
          if (!cc[key] || cc[key] <= 1) continue;
          const items = ci[key] || [];
          const keep = items.filter(it => it.tripKey !== ho.arrTripKey && it.tripKey !== ho.depTripKey);
          const removed = items.length - keep.length;
          if (removed > 0) {
            cc[key] = Math.max(0, cc[key] - removed);
            ci[key] = keep;
          }
        }
      }

      clearConflictStyles();

      const conflicts = [];
      for (const k of Object.keys(cc)) {
        if (cc[k] <= 1) continue;

        const [busId, dayIdxStr] = k.split("|");
        const dayIdx = Number(dayIdxStr);

        const rowIdx = state.busRowIndex.get(busId);
        const row = dom.agendaBody.rows[rowIdx];
        if (!row) continue;

        row.cells[0].classList.add("bus-conflict");
        row.cells[dayIdx + 1]?.classList.add("conflict");

        const dateObj = addDays(state.currentDate, dayIdx);
        conflicts.push({
          busId,
          dayLabel: `${CONFIG.MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}`,
          items: ci[k] || [],
        });
      }

      for (const [, bar] of state.barElByKey) {
        if (bar._renderPass !== state.renderPass) continue;

        const busId = bar.dataset.busid;
        const sidx = Number(bar.dataset.sidx);
        const eidx = Number(bar.dataset.eidx);
        if (!busId || Number.isNaN(sidx) || Number.isNaN(eidx)) continue;

        let danger = false;
        for (let d = sidx; d <= eidx; d++) {
          if ((cc[`${busId}|${d}`] || 0) > 1) {
            danger = true;
            break;
          }
        }
        bar.classList.toggle("danger", danger);
      }

      showConflictsPanel(conflicts);
      dom.conflictBadge?.classList.toggle("is-hidden", !conflicts.length);
    };

    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 600 });
    else setTimeout(run, 0);
  }
}

// ======================================================
// 21) DRIVER WEEK CARD (LEFT PANEL)
// ======================================================
function renderDriverWeekHeader() {
  if (!dom.driverWeekHeadRow) return;

  dom.driverWeekHeadRow.innerHTML = "";

  const thName = document.createElement("th");
  thName.textContent = "Driver";
  dom.driverWeekHeadRow.appendChild(thName);

  const weekDates = getWeekDates(); // Returns 7 days in correct order
  // In a Monday-start world, index 5 is Saturday.
  // In a Sunday-start world, index 6 is Saturday.
  const dayLabels = state.weekStartsOnMonday
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];

  weekDates.forEach((dStr, i) => {
    const th = document.createElement("th");
    th.textContent = dayLabels[i];
    th.dataset.date = dStr;

    // Highlight today in driver week header too
    if (dStr === ymd(new Date())) {
      th.classList.add("driver-week__header-cell--today");
    }

    dom.driverWeekHeadRow.appendChild(th);
  });

}
function renderDriverWeekGrid() {
  if (!dom.driverWeekHeadRow || !dom.driverWeekBody) return;

  renderDriverWeekHeader();

  const weekDates = getWeekDates(); // Full 7 days

  const weekIndex = new Map(weekDates.map((d, i) => [d, i]));
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6]; // 7 days, so last index is 6

  const onDaysByDriver = new Map();     // primary (driver1/driver2)
  const reliefDaysByDriver = new Map(); // relief  (driver3/driver4)

  const visibleTrips = state.trips
    .map((t) => {
      const dep = parseYMD(t.departureDate);
      const arr = parseYMD(t.arrivalDate) || dep;
      return { ...t, _dep: dep, _arr: arr };
    })
    .filter((t) => t._dep && t._arr)
    .filter((t) => !(ymd(t._arr) < weekStart || ymd(t._dep) > weekEnd));

  for (const t of visibleTrips) {
    const depY = ymd(t._dep);
    const arrY = ymd(t._arr);

    const start = depY < weekStart ? weekStart : depY;
    const end = arrY > weekEnd ? weekEnd : arrY;

    const assigns = state.assignmentsByTripKey[String(t.tripKey)] || [];
    if (!assigns.length) continue;

    const startD = parseYMD(start);
    const endD = parseYMD(end);
    if (!startD || !endD) continue;

    for (let d = new Date(startD); d <= endD; d = addDays(d, 1)) {
      const k = ymd(d);
      const idx = weekIndex.get(k);
      if (idx == null) continue;

      for (const a of assigns) {
        const d1 = String(a.driver1 || "").trim();
        const d2 = String(a.driver2 || "").trim();
        const drivers = [d1, d2].filter((x) => x && x !== "None");

        for (const name of drivers) {
          if (!onDaysByDriver.has(name)) onDaysByDriver.set(name, new Set());
          onDaysByDriver.get(name).add(idx);
        }

        const d3 = String(a.driver3 || "").trim();
        const d4 = String(a.driver4 || "").trim();
        const relief = [d3, d4].filter((x) => x && x !== "None");

        for (const name of relief) {
          if (!reliefDaysByDriver.has(name)) reliefDaysByDriver.set(name, new Set());
          reliefDaysByDriver.get(name).add(idx);
        }
      }
    }
  }

  const seenDriverNames = new Set();
  const driverNames = [];
  const addDriverName = (name) => {
    if (name && !seenDriverNames.has(name.toLowerCase())) {
      seenDriverNames.add(name.toLowerCase());
      driverNames.push(name);
    }
  };

  (state.driversList || [])
    .map((d) => String(d.driverName || "").trim())
    .filter(Boolean)
    .forEach(addDriverName);

  for (const name of onDaysByDriver.keys()) addDriverName(name);
  for (const name of reliefDaysByDriver.keys()) addDriverName(name);

  dom.driverWeekBody.innerHTML = driverNames
    .map((name) => {
      const set = onDaysByDriver.get(name) || new Set();

      const cells = weekDates
        .map((dStr, idx) => {
          const on = set.has(idx);
          const relief = !on && (reliefDaysByDriver.get(name)?.has(idx) ?? false);
          const unavailable = state.unavailabilityByDriver[name]?.[dStr];
          let cls = "driver-week__cell--off";
          if (on) cls = "driver-week__cell--on";
          else if (relief) cls = "driver-week__cell--relief";
          else if (unavailable) cls = "driver-week__cell--unavailable";

          const icon = relief
            ? `<span class="material-symbols-outlined driver-week__relief-icon">emergency_home</span>`
            : "";
          return `<td class="${cls}" data-driver="${escHtml(name)}" data-date="${dStr}">${icon}</td>`;
        })
        .join("");

      return `
<tr>
<td class="driver-week__name-cell" data-driver-name="${escHtml(name)}">${escHtml(name)}<span class="material-symbols-outlined driver-week__schedule-icon" data-action="showDriverWeekSchedule" data-driver-name="${escHtml(name)}" title="Week schedule for ${escHtml(name)}">sms</span></td>
${cells}
</tr>
`;
    })
    .join("");
}

function updateDriverWeekIfVisible() {
  if (!dom.driverWeekCard) return;

  const driverCardVisible = getCardPanel("drivers") !== null;

  if (driverCardVisible) renderDriverWeekGrid();
}

const TRIP_CHECKLIST = [
  {
    key: "envelope",
    label: "Envelope Printed",
    show: () => true,
  },
  {
    key: "envelopeInfo",
    type: "warning",
    label: "Envelope info incomplete",
    show: (t) => !t.envelopePickup || !t.envelopeTripContact || !t.envelopeTripPhone,
  },
  {
    key: "reminder",
    tripProp: "tripReminderSent",
    label: "Trip Reminder Sent",
    show: () => true,
  },
  {
    key: "driverInfo",
    tripProp: "driverInfoSent",
    label: "Driver Info Sent",
    show: (t) => t.contactStatus !== "Not Required",
  },
  {
    key: "fuelCard",
    label: "Fuel Card Assigned",
    show: (t) => !!t.reqFuelCard,
  },
  {
    key: "hos",
    label: "Hours of Service form",
    show: (t) => {
      const asns = state.assignmentsByTripKey?.[t.tripKey] || [];
      const names = asns.flatMap((a) =>
        [a.driver1, a.driver2, a.driver3, a.driver4].filter((d) => d && d.toLowerCase() !== "none")
      );
      return names.some((name) => {
        const d = (state.driversList || []).find(
          (d) => String(d.driverName).trim().toLowerCase() === name.trim().toLowerCase()
        );
        return d?.status === "Part-Time";
      });
    },
  },
];

function updateTodoCardIfVisible() {
  if (!getCardPanel("todo")) return;
  renderTodoCard();
}

function buildTripCard(t, todayYMD, getAsns) {
  const dest       = t.destination || "—";
  const customer   = t.customer || "";
  const depart     = formatTime12(t.departureTime) || "--";
  const spot       = t.spotTime ? `· Spot ${formatTime12(t.spotTime)}` : "";
  const asns       = getAsns(t.tripKey);
  const allDrivers = asns.flatMap((a) =>
    [a.driver1, a.driver2, a.driver3, a.driver4].filter((d) => d && d.toLowerCase() !== "none")
  );
  const driverLine = [...new Set(allDrivers)].join(" · ");

  const assignedFleets = asns
    .filter((a) => a.busId && a.busId !== "WAITING_LIST")
    .map((a) => {
      const bus = (state.busesList || []).find((b) => b.busId === a.busId);
      return bus?.busNumber ? `#${bus.busNumber}` : null;
    })
    .filter(Boolean);
  const busDisplay =
    assignedFleets.length > 0
      ? assignedFleets.join(" · ")
      : t.busesNeeded > 0
      ? `${t.busesNeeded} bus${t.busesNeeded !== 1 ? "es" : ""} needed`
      : "";
  const uniqueDriverCount = new Set(allDrivers).size;
  const envelopeDisplay =
    uniqueDriverCount > 0
      ? `${uniqueDriverCount} envelope${uniqueDriverCount !== 1 ? "s" : ""}`
      : "";
  const statsLine = [busDisplay, envelopeDisplay].filter(Boolean).join('<span class="todo-stat__sep"> · </span>');

  const savedKey   = `etb-todo-${t.tripKey}-${todayYMD}`;
  const saved      = JSON.parse(localStorage.getItem(savedKey) || "{}");
  const items      = TRIP_CHECKLIST.filter(({ show }) => show(t));
  const checkItems = items.filter(({ type }) => type !== "warning");
  const checks     = items.map(({ key, label, type, tripProp }) => {
    if (type === "warning") {
      return `<li class="todo-item todo-item--warning" data-trip="${t.tripKey}" data-key="${key}">
        <span class="todo-item__label">
          <span class="material-symbols-outlined todo-item__warn-icon">warning</span>
          <span class="todo-item__text">${label}</span>
        </span>
      </li>`;
    }
    const checked = !!saved[key] || (tripProp ? !!t[tripProp] : false);
    return `<li class="todo-item${checked ? " is-done" : ""}" data-trip="${t.tripKey}" data-key="${key}">
      <label class="todo-item__label">
        <input type="checkbox" class="todo-item__check" ${checked ? "checked" : ""}>
        <span class="todo-item__text">${label}</span>
      </label>
    </li>`;
  }).join("");
  let statusClass = "";
  if (checkItems.length > 0) {
    const allDone = checkItems.every(({ key, tripProp }) => !!saved[key] || (tripProp ? !!t[tripProp] : false));
    statusClass = allDone ? " is-complete" : " has-pending";
  }
  return `<div class="todo-trip-card${statusClass}" data-trip="${t.tripKey}">
    <p class="todo-trip-card__dest">${dest}</p>
    ${customer   ? `<p class="todo-trip-card__customer">${customer}</p>`  : ""}
    <p class="todo-trip-card__meta">Depart ${depart} ${spot}</p>
    ${driverLine ? `<p class="todo-trip-card__meta">${driverLine}</p>`    : ""}
    ${statsLine   ? `<p class="todo-trip-card__stats">${statsLine}</p>`  : ""}
    ${items.length ? `<ul class="todo-trip-card__checks">${checks}</ul>` : ""}
  </div>`;
}

async function renderTodoCard() {
  const headerEl = dom.todoHeader;
  const listEl   = dom.todoList;
  if (!headerEl || !listEl) return;

  const today    = new Date();
  const todayYMD = ymd(today);
  const dow      = today.getDay(); // 0=Sun 1=Mon … 5=Fri 6=Sat

  // Weekend — not working
  if (dow === 0 || dow === 6) {
    headerEl.innerHTML = "";
    listEl.innerHTML = `<p class="todo-list__empty todo-list__empty--rest">Sergio doesn't work today.</p>`;
    return;
  }

  // Friday → prep Sat + Sun + Mon; otherwise → just tomorrow
  const daysAhead = dow === 5 ? [1, 2, 3] : [1];
  const prepDates = daysAhead.map((offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return d;
  });
  const prepYMDs = prepDates.map(ymd);

  // On Fridays, Monday may fall in next week which isn't loaded yet — fetch it
  let bonusTrips       = [];
  let bonusAssignments = {};
  if (dow === 5) {
    const mondayYMD   = prepYMDs[2];
    const loadedDates = new Set(getWeekDates());
    if (!loadedDates.has(mondayYMD)) {
      try {
        const { start, end, notesKey } = getWeekRange(prepDates[2]);
        // prefetchAdjacentWeeks already fetched this — reads from cache, no network call
        const resp = await fetchWeekDataCached(start, end, notesKey);
        if (resp.ok) {
          bonusTrips = resp.trips.filter((t) => t.departureDate === mondayYMD);
          for (const a of resp.assignments) {
            (bonusAssignments[a.tripKey] ||= []).push(a);
          }
        }
      } catch (_) { /* Monday cards will appear without driver info */ }
    }
  }

  const tripPool = [...(state.trips || []), ...bonusTrips];
  const getAsns  = (tripKey) =>
    state.assignmentsByTripKey?.[tripKey] || bonusAssignments[tripKey] || [];

  const allTrips = tripPool
    .filter((t) => prepYMDs.includes(t.departureDate) && t.tripColor !== "Out of Service")
    .sort((a, b) =>
      a.departureDate !== b.departureDate
        ? a.departureDate.localeCompare(b.departureDate)
        : (a.departureTime || "").localeCompare(b.departureTime || "")
    );

  // Header
  if (dow === 5) {
    headerEl.innerHTML = `
      <p class="todo-header__date">Weekend Prep</p>
      <p class="todo-header__count">${allTrips.length} trip${allTrips.length !== 1 ? "s" : ""} departing</p>`;
  } else {
    const dateLabel = prepDates[0].toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    headerEl.innerHTML = `
      <p class="todo-header__date">Departing ${dateLabel}</p>
      <p class="todo-header__count">${allTrips.length} trip${allTrips.length !== 1 ? "s" : ""} departing</p>`;
  }

  if (allTrips.length === 0) {
    listEl.innerHTML = `<p class="todo-list__empty">No trips departing.</p>`;
    return;
  }

  // On Fridays group cards under a day label per date
  let html = "";
  if (dow === 5) {
    for (const d of prepDates) {
      const dayTrips = allTrips.filter((t) => t.departureDate === ymd(d));
      if (!dayTrips.length) continue;
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      html += `<p class="todo-day-label">${dayLabel} — ${dayTrips.length} trip${dayTrips.length !== 1 ? "s" : ""}</p>`;
      html += dayTrips.map((t) => buildTripCard(t, todayYMD, getAsns)).join("");
    }
  } else {
    html = allTrips.map((t) => buildTripCard(t, todayYMD, getAsns)).join("");
  }

  listEl.innerHTML = html;

  // Debounce timers keyed by tripKey — prevents duplicate sheet rows from rapid clicks
  const syncTimers = {};

  listEl.querySelectorAll(".todo-item__check").forEach((cb) => {
    cb.addEventListener("change", () => {
      const item     = cb.closest(".todo-item");
      const tripKey  = item.dataset.trip;
      const key      = item.dataset.key;
      const savedKey = `etb-todo-${tripKey}-${todayYMD}`;
      const saved    = JSON.parse(localStorage.getItem(savedKey) || "{}");
      saved[key]     = cb.checked;
      localStorage.setItem(savedKey, JSON.stringify(saved));
      item.classList.toggle("is-done", cb.checked);
      // Update card status class live
      const card = cb.closest(".todo-trip-card");
      if (card) {
        const trip = (state.trips || []).find((tr) => tr.tripKey === tripKey);
        if (trip) {
          const cardItems = TRIP_CHECKLIST.filter(({ show, type }) => show(trip) && type !== "warning");
          const allDone = cardItems.length > 0 && cardItems.every(({ key: k, tripProp }) => {
            const tripVal = tripProp && trip ? !!trip[tripProp] : false;
            return !!saved[k] || tripVal;
          });
          card.classList.toggle("is-complete", allDone);
          card.classList.toggle("has-pending", cardItems.length > 0 && !allDone);
        }
      }
      // Debounce server persist — waits 600ms after last change for this trip before POSTing
      clearTimeout(syncTimers[tripKey]);
      syncTimers[tripKey] = setTimeout(() => {
        const latest = JSON.parse(localStorage.getItem(savedKey) || "{}");
        api.setChecklist(tripKey, todayYMD, latest).catch((err) => console.warn("[checklist sync]", err));
      }, 600);
    });
  });

  // Reconcile with server state in background after rendering from localStorage
  syncChecklistFromServer(todayYMD);
}

async function syncChecklistFromServer(date) {
  try {
    const resp = await api.getChecklist(date);
    if (!resp?.ok || !resp.rows?.length) return;
    const KEYS = ["envelope", "reminder", "driverInfo", "fuelCard", "hos"];
    for (const row of resp.rows) {
      const tripKey  = String(row.tripKey || "").trim();
      if (!tripKey) continue;
      const trip = (state.trips || []).find((tr) => tr.tripKey === tripKey);
      const saved = {};
      for (const k of KEYS) saved[k] = String(row[k] || "").toLowerCase() === "true";
      // Fold in trip-record fields so the two sources stay aligned
      for (const { key: k, tripProp } of TRIP_CHECKLIST) {
        if (tripProp && trip && trip[tripProp]) saved[k] = true;
      }
      localStorage.setItem(`etb-todo-${tripKey}-${date}`, JSON.stringify(saved));
      // Patch the live DOM without re-rendering
      const cardEl = dom.todoList?.querySelector(`[data-trip="${tripKey}"]`);
      if (!cardEl) continue;
      for (const k of KEYS) {
        const itemEl = cardEl.querySelector(`.todo-item[data-key="${k}"]`);
        if (!itemEl) continue;
        const itemDef = TRIP_CHECKLIST.find((i) => i.key === k);
        const tripVal = itemDef?.tripProp && trip ? !!trip[itemDef.tripProp] : false;
        const isChecked = saved[k] || tripVal;
        const cb = itemEl.querySelector(".todo-item__check");
        if (cb) cb.checked = isChecked;
        itemEl.classList.toggle("is-done", isChecked);
      }
      // Refresh card status class after server reconcile
      if (trip) {
        const cardItems = TRIP_CHECKLIST.filter(({ show, type }) => show(trip) && type !== "warning");
        const allDone = cardItems.length > 0 && cardItems.every(({ key: k, tripProp }) => {
          const tripVal = tripProp && trip ? !!trip[tripProp] : false;
          return !!saved[k] || tripVal;
        });
        cardEl.classList.toggle("is-complete", allDone);
        cardEl.classList.toggle("has-pending", cardItems.length > 0 && !allDone);
      }
    }
  } catch (err) { console.warn("[checklist getChecklist]", err); }
}

// ======================================================
// 22) LEFT PANEL MODE + DESKTOP ENFORCEMENT
// ======================================================
// Card-to-panel mapping
const TIME_SEVERITY_CONFIG = {
  depart: { flagBeforeMinutes: 4 * 60 + 30 }, // before 4:30 AM → flagged
  arrive: { flagAfter: 23, flagBefore: 3 },    // 11:00 PM+ or midnight–2:59 AM → flagged
};

function getTimeSeverity(timeStr, role) {
  const hhmm = normalizeTime(timeStr);
  if (!hhmm) return "normal";
  const [h, m] = hhmm.split(":").map(Number);
  const cfg = TIME_SEVERITY_CONFIG[role];
  if (role === "depart" && h * 60 + m < cfg.flagBeforeMinutes) return "flagged";
  if (role === "arrive" && (h >= cfg.flagAfter || h < cfg.flagBefore)) return "flagged";
  return "normal";
}

const CARD_CONFIG = {
  trip: { card: dom.tripInfoCard, btn: dom.tripInputBtn },
  drivers: { card: dom.driverWeekCard, btn: dom.driversBtn },
  notes: { card: dom.notesCard, btn: dom.notesBtn },
  quote: { card: dom.quoteCard, btn: dom.quoteBtn },
  todo: { card: dom.todoCard, btn: dom.todoBtn },
  log: { card: dom.logCard, btn: dom.logBtn },
};

function getCardPanel(cardType) {
  return state.cardPanelAssignments[cardType] || null;
}

/** Suppress horizontal scrollbar during layout changes (panel open/close, window resize) */
let _resizeTimer = 0;
function suppressScrollbarDuringResize() {
  const layout = getLayoutPanelsEl();
  if (!layout) return;
  layout.classList.add("is-resizing");
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => layout.classList.remove("is-resizing"), 800);
}

function getFirstAvailablePanel() {
  const panelStart = dom.panelStart;
  const panelEndEl = dom.panelEnd;

  const leftHasCard = Object.values(state.cardPanelAssignments).includes("left");
  const rightHasCard = Object.values(state.cardPanelAssignments).includes("right");

  if (!leftHasCard && panelStart) return "left";
  if (!rightHasCard && panelEndEl) return "right";
  return null; // Both panels occupied
}

function showCardInPanel(cardType, panel) {
  const config = CARD_CONFIG[cardType];
  if (!config || !config.card) return;

  suppressScrollbarDuringResize();

  const panelStart = dom.panelStart;
  const panelEndEl = dom.panelEnd;

  // Cancel any pending exit animation
  if (config.card._hideTimeout) {
    clearTimeout(config.card._hideTimeout);
    config.card._hideTimeout = null;
  }

  // Remove card from current location if it's a direct child
  const currentParent = config.card.parentElement;
  if (currentParent === panelStart || currentParent === panelEndEl) {
    currentParent.removeChild(config.card);
  }

  // Add to target panel
  if (panel === "left" && panelStart) {
    panelStart.appendChild(config.card);
    panelStart.classList.remove("is-collapsed");
  } else if (panel === "right" && panelEndEl) {
    panelEndEl.appendChild(config.card);
    panelEndEl.classList.remove("is-collapsed");
  }

  // Show the card
  config.card.classList.remove("is-hidden");

  // Reset animation
  const inClass = panel === "right" ? "slide-in-right" : "slide-in-left";
  const outClass = panel === "right" ? "slide-out-right" : "slide-out-left";
  config.card.classList.remove("slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right", "fade-in");
  void config.card.offsetWidth; // force reflow
  config.card.classList.add(inClass);

  // Update state
  state.cardPanelAssignments[cardType] = panel;

  // Update button state
  if (config.btn) {
    config.btn.setAttribute("aria-pressed", "true");
  }

  // Special handling for specific cards
  if (cardType === "notes") {
    updateNotesWeekTitle();
  }
  if (cardType === "drivers") {
    updateDriverWeekIfVisible();
  }
  if (cardType === "todo") {
    renderTodoCard();
  }

  scheduleAgendaReflow();
}

function hideCard(cardType) {
  const config = CARD_CONFIG[cardType];
  if (!config || !config.card) return;

  suppressScrollbarDuringResize();

  const panel = state.cardPanelAssignments[cardType];
  
  // Explicitly trigger the slide-out animation independently from the wrapper's CSS
  const outClass = panel === "right" ? "slide-out-right" : "slide-out-left";
  config.card.classList.remove("slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
  void config.card.offsetWidth; // force reflow
  config.card.classList.add(outClass);
  
  state.cardPanelAssignments[cardType] = null;

  // Update button state
  if (config.btn) {
    config.btn.setAttribute("aria-pressed", "false");
  }

  // Collapse panel if it's now empty (check state, not DOM)
  const panelStart = dom.panelStart;
  const panelEndEl = dom.panelEnd;

  const leftHasCards = Object.values(state.cardPanelAssignments).includes("left");
  const rightHasCards = Object.values(state.cardPanelAssignments).includes("right");

  if (panelStart && !leftHasCards) {
    panelStart.classList.add("is-collapsed");
  }
  if (panelEndEl && !rightHasCards) {
    panelEndEl.classList.add("is-collapsed");
  }

  // Delay "display: none" so the closing animation can visually complete
  if (config.card._hideTimeout) {
    clearTimeout(config.card._hideTimeout);
  }
  config.card._hideTimeout = setTimeout(() => {
    config.card.classList.add("is-hidden");
    config.card._hideTimeout = null;
  }, 300);

  scheduleAgendaReflow();
}

function toggleCard(cardType) {
  const currentPanel = getCardPanel(cardType);

  if (currentPanel) {
    // Card is open — close it
    hideCard(cardType);
  } else {
    const panel = getFirstAvailablePanel();
    if (panel) {
      // Open in the first available slot (left first, then right)
      showCardInPanel(cardType, panel);
    } else {
      // Both panels occupied — replace the right (secondary) panel
      const rightCard = Object.keys(state.cardPanelAssignments).find(
        (k) => state.cardPanelAssignments[k] === "right"
      );
      if (rightCard) hideCard(rightCard);
      showCardInPanel(cardType, "right");
    }
  }
}

// Legacy function for backward compatibility (if needed)
function setSidePanelMode(mode) {
  if (mode === "off") {
    // Close all cards
    Object.keys(CARD_CONFIG).forEach((cardType) => hideCard(cardType));
  } else {
    // Ensure card is shown exclusively on the left
    const currentPanel = getCardPanel(mode);
    if (!currentPanel) {
      // Close anything else
      Object.keys(CARD_CONFIG).forEach((cardType) => hideCard(cardType));
      showCardInPanel(mode, "left");
    } else {
      // Card is assigned to a panel — ensure that panel is actually expanded
      const panelEl = currentPanel === "left" ? dom.panelStart : dom.panelEnd;
      if (panelEl?.classList.contains("is-collapsed")) {
        panelEl.classList.remove("is-collapsed");
      }
    }
  }
}

function setPanelStartMode(show) {
  const panelStart = dom.panelStart;
  if (!panelStart) return;

  panelStart.classList.toggle("is-collapsed", !show);

  const btn = document.getElementById("panelStartBtn");
  if (btn) {
    btn.setAttribute("aria-pressed", show ? "true" : "false");
  }

  if (dom.agendaBody?.rows?.length) scheduleAgendaReflow();
}

function enforceDesktopEditing() {
  const mobile = isMobileOnly();

  if (dom.tripInputBtn) {
    dom.tripInputBtn.disabled = mobile;
    dom.tripInputBtn.title = mobile ? "Trip editing is available on desktop" : "Trip Editor";
    dom.tripInputBtn.setAttribute("aria-disabled", mobile ? "true" : "false");
  }

  if (mobile) setSidePanelMode("off");
}

// ======================================================
// 23) BUS ASSIGNMENTS UI
// ======================================================
function makeSelect(name) {
  const sel = document.createElement("select");
  sel.name = name;
  return sel;
}

function setSelectOptions(sel, options, selectedValue) {
  const prev = selectedValue ?? sel.value;
  sel.innerHTML = "";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }
  const prevTrimmed = String(prev).trim();
  const match = options.find((o) => String(o.value).trim() === prevTrimmed);
  sel.value = match ? match.value : "None";
}

function getBusOptions() {
  const base = [
    { value: "None", label: "" },
    { value: "WAITING_LIST", label: "W/L" },
  ];
  const mapped = state.busesList.map((b) => ({
    value: String(b.busId),
    label: b.busName ? `${b.busName}` : `Bus ${b.busId}`,
  }));
  return base.concat(mapped);
}

function getDriverOptions() {
  const base = [{ value: "None", label: "" }];
  const mapped = state.driversList.map((d) => ({
    value: d.driverName ? String(d.driverName) : String(d.driverId),
    label: d.driverName ? String(d.driverName) : String(d.driverId),
  }));
  return base.concat(mapped);
}

const DRIVER_STATUS_STATES = [
  { value: "Pending",   icon: "schedule",               cls: "status-pending"  },
  { value: "Assigned",  icon: "pending",                cls: "status-assigned" },
  { value: "Confirmed", icon: "check_circle",           cls: "status-ok"       },
];

function makeDriverStatusSelect(name) {
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = name;
  hidden.value = "";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "driver-status-cycle";
  btn.setAttribute("aria-label", "Driver status");
  btn.innerHTML = `<span class="material-symbols-outlined">radio_button_unchecked</span>`;

  const syncBtn = () => {
    const state = DRIVER_STATUS_STATES.find(s => s.value === hidden.value);
    if (state) {
      btn.querySelector("span").textContent = state.icon;
      btn.className = `driver-status-cycle ${state.cls}`;
    } else {
      btn.querySelector("span").textContent = "radio_button_unchecked";
      btn.className = "driver-status-cycle";
    }
  };

  btn.addEventListener("click", () => {
    const cur = DRIVER_STATUS_STATES.findIndex(s => s.value === hidden.value);
    const next = DRIVER_STATUS_STATES[(cur + 1) % DRIVER_STATUS_STATES.length];
    hidden.value = next.value;
    syncBtn();
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
    state.tripFormDirty = true;
  });

  hidden.addEventListener("change", syncBtn);

  // Override value property so external .value = "..." updates the button too
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(hidden, "value", {
    get: () => proto.get.call(hidden),
    set: (v) => { proto.set.call(hidden, v); syncBtn(); },
    configurable: true,
  });

  const wrap = document.createElement("div");
  wrap.className = "driver-status-cycle-wrap";
  wrap.appendChild(btn);
  wrap.appendChild(hidden);

  // Proxy disabled to both button and hidden
  Object.defineProperty(wrap, "disabled", {
    set: (v) => { btn.disabled = v; hidden.disabled = v; },
    get: () => btn.disabled,
    configurable: true,
  });

  // Proxy value/dispatchEvent through to hidden input
  Object.defineProperty(wrap, "value", {
    get: () => hidden.value,
    set: (v) => { hidden.value = v; },
    configurable: true,
  });

  wrap.dispatchEvent = (e) => hidden.dispatchEvent(e);
  wrap.addEventListener = (type, fn, opts) => hidden.addEventListener(type, fn, opts);

  return wrap;
}

function syncBusSelectEmptyState() {
  dom.busGrid?.querySelectorAll("select").forEach((el) => {
    const v = (el.value ?? "").trim();
    const cell = el.closest(".select-dropdown") || el;
    cell.classList.toggle("is-empty", !v || v === "None");

  });
  checkDriverDoubleBookings();
}

function refreshBusSelectOptions() {
  const busOpts = getBusOptions();
  const drvOpts = getDriverOptions();
  state.busRows.forEach((r) => {
    setSelectOptions(r.busSel, busOpts);
    setSelectOptions(r.d1Sel, drvOpts);
    setSelectOptions(r.d2Sel, drvOpts);
    setSelectOptions(r.d3Sel, drvOpts);
    setSelectOptions(r.d4Sel, drvOpts);
  });
  syncBusSelectEmptyState();
}

function updateBusRowVisibility() {
  const raw = Number(dom.busesNeeded.value);
  const n   = raw > 0 ? Math.min(10, raw) : 0;

  const wantsD2 = document.getElementById("reqCoDriver")?.getAttribute("aria-pressed") === "true";
  const wantsD3 = document.getElementById("reqRelief")?.getAttribute("aria-pressed") === "true";
  const wantsD4 = document.getElementById("reqRelief2")?.getAttribute("aria-pressed") === "true";

  state.busRows.forEach((r, idx) => {
    const show    = idx < n || idx === 0;
    const enabled = raw > 0 && idx < n;

    const showD2 = show && (wantsD2 || (r.d2Sel.value && r.d2Sel.value !== "None"));
    const showD3 = show && (wantsD3 || (r.d3Sel.value && r.d3Sel.value !== "None"));
    const showD4 = show && (wantsD4 || (r.d4Sel.value && r.d4Sel.value !== "None"));

    r.rowGroup.classList.toggle("is-hidden", !show);
    r.d1Row.classList.toggle("is-hidden", false);
    r.d2Row.classList.toggle("is-hidden", !showD2);
    r.d3Row.classList.toggle("is-hidden", !showD3);
    r.d4Row.classList.toggle("is-hidden", !showD4);

    r.busSel.disabled      = !enabled;
    r.d1Sel.disabled       = !enabled;
    r.d1StatusSel.disabled = !enabled;
    r.d1Pay.disabled       = !enabled;
    r.d2Sel.disabled       = !enabled || !showD2;
    r.d2StatusSel.disabled = !enabled || !showD2;
    r.d2Pay.disabled       = !enabled || !showD2;
    r.d3Sel.disabled       = !enabled || !showD3;
    r.d3StatusSel.disabled = !enabled || !showD3;
    r.d3Pay.disabled       = !enabled || !showD3;
    r.d4Sel.disabled       = !enabled || !showD4;
    r.d4StatusSel.disabled = !enabled || !showD4;
    r.d4Pay.disabled       = !enabled || !showD4;

    if (!show) {
      r.busSel.value = "None";
      r.d1Sel.value = "None"; r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
      r.d2Sel.value = "None"; r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
      r.d3Sel.value = "None"; r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
      r.d4Sel.value = "None"; r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
    }
  });

  syncBusSelectEmptyState();
}

function syncBusPanelState() {
  const unlocked = Number(dom.busesNeeded.value) > 0;
  dom.assignmentsOverridesSection.classList.toggle("is-disabled", !unlocked);
}

function setBusesNeededAndSync(value) {
  dom.busesNeeded.value = value;
  updateBusRowVisibility();
  syncBusPanelState();
}

function buildBusRowsOnce() {
  dom.busGrid.innerHTML = "";
  state.busRows.length = 0;
  dom.busGrid.classList.add("bus-assign");

  const makePayInput = (name) => {
    const input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.className = "bus-assign__pay-input";
    input.placeholder = "$";
    return input;
  };

  const makeDriverRow = (dSel, dStatusSel, payInput) => {
    const row = document.createElement("div");
    row.className = "bus-assign__driver-row";
    row.appendChild(dSel);
    row.appendChild(payInput);
    row.appendChild(dStatusSel);
    return row;
  };

  for (let i = 1; i <= 10; i++) {
    const busSel      = makeSelect(`bus${i}`);
    const d1Sel       = makeSelect(`bus${i}_driver1`);
    const d1StatusSel = makeDriverStatusSelect(`bus${i}_driver1Status`);
    const d1Pay       = makePayInput(`bus${i}_driver1Pay`);
    const d2Sel       = makeSelect(`bus${i}_driver2`);
    const d2StatusSel = makeDriverStatusSelect(`bus${i}_driver2Status`);
    const d2Pay       = makePayInput(`bus${i}_driver2Pay`);
    const d3Sel       = makeSelect(`bus${i}_driver3`);
    const d3StatusSel = makeDriverStatusSelect(`bus${i}_driver3Status`);
    const d3Pay       = makePayInput(`bus${i}_driver3Pay`);
    const d4Sel       = makeSelect(`bus${i}_driver4`);
    const d4StatusSel = makeDriverStatusSelect(`bus${i}_driver4Status`);
    const d4Pay       = makePayInput(`bus${i}_driver4Pay`);

    const busCell = document.createElement("div");
    busCell.className = "bus-assign__bus-cell";
    busCell.appendChild(busSel);

    const d1Row = makeDriverRow(d1Sel, d1StatusSel, d1Pay);
    const d2Row = makeDriverRow(d2Sel, d2StatusSel, d2Pay);
    const d3Row = makeDriverRow(d3Sel, d3StatusSel, d3Pay);
    const d4Row = makeDriverRow(d4Sel, d4StatusSel, d4Pay);

    const driverStack = document.createElement("div");
    driverStack.className = "bus-assign__driver-stack";
    driverStack.append(d1Row, d2Row, d3Row, d4Row);

    const rowGroup = document.createElement("div");
    rowGroup.className = "bus-assign__row-group";
    rowGroup.append(busCell, driverStack);

    dom.busGrid.appendChild(rowGroup);

    state.busRows.push({
      rowGroup, busCell,
      busSel, d1Sel, d1StatusSel, d1Pay, d1Row,
      d2Sel, d2StatusSel, d2Pay, d2Row,
      d3Sel, d3StatusSel, d3Pay, d3Row,
      d4Sel, d4StatusSel, d4Pay, d4Row,
    });
  }

  refreshBusSelectOptions();
  updateBusRowVisibility();
  syncBusSelectEmptyState();
  refreshEmptyStateUI();
}

// ======================================================
// 24) WEEK DATE UI + WEEK NAV
// ======================================================
function updateWeekDates() {
  if (!state.currentDate) state.currentDate = startOfWeek(new Date());

  if (dom.weekPicker) dom.weekPicker.value = toLocalDateInputValue(state.currentDate);

  updateWeekTitle();
  updateNotesWeekTitle();
  fitDateTitle();

  const today = new Date();
  const todayYmd = ymd(today);
  const ids = getDayIds();

  // Strip all "today" classes completely first to avoid them getting stuck
  // when the DOM element order is swapped by the week toggle.
  document.querySelectorAll(".schedule-grid__day-cell--today").forEach((el) => {
    el.classList.remove("schedule-grid__day-cell--today");
  });
  document.querySelectorAll(".schedule-grid__header-cell--today").forEach((el) => {
    el.classList.remove("schedule-grid__header-cell--today");
  });

  ids.forEach((dayId, index) => {
    const date = addDays(state.currentDate, index);
    const th = document.getElementById(dayId);
    const dateSpan = th?.querySelector?.(".schedule-grid__day-date");
    if (dateSpan) dateSpan.textContent = `${date.getDate()}`;

    const isToday = ymd(date) === todayYmd;
    th?.classList.toggle("schedule-grid__header-cell--today", isToday);

    // Update body cells in this column too
    document.querySelectorAll(`td[data-day-id="${dayId}"]`).forEach((td) => {
      td.classList.toggle("schedule-grid__day-cell--today", isToday);
    });
  });

  const { start, end } = getWeekRange();
  const key = weekKey(start, end);
  const cached = getCachedWeek(key);

  if (cached?.ok) {
    applyWeekRespToState(cached);
    updateDriverWeekIfVisible();
    updateTodoCardIfVisible();
    scheduleAgendaReflow();
    refreshWeekData({ silent: true });
  } else {
    refreshWeekData({ silent: false });
  }
}

function changeWeek(direction) {
  if (!confirmDiscardIfDirty()) return;
  // Abort any in-flight requests to prevent stale data
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }

  const moved = addDays(state.currentDate, direction * 7);
  state.currentDate = startOfWeek(moved);
  updateWeekDates();
}

function setWeekSyncStatus(mode = "idle", detail = "", options = {}) {
  state.baseWeekSyncStatus = buildWeekSyncStatusEntry(mode, detail, options);
  if (!state.activeStatusNotice || options.force) {
    renderCurrentWeekSyncStatus();
  }
}

// ======================================================
// 25) WEEK REFRESH PIPELINE
// ======================================================
async function loadTripsForWeek(reqId) {
  const { start, end, notesKey } = getWeekRange();

  // 1. Instant Load from LocalStorage (SWR)
  const localKey = weekCacheKey(start, end);
  const localData = CACHE.get(localKey);

  if (localData && localData.ok) {
    if (reqId != null && reqId !== state.weekReqId) return;
    applyWeekRespToState(localData);
    updateDriverWeekIfVisible();
    updateTodoCardIfVisible();
    scheduleAgendaReflow();
    setWeekSyncStatus("sync");

    // FIXED: Reveal the bars immediately if we have local data!
    setBarsHidden(false);

    // Show background refresh progress in the header without implying a full load state.
    toastShow("Updating in background…", "sync", {
      source: "background-sync",
      priority: 10,
    });
  }

  // 2. Always Fetch Fresh Data (Force)
  const resp = await fetchWeekDataCached(start, end, notesKey, true);

  if (reqId != null && reqId !== state.weekReqId) return;

  applyWeekRespToState(resp);
  updateDriverWeekIfVisible();
  updateTodoCardIfVisible();
  scheduleAgendaReflow();

  if (resp?.__stale) {
    setWeekSyncStatus("stale");
  }
}

async function refreshWeekData({ silent = false } = {}) {
  // CRITICAL: Skip background refresh if a delete/save is pending
  // to avoid applying stale data before the server mutation completes
  if (silent && state.pendingWrite) {
    return;
  }

  const reqId = ++state.weekReqId;
  const weekLoadStatusOpts = {
    source: "week-load",
    priority: 45,
    force: !tripLoadInFlight, // yield to an active trip-load — don't hijack the bar
  };

  try {
    if (!silent) {
      if (state.weekLoadSafetyTimer) clearTimeout(state.weekLoadSafetyTimer);
      state.weekLoadSafetyTimer = setTimeout(() => {
        if (state.activeStatusNotice?.source !== "week-load") return;
        stopProgressCreep();
        toastHide(0, { source: "week-load" });
        setWeekSyncStatus("idle", "", { force: true });
      }, 10000);

      toastShow("Loading week…", "loading", weekLoadStatusOpts);
      setWeekSyncStatus("loading");
    } else {
      setWeekSyncStatus("sync");
    }

    // Only dim/hide bars for explicit (non-silent) refreshes so that
    // background syncs don't cause visible flicker during editing.
    if (!silent) setBarsHidden(true);

    clearConflictStyles();
    showConflictsPanel([]);
    dom.conflictBadge?.classList.add("is-hidden");

    await loadTripsForWeek(reqId);

    // If a newer refresh started, do not keep stale progress notices alive.
    if (reqId !== state.weekReqId) {
      if (!silent) toastHide(0, { source: "week-load" });
      return;
    }

    await waitForAgendaPaint();

    if (reqId !== state.weekReqId) {
      if (!silent) toastHide(0, { source: "week-load" });
      return;
    }

    if (!silent) {
      toastHide(350, { source: "week-load" });
      toast("Up to date ✓", "success", 900);
    } else {
      toastHide(0, { source: "background-sync" });
    }

    const stamp = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    setWeekSyncStatus("idle", `· Updated ${stamp}`);

    prefetchAdjacentWeeks();
  } catch (e) {
    stopProgressCreep();
    console.error(e);
    toast("Refresh failed", "danger", 2200);
    setWeekSyncStatus("error");
  } finally {
    if (!silent && state.weekLoadSafetyTimer) {
      clearTimeout(state.weekLoadSafetyTimer);
      state.weekLoadSafetyTimer = null;
    }
    if (!silent && reqId !== state.weekReqId) {
      toastHide(0, { source: "week-load" });
    }
    if (!silent && reqId === state.weekReqId) setBarsHidden(false);
  }
}

// ======================================================
// 26) TRIP MODE + CLEAR
// ======================================================
function setTripIdBadge(text, show = true) {
  if (!dom.tripIdBadge) return;
  dom.tripIdBadge.textContent = text;
  dom.tripIdBadge.classList.toggle("is-hidden", !show);
}

function setModeNew() {
  dom.action.value = "create";
  dom.tripKey.value = "";
  dom.tripId.value = "";
  setTripIdBadge("", false);
  dom.deleteBtn.disabled = true;
}

function setModeEdit(tripKey, tripId) {
  dom.action.value = "update";
  dom.tripKey.value = tripKey;
  dom.tripId.value = tripId || "";
  setTripIdBadge(shortTripId(tripId), true);
  dom.deleteBtn.disabled = false;
}

function clearTripInfoCardForNextTrip() {
  const conflictBanner = document.getElementById("tripConflictBanner");
  if (conflictBanner) conflictBanner.classList.add("is-hidden");
  
  dom.tripForm.reset();
  state.busRows.forEach((r) => {
    r.busSel.value = "None";
    r.d1Sel.value = "None";
    r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
    r.d2Sel.value = "None";
    r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
    r.d3Sel.value = "None";
    r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
    r.d4Sel.value = "None";
    r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
    // Fire change events so custom dropdown triggers update their display labels
    r.busSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  resetRequirementToggles();
  refreshEmptyStateUI();
  setModeNew();

  setSelectToPlaceholder("busesNeeded");
  setSelectToPlaceholder("tripColor");
  setSelectToPlaceholder("itineraryStatus");
  setSelectToPlaceholder("contactStatus");
  setSelectToPlaceholder("paymentStatus");
  setSelectToPlaceholder("driverStatus");
  setSelectToPlaceholder("invoiceStatus");

  dom.busesNeeded.value = "";
  updateBusRowVisibility();
  syncBusPanelState();
  refreshBusSelectOptions();

  ["paymentStatus", "driverStatus", "invoiceStatus"].forEach(
    (id) => updateStatusSelect($(id)),
  );
  updateInvoiceNumberVisibility();

  // Form has been cleared intentionally; mark as not dirty.
  state.tripFormDirty = false;
}

// ======================================================
// 27) ITINERARY MODAL
// ======================================================
function openItineraryModal() {
  state.lastFocusedElement = document.activeElement;
  dom.itineraryModalField.value = dom.itineraryField.value || "";
  dom.itineraryModal.hidden = false;
  dom.itineraryModalField.focus();
}

function closeItineraryModal() {
  dom.itineraryField.value = dom.itineraryModalField.value || "";
  dom.itineraryField.dispatchEvent(new Event("input", { bubbles: true }));
  dom.itineraryModal.hidden = true;
  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

// ======================================================
// 28) MOBILE TRIP DETAILS MODAL
// ======================================================
// ======================================================
function renderTripDetailsModalFromData(t, assigns) {
  let html = "";

  function detailGridItem(label, val, itemClass) {
    const display = val ? escHtml(val) : "—";
    const wrapClass = itemClass
      ? `trip-details__grid-item ${itemClass}`
      : "trip-details__grid-item";
    return `<div class="${wrapClass}"><span class="trip-details__label">${label}:</span> <span class="trip-details__value">${display}</span></div>`;
  }

  function getDetailStatusClass(fieldId, val) {
    const v = String(val || "")
      .trim()
      .toLowerCase();
    if (!v) return "";
    if (fieldId === "driverStatus") {
      if (v === "pending") return "status-pending";
      if (v === "assigned") return "status-assigned";
      return "status-ok";
    }
    if (fieldId === "paymentStatus") {
      if (v === "pending quote") return "status-pending";
      if (v === "quoted") return "status-assigned";
      return "status-ok";
    }
    if (fieldId === "invoiceStatus") {
      if (v === "pending invoice") return "status-pending";
      if (v === "invoiced") return "status-assigned";
      if (v === "deposit received") return "status-blue";
      if (v === "paid in full") return "status-ok";
      return "";
    }
    if (v === "pending") return "status-pending";
    return "status-ok";
  }

  function rowStatus(label, val, fieldId, extraClass) {
    const display = val ? escHtml(val) : "—";
    const cls = val ? getDetailStatusClass(fieldId, val) : "";
    const wrapClass = extraClass
      ? `trip-details__grid-item ${extraClass}`
      : "trip-details__grid-item";
    const valueSpan = cls
      ? `<span class="trip-details__value ${cls}">${display}</span>`
      : `<span class="trip-details__value">${display}</span>`;
    return `<div class="${wrapClass}"><span class="trip-details__label">${label}:</span> ${valueSpan}</div>`;
  }

  function section(title) {
    return `<div class="trip-details__section-title trip-details__label">${title}</div>`;
  }

  html += `<div class="trip-details__meta-grid detail-status-grid">`;
  html += rowStatus(
    "Itinerary Status",
    t.itineraryStatus,
    "itineraryStatus",
    "trip-details__hide-mobile",
  );
  html += rowStatus(
    "Contact Status",
    t.contactStatus,
    "contactStatus",
    "trip-details__hide-mobile",
  );
  html += rowStatus(
    "Approval Status",
    t.paymentStatus,
    "paymentStatus",
    "trip-details__hide-mobile",
  );
  html += rowStatus("Driver Status", t.driverStatus, "driverStatus", "trip-details__hide-mobile");
  html += rowStatus(
    "Invoice Status",
    t.invoiceStatus,
    "invoiceStatus",
    "trip-details__hide-mobile",
  );
  html += detailGridItem("Invoice Number", t.invoiceNumber, "trip-details__hide-mobile");
  html += detailGridItem("Contact", t.contactName);
  html += detailGridItem("Phone", t.phone);
  html += `</div>`;

  html += `<div class="detail-divider"></div>`;

  if (t.itinerary) {
    html += `<div class="trip-details__itinerary-scroll pre-wrap">${escHtml(t.itinerary)}</div>`;
  }

  dom.tripDetailsBody.innerHTML = html;
  state.lastFocusedElement = document.activeElement;
  dom.tripDetailsModal.hidden = false;
  const firstBtn = dom.tripDetailsModal.querySelector("button");
  if (firstBtn) firstBtn.focus();
}

async function openTripDetailsModal(tripKey) {
  try {
    toastShow("Loading details… 0%", "loading");
    toastProgress(0);

    const k = String(tripKey || "").trim();
    if (!k) throw new Error("Missing tripKey");

    toastProgress(15, "Checking cache… 15%");

    const cachedTrip = state.tripByKey?.[k] || null;
    const cachedAssigns = state.assignmentsByTripKey?.[k] || [];

    const hasCore =
      cachedTrip &&
      (cachedTrip.destination ||
        cachedTrip.customer ||
        cachedTrip.departureDate ||
        cachedTrip.arrivalDate);

    let t = cachedTrip || {};
    let assigns = Array.isArray(cachedAssigns) ? cachedAssigns : [];

    if (hasCore) {
      toastProgress(55, "Rendering… 55%");
      renderTripDetailsModalFromData(t, assigns);
      toastProgress(100, "Loaded ✓");
      toastHide(800);
      return;
    }

    const startTime = Date.now();
    toastProgress(30, "Fetching trip… 30%");

    const [tripResp, assignResp] = await Promise.all([api.getTrip(k), api.getBusAssignments(k)]);

    // Force minimum delay for UX consistency
    const elapsed = Date.now() - startTime;
    if (elapsed < 600) {
      toastProgress(50, "Processing…");
      await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
    }

    if (!tripResp?.ok) throw new Error(tripResp?.error || "Trip not found");

    t = tripResp.trip || {};
    assigns = assignResp?.ok && Array.isArray(assignResp.assignments) ? assignResp.assignments : [];

    toastProgress(70, "Rendering… 70%");
    renderTripDetailsModalFromData(t, assigns);

    toastProgress(100, "Loaded ✓");
    toastHide(800);
  } catch (e) {
    console.error(e);
    toast("Could not load details", "danger", 2200);
  }
}

function closeTripDetailsModal() {
  dom.tripDetailsModal.hidden = true;
  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

// ======================================================
// DRIVER CONTACT MODAL
// ======================================================

function openDriverWeekScheduleModal(driverName) {
  const weekDates = getWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];
  const startDate = parseYMD(weekStart);
  const endDate = parseYMD(weekEnd);
  const firstName = driverName.split(" ")[0];

  const fmtLong = (d) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const fmtDayLabel = (ymdStr) => {
    const d = parseYMD(ymdStr);
    if (!d) return "";
    return `${d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} ${d.getMonth() + 1}/${d.getDate()}`;
  };

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("confirm")) return "drv-card__status--confirmed";
    if (s.includes("assign"))  return "drv-card__status--assigned";
    return "drv-card__status--pending";
  };

  const tripsInWeek = (state.trips || []).filter((t) => {
    const dep = t.departureDate || "";
    const arr = t.arrivalDate || dep;
    return !(arr < weekStart || dep > weekEnd);
  });

  const driverTrips = tripsInWeek
    .filter((trip) => {
      const assigns = state.assignmentsByTripKey[String(trip.tripKey)] || [];
      return assigns.some((a) =>
        [a.driver1, a.driver2, a.driver3, a.driver4].some(
          (d) => d && d.trim().toLowerCase() === driverName.trim().toLowerCase()
        )
      );
    })
    .sort((a, b) => {
      if (a.departureDate !== b.departureDate)
        return a.departureDate.localeCompare(b.departureDate);
      return (a.departureTime || "").localeCompare(b.departureTime || "");
    });

  const fmtShortDate = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();

  const fmtFullDayLine = (depYmd, arrYmd) => {
    const d = parseYMD(depYmd);
    if (!d) return "";
    const depWeekday = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const depStr = `${depWeekday} - ${fmtShortDate(d)}`;
    if (arrYmd && arrYmd !== depYmd) {
      const a = parseYMD(arrYmd);
      if (a) {
        const arrWeekday = a.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
        return `${depStr} → ${arrWeekday} - ${fmtShortDate(a)}`;
      }
    }
    return depStr;
  };

  const SEP = "➖➖➖➖➖➖➖➖";
  let msg = `🗓️ TRIPS FOR THE WEEK OF: ${fmtShortDate(startDate)} - ${fmtShortDate(endDate)}\n`;

  if (driverTrips.length === 0) {
    msg += "\nNo trips assigned this week.";
  } else {
    for (let i = 0; i < driverTrips.length; i++) {
      const trip = driverTrips[i];
      const assigns = state.assignmentsByTripKey[String(trip.tripKey)] || [];
      const myAssign = assigns.find((a) =>
        [a.driver1, a.driver2, a.driver3, a.driver4].some(
          (d) => d && d.trim().toLowerCase() === driverName.trim().toLowerCase()
        )
      );
      const spotTime = envFormatTime(trip.spotTime || "");

      msg += `\n${fmtFullDayLine(trip.departureDate, trip.arrivalDate)}\n`;
      if (trip.customer)    msg += `🏢 ${trip.customer}\n`;
      if (trip.destination) msg += `📍 ${trip.destination}\n`;
      if (spotTime)         msg += `⏱️ Spot: ${spotTime}\n`;
      if (trip.itineraryPdfUrl) msg += `👇 Tap link for itinerary:\n${trip.itineraryPdfUrl}\n`;

      if (i < driverTrips.length - 1) msg += `\n${SEP}\n`;
    }
  }

  msg += `\n\n👍 Please reply "CONFIRMED" so I know you received your assignments!`;

  dom.driverWeekSchedulePreview.textContent = msg;
  openModalA11y(dom.driverWeekScheduleModal, null);
}

function openDriverContactModal(tripKey) {
  const trip = state.tripByKey[tripKey];
  if (!trip) return;

  // Retrieve assignments for the trip
  const rowA = state.assignmentsByTripKey[tripKey];

  // Helper: get driver object from name
  const getDriverObj = (name) => {
    if (!name) return null;
    return (
      state.driversList.find(
        (d) => String(d.driverName).trim().toLowerCase() === String(name).trim().toLowerCase(),
      ) || null
    );
  };

  const isAssigned = (name) => {
    const n = String(name || "").trim();
    return n && n.toLowerCase() !== "none";
  };

  // --- 1. Generate OFFICE/CUSTOMER Message ---
  const dDate = trip.departureDate ? parseYMD(trip.departureDate) : null;
  const dDateStr = dDate
    ? dDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    : "the upcoming date";
  const destName = trip.destination || "your destination";

  let officeText = `Hello,\n\nBelow is the driver contact information for your trip on ${dDateStr} going to ${destName}:\n\n`;
  const officeBlocks = [];

  if (rowA && rowA.length > 0) {
    rowA.forEach((assignment) => {
      const busId =
        assignment.busId && assignment.busId !== "—" ? assignment.busId : trip.busId || "None";
      const d1Name = assignment.driver1 && assignment.driver1 !== "—" ? assignment.driver1 : "";
      const d2Name = assignment.driver2 && assignment.driver2 !== "—" ? assignment.driver2 : "";

      if (isAssigned(d1Name)) {
        const d1 = getDriverObj(d1Name);
        const d1Full = (d1 && d1.driverNameFull) ? d1.driverNameFull : d1Name;
        officeBlocks.push(
          `Name:  ${d1Full}\nPhone: ${d1 ? d1.phone || "None" : "None"}\nBus:   ${busId}`,
        );
      }
      if (isAssigned(d2Name)) {
        const d2 = getDriverObj(d2Name);
        const d2Full = (d2 && d2.driverNameFull) ? d2.driverNameFull : d2Name;
        officeBlocks.push(
          `Name:  ${d2Full}\nPhone: ${d2 ? d2.phone || "None" : "None"}\nBus:   ${busId}`,
        );
      }

      const d3Name = assignment.driver3 && assignment.driver3 !== "—" ? assignment.driver3 : "";
      const d4Name = assignment.driver4 && assignment.driver4 !== "—" ? assignment.driver4 : "";

      if (isAssigned(d3Name)) {
        const d3 = getDriverObj(d3Name);
        const d3Full = (d3 && d3.driverNameFull) ? d3.driverNameFull : d3Name;
        officeBlocks.push(
          `Name:  ${d3Full} (Relief)\nPhone: ${d3 ? d3.phone || "None" : "None"}\nBus:   ${busId}`,
        );
      }
      if (isAssigned(d4Name)) {
        const d4 = getDriverObj(d4Name);
        const d4Full = (d4 && d4.driverNameFull) ? d4.driverNameFull : d4Name;
        officeBlocks.push(
          `Name:  ${d4Full} (Relief)\nPhone: ${d4 ? d4.phone || "None" : "None"}\nBus:   ${busId}`,
        );
      }
    });
  }

  if (officeBlocks.length === 0) {
    officeText += `No drivers assigned yet.\n\n`;
  } else {
    officeText += officeBlocks.join("\n\n") + "\n\n";
  }
  officeText += `Thank you!`;

  // --- 2. Generate DRIVER REMINDER Message ---
  let reminderText = "";
  if (dDate) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isTomorrow =
      dDate.getFullYear() === tomorrow.getFullYear() &&
      dDate.getMonth() === tomorrow.getMonth() &&
      dDate.getDate() === tomorrow.getDate();

    const dateLabel = isTomorrow
      ? "Tomorrow"
      : dDate.toLocaleDateString("en-US", { weekday: "long" });
    const fullDate = dDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const spotTime = envFormatTime(trip.spotTime || trip.departureTime || "");

    reminderText = `Reminder for your trip ${dateLabel}, ${fullDate} at ${spotTime}\n\n`;

    if (officeBlocks.length > 0) {
      reminderText += officeBlocks.join("\n\n");
    } else {
      reminderText += "No drivers assigned yet.";
    }
  } else {
    reminderText = "No trip date set.";
  }

  reminderText += `\n\nPlease remember to:\n\nFinal Inspection: Perform a walkthrough to ensure no belongings are left behind.\n\nBus Tidiness: Kindly ask passengers to take all trash with them upon arrival.\n\nService Excellence: Prioritize professional and courteous customer service.`;

  if (trip.itineraryPdfUrl) {
    reminderText += `\n\nItinerary: ${trip.itineraryPdfUrl}`;
  }

  // --- 3. Generate TRIP INFORMATION Message (SMS-friendly) ---
  let tripInfoText = "";
  if (dDate) {
    const aDate = trip.arrivalDate ? parseYMD(trip.arrivalDate) : null;
    const fmtShortDate = (d) => {
      const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const md  = `${d.getMonth() + 1}/${d.getDate()}`;
      return `${day} ${md}`;
    };
    const fmtLongDate = (d) => {
      const day = d.toLocaleDateString("en-US", { weekday: "long" });
      return `${day}, ${d.getMonth() + 1}/${d.getDate()}`;
    };
    const assignmentDate = (aDate && aDate > dDate)
      ? `${fmtLongDate(dDate)} – ${fmtLongDate(aDate)}`
      : fmtLongDate(dDate);
    const firstAsn = rowA && rowA.length > 0 ? rowA[0] : null;
    const busNum   = (firstAsn?.busId && firstAsn.busId !== "—") ? firstAsn.busId : (trip.busId || "");
    const yardTime = envFormatTime(trip.departureTime || "");
    const spotTime2 = envFormatTime(trip.spotTime || "");
    // First driver's first name for greeting
    const firstDriverName = (() => {
      const asns = rowA || [];
      for (const a of asns) {
        for (const key of ["driver1", "driver2", "driver3", "driver4"]) {
          const n = String(a[key] || "").trim();
          if (n && n.toLowerCase() !== "none") return n.split(" ")[0];
        }
      }
      return "[Name]";
    })();

    tripInfoText += `Hello ${firstDriverName}, here is your trip assignment for ${assignmentDate}:\n\n`;
    if (busNum)              tripInfoText += `BUS: ${busNum}\n`;
    if (yardTime)            tripInfoText += `YARD: ${yardTime}\n`;
    if (spotTime2)           tripInfoText += `SPOT: ${spotTime2}\n`;
    if (trip.envelopePickup) tripInfoText += `FROM: ${trip.envelopePickup}\n`;
    if (trip.destination)    tripInfoText += `DEST: ${trip.destination}\n`;
    if (trip.itineraryPdfUrl) tripInfoText += `LINK: ${trip.itineraryPdfUrl}`;
  } else {
    tripInfoText = "No trip date set.";
  }

  // Set values and show modal
  dom.driverContactBody.value = officeText;
  dom.driverReminderBody.value = reminderText;
  dom.tripInfoBody.value = tripInfoText;
  openModalA11y(dom.driverContactModal, dom.driverContactBody);
}

// ======================================================
// TRIP ENVELOPE MODAL (from schedule trip data)
// ======================================================

const ENVELOPE_BRAND_ADDR =
  "2801 Zinnia Ave. McAllen TX 78504\n(956) 994-1169 / Fax 994-9491 / Cell 648-9691";

function envFormatDate(ymdStr) {
  if (!ymdStr) return "";
  const d = parseYMD(ymdStr);
  if (!d) return String(ymdStr).slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function envFormatWeekday(ymdStr) {
  if (!ymdStr) return "";
  const d = parseYMD(ymdStr);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
}

function envFormatTime(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  // Already 12-hour (e.g. "7:30 PM") — normalize to "7:30 PM"
  const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    const h = parseInt(match12[1], 10);
    const m = match12[2];
    const ampm = (match12[3] || "").toUpperCase();
    return `${h}:${m} ${ampm}`;
  }
  // Parse 24-hour or time-only and format as 12-hour (e.g. 7:30 PM)
  const iso = s.length <= 5 ? s + ":00" : s.replace(" ", "");
  const d = new Date("1970-01-01T" + iso);
  if (isNaN(d.getTime())) return s;
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function createEnvelopePageElement() {
  const page = document.createElement("div");
  page.className = "envelope-page env-yellow";

  const brandAddr = ENVELOPE_BRAND_ADDR.replace(/\n/g, "<br>");
  page.innerHTML = `
    <div class="env-panel">
      <div class="env-header">
        <div class="env-day" data-field="day"></div>
        <div class="env-brand">
          <img src="assets/logo.png" alt="Logo" onerror="this.style.display='none'">
          <div class="env-addr">${brandAddr}</div>
        </div>
      </div>
      <div class="env-section-title">TRIP INFORMATION</div>
      <div class="env-trip-contact">
        <div class="env-trip">
          <div class="env-trip-row env-cols-3">
            <div class="env-cell"><span class="env-label">BUS:</span><span class="env-value" data-field="busno"></span></div>
            <div class="env-cell"><span class="env-label" data-field="driverlabel">DRIVER:</span><span class="env-value" data-field="driver"></span></div>
            <div class="env-cell"><span class="env-label" data-field="codriverlabel">CO-DRIVER:</span><span class="env-value" data-field="codriver"></span></div>
          </div>
          <div class="env-trip-row env-cols-2">
            <div class="env-cell">
              <div style="display:flex;justify-content:space-between;align-items:baseline;width:100%;">
                <span class="env-label">TRIP DATE:</span>
                <span class="env-label" data-field="returnlabel" style="text-align:right;">RETURN:</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:0.08in;">
                <span class="env-value" data-field="tripdate" style="width:120px;"></span>
                <span style="flex:1 1 auto;"></span>
                <span class="env-value" data-field="returndate" style="width:120px;text-align:right;"></span>
              </div>
            </div>
            <div class="env-cell"><span class="env-label">SPOT TIME:</span><span class="env-value" data-field="spottime"></span></div>
          </div>
          <div class="env-trip-row env-cols-1">
            <div class="env-cell"><span class="env-label">PICK UP ADDRESS:</span><span class="env-value" data-field="pickup"></span></div>
          </div>
          <div class="env-trip-row env-cols-1">
            <div class="env-cell"><span class="env-label">DESTINATION:</span><span class="env-value" data-field="destination"></span></div>
          </div>
        </div>
        <div class="env-grid-row">
          <div class="env-cell"><span class="env-label">CONTACT:</span><span class="env-value" data-field="contact"></span></div>
          <div class="env-cell"><span class="env-label">PHONE:</span><span class="env-value" data-field="phone"></span></div>
        </div>
      </div>
      <div class="env-odometer-box">
        <div class="env-grid-row">
          <div class="env-cell"><span class="env-label">STARTING ODOMETER:</span><span class="env-value" data-field="startodo"></span></div>
          <div class="env-cell"><span class="env-label">ENDING ODOMETER:</span><span class="env-value" data-field="endodo"></span></div>
        </div>
      </div>
      <div class="env-mini env-mini-standard">
        <table>
          <tr><td>ELD VERIFIED</td><td class="env-choice-cell"><span class="env-choice">DRV</span><span class="env-choice">OFC</span></td><td>HOTEL</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td>ELD BACKUP USED</td><td class="env-choice-cell"><span class="env-choice">YES</span><span class="env-choice">NO</span></td><td>DIESEL/BLUE DEF</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td>CC FOR TRIP</td><td class="env-choice-cell"><span class="env-choice" data-field="ccYes">YES</span><span class="env-choice" data-field="ccNo">NO</span></td><td>REPAIRS</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td colspan="2" class="env-mini-td-left">CC RECEIVED BY</td><td>MISCELLANEOUS</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td colspan="2" class="env-mini-td-left">TOTAL TRIP MILES</td><td>TOTAL</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
        </table>
      </div>
      <div class="env-footer">
        <span class="env-label">NOTES:</span>
        <div class="env-notes-lines">
          <span class="env-value env-notes-line" data-field="notes1"></span>
          <span class="env-value env-notes-line" data-field="notes2"></span>
          <span class="env-value env-notes-line" data-field="notes3"></span>
          <span class="env-value env-notes-line" data-field="notes4"></span>
        </div>
      </div>
    </div>
  `;
  return page;
}

function createAlternateEnvelopePageElement() {
  const page = document.createElement("div");
  page.className = "envelope-page env-yellow";

  const brandAddr = ENVELOPE_BRAND_ADDR.replace(/\n/g, "<br>");
  page.innerHTML = `
    <div class="env-panel">
      <div class="env-header">
        <div class="env-day" data-field="day"></div>
        <div class="env-brand">
          <img src="assets/logo.png" alt="Logo" onerror="this.style.display='none'">
          <div class="env-addr">${brandAddr}</div>
        </div>
      </div>
      <div class="env-section-title">TRIP INFORMATION</div>
      <div class="env-trip-contact">
        <div class="env-trip">
          <div class="env-trip-row env-cols-3">
            <div class="env-cell"><span class="env-label">BUS:</span><span class="env-value" data-field="busno"></span></div>
            <div class="env-cell"><span class="env-label" data-field="driverlabel">DRIVER:</span><span class="env-value" data-field="driver"></span></div>
            <div class="env-cell"><span class="env-label" data-field="codriverlabel">CO-DRIVER:</span><span class="env-value" data-field="codriver"></span></div>
          </div>
          <div class="env-trip-row env-cols-2">
            <div class="env-cell">
              <span class="env-label">TRIP DATE:</span>
              <span class="env-value" data-field="tripdate"></span>
            </div>
            <div class="env-cell">
              <span class="env-label">SPOT TIME:</span>
              <span class="env-value" data-field="spottime"></span>
            </div>
          </div>
        </div>
        
        <div class="env-grid-row" style="grid-template-columns: 1fr;">
          <div class="env-cell">
            <span class="env-label">PICK UP ADDRESS:</span>
            <span class="env-value">(MVM) 220 S K CENTER ST, MCALLEN, TX 78501</span>
          </div>
        </div>
        
        <div class="env-grid-row">
          <div class="env-cell">
            <span class="env-label">CONTACT PERSON:</span>
            <span class="env-value">ESCAMILLA</span>
          </div>
          <div class="env-cell">
            <span class="env-label">PHONE:</span>
            <span class="env-value">(956) 648-9691</span>
          </div>
        </div>
        
      </div>
      
      <table class="env-alt-table">
        <thead>
          <tr>
            <th style="width: 45%;">LOCATION</th>
            <th style="width: 15%;">TIME IN</th>
            <th style="width: 15%;">TIME OUT</th>
            <th style="width: 25%;">ODOMETER</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="font-size: 0.12in; text-transform:uppercase;"></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      
      <div class="env-mini">
        <table>
          <tr><td>ELD VERIFIED</td><td class="env-choice-cell"><span class="env-choice">DRV</span><span class="env-choice">OFC</span></td><td>HOTEL</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td>ELD BACKUP USED</td><td class="env-choice-cell"><span class="env-choice">YES</span><span class="env-choice">NO</span></td><td>DIESEL/BLUE DEF</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td>CC FOR TRIP</td><td class="env-choice-cell"><span class="env-choice" data-field="ccYes">YES</span><span class="env-choice" data-field="ccNo">NO</span></td><td>REPAIRS</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td colspan="2" class="env-mini-td-left">CC RECEIVED BY</td><td>MISCELLANEOUS</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
          <tr><td colspan="2" class="env-mini-td-left">TOTAL TRIP MILES</td><td>TOTAL</td><td><div class="money"><span class="dollar">$</span><span class="amount-space"></span></div></td></tr>
        </table>
      </div>
    </div>
  `;
  return page;
}

function fillEnvelopePage(pageEl, trip, assignment) {
  if (!pageEl || !trip) return;
  const busId = assignment ? assignment.busId || trip.busId || "" : trip.busId || "";
  const driver1 = assignment ? assignment.driver1 || "" : "";
  const rawDriver2 = assignment ? assignment.driver2 || "" : "";
  // Treat common \"no co-driver\" markers as empty
  const driver2 =
    rawDriver2 && rawDriver2.toString().trim().toLowerCase() !== "none" && rawDriver2 !== "—"
      ? rawDriver2
      : "";

  const fullName = (shortName) => {
    if (!shortName) return shortName;
    const d = (state.driversList || []).find(
      (d) => String(d.driverName).trim().toLowerCase() === String(shortName).trim().toLowerCase(),
    );
    return (d && d.driverNameFull) ? d.driverNameFull : shortName;
  };

  const set = (field, text) => {
    const el = pageEl.querySelector(`[data-field="${field}"]`);
    if (!el) return;
    let val = String(text ?? "").trim();
    // Uppercase envelope display fields (driver names, trip text, dates, notes)
    const upperFields = new Set([
      "day",
      "busno",
      "driver",
      "codriver",
      "tripdate",
      "returndate",
      "arrivaltime",
      "pickup",
      "destination",
      "contact",
      "notes1",
      "notes2",
      "notes3",
    ]);
    if (upperFields.has(field)) {
      val = val.toUpperCase();
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.value = val;
      el.setAttribute("value", val);
      if (el.tagName === "TEXTAREA")
        el.innerHTML = String(val)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
    } else {
      el.textContent = val;
    }
  };

  const setHTML = (field, html) => {
    const el = pageEl.querySelector(`[data-field="${field}"]`);
    if (el) el.innerHTML = html;
  };

  const busIndex  = assignment.busIndex  ?? 0;
  const totalBuses = assignment.totalBuses ?? (parseInt(trip.busesNeeded, 10) || 1);

  const tripDateStr = envFormatDate(trip.departureDate);
  const returnDateStr = envFormatDate(trip.arrivalDate);
  const showReturn = !!returnDateStr && (!tripDateStr || returnDateStr !== tripDateStr); // blank if same as trip date

  set("day", envFormatWeekday(trip.departureDate));
  set("busno", busId);
  set("driver", fullName(driver1));
  // If there is no real co-driver, field stays blank
  set("codriver", fullName(driver2));
  set("driverlabel", assignment?.isConsolidatedCo ? "CO-DRIVER:" : assignment?.isRelief ? "RELIEF DRIVER:" : "DRIVER:");
  const coDriverLabel = assignment?.isConsolidatedCo ? "DRIVER(S):" : assignment?.driver2IsRelief ? "RELIEF:" : assignment?.isRelief ? "DRIVER:" : "CO-DRIVER:";
  set("codriverlabel", coDriverLabel);
  set("tripdate", tripDateStr);
  set("returndate", showReturn ? returnDateStr : "");
  set("returnlabel", showReturn ? "RETURN" : "");
  set("spottime", envFormatTime(trip.spotTime || trip.departureTime));
  set("pickup", trip.envelopePickup || "");
  set("destination", trip.destination || "");
  set("contact", trip.envelopeTripContact || "");
  set("phone", trip.envelopeTripPhone || "");
  set("startodo", "");
  set("endodo", "");
  const REQ_ITEMS = [
    { key: "req56Pass",  icon: "tatami_seat",      label: "56 Pass" },
    { key: "reqSleeper", icon: "airline_seat_flat", label: "Sleeper" },
    { key: "reqLift",    icon: "accessible",        label: "Lift"    },
    { key: "reqHotel",   icon: "apartment",         label: "Hotel"   },
    { key: "reqWifi",    icon: "wifi",              label: "Wifi"    },
  ];

  const notesLines = [];

  const comments = (trip.comments || "").trim().toUpperCase();
  if (comments) notesLines.push({ text: comments });

  const activeReqs = REQ_ITEMS.filter((r) => trip[r.key]);
  if (activeReqs.length) {
    const html = activeReqs
      .map((r) => `<span class="env-req-item"><span class="material-symbols-outlined env-req-icon">${r.icon}</span><span class="env-req-label">${r.label}</span></span>`)
      .join("");
    notesLines.push({ html });
  }

  if (trip.reqFuelCard) {
    notesLines.push({ html: `<span class="env-req-item"><span class="material-symbols-outlined env-req-icon">credit_card</span><span class="env-req-label">Fuel Card  _______________</span></span>` });
  }

  if (totalBuses > 1) {
    notesLines.push({ text: `Bus ${busIndex + 1} of ${totalBuses}` });
  }

  ["notes1", "notes2", "notes3", "notes4"].forEach((slot, i) => {
    const line = notesLines[i];
    if (line?.html) setHTML(slot, line.html);
    else set(slot, line?.text ?? "");
  });

  // CC FOR TRIP checkbox — pre-check YES if fuel card required
  const ccYesEl = pageEl.querySelector('[data-field="ccYes"]');
  const ccNoEl  = pageEl.querySelector('[data-field="ccNo"]');
  if (ccYesEl && ccNoEl) {
    ccYesEl.classList.toggle("is-checked", !!trip.reqFuelCard);
    ccNoEl.classList.toggle("is-checked", !trip.reqFuelCard);
  }
}

let stateEnvelope = {
  tripKey: null,
  trip: null,
  assignments: [],
  bg: "yellow",
  format: "standard",
};

function openEnvelopeModal(tripKey) {
  let trip = state.tripByKey?.[tripKey];
  if (!trip) {
    toast("Trip not found.", "danger", 2000);
    return;
  }

  // If the envelope is opened for the trip currently being edited,
  // merge the unsaved form values so the envelope preview is accurate.
  if (dom.action?.value === "update" && dom.tripKey?.value === tripKey) {
    trip = {
      ...trip,
      destination: $("destination")?.value || trip.destination,
      departureDate: $("tripDate")?.value || trip.departureDate,
      spotTime: $("spotTime")?.value || trip.spotTime,
      departureTime: $("departureTime")?.value || trip.departureTime,
      arrivalDate: $("arrivalDate")?.value || trip.arrivalDate,
      contactName: $("contactName")?.value || trip.contactName,
      phone: $("phone")?.value || trip.phone,
      envelopePickup: $("envelopePickup") ? $("envelopePickup").value : trip.envelopePickup || "",
      envelopeTripContact: $("envelopeTripContact")
        ? $("envelopeTripContact").value
        : trip.envelopeTripContact || "",
      envelopeTripPhone: $("envelopeTripPhone")
        ? $("envelopeTripPhone").value
        : trip.envelopeTripPhone || "",
      envelopeTripNotes: trip.envelopeTripNotes || "",
    };
  }

  state.lastFocusedElement = document.activeElement;
  stateEnvelope.tripKey = tripKey;
  stateEnvelope.trip = trip;
  stateEnvelope.bg = "yellow";
  if (!stateEnvelope.format) stateEnvelope.format = "standard";

  if (dom.envelopeFormatSelect) {
    dom.envelopeFormatSelect.value = stateEnvelope.format;
  }

  const pagesContainer = dom.envelopeModalPages;
  if (!pagesContainer) return;
  pagesContainer.innerHTML = "";

  // Build envelope assignments. For trips with a co-driver, we create
  // two variants so each driver gets a version where they are BUS DRIVER.
  const rawAssignments = state.assignmentsByTripKey?.[tripKey] || [];
  const assignments = [];

  if (rawAssignments.length) {
    const totalBuses = rawAssignments.length;

    // Find any driver2 who appears on every bus — they get one consolidated envelope
    const coDriverCount = {};
    rawAssignments.forEach((a) => {
      const d2 = (a.driver2 || "").toString().trim();
      if (d2 && d2.toLowerCase() !== "none" && d2 !== "—") {
        coDriverCount[d2] = (coDriverCount[d2] || 0) + 1;
      }
    });
    const universalCodrivers = new Set(
      Object.entries(coDriverCount)
        .filter(([, cnt]) => cnt === rawAssignments.length && rawAssignments.length > 1)
        .map(([name]) => name)
    );

    rawAssignments.forEach((a, busIndex) => {
      const busId = a.busId || trip.busId || "";
      const d1 = (a.driver1 || "").toString().trim();

      const d2Raw = (a.driver2 || "").toString().trim();
      const hasD2 = d2Raw && d2Raw.toLowerCase() !== "none" && d2Raw !== "—";
      const d2 = hasD2 ? d2Raw : "";

      const d3Raw = (a.driver3 || "").toString().trim();
      const hasD3 = d3Raw && d3Raw.toLowerCase() !== "none" && d3Raw !== "—";

      const d4Raw = (a.driver4 || "").toString().trim();
      const hasD4 = d4Raw && d4Raw.toLowerCase() !== "none" && d4Raw !== "—";

      const pos = { busIndex, totalBuses };

      // Variant 1: driver1 primary; if no co-driver, show relief 1 in that spot
      const d1CoDriver = d2 || (hasD3 ? d3Raw : "");
      const d1CoIsRelief = !hasD2 && hasD3;
      assignments.push({ busId, driver1: d1, driver2: d1CoDriver, driver2IsRelief: d1CoIsRelief, ...pos });

      // Variant 2: swapped (co-driver primary), only if real co-driver exists
      // Skip per-bus variant for universal co-drivers — they get one consolidated envelope below
      if (hasD2 && !universalCodrivers.has(d2)) {
        assignments.push({ busId, driver1: d2, driver2: d1, ...pos });
      }

      // Relief driver variants — co-driver field: relief 1 gets primary driver;
      // relief 2 gets relief 1 as co (if present), otherwise primary driver.
      if (hasD3) assignments.push({ busId, driver1: d3Raw, driver2: d1, isRelief: true, ...pos });
      if (hasD4) assignments.push({ busId, driver1: d4Raw, driver2: d1, isRelief: true, ...pos });
    });

    // Add one consolidated envelope per universal co-driver listing all buses
    universalCodrivers.forEach((coDriverName) => {
      const allBusIds = rawAssignments.map((a) => a.busId || "").filter(Boolean).join(" · ");
      const primaryDrivers = rawAssignments
        .map((a) => (a.driver1 || "").toString().trim())
        .filter(Boolean)
        .join(" / ");
      assignments.push({
        busId: allBusIds,
        driver1: coDriverName,
        driver2: primaryDrivers,
        isConsolidatedCo: true,
        busIndex: 0,
        totalBuses,
      });
    });
  } else {
    assignments.push({ busId: trip.busId || "", driver1: "", driver2: "", busIndex: 0, totalBuses: 1 });
  }

  // Store the envelope assignments so print/save logic uses the same variants
  stateEnvelope.assignments = assignments;

  const select = dom.envelopeAssignmentSelect;
  if (select) {
    select.innerHTML = "";
    assignments.forEach((a, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      const bus = a.busId || "—";
      const d1 = a.driver1 || "—";
      const d2 = a.driver2 ? ` / ${a.driver2}` : "";
      opt.textContent = a.isConsolidatedCo
        ? `All Buses — ${d1} (Co-Driver)`
        : a.isRelief
          ? `Bus ${bus} — ${d1} (Relief)`
          : `Bus ${bus} — ${d1}${d2}`;
      select.appendChild(opt);
    });
    select.selectedIndex = 0;
    // Notify glass wrapper so trigger text & menu stay in sync
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const isAlternate = stateEnvelope.format === "alternate";
  assignments.forEach((assignment, idx) => {
    const pageEl = isAlternate ? createAlternateEnvelopePageElement() : createEnvelopePageElement();
    pageEl.classList.add(stateEnvelope.bg === "white" ? "env-white" : "env-yellow");
    fillEnvelopePage(pageEl, trip, assignment);
    if (assignments.length > 1) pageEl.style.display = idx === 0 ? "block" : "none";
    pageEl.dataset.index = String(idx);
    pagesContainer.appendChild(pageEl);
  });

  if (dom.envelopeYellowBtn)
    dom.envelopeYellowBtn.classList.toggle("active", stateEnvelope.bg === "yellow");
  if (dom.envelopeWhiteBtn)
    dom.envelopeWhiteBtn.classList.toggle("active", stateEnvelope.bg === "white");

  dom.envelopeModal.hidden = false;
}

function updateEnvelopeModalSelection(index) {
  const pages = dom.envelopeModalPages?.querySelectorAll(".envelope-page");
  if (!pages || !pages.length) return;
  pages.forEach((p, i) => {
    p.style.display = String(i) === String(index) ? "block" : "none";
  });
}

function printEnvelopePages() {
  const trip = stateEnvelope.trip;
  const assignments = stateEnvelope.assignments.length
    ? stateEnvelope.assignments
    : [{ busId: trip?.busId || "", driver1: "", driver2: "" }];
  if (!trip || !assignments.length) return;

  const tripForPrint = trip;

  // Always print the white style, regardless of screen toggle
  const isAlternate = stateEnvelope.format === "alternate";
  const bgClass = "env-white";
  const pagesHtml = assignments
    .map((assignment) => {
      const page = isAlternate ? createAlternateEnvelopePageElement() : createEnvelopePageElement();
      page.classList.add(bgClass);
      fillEnvelopePage(page, tripForPrint, assignment);
      return page.outerHTML;
    })
    .join("");

  const cssLink =
    document.querySelector('link[href*="main.css"]')?.getAttribute("href") || "css/main.css";
  const cssHref = new URL(cssLink, window.location.href).href;
  const printDoc = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Trip envelope</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${cssHref}">
<style>
  /* Base page setup for envelopes */
  @page {
    size: 6in 9in;
    margin: 0;
  }

  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  /* Hide modal chrome from the main app; only show the envelope page(s) */
  .modal--envelope .modal__card--envelope,
  .envelope-modal__toolbar,
  .rux-header--modal,
  .modal__foot,
  .modal__backdrop {
    display: none !important;
  }

  .envelope-modal__body {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 0;
  }

  .envelope-page {
    box-shadow: none !important;
    margin: 0 auto;
    page-break-after: always;
    break-after: page;
  }

  .envelope-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  @media print {
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }

    .envelope-modal__body {
      justify-content: center !important;
      align-items: flex-start !important;
    }

    .envelope-page {
      page-break-after: always;
    }

    .envelope-page:last-child {
      page-break-after: auto;
    }
  }
</style>
</head><body class="modal--envelope"><div class="envelope-modal__body">${pagesHtml}</div></body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast("Popup blocked. Allow popups to print envelopes.", "danger", 3000);
    return;
  }
  win.document.write(printDoc);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  };
}

function closeEnvelopeModal() {
  dom.envelopeModal.hidden = true;
  stateEnvelope.tripKey = null;
  stateEnvelope.trip = null;
  stateEnvelope.assignments = [];
  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

/** Removed editable envelope functions */

/** Set main trip form from state (for saving envelope edits via existing submit flow) */
function setTripFormFromState(tripKey) {
  const t = state.tripByKey?.[tripKey];
  const assigns = state.assignmentsByTripKey?.[tripKey] || [];
  if (!t) return false;

  $("destination").value = t.destination || "";
  $("customer").value = t.customer || "";
  $("contactName").value = t.contactName || "";
  $("phone").value = t.phone || "";

  $("tripDate").value = String(t.departureDate || "").slice(0, 10);
  $("arrivalDate").value = String(t.arrivalDate || "").slice(0, 10);
  $("departureTime").value = normalizeTime(t.departureTime) || "";
  $("spotTime").value = normalizeTime(t.spotTime) || "";
  $("arrivalTime").value = normalizeTime(t.arrivalTime) || "";

  $("itineraryStatus").value = t.itineraryStatus || "";
  $("contactStatus").value = t.contactStatus || "";
  $("paymentStatus").value = t.paymentStatus || "";
  $("driverStatus").value = t.driverStatus || "";
  $("invoiceStatus").value = t.invoiceStatus || "";
  $("invoiceNumber").value = t.invoiceNumber || "";
  $("tripColor").value = t.tripColor || "";
  setRequirementTogglesFromTrip(t);

  // Envelope-specific fields (when editing in the main Trip Editor)
  if ($("envelopePickup")) $("envelopePickup").value = t.envelopePickup || "";
  if ($("envelopeTripContact")) $("envelopeTripContact").value = t.envelopeTripContact || "";
  if ($("envelopeTripPhone")) $("envelopeTripPhone").value = t.envelopeTripPhone || "";

  if ($("envelopeTripNotes")) $("envelopeTripNotes").value = t.envelopeTripNotes || "";

  [
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
    "tripColor",
  ].forEach((id) => {
    const el = $(id);
    if (el) el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  if (typeof updateInvoiceNumberVisibility === "function") updateInvoiceNumberVisibility();

  dom.itineraryField.value = t.itinerary || "";
  $("notes").value = t.notes || "";
  $("comments").value = t.comments || "";

  setBusesNeededAndSync(t.busesNeeded ? String(t.busesNeeded) : "");
  dom.busesNeeded?.dispatchEvent(new Event("change", { bubbles: true }));
  setModeEdit(String(t.tripKey || tripKey), String(t.tripId || ""));

  const fallbackDriverStatus = t.driverStatus || "Pending";
  state.busRows.forEach((r) => {
    r.busSel.value = "None";
    r.d1Sel.value = "None";
    r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
    r.d2Sel.value = "None";
    r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
    r.d3Sel.value = "None";
    r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
    r.d4Sel.value = "None";
    r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
  });
  assigns.forEach((a, i) => {
    const row = state.busRows[i];
    if (!row) return;
    if (a.busId) row.busSel.value = String(a.busId);
    if (a.driver1) row.d1Sel.value = String(a.driver1);
    if (a.driver2) row.d2Sel.value = String(a.driver2);
    if (a.driver3) row.d3Sel.value = String(a.driver3);
    if (a.driver4) row.d4Sel.value = String(a.driver4);
    row.d1StatusSel.value = String(a.driver1Status || "").trim() || fallbackDriverStatus;
    row.d2StatusSel.value = String(a.driver2Status || "").trim() || fallbackDriverStatus;
    row.d3StatusSel.value = String(a.driver3Status || "").trim() || fallbackDriverStatus;
    row.d4StatusSel.value = String(a.driver4Status || "").trim() || fallbackDriverStatus;
  });
  updateBusRowVisibility();
  state.busRows.forEach((r) => {
    r.busSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  syncBusPanelState();
  if (typeof syncBusSelectEmptyState === "function") syncBusSelectEmptyState();
  if (typeof refreshEmptyStateUI === "function") refreshEmptyStateUI();
  if (typeof syncEmptyFields === "function") syncEmptyFields();

  dom.action.value = "update";
  dom.tripKey.value = tripKey;
  return true;
}

// Removed saveEnvelopeEdits

// ======================================================
// 29) TRIP OPEN (DESKTOP EDIT)
// ======================================================
let tripLoadInFlight = false;

function populateFormFromData(t, assigns) {
  $("destination").value = t.destination || "";
  $("customer").value = t.customer || "";
  $("contactName").value = t.contactName || "";
  $("phone").value = t.phone || "";

  $("tripDate").value = String(t.departureDate || "").slice(0, 10);
  $("arrivalDate").value = String(t.arrivalDate || "").slice(0, 10);
  $("departureTime").value = normalizeTime(t.departureTime) || "";
  $("spotTime").value = normalizeTime(t.spotTime) || "";
  $("arrivalTime").value = normalizeTime(t.arrivalTime) || "";

  $("itineraryStatus").value = t.itineraryStatus || "";
  $("contactStatus").value = t.contactStatus || "";
  $("paymentStatus").value = t.paymentStatus || "";
  $("driverStatus").value = t.driverStatus || "";
  $("invoiceStatus").value = t.invoiceStatus || "";
  $("invoiceNumber").value = t.invoiceNumber || "";
  $("tripColor").value = t.tripColor || "";
  setRequirementTogglesFromTrip(t);

  ["paymentStatus", "driverStatus", "invoiceStatus", "tripColor"].forEach((id) => {
    const el = $(id);
    if (el) el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  updateInvoiceNumberVisibility();

  if ($("itinerary")) dom.itineraryField.value = t.itinerary || "";
  if ($("itineraryPdfUrl")) $("itineraryPdfUrl").value = t.itineraryPdfUrl || "";
  if ($("paymentType")) $("paymentType").value = t.paymentType || "";
  if ($("estimatedMileage")) $("estimatedMileage").value = t.estimatedMileage || "";
  if ($("drivingHours")) $("drivingHours").value = t.drivingHours || "";
  if ($("onDutyHours"))  $("onDutyHours").value  = t.onDutyHours  || "";
  if ($("quotedPrice")) {
    const qp = String(t.quotedPrice || "");
    $("quotedPrice").value = qp && !qp.startsWith("$") ? "$" + qp : qp;
  }
  if ($("tripMiles")) $("tripMiles").value = t.tripMiles || "";
  if ($("datePaid")) $("datePaid").value = t.datePaid || "";
  if ($("notes")) $("notes").value = t.notes || "";
  if ($("comments")) $("comments").value = t.comments || "";
  if ($("envelopePickup")) $("envelopePickup").value = t.envelopePickup || "";
  if ($("envelopeTripContact")) $("envelopeTripContact").value = t.envelopeTripContact || "";
  if ($("envelopeTripPhone")) $("envelopeTripPhone").value = t.envelopeTripPhone || "";
  if ($("envelopeTripNotes")) $("envelopeTripNotes").value = t.envelopeTripNotes || "";

  setBusesNeededAndSync(t.busesNeeded ? String(t.busesNeeded) : "");
  dom.busesNeeded?.dispatchEvent(new Event("change", { bubbles: true }));
  setModeEdit(String(t.tripKey), String(t.tripId || ""));

  const fallbackDriverStatus = t.driverStatus || "Pending";
  state.busRows.forEach((r) => {
    r.busSel.value = "None";
    r.d1Sel.value = "None"; r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
    r.d2Sel.value = "None"; r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
    r.d3Sel.value = "None"; r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
    r.d4Sel.value = "None"; r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
  });

  refreshBusSelectOptions();
  (assigns || []).forEach((a) => {
    const n = Number(a.busNumber);
    if (!n || n < 1 || n > 10) return;
    const row = state.busRows[n - 1];
    if (!row) return;
    if (a.busId)   row.busSel.value = String(a.busId).trim();
    if (a.driver1) row.d1Sel.value  = String(a.driver1).trim();
    if (a.driver2) row.d2Sel.value  = String(a.driver2).trim();
    if (a.driver3) row.d3Sel.value  = String(a.driver3).trim();
    if (a.driver4) row.d4Sel.value  = String(a.driver4).trim();
    row.d1StatusSel.value = String(a.driver1Status || "").trim() || fallbackDriverStatus;
    row.d2StatusSel.value = String(a.driver2Status || "").trim() || fallbackDriverStatus;
    row.d3StatusSel.value = String(a.driver3Status || "").trim() || "Pending";
    row.d4StatusSel.value = String(a.driver4Status || "").trim() || "Pending";
    if (a.driver1Pay && row.d1Pay) row.d1Pay.value = String(a.driver1Pay).trim();
    if (a.driver2Pay && row.d2Pay) row.d2Pay.value = String(a.driver2Pay).trim();
    if (a.driver3Pay && row.d3Pay) row.d3Pay.value = String(a.driver3Pay).trim();
    if (a.driver4Pay && row.d4Pay) row.d4Pay.value = String(a.driver4Pay).trim();
  });

  updateBusRowVisibility();
  state.busRows.forEach((r) => {
    r.busSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d1StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d2StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d3StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4Sel.dispatchEvent(new Event("change", { bubbles: true }));
    r.d4StatusSel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  syncBusPanelState();
  syncBusSelectEmptyState();
  refreshEmptyStateUI();
  if (typeof syncEmptyFields === "function") syncEmptyFields();
}

async function openTripForEdit(tripKey) {
  if (tripLoadInFlight) {
    toast("Trip is already loading…", "info", 1200);
    return;
  }
  tripLoadInFlight = true;
  if (isMobileOnly()) { tripLoadInFlight = false; return openTripDetailsModal(tripKey); }

  showHeaderStatusNotice("Loading trip…", "loading", {
    sticky: true,
    source: "trip-load",
    priority: 55,
    force: true,
  });

  // Disable/enable all form inputs during load — defined outside try so finally can call it
  const setFormDisabled = (disabled) => {
    if (!dom.tripForm) return;
    dom.tripForm.querySelectorAll("input, select, textarea").forEach((el) => {
      el.disabled = disabled;
    });
    ["req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2", "reqCoDriver", "reqHotel", "reqFuelCard", "reqWifi"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    });
  };

  try {

  const conflictBanner = document.getElementById("tripConflictBanner");
  if (conflictBanner) conflictBanner.classList.add("is-hidden");

  // If the trip panel is already open, keep old data visible but lock all inputs.
  // If the panel is closed, it will open after the fetch with fresh data.
  const panelAlreadyOpen = getCardPanel("trip") !== null;

  // Helper to populate the form fully
  // populateFormFromData is now a module-level function above openTripForEdit

  if (panelAlreadyOpen) {
    // Panel is visible — lock inputs so old data stays readable but not editable
    setFormDisabled(true);
  } else {
    // Panel is closed — blank the form while we fetch
    if (dom.tripForm) dom.tripForm.reset();
    state.busRows.forEach((r) => {
      r.busSel.value = "None";
      r.d1Sel.value = "None"; r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
      r.d2Sel.value = "None"; r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
      r.d3Sel.value = "None"; r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
      r.d4Sel.value = "None"; r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
    });
    $("tripIdBadge").textContent = "";
    $("tripIdBadge").classList.add("is-hidden");
    updateBusRowVisibility();
  }
  dom.saveBtn.disabled = true;
  if (dom.deleteBtn) dom.deleteBtn.disabled = true;

    const startTime = Date.now();

    const [tripResp, assignResp] = await Promise.all([
      api.getTrip(tripKey),
      api.getBusAssignments(tripKey),
    ]);

    // Minor loading flash prevention
    const elapsed = Date.now() - startTime;
    if (elapsed < 200) {
      await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
    }

    if (!tripResp?.ok) throw new Error(tripResp?.error || "Trip not found");

    const serverTrip   = tripResp.trip || {};
    const localAssigns = state.assignmentsByTripKey[String(tripKey)] || [];
    const rawAssigns   = (assignResp?.ok && assignResp.assignments?.length)
      ? assignResp.assignments
      : localAssigns;

    // Fill empty driver/status fields from weekData local state — guards against
    // getBusAssignments returning a partial record (transient GAS error, partial write)
    // and against the race where driver options aren't loaded yet when values are set.
    const mergedAssigns = rawAssigns.map((a) => {
      const normalizedA = normalizeAssignment(a);
      // Find local assignment by busNumber first, then by busId as fallback
      let local = localAssigns.find((l) => Number(l.busNumber) === normalizedA.busNumber && normalizedA.busNumber > 0);
      if (!local && normalizedA.busId) {
        local = localAssigns.find((l) => l.busId === normalizedA.busId);
      }
      const merged = {
        ...normalizedA,
        driver1:       normalizedA.driver1       || local?.driver1       || "",
        driver2:       normalizedA.driver2       || local?.driver2       || "",
        driver3:       normalizedA.driver3       || local?.driver3       || "",
        driver4:       normalizedA.driver4       || local?.driver4       || "",
        driver1Status: normalizedA.driver1Status || local?.driver1Status || "",
        driver2Status: normalizedA.driver2Status || local?.driver2Status || "",
        driver3Status: normalizedA.driver3Status || local?.driver3Status || "",
        driver4Status: normalizedA.driver4Status || local?.driver4Status || "",
      };
      // Log if local fallback filled missing data
      if (local && (!normalizedA.driver1 || !normalizedA.driver2 || !normalizedA.driver3 || !normalizedA.driver4)) {
        console.warn(`Trip ${tripKey}: Merged assignment for bus ${normalizedA.busId || normalizedA.busNumber} using local fallback data.`);
      }
      return merged;
    });

    // Ensure driver/bus select options are populated before setting values —
    // weekData can resolve from cache before loadDriversAndBuses completes.
    if (!state.driversList.length || !state.busesList.length) {
      await loadDriversAndBuses(false);
    }

    populateFormFromData(serverTrip, mergedAssigns);
    setFormDisabled(false);
    setSidePanelMode("trip");
    state.tripFormDirty = false;
    $("destination")?.focus?.({ preventScroll: true });

    showHeaderStatusNotice("Trip ready", "success", {
      duration: 1200,
      source: "trip-load",
      priority: 55,
    });
  } catch (e) {
    showHeaderStatusNotice("Could not load trip", "danger", {
      duration: 2200,
      source: "trip-load",
      priority: 60,
    });
    console.error(e);
    alert("Could not open trip for editing.");
  } finally {
    tripLoadInFlight = false;
    // Safety net: if neither success nor error notice replaced the loading bar, clear it now.
    if (state.activeStatusNotice?.source === "trip-load" &&
        state.activeStatusNotice?.entry?.mode === "loading") {
      toastHide(0, { source: "trip-load" });
    }
    setFormDisabled(false);
    dom.saveBtn.disabled = false;
    if (dom.deleteBtn) dom.deleteBtn.disabled = dom.action.value === "create";
    state.tripFormDirty = false;
  }
}

// ======================================================
// 30) SAVE/DELETE VERIFY (IFRAME + POLL)
// ======================================================
function startVerifyFallback() {
  if (state.verifyFallbackTimer) clearTimeout(state.verifyFallbackTimer);
  state.verifyFallbackTimer = setTimeout(() => state.pendingWrite && verifyWriteResult(), 4500);
}
function clearVerifyFallback() {
  if (state.verifyFallbackTimer) clearTimeout(state.verifyFallbackTimer);
  state.verifyFallbackTimer = null;
}

async function verifyWriteResult() {
  if (!state.pendingWrite?.tripKey) return;

  const { action, tripKey, originalTrips, originalTripByKey, originalAssignments } =
    state.pendingWrite;

  startProgressCreep({ from: 70, to: 95, label: "Verifying… " });

  // Optimized polling: faster start, exponential backoff
  const delays = [200, 400, 800, 1500, 3000, 6000];

  let exists = false;
  let serverTrip = null;

  try {
    // DELETE: Wait for trip to disappear
    if (action === "delete") {
      for (let i = 0; i < delays.length; i++) {
        const resp = await api.getTrip(tripKey);
        exists = !!(resp?.ok && resp.trip);
        if (!exists) break;
        await delay(delays[i]);
      }

      if (!exists) {
        toastProgress(100, "Deleted ✓");
        toastHide(300);

        // Final sync: clear in-memory week cache so next explicit load
        // will refetch, but avoid a full background refresh here to
        // keep rapid delete/edit flows smooth.
        state.weekCache.clear();
      } else {
        toast("Delete may have failed — restoring", "danger", 3000);
        rollbackState();
      }
    } else {
      // CREATE/UPDATE: Wait for trip to appear
      for (let i = 0; i < delays.length; i++) {
        const resp = await api.getTrip(tripKey);
        exists = !!(resp?.ok && resp.trip);
        serverTrip = exists ? resp.trip : null;
        if (exists) break;
        await delay(delays[i]);
      }

      if (exists) {
        toastProgress(100, "Saved ✓");
        toastHide(300);

        // Sync server-derived field values (e.g. itineraryStatus) back to
        // state — the optimistic object may differ from what GAS stored.
        refreshWeekData({ silent: true });
      } else {
        // Verification timed out — the save may still have landed (GAS was
        // slow). Fetch the real server state instead of blindly rolling back;
        // if the write succeeded the trip will appear, if it failed it won't.
        toast("Verification timed out — reloading from server…", "warning", 3000);
        refreshWeekData({ silent: false });
      }
    }
  } catch (e) {
    console.error(e);
    // Network error during getTrip polling — can't determine outcome.
    // Restore previous state as a safe fallback; user can retry.
    rollbackState();
    toast(
      "Connection error — could not verify save. Please check your connection and try again.",
      "danger",
      3000,
    );
  } finally {
    stopProgressCreep();
    clearVerifyFallback();
    state.pendingWrite = null;
    dom.saveBtn.disabled = false;
    dom.action.value = dom.tripKey.value ? "update" : "create";
  }

  function rollbackState() {
    if (originalTrips) {
      state.trips = originalTrips;
      state.tripByKey = originalTripByKey;
      state.assignmentsByTripKey = originalAssignments;
      scheduleAgendaReflow();
      updateDriverWeekIfVisible();
      try { state.weekCache.clear(); } catch (_) {}
      if (CACHE?.clearAll) CACHE.clearAll();
    }
  }
}

// ======================================================
// 31) TOP CONTROLS MOVE (DESKTOP)
// ======================================================

// ======================================================
// 32) PRINT
// ======================================================

/**
 * Build Legal-landscape print layout by cloning the live schedule-grid.
 * Layout: 2 pages, 5 bus rows each, 2 empty note rows below each bus.
 * Trip bars are in the clone; repositionBarsForPrint sets pixel-based left/width.
 */
function buildPrintScheduleTwoPages() {
  const printRoot = document.getElementById("printRoot");
  if (!printRoot) return;

  const weekTable = getScheduleGridTableEl();
  if (!weekTable) return;

  const weekTitle = document.getElementById("headerWeek")?.textContent || "Schedule";

  /** Reposition trip bars using fixed column metrics for print alignment */
  function repositionBarsForPrint(table, col) {
    if (!col) return;
    const body = table.querySelector("tbody:not([hidden])");
    if (!body) return;
    const total = Math.round(col.total);
    body.querySelectorAll(".schedule-grid__row-bars").forEach((bars) => {
      bars.style.width = `${total}px`;
      bars.querySelectorAll(".schedule-grid__trip-bar").forEach((bar) => {
        const sidx = Number(bar.dataset.sidx);
        const eidx = Number(bar.dataset.eidx);
        if (!Number.isFinite(sidx) || !Number.isFinite(eidx)) return;
        positionBarWithinOverlay(bar, bars, col, sidx, eidx, { insetL: 0, insetR: 0 });
        // Re-apply handoff arrival clip (takes priority over half-day)
        const handoffArrStr = bar.dataset.handoffArr;
        const handoffDepStr = bar.dataset.handoffDep;
        if (handoffArrStr) {
          const frac = parseFloat(handoffArrStr);
          const clip = (1 - frac) * (col.widths[eidx] ?? 0);
          bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - clip)}px`;
        } else if (bar.classList.contains("half-day-return")) {
          const lastColW = col.widths[eidx] ?? 0;
          const curW = parseFloat(bar.style.width) || 0;
          bar.style.width = `${Math.max(0, curW - lastColW / 2)}px`;
        }
        // Re-apply handoff departure shift (takes priority over half-day)
        if (handoffDepStr) {
          const frac = parseFloat(handoffDepStr);
          const shift = frac * (col.widths[sidx] ?? 0);
          bar.style.left  = `${(parseFloat(bar.style.left) || 0) + shift}px`;
          bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - shift)}px`;
        } else if (bar.classList.contains("half-day-depart")) {
          const firstColW = col.widths[sidx] ?? 0;
          const half = firstColW / 2;
          const curLeft = parseFloat(bar.style.left) || 0;
          const curW = parseFloat(bar.style.width) || 0;
          bar.style.left = `${curLeft + half}px`;
          bar.style.width = `${Math.max(0, curW - half)}px`;
        }
        const rawLeft = parseFloat(bar.style.left) || 0;
        const rawW = parseFloat(bar.style.width) || 0;
        bar.style.left = `${Math.round(rawLeft)}px`;
        bar.style.width = `${Math.round(rawW)}px`;
      });
    });
  }

  /** Fit to page: Legal landscape — scale to fit both width and height */
  function computePrintScale() {
    const card = printRoot.querySelector(".print-card");
    if (!card) return 1;
    const contentW = card.scrollWidth || card.offsetWidth;
    const contentH = card.scrollHeight || card.offsetHeight;
    const legalPrintableW = 1296;
    const legalPrintableH = 720;
    const scaleW = contentW > 0 ? legalPrintableW / contentW : 1;
    const scaleH = contentH > 0 ? legalPrintableH / contentH : 1;
    const scale = Math.min(1, scaleW, scaleH) * 0.97;
    return Math.max(0.6, Math.min(1, scale));
  }

  function makeTableForRows(startIdx, endIdx) {
    const clone = weekTable.cloneNode(true);
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

    const body = clone.querySelector("tbody:not([hidden])");
    if (!body) return null;

    clone.querySelectorAll("tbody[hidden]").forEach((el) => el.remove());

    const rows = Array.from(body.querySelectorAll("tr"));
    rows.forEach((tr, idx) => {
      if (idx < startIdx || idx >= endIdx) {
        tr.remove();
      } else {
        for (let j = 0; j < 2; j++) {
          const notesRow = document.createElement("tr");
          notesRow.className = "schedule-grid__row--notes";
          const tdEmpty = document.createElement("td");
          tdEmpty.className = "schedule-grid__cell schedule-grid__bus-cell";
          notesRow.appendChild(tdEmpty);
          for (let i = 0; i < 7; i++) {
            const td = document.createElement("td");
            td.className = "schedule-grid__cell schedule-grid__day-cell";
            notesRow.appendChild(td);
          }
          tr.parentNode.insertBefore(notesRow, tr.nextSibling);
        }
      }
    });

    const page = document.createElement("div");
    page.className = "print-page";
    const card = document.createElement("div");
    card.className = "print-card";

    const agendaHeader = getScheduleAgendaHeaderEl();
    const headerClone = agendaHeader ? agendaHeader.cloneNode(true) : null;
    if (headerClone) {
      headerClone.classList.add("print-header");
      headerClone
        .querySelectorAll(
          ".rux-header__actions, .agenda-header__date-left .rux-btn--tertiary, .weekpicker-trigger-wrap, .agenda-header__sync-center, .agenda-header__date-right",
        )
        .forEach((el) => el.remove());

      const dateLeft = headerClone.querySelector(".agenda-header__date-left");
      if (dateLeft) {
        const logoImg = document.createElement("img");
        logoImg.src = "assets/logo.png";
        logoImg.className = "print-header-logo-img";
        logoImg.alt = "Logo";
        dateLeft.insertBefore(logoImg, dateLeft.firstChild);
      }
      card.appendChild(headerClone);
    } else {
      const title = document.createElement("div");
      title.className = "print-title";
      title.textContent = weekTitle;
      card.appendChild(title);
    }
    clone.classList.add("print-table");
    card.appendChild(clone);
    page.appendChild(card);
    return page;
  }

  printRoot.innerHTML = "";
  printRoot.appendChild(makeTableForRows(0, 5));
  printRoot.appendChild(makeTableForRows(5, 10));

  const printCardWidth = 1440;

  // Force layout before measuring so getBoundingClientRect() returns accurate values
  printRoot.classList.add("print-mode-legal");
  printRoot.classList.remove("is-hidden");
  printRoot.style.cssText = `position:absolute;left:-9999px;visibility:hidden;width:${printCardWidth}px;`;
  void printRoot.offsetHeight;

  // Measure actual rendered column widths from the DOM.
  // Use a body row (same rows where bars live) as the baseline — mirrors getColMetricsCached.
  function measurePrintCols(table) {
    const tbody = table?.querySelector("tbody:not([hidden])");
    const firstBodyRow = tbody?.rows?.[0];
    if (!firstBodyRow || firstBodyRow.cells.length < 8) return null;
    const baseLeft = firstBodyRow.cells[1].getBoundingClientRect().left;
    const starts = [], widths = [];
    let total = 0;
    for (let i = 1; i <= 7; i++) {
      const cell = firstBodyRow.cells[i];
      if (!cell) continue;
      const rect = cell.getBoundingClientRect();
      starts.push(rect.left - baseLeft);
      widths.push(rect.width);
      total += rect.width;
    }
    return starts.length === 7 ? { starts, widths, total } : null;
  }

  const firstTable = printRoot.querySelector(".print-table");
  const colMetrics = measurePrintCols(firstTable) ?? (() => {
    // Fallback to hard-coded values if DOM measurement fails
    const dayColWidth = (1296 - 34 - 22) / 7;
    return {
      starts: Array.from({ length: 7 }, (_, i) => i * dayColWidth),
      widths: Array(7).fill(dayColWidth),
      total: dayColWidth * 7,
    };
  })();

  printRoot.querySelectorAll(".print-table").forEach((t) => repositionBarsForPrint(t, colMetrics));
  const scale = computePrintScale();
  printRoot.classList.add("is-hidden");
  printRoot.style.cssText = "";
  printRoot.style.setProperty("--print-scale", String(scale));
}

/**
 * Build Legal-landscape print layout using CSS Grid.
 * Bars are positioned with grid-column (sidx/eidx) — no pixel measurement,
 * no zoom, no requestAnimationFrame needed.
 * 5 bus rows per page × 2 pages = 10 total rows.
 */
function buildPrintScheduleLegalCSSGrid() {
  const printRoot = document.getElementById("printRoot");
  if (!printRoot) return;

  const weekTable = getScheduleGridTableEl();
  if (!weekTable) return;

  // Day header cells from the live schedule thead (index 1-7, skipping bus col)
  const theadRow = weekTable.querySelector("thead tr");
  const dayHeaderCells = theadRow ? Array.from(theadRow.cells).slice(1) : [];

  function buildPage(startIdx, endIdx) {
    const page = document.createElement("div");
    page.className = "print-page";

    const card = document.createElement("div");
    card.className = "print-card";

    // Agency header (logo + date range) — same approach as existing function
    const agendaHeader = getScheduleAgendaHeaderEl();
    const headerClone = agendaHeader ? agendaHeader.cloneNode(true) : null;
    if (headerClone) {
      headerClone.classList.add("print-header");
      headerClone
        .querySelectorAll(
          ".rux-header__actions, .agenda-header__date-left .rux-btn--tertiary, .weekpicker-trigger-wrap, .agenda-header__sync-center, .agenda-header__date-right",
        )
        .forEach((el) => el.remove());
      const dateLeft = headerClone.querySelector(".agenda-header__date-left");
      if (dateLeft) {
        const logoImg = document.createElement("img");
        logoImg.src = "assets/logo.png";
        logoImg.className = "print-header-logo-img";
        logoImg.alt = "Logo";
        dateLeft.insertBefore(logoImg, dateLeft.firstChild);
      }
      card.appendChild(headerClone);
    }

    // CSS Grid schedule
    const grid = document.createElement("div");
    grid.className = "pgv2-grid";

    // Header row: empty bus cell + 7 day cells
    const busHeaderCell = document.createElement("div");
    busHeaderCell.className = "pgv2-hcell pgv2-hcell--bus";
    grid.appendChild(busHeaderCell);

    for (let d = 0; d < 7; d++) {
      const hcell = document.createElement("div");
      hcell.className = "pgv2-hcell";
      const srcCell = dayHeaderCells[d];
      if (srcCell) {
        const label = srcCell.querySelector(".schedule-grid__day-label");
        hcell.appendChild(label ? label.cloneNode(true) : document.createTextNode(srcCell.textContent.trim()));
      }
      grid.appendChild(hcell);
    }

    // Bus rows
    const tbody = weekTable.querySelector("tbody:not([hidden])");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      for (let i = startIdx; i < Math.min(endIdx, rows.length); i++) {
        const tr = rows[i];

        // Bus cell — clone indicator div (bus number + icons)
        const busCell = document.createElement("div");
        busCell.className = "pgv2-bus-cell";
        const srcBusCell = tr.cells[0];
        if (srcBusCell) {
          const indicator = srcBusCell.querySelector(".schedule-grid__bus-indicator");
          if (indicator) busCell.appendChild(indicator.cloneNode(true));
        }
        const busAccent = tr.style.getPropertyValue("--bus-accent-color");
        if (busAccent) busCell.style.setProperty("--bus-accent-color", busAccent);
        grid.appendChild(busCell);

        // Bars area — inner 7-col grid; each bar placed by grid-column
        const barsArea = document.createElement("div");
        barsArea.className = "pgv2-bars-area";

        const srcBarsCell = tr.cells[1];
        if (srcBarsCell) {
          srcBarsCell.querySelectorAll(".schedule-grid__trip-bar").forEach((bar) => {
            const sidx = Number(bar.dataset.sidx);
            const eidx = Number(bar.dataset.eidx);
            if (!Number.isFinite(sidx) || !Number.isFinite(eidx)) return;
            const barClone = bar.cloneNode(true);
            // Set positioning inline with !important so it beats the base class's
            // height: var(--tripbar-height) !important and position: absolute rules
            barClone.style.removeProperty("left");
            barClone.style.removeProperty("width");
            barClone.style.setProperty("position", "absolute", "important");
            barClone.style.setProperty("top", "0", "important");
            barClone.style.setProperty("left", "0", "important");
            barClone.style.setProperty("width", "100%", "important");
            barClone.style.setProperty("height", "100%", "important");
            barClone.style.setProperty("max-height", "none", "important");
            // Wrapper is the grid item — grid-column placed here, not on the bar
            const lane = Number(bar.dataset.lane) || 0;
            const wrapper = document.createElement("div");
            wrapper.className = "pgv2-bar-wrapper";
            wrapper.style.gridColumn = `${sidx + 1} / ${eidx + 2}`;
            wrapper.style.gridRow = String(lane + 1);
            wrapper.appendChild(barClone);
            barsArea.appendChild(wrapper);
          });
        }
        grid.appendChild(barsArea);

        // Two empty notes rows for handwritten notes
        for (let n = 0; n < 2; n++) {
          const notesRow = document.createElement("div");
          notesRow.className = "pgv2-notes-row";
          grid.appendChild(notesRow);
        }
      }
    }

    card.appendChild(grid);
    page.appendChild(card);
    return page;
  }

  printRoot.innerHTML = "";
  printRoot.classList.remove("print-mode-legal", "print-mode-legal-v2", "print-mode-letter-full");
  printRoot.classList.add("print-mode-legal-v2");
  printRoot.appendChild(buildPage(0, 5));
  printRoot.appendChild(buildPage(5, 10));
}

/**
 * Build Letter-landscape print layout (Full 10-row schedule on 1 page).
 */
function buildPrintScheduleFullLetter() {
  const printRoot = document.getElementById("printRoot");
  if (!printRoot) return;

  const weekTitle = document.getElementById("headerWeek")?.textContent || "Schedule";
  const dates = getWeekDates();
  const dayIds = getDayIds();

  // Create the fresh static tabular HTML based on State
  let html = `
    <div class="print-page print-page-letter">
      <div class="print-header">
        <h2 class="print-title">${escHtml(weekTitle)}</h2>
      </div>
      <table class="print-data-table">
        <thead>
          <tr>
            <th class="schedule-grid__col-bus">Bus</th>
            ${dates
      .map((d, i) => {
        const dObj = parseYMD(d);
        const dayStr = dObj
          ? dObj.toLocaleDateString("en-US", { weekday: "short" })
          : dayIds[i];
        const dateStr = dObj ? `${dObj.getMonth() + 1}/${dObj.getDate()}` : d;
        return `<th class="schedule-grid__col-day">${escHtml(dayStr)} ${escHtml(dateStr)}</th>`;
      })
      .join("")}
          </tr>
        </thead>
        <tbody>
  `;

  const buses = state.busesList || [];
  for (const bus of buses) {
    const busId = String(bus.busId || bus.id || "").trim();
    if (!busId || busId === "None" || busId === "WAITING_LIST") continue;

    const busTrips = state.trips.filter((t) => {
      const a = state.assignmentsByTripKey[t.tripKey] || {};
      return String(a.busId).trim() === busId;
    });

    html += `<tr>`;
    html += `<td class="schedule-grid__bus-cell"><strong>${escHtml(busId)}</strong></td>`;

    let skipDays = 0;
    for (let i = 0; i < 7; i++) {
      if (skipDays > 0) {
        skipDays--;
        continue;
      }

      const currentYMD = dates[i];
      const tripsToday = busTrips.filter((t) => {
        const start = ymd(parseYMD(t.departureDate));
        const end = ymd(parseYMD(t.arrivalDate) || parseYMD(t.departureDate));
        return currentYMD >= start && currentYMD <= end;
      });

      if (tripsToday.length === 0) {
        html += `<td></td>`;
      } else {
        tripsToday.sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));
        const t = tripsToday[0];
        const a = state.assignmentsByTripKey[t.tripKey] || {};

        const tEndYMD = ymd(parseYMD(t.arrivalDate) || parseYMD(t.departureDate));
        let colspan = 1;
        for (let j = i + 1; j < 7; j++) {
          if (dates[j] <= tEndYMD) colspan++;
          else break;
        }

        html += `<td colspan="${colspan}" class="trip-cell">
          <div class="trip-content">
            <div class="trip-dest-cust"><strong>${escHtml(t.destination)}</strong> - ${escHtml(t.customer)}</div>
            <div class="trip-times">⏱ ${normalizeTime(t.departureTime)} - ${normalizeTime(t.arrivalTime)}</div>
            <div class="trip-drivers">👤 D1: ${escHtml(a.driver1 || "—")} | D2: ${escHtml(a.driver2 || "—")}</div>
            <div class="trip-notes">📝 ${escHtml(t.notes || "")}</div>
          </div>
        </td>`;

        skipDays = colspan - 1;
      }
    }
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;

  printRoot.innerHTML = html;
  printRoot.classList.add("print-mode-letter-full");
}

function clearPrintRoot() {
  const printRoot = document.getElementById("printRoot");
  if (printRoot) {
    printRoot.innerHTML = "";
    printRoot.classList.remove("print-mode-letter-full", "print-mode-legal", "print-mode-legal-v2");
  }
}

function setPrintPageSize(size) {
  let el = document.getElementById("dynamicPrintPageSize");
  if (!el) {
    el = document.createElement("style");
    el.id = "dynamicPrintPageSize";
    document.head.appendChild(el);
  }
  const css =
    size === "letter"
      ? `@media print { @page { size: letter landscape; margin: 0.5in; } }`
      : `@media print { @page { size: legal landscape; margin: 0.25in; } }`;
  el.textContent = css;
}

window.addEventListener("afterprint", clearPrintRoot);

// ======================================================
// 33) DATA LOADING (DRIVERS/BUSES)
// ======================================================
const LOG_ACTION_LABELS = {
  trip_added:         () => "Trip added",
  trip_deleted:       () => "Trip deleted",
  itinerary_uploaded: () => "Itinerary uploaded",
  field_changed: (field, oldVal, newVal) => {
    const labels = {
      departureDate:   "Departure date",  arrivalDate:      "Arrival date",
      departureTime:   "Departure time",  spotTime:         "Spot time",
      arrivalTime:     "Arrival time",    destination:      "Destination",
      customer:        "Customer",        contactName:      "Contact name",
      phone:           "Phone",           invoiceNumber:    "Invoice #",
      tripColor:       "Trip color",      busesNeeded:      "Bus assignment",
      busId:           "Bus",             itinerary:        "Itinerary notes",
      notes:           "Notes",           comments:         "Comments",
      itineraryStatus: "Itinerary status", contactStatus:   "Contact status",
      paymentStatus:   "Payment status",  driverStatus:     "Driver status",
      invoiceStatus:   "Invoice status",
      envelopePickup:       "Pickup address",
      envelopeTripContact:  "Trip contact",
      envelopeTripPhone:    "Trip contact phone",
      envelopeTripNotes:    "Trip contact notes",
      driver1: "Driver 1", driver2: "Driver 2",
      driver3: "Driver 3", driver4: "Driver 4",
      driver1Status: "Driver 1 status", driver2Status: "Driver 2 status",
      driver3Status: "Driver 3 status", driver4Status: "Driver 4 status",
    };
    const label = labels[field] || field;
    const fmt = (v) => {
      if (!v || v === "None") return "";
      const iso = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
      return iso ? iso[1] : String(v);
    };
    const old = fmt(oldVal);
    const nw  = fmt(newVal);
    if (old === nw || (!old && !nw)) return null;
    if (old && nw) return `${label}: ${old} → ${nw}`;
    if (nw)        return `${label}: ${nw}`;
    return `${label} removed`;
  },
};

let logActiveTripKey = null;

function shortTripId(tripId) {
  return tripId ? tripId.replace(/^TRIP-20/, "") : "—";
}

async function fetchActivityLog(tripKey = null) {
  const params = tripKey ? { tripKey } : {};
  const data = await fetchAPI("listLog", params);
  if (!data.ok) throw new Error(data.error);
  return data.log || [];
}

function setLogFilter(tripKey) {
  logActiveTripKey = tripKey || null;
  const badge = dom.logFilterBadge;
  const clearBtn = dom.logClearFilterBtn;
  if (logActiveTripKey) {
    const trip = state.tripByKey?.[logActiveTripKey];
    const label = shortTripId(trip?.tripId || logActiveTripKey);
    if (badge) { badge.textContent = label; badge.classList.remove("is-hidden"); }
    if (clearBtn) clearBtn.classList.remove("is-hidden");
  } else {
    if (badge) { badge.textContent = ""; badge.classList.add("is-hidden"); }
    if (clearBtn) clearBtn.classList.add("is-hidden");
  }
  if (getCardPanel("log")) {
    fetchActivityLog(logActiveTripKey).then(renderLogList).catch(console.error);
  }
}

function renderLogList(entries) {
  if (!dom.logList) return;
  if (logActiveTripKey && entries?.length > 0 && entries[0].tripId && dom.logFilterBadge) {
    dom.logFilterBadge.textContent = shortTripId(entries[0].tripId);
  }
  if (!entries || entries.length === 0) {
    dom.logList.innerHTML = '<p class="log-empty">No activity recorded yet.</p>';
    return;
  }
  const LOG_GROUP_THRESHOLD_MS = 60 * 1000; // group entries within 1 minute

  const groups = [];
  let currentGroup = null;
  let prevTs = 0;

  for (const e of entries) {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    const key = e.tripKey || "";
    if (!currentGroup || key !== currentGroup.key || (prevTs - ts) > LOG_GROUP_THRESHOLD_MS) {
      currentGroup = { key, tripId: e.tripId || e.tripKey || "—", timestamp: e.timestamp, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(e);
    prevTs = ts;
  }

  const rows = groups.map((group) => {
    const ts = group.timestamp ? new Date(group.timestamp) : null;
    const date = ts ? ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
    const time = ts ? ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: undefined }) : "—";

    // Build driver name map from this group's field changes (driver1 → name)
    const driverNames = {};
    for (const e of group.items) {
      if (e.action === "field_changed" && /^driver[1-4]$/.test(e.field)) {
        const name = e.newValue || e.oldValue;
        if (name && name !== "None") driverNames[e.field] = name;
      }
    }

    const actionLines = group.items
      .map((e) => {
        if (e.action !== "field_changed") {
          const labelFn = LOG_ACTION_LABELS[e.action];
          return labelFn ? labelFn(e.field, e.oldValue, e.newValue) : (e.action || null);
        }

        const fmt = (v) => {
          if (!v || v === "None") return "";
          const s = String(v);
          // Strip ISO timestamp to YYYY-MM-DD only if it looks like a full datetime
          const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
          return iso ? iso[1] : s;
        };
        const old = fmt(e.oldValue);
        const nw  = fmt(e.newValue);
        if (old === nw || (!old && !nw)) return null;

        // Suppress busNumber — internal sequencing, not useful
        if (e.field === "busNumber") return null;

        // Driver status: use driver's name as label if known
        const statusMatch = e.field.match(/^(driver[1-4])Status$/);
        if (statusMatch) {
          const name = driverNames[statusMatch[1]];
          const label = name ? `${name} status` : `Driver ${statusMatch[1].slice(-1)} status`;
          if (!nw) return null; // suppress "status removed" — driver unassign covers it
          if (old && nw) return `${label}: ${old} → ${nw}`;
          return `${label}: ${nw}`;
        }

        // Driver name change
        const driverMatch = e.field.match(/^driver([1-4])$/);
        if (driverMatch) {
          const n = driverMatch[1];
          if (!nw) return `Driver ${n} unassigned`;
          if (!old) return `Driver ${n}: ${nw}`;
          return `Driver ${n}: ${old} → ${nw}`;
        }

        // All other fields
        const labels = LOG_ACTION_LABELS.field_changed;
        return labels ? labels(e.field, e.oldValue, e.newValue) : null;
      })
      .filter(Boolean)
      .map(action => `<div class="log-entry__action">${action}</div>`)
      .join("");
    if (!actionLines) return null;
    return `<div class="log-entry">
      <div class="log-entry__meta">
        <span class="log-entry__trip">${shortTripId(group.tripId)}</span>
        <span class="log-entry__time">${date} · ${time}</span>
      </div>
      ${actionLines}
    </div>`;
  });
  dom.logList.innerHTML = `<div class="log-entries">${rows.filter(Boolean).join("")}</div>`;
}

async function loadDriversAndBuses(forceRefresh = false) {
  // Try cache first (only for drivers, buses always fetch fresh)
  if (!forceRefresh) {
    const cDrivers = CACHE.get("cache_drivers");

    if (cDrivers) {
      state.driversList = cDrivers;
      // Don't return early - still need to fetch buses
    }
  }

  // Always fetch buses fresh (no caching) to ensure hasLift data is current
  const [driversResp, busesResp] = await Promise.all([
    forceRefresh || !state.driversList.length
      ? api.listDrivers(true, forceRefresh)
      : Promise.resolve({ ok: true, drivers: state.driversList }),
    api.listBuses(true, forceRefresh),
  ]);

  const freshDrivers = driversResp?.ok && driversResp.drivers?.length ? driversResp.drivers : null;
  const freshBuses   = busesResp?.ok  && busesResp.buses?.length   ? busesResp.buses   : null;

  // Only replace existing state when the response has valid data — a transient API
  // failure returning an empty list must not wipe good state that other code depends on.
  if (freshDrivers) {
    state.driversList = freshDrivers
      .map((d) => ({
        ...d,
        driverId: String(d.driverId || "").trim(),
        driverName:
          d.driverName && String(d.driverName).trim()
            ? String(d.driverName).trim()
            : String(d.driverId || "").trim(),
      }))
      .filter((d) => d.driverName);
  }

  if (freshBuses) {
    state.busesList = freshBuses
      .map((b) => ({
        ...b,
        busId: String(b.busId || "").trim(),
        busName: b.busName && String(b.busName).trim() ? String(b.busName).trim() : `Bus ${b.busId}`,
      }))
      .filter((b) => b.busId);
  }

  // Save drivers to cache (but not buses)
  if (state.driversList.length)
    CACHE.set("cache_drivers", state.driversList, CONFIG.CACHE_TTL_DRIVERS);

  refreshBusSelectOptions();

  buildAgendaRows();
  setHeaderOrder();
  scheduleAgendaReflow();
}

// ======================================================
// 34) DELEGATED BAR EVENTS
// ======================================================
// ======================================================
// 34) DELEGATED BAR EVENTS (CONTEXT MENU)
// ======================================================
let activeContextTripKey = null;
let activeCellContext = null;
let selectedTripBar = null;
let selectedDriverName = null;

function selectDriverBars(driverName) {
  // Clear existing trip bar selection
  if (selectedTripBar) {
    const prevKey = selectedTripBar.dataset.tripkey;
    document.querySelectorAll(`.schedule-grid__trip-bar[data-tripkey="${CSS.escape(prevKey)}"]`)
      .forEach(el => el.classList.remove("selected"));
    document.body.classList.remove("trip-bar-selected");
    selectedTripBar = null;
  }

  // Clear previous driver name highlight
  document.querySelectorAll(".driver-week__name-cell.is-selected")
    .forEach(el => el.classList.remove("is-selected"));

  // Toggle off if same driver clicked again
  if (selectedDriverName === driverName) {
    selectedDriverName = null;
    document.querySelectorAll(".schedule-grid__trip-bar.selected")
      .forEach(el => el.classList.remove("selected"));
    document.body.classList.remove("driver-filter-active");
    return;
  }

  selectedDriverName = driverName;
  document.body.classList.add("driver-filter-active");

  // Highlight the name cell
  document.querySelectorAll(`.driver-week__name-cell[data-driver-name="${CSS.escape(driverName)}"]`)
    .forEach(el => el.classList.add("is-selected"));

  // Clear any previously selected bars then select matching ones
  document.querySelectorAll(".schedule-grid__trip-bar.selected")
    .forEach(el => el.classList.remove("selected"));

  document.querySelectorAll(".schedule-grid__trip-bar").forEach(bar => {
    const names = Array.from(bar.querySelectorAll(".schedule-grid__trip-bar__driver"))
      .map(el => el.textContent.trim())
      .filter(Boolean);
    if (names.includes(driverName)) bar.classList.add("selected");
  });
}

function selectTripBar(barEl) {
  // Clear driver selection
  if (selectedDriverName) {
    selectedDriverName = null;
    document.body.classList.remove("driver-filter-active");
    document.querySelectorAll(".driver-week__name-cell.is-selected")
      .forEach(el => el.classList.remove("is-selected"));
  }

  // Toggle off if same trip clicked again
  if (selectedTripBar && barEl?.dataset.tripkey === selectedTripBar.dataset.tripkey) {
    const key = selectedTripBar.dataset.tripkey;
    document.querySelectorAll(`.schedule-grid__trip-bar[data-tripkey="${CSS.escape(key)}"]`)
      .forEach(el => el.classList.remove("selected"));
    document.body.classList.remove("trip-bar-selected");
    document.querySelectorAll(
      ".driver-week__cell--trip-highlight, .driver-week__header-cell--trip-highlight"
    ).forEach(el => el.classList.remove(
      "driver-week__cell--trip-highlight",
      "driver-week__header-cell--trip-highlight"
    ));
    const overlay = document.getElementById("driver-col-hl");
    if (overlay) overlay.hidden = true;
    selectedTripBar = null;
    setLogFilter(null);
    return;
  }

  if (selectedTripBar) {
    const prevKey = selectedTripBar.dataset.tripkey;
    document.querySelectorAll(`.schedule-grid__trip-bar[data-tripkey="${CSS.escape(prevKey)}"]`)
      .forEach(el => el.classList.remove("selected"));
  }
  // Clear previous driver column highlights
  document.querySelectorAll(
    ".driver-week__cell--trip-highlight, .driver-week__header-cell--trip-highlight"
  ).forEach(el => el.classList.remove(
    "driver-week__cell--trip-highlight",
    "driver-week__header-cell--trip-highlight"
  ));
  const existingOverlay = document.getElementById("driver-col-hl");
  if (existingOverlay) existingOverlay.hidden = true;

  selectedTripBar = barEl || null;
  if (!selectedTripBar) {
    document.body.classList.remove("trip-bar-selected");
    return;
  }

  const tripKey = selectedTripBar.dataset.tripkey;
  document.querySelectorAll(`.schedule-grid__trip-bar[data-tripkey="${CSS.escape(tripKey)}"]`)
    .forEach(el => el.classList.add("selected"));
  document.body.classList.add("trip-bar-selected");
  setLogFilter(tripKey);

  const sidx = parseInt(selectedTripBar.dataset.sidx, 10);
  const eidx = parseInt(selectedTripBar.dataset.eidx, 10);
  const weekDates = getWeekDates();
  const targetDates = new Set(weekDates.slice(sidx, eidx + 1));
  const leftDate = weekDates[sidx];
  const rightDate = weekDates[eidx];

  // Background tint on matching cells
  [
    ...(dom.driverWeekHeadRow?.querySelectorAll("[data-date]") ?? []),
    ...(dom.driverWeekBody?.querySelectorAll("[data-date]") ?? []),
  ].forEach(el => {
    if (!targetDates.has(el.dataset.date)) return;
    el.classList.add(
      el.tagName === "TH"
        ? "driver-week__header-cell--trip-highlight"
        : "driver-week__cell--trip-highlight"
    );
  });

  // Overlay for border + glow
  const wrap = dom.driverWeekBody?.closest(".driver-week__wrap");
  if (!wrap) return;
  const leftHeaderCell = dom.driverWeekHeadRow?.querySelector(`[data-date="${leftDate}"]`);
  const bodyRows = Array.from(dom.driverWeekBody?.querySelectorAll("tr") ?? []);
  const lastBodyRow = bodyRows[bodyRows.length - 1];
  const rightLastCell = lastBodyRow?.querySelector(`[data-date="${rightDate}"]`);
  if (!leftHeaderCell || !rightLastCell) return;

  let overlay = document.getElementById("driver-col-hl");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "driver-col-hl";
    wrap.appendChild(overlay);
  }

  const wrapRect = wrap.getBoundingClientRect();
  const topRect = leftHeaderCell.getBoundingClientRect();
  const bottomRect = rightLastCell.getBoundingClientRect();

  overlay.style.left   = `${topRect.left   - wrapRect.left - wrap.clientLeft + wrap.scrollLeft}px`;
  overlay.style.top    = `${topRect.top    - wrapRect.top  - wrap.clientTop  + wrap.scrollTop}px`;
  overlay.style.width  = `${bottomRect.right  - topRect.left}px`;
  overlay.style.height = `${bottomRect.bottom - topRect.top}px`;

  overlay.hidden = false;
}

function closeTripContextMenu() {
  if (dom.ctxMenu) dom.ctxMenu.hidden = true;
  activeContextTripKey = null;
}

function closeCellContextMenu() {
  if (dom.cellCtxMenu) dom.cellCtxMenu.hidden = true;
  activeCellContext = null;
}

// ── Central Management for Floating Menus (Context & Custom Dropdowns) ─────────
function closeAllFloatingMenus() {
  closeTripContextMenu();
  closeCellContextMenu();
  // Dispatch custom event to close any "glass select" dropdowns
  window.dispatchEvent(new CustomEvent("close-all-floating-menus"));
}

// Auto-close menus on Escape
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllFloatingMenus();
  }
});

function showTripContextMenu(x, y, tripKey) {
  if (!dom.ctxMenu) return;

  closeQuickEditPopover();
  closeAllFloatingMenus();

  activeContextTripKey = tripKey;

  // Update Header (optional, could fetch trip details to show dest)
  // For now just generic "Trip Actions" or maybe the destination from the DOM?
  // Let's keep it simple for now.

  dom.ctxMenu.style.left = `${x}px`;
  dom.ctxMenu.style.top = `${y}px`;
  dom.ctxMenu.hidden = false;

  // Adjust if off-screen (using clientX to avoid scroll math complexity)
  const rect = dom.ctxMenu.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  // Calculate viewport-relative X
  const clientX = x - scrollX;

  // If click is in the right 250px of the screen, force alignment to LEFT of cursor
  // This avoids waiting for rect.width to be valid (which might be 0 during animation)
  if (clientX > winW - 250) {
    // Force menu to be ~200px wide properties to left
    // x is pageX.
    dom.ctxMenu.style.left = `${Math.max(scrollX, x - 210)}px`;
  }

  // Check overflow bottom
  if (rect.bottom > winH) {
    dom.ctxMenu.style.top = `${y - rect.height}px`;
  }
}

function showCellContextMenu(x, y, busId, dateStr) {
  closeAllFloatingMenus();
  // console.log("showCellContextMenu called", { x, y, busId, dateStr, menu: dom.cellCtxMenu });
  if (!dom.cellCtxMenu) {
    console.error("cellCtxMenu DOM element not found!");
    return;
  }

  activeCellContext = { busId, dateStr };

  dom.cellCtxMenu.style.left = `${x}px`;
  dom.cellCtxMenu.style.top = `${y}px`;
  dom.cellCtxMenu.hidden = false;
  // dom.cellCtxMenu.style.display = "block"; // Removed, relies on hidden attribute
  // dom.cellCtxMenu.style.zIndex = "99999"; // Removed
  // ... rest of function default ...

  // Adjust if off-screen
  const rect = dom.cellCtxMenu.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  // X adjustment
  const clientX = x - scrollX;
  if (clientX > winW - 200) {
    dom.cellCtxMenu.style.left = `${Math.max(scrollX, x - 180)}px`;
  }

  // Y adjustment
  if (rect.bottom > winH) {
    dom.cellCtxMenu.style.top = `${Math.max(scrollY, y - rect.height)}px`;
  }
}

function handleScheduleInteraction(e, isContext) {
  // 1. Check for Trip Bar
  const tripBar = e.target.closest(".schedule-grid__trip-bar");

  if (tripBar) {
    if (isContext) e.preventDefault(); // Stop browser menu
    e.stopPropagation();

    const tripKey = tripBar.dataset.tripkey;
    if (!tripKey) return;

    // Handle "Driver Status" icon click
    const driverContactIcon = e.target.closest('[data-action="showDriverContact"]');
    if (driverContactIcon && !isContext) {
      openDriverContactModal(tripKey);
      return;
    }

    selectTripBar(tripBar);
    showTripContextMenu(e.pageX, e.pageY, tripKey);
    return;
  }

  // 2. Check for Day Cell (Context Menu)
  const cell = e.target.closest("td.schedule-grid__day-cell");
  if (cell) {
    if (isContext) e.preventDefault(); // Stop browser menu
    e.stopPropagation(); // Prevent immediate close via document listener

    // Get the bus ID from the row
    const tr = cell.closest("tr");
    if (!tr) return;

    let busId = "";
    const busCell = tr.querySelector(".schedule-grid__bus-num");
    if (busCell) {
      busId = busCell.textContent.trim();
    } else if (tr.classList.contains("waiting-list-row")) {
      busId = "Waiting List";
    }

    // Get the date
    const colIdx = cell.cellIndex;
    if (colIdx < 1) return;
    const dayIndex = colIdx - 1;
    const weekDates = getWeekDates();
    if (dayIndex < 0 || dayIndex >= weekDates.length) return;
    const dateStr = weekDates[dayIndex];

    if (busId && dateStr) {
      showCellContextMenu(e.pageX, e.pageY, busId, dateStr);
    } else {
      console.warn("Missing busId or dateStr", { busId, dateStr });
    }
  }
}

// ======================================================
// 34B) TRIP BAR QUICK-EDIT POPOVER
// ======================================================

let quickEditTripKey = null;
let quickEditDirty = false;

const QUICK_EDIT_TABS = [
  { id: "details",   label: "Trip"      },
  { id: "billing",   label: "Billing"   },
  { id: "bus",       label: "Dispatch"  },
  { id: "envelope",  label: "Envelope"  },
  { id: "checklist", label: "Checklist" },
];

function closeQuickEditPopover() {
  const el = $("tripQuickEdit");
  if (el) el.classList.add("is-hidden");
  quickEditTripKey = null;
  quickEditDirty = false;
}

function renderQuickEditTab(tabId, trip, assigns) {
  const body = $("quickEditBody");
  if (!body) return;
  body.innerHTML = "";

  if (tabId === "billing") {
    const fields = [
      { label: "Contract",       key: "paymentStatus",  type: "select", options: [["",""],["Pending Quote","Unconfirmed"],["Contract Signed","Contract Signed"],["PO Received","PO Received"],["Not Required","Not Required"]] },
      { label: "Invoice",        key: "invoiceStatus",  type: "select", options: [["",""],["Pending Invoice","Pending"],["Invoiced","Invoiced"],["Deposit Received","Deposit Paid"],["Paid in Full","Paid in Full"]] },
      { label: "Invoice #",      key: "invoiceNumber",  type: "text"   },
      { label: "PO / Payment",   key: "paymentType",    type: "text"   },
      { label: "Est. Mileage",   key: "estimatedMileage", type: "text"   },
      { label: "Quoted Price",   key: "quotedPrice",      type: "text"   },
      { label: "Trip Miles",     key: "tripMiles",        type: "text"   },
      { label: "Date Paid",      key: "datePaid",         type: "date"   },
      { label: "Notes",          key: "notes",            type: "text"   },
    ];
    fields.forEach(({ label, key, type, options }) => {
      const wrap = document.createElement("div");
      wrap.className = "trip-quick-edit__field";
      const lbl = document.createElement("span");
      lbl.className = "trip-quick-edit__label";
      lbl.textContent = label;
      wrap.appendChild(lbl);
      let input;
      if (type === "select") {
        input = document.createElement("select");
        input.className = "trip-quick-edit__select";
        options.forEach(([val, txt]) => {
          const o = document.createElement("option");
          o.value = val; o.textContent = txt;
          input.appendChild(o);
        });
        input.value = trip[key] || "";
      } else {
        input = document.createElement("input");
        input.type = type === "date" ? "date" : "text";
        input.className = "trip-quick-edit__input";
        input.value = trip[key] || "";
        if (key === "quotedPrice") {
          input.addEventListener("blur", () => {
            const v = input.value.trim();
            if (v && !v.startsWith("$")) input.value = "$" + v;
          });
        }
      }
      input.dataset.key = key;
      wrap.appendChild(input);
      body.appendChild(wrap);
    });

  } else if (tabId === "bus") {
    if (!assigns.length) {
      const empty = document.createElement("span");
      empty.className = "trip-quick-edit__label";
      empty.textContent = "No bus assignments";
      body.appendChild(empty);
      return;
    }

    const STATUS_STATES = [
      { value: "Pending",   icon: "schedule",    cls: "status-pending"  },
      { value: "Assigned",  icon: "pending",      cls: "status-assigned" },
      { value: "Confirmed", icon: "check_circle", cls: "status-ok"       },
    ];

    const makeStatusCycle = (currentValue, busNumber, statusKey) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.busNumber = busNumber;
      btn.dataset.statusKey = statusKey;
      btn.dataset.value = currentValue || "Pending";
      const sync = () => {
        const s = STATUS_STATES.find(st => st.value === btn.dataset.value) || STATUS_STATES[0];
        btn.innerHTML = `<span class="material-symbols-outlined">${s.icon}</span>`;
        btn.className = `driver-status-cycle ${s.cls}`;
      };
      sync();
      btn.addEventListener("click", () => {
        const cur = STATUS_STATES.findIndex(st => st.value === btn.dataset.value);
        btn.dataset.value = STATUS_STATES[(cur + 1) % STATUS_STATES.length].value;
        sync();
      });
      return btn;
    };

    assigns.forEach((a) => {
      // Bus header
      const header = document.createElement("div");
      header.className = "trip-quick-edit__bus-header";
      header.textContent = `Bus ${a.busId}`;
      body.appendChild(header);

      // One row per assigned driver
      const slots = [
        { name: a.driver1, pay: a.driver1Pay, status: a.driver1Status, payKey: "driver1Pay", statusKey: "driver1Status" },
        { name: a.driver2, pay: a.driver2Pay, status: a.driver2Status, payKey: "driver2Pay", statusKey: "driver2Status" },
        { name: a.driver3, pay: a.driver3Pay, status: a.driver3Status, payKey: "driver3Pay", statusKey: "driver3Status" },
        { name: a.driver4, pay: a.driver4Pay, status: a.driver4Status, payKey: "driver4Pay", statusKey: "driver4Status" },
      ].filter(s => s.name && s.name !== "None" && s.name !== "");

      slots.forEach(({ name, pay, status, payKey, statusKey }) => {
        const row = document.createElement("div");
        row.className = "trip-quick-edit__driver-row";

        const nameEl = document.createElement("span");
        nameEl.className = "trip-quick-edit__value";
        nameEl.textContent = name;

        const payInput = document.createElement("input");
        payInput.type = "text";
        payInput.className = "trip-quick-edit__input";
        payInput.placeholder = "$";
        payInput.value = pay || "";
        payInput.dataset.busNumber = a.busNumber;
        payInput.dataset.payKey = payKey;

        const statusBtn = makeStatusCycle(status, a.busNumber, statusKey);

        row.appendChild(nameEl);
        row.appendChild(payInput);
        row.appendChild(statusBtn);
        body.appendChild(row);
      });
    });

  } else if (tabId === "envelope") {
    const fields = [
      { label: "Pick Up Address",    key: "envelopePickup"       },
      { label: "Trip Contact",       key: "envelopeTripContact"  },
      { label: "Contact Phone",      key: "envelopeTripPhone"    },
      { label: "Driver Instructions",key: "envelopeTripNotes"    },
    ];
    fields.forEach(({ label, key }) => {
      const wrap = document.createElement("div");
      wrap.className = "trip-quick-edit__field";
      const lbl = document.createElement("span");
      lbl.className = "trip-quick-edit__label";
      lbl.textContent = label;
      wrap.appendChild(lbl);
      const input = document.createElement("input");
      input.type = "text";
      input.className = "trip-quick-edit__input";
      input.value = trip[key] || "";
      input.dataset.key = key;
      wrap.appendChild(input);
      body.appendChild(wrap);
    });

  } else if (tabId === "checklist") {
    const items = [
      { key: "tripReminderSent", label: "Reminder Sent",  icon: "notifications" },
      { key: "driverInfoSent",   label: "Driver Info Sent", icon: "send"         },
      { key: "tripReviewed",     label: "Reviewed",         icon: "task_alt"     },
    ];
    const row = document.createElement("div");
    row.className = "trip-quick-edit__toggle-row";
    items.forEach(({ key, label, icon }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rux-btn rux-btn--toggle${key === "tripReviewed" ? " rux-btn--toggle-reviewed" : ""}`;
      const isOn = !!trip[key] && trip[key] !== false && trip[key] !== "false";
      btn.setAttribute("aria-pressed", String(isOn));
      btn.dataset.key = key;
      btn.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>${label}`;
      btn.addEventListener("click", () => {
        const pressed = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", String(!pressed));
      });
      row.appendChild(btn);
    });
    body.appendChild(row);

  } else if (tabId === "details") {
    const fields = [
      { label: "Destination",  key: "destination",   readonly: true },
      { label: "Customer",     key: "customer",      readonly: true },
      { label: "Departure",    key: "departureDate", readonly: true },
      { label: "Arrival",      key: "arrivalDate",   readonly: true },
      { label: "Name",         key: "contactName",   type: "text"   },
      { label: "Phone",        key: "phone",         type: "tel"    },
      { label: "Depart Time",  key: "departureTime", type: "time"   },
      { label: "Spot Time",    key: "spotTime",      type: "time"   },
      { label: "Arrival Time", key: "arrivalTime",   type: "time"   },
      { label: "Trip Color",   key: "tripColor",     type: "select",
        options: [["","None"],["blue","Blue"],["green","Green"],["one-way","One-Way"],["out-of-service","Out of Service"]] },
      { label: "Buses",        key: "busesNeeded",   readonly: true },
    ];
    fields.forEach(({ label, key, readonly, type, options }) => {
      const wrap = document.createElement("div");
      wrap.className = "trip-quick-edit__field";
      const lbl = document.createElement("span");
      lbl.className = "trip-quick-edit__label";
      lbl.textContent = label;
      wrap.appendChild(lbl);
      if (readonly) {
        const val = document.createElement("span");
        val.className = "trip-quick-edit__value";
        val.textContent = trip[key] || "—";
        wrap.appendChild(val);
      } else if (type === "select") {
        const sel = document.createElement("select");
        sel.className = "trip-quick-edit__select";
        sel.dataset.key = key;
        options.forEach(([v, t]) => {
          const o = document.createElement("option");
          o.value = v; o.textContent = t;
          sel.appendChild(o);
        });
        sel.value = trip[key] || "";
        wrap.appendChild(sel);
      } else {
        const input = document.createElement("input");
        input.type = type;
        input.className = "trip-quick-edit__input";
        input.value = trip[key] || "";
        input.dataset.key = key;
        wrap.appendChild(input);
      }
      body.appendChild(wrap);
    });
  }
}

function showQuickEditPopover(tripKey, barEl) {
  const trip = state.tripByKey?.[String(tripKey)];
  if (!trip) return;
  const assigns = (state.assignmentsByTripKey?.[String(tripKey)] || [])
    .filter(a => a.busId && a.busId !== "None");

  quickEditTripKey = tripKey;
  quickEditDirty = false;

  const el = $("tripQuickEdit");
  const titleEl = el.querySelector(".trip-quick-edit__title");
  const tabsEl = $("quickEditTabs");

  titleEl.textContent = "Quick Edit";

  // Build tabs
  tabsEl.innerHTML = "";
  QUICK_EDIT_TABS.forEach((tab, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "trip-quick-edit__tab" + (i === 0 ? " is-active" : "");
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".trip-quick-edit__tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderQuickEditTab(tab.id, trip, assigns);
    });
    tabsEl.appendChild(btn);
  });

  renderQuickEditTab("details", trip, assigns);
  el.classList.remove("is-hidden");

  // Position
  const scrollX = window.scrollX, scrollY = window.scrollY;
  const barRect = barEl.getBoundingClientRect();
  const popW = 320, popH = el.offsetHeight;
  const arrow = el.querySelector(".trip-quick-edit__arrow");

  let left = barRect.right + 10 + scrollX;
  let top  = barRect.top  + scrollY;
  arrow.classList.remove("arrow-right");

  if (left + popW > window.innerWidth + scrollX - 16) {
    left = barRect.left - popW - 10 + scrollX;
    arrow.classList.add("arrow-right");
  }
  if (top + popH > window.innerHeight + scrollY - 12) {
    top = window.innerHeight + scrollY - popH - 12; // --rux-space-4
  }
  if (top < scrollY + 8) top = scrollY + 8;

  el.style.left = `${left}px`;
  el.style.top  = `${top}px`;
}

function collectQuickEditData() {
  const body = $("quickEditBody");
  if (!body) return { tripEdits: {}, assignEdits: [] };
  const tripEdits = {};
  body.querySelectorAll("[data-key]").forEach(el => {
    if (el.tagName === "SELECT" || el.tagName === "INPUT") {
      tripEdits[el.dataset.key] = el.value;
    } else if (el.tagName === "BUTTON" && el.dataset.key) {
      tripEdits[el.dataset.key] = el.getAttribute("aria-pressed") === "true";
    }
  });
  const assignEdits = [];
  body.querySelectorAll("[data-bus-number]").forEach(el => {
    const bn = String(el.dataset.busNumber);
    let entry = assignEdits.find(a => a.busNumber === bn);
    if (!entry) { entry = { busNumber: bn }; assignEdits.push(entry); }
    if (el.dataset.payKey)    entry[el.dataset.payKey]    = el.value;
    if (el.dataset.statusKey) entry[el.dataset.statusKey] = el.dataset.value;
  });
  return { tripEdits, assignEdits };
}

function saveQuickEdit() {
  if (!quickEditTripKey) return;
  const trip = state.tripByKey?.[String(quickEditTripKey)];
  if (!trip) return;

  const { tripEdits, assignEdits } = collectQuickEditData();

  closeQuickEditPopover();

  if (!confirmDiscardIfDirty("You have unsaved trip changes. Save quick edit instead?")) return;

  // Merge edits into existing state — no API call, panel stays closed
  const merged = { ...trip, ...tripEdits };
  const baseAssigns = (state.assignmentsByTripKey?.[String(merged.tripKey)] || []).map(a => {
    const edit = assignEdits.find(e => String(e.busNumber) === String(a.busNumber));
    return edit ? { ...a, ...edit } : a;
  });

  populateFormFromData(merged, baseAssigns);
  state.tripFormDirty = true;
  dom.saveBtn.click();
}

function wireQuickEditPopover() {
  $("quickEditSaveBtn")?.addEventListener("click", saveQuickEdit);
  $("quickEditCloseBtn")?.addEventListener("click", closeQuickEditPopover);

  $("quickEditBody")?.addEventListener("input", () => { quickEditDirty = true; });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && quickEditTripKey) closeQuickEditPopover();
  });

  document.addEventListener("click", (e) => {
    if (!quickEditTripKey) return;
    const el = $("tripQuickEdit");
    const path = e.composedPath ? e.composedPath() : [e.target];
    const insidePopover = path.some(n => n === el);
    const onBar = path.some(n => n?.classList?.contains?.("schedule-grid__trip-bar"));
    if (insidePopover || onBar) return;
    if (quickEditDirty && !confirm("Discard unsaved changes?")) return;
    closeQuickEditPopover();
  });
}

function wireDelegatedBarEvents() {
  const containers = document.querySelectorAll(SELECTORS.scheduleGridWrapHook);
  if (!containers.length) return;

  // Close context menu on any click outside
  document.addEventListener("click", (e) => {
    if (dom.ctxMenu && !dom.ctxMenu.hidden && !dom.ctxMenu.contains(e.target)) {
      closeTripContextMenu();
    }
    if (dom.cellCtxMenu && !dom.cellCtxMenu.hidden && !dom.cellCtxMenu.contains(e.target)) {
      closeCellContextMenu();
    }
  });

  // Wire Context Actions
  dom.ctxEditTripInfoBtn?.addEventListener("click", async () => {
    if (activeContextTripKey) {
      if (dom.tripKey.value !== activeContextTripKey) {
        if (!confirmDiscardIfDirty()) return;
        await openTripForEdit(activeContextTripKey);
      }
      openItineraryModal();
      closeTripContextMenu();
    }
  });

  dom.ctxEditBtn?.addEventListener("click", async () => {
    if (!activeContextTripKey) return;
    const tripKey = activeContextTripKey; // capture before menu close clears it
    closeTripContextMenu();
    if (!confirmDiscardIfDirty()) return;
    await openTripForEdit(tripKey);
  });

  dom.ctxViewBtn?.addEventListener("click", () => {
    if (activeContextTripKey) {
      openTripDetailsModal(activeContextTripKey);
      closeTripContextMenu();
    }
  });

  dom.ctxEnvelopeBtn?.addEventListener("click", () => {
    if (activeContextTripKey) {
      openEnvelopeModal(activeContextTripKey);
      closeTripContextMenu();
    }
  });

  dom.ctxOpenItineraryPdfBtn?.addEventListener("click", () => {
    if (!activeContextTripKey) return;
    const trip = state.tripByKey?.[activeContextTripKey];
    if (!trip || !trip.itineraryPdfUrl) {
      toast("No itinerary PDF attached for this trip.", "info", 2000);
      return;
    }
    window.open(trip.itineraryPdfUrl, "_blank");
    closeTripContextMenu();
  });

  dom.ctxAttachItineraryPdfBtn?.addEventListener("click", () => {
    if (!activeContextTripKey) return;
    if (!dom.itineraryPdfInput) {
      toast("Upload control not available.", "danger", 2000);
      return;
    }
    state.pendingItineraryTripKey = activeContextTripKey;
    dom.itineraryPdfInput.value = "";
    dom.itineraryPdfInput.click();
  });

  dom.ctxRemoveItineraryPdfBtn?.addEventListener("click", async () => {
    if (!activeContextTripKey) return;
    const capturedTripKey = activeContextTripKey; // capture before menu close clears it
    const trip = state.tripByKey?.[capturedTripKey];

    if (!trip || !trip.itineraryPdfUrl) {
      toast("No itinerary PDF attached to remove.", "info", 2000);
      closeTripContextMenu();
      return;
    }

    if (!confirm("Remove this PDF itinerary?")) {
      closeTripContextMenu();
      return;
    }

    closeTripContextMenu();

    // Needs to be loaded in the editor for saveBtn.click() to save this specific trip
    const wasOpenKey = dom.tripKey?.value;
    if (wasOpenKey !== capturedTripKey) {
      if (!confirmDiscardIfDirty("You have unsaved changes. Loading this trip to remove its PDF will discard them. Continue?")) return;
      toastShow("Loading trip to remove PDF...", "loading", {
        indeterminate: true,
        source: "pdf-delete",
      });
      await openTripForEdit(capturedTripKey);
    }

    toastShow("Deleting PDF...", "loading", { indeterminate: true, source: "pdf-delete" });
    trip.itineraryPdfUrl = ""; // Clear from local state
    if ($("itineraryPdfUrl")) $("itineraryPdfUrl").value = ""; // Clear from form so it submits empty
    if (trip.itineraryStatus === "Received") {
      trip.itineraryStatus = "Pending";
      const itinStatusEl = $("itineraryStatus");
      if (itinStatusEl) {
        itinStatusEl.value = "Pending";
        itinStatusEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    // Trigger save process
    state.tripFormDirty = true;
    dom.saveBtn.click();
    // No need to manually hide "Deleting PDF..." here, as the save process's "Saving..." notice will replace it.
  });

  dom.ctxContactNotRequiredBtn?.addEventListener("click", async () => {
    if (!activeContextTripKey) return;
    const capturedTripKey = activeContextTripKey;
    closeTripContextMenu();
    if (dom.tripKey?.value !== capturedTripKey) {
      if (!confirmDiscardIfDirty("You have unsaved changes. Loading this trip will discard them. Continue?")) return;
      await openTripForEdit(capturedTripKey);
    }
    $("contactStatus").value = "Not Required";
    state.tripFormDirty = true;
    dom.saveBtn.click();
  });

  dom.ctxItineraryNotRequiredBtn?.addEventListener("click", async () => {
    if (!activeContextTripKey) return;
    const capturedTripKey = activeContextTripKey;
    closeTripContextMenu();
    if (dom.tripKey?.value !== capturedTripKey) {
      if (!confirmDiscardIfDirty("You have unsaved changes. Loading this trip will discard them. Continue?")) return;
      await openTripForEdit(capturedTripKey);
    }
    $("itineraryStatus").value = "Not Required";
    state.tripFormDirty = true;
    dom.saveBtn.click();
  });

  dom.itineraryPdfInput?.addEventListener("change", async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    const tripKey = state.pendingItineraryTripKey;

    if (!file || !tripKey) {
      state.pendingItineraryTripKey = null;
      return;
    }

    if (file.type !== "application/pdf") {
      toast("Please select a PDF file.", "danger", 2500);
      state.pendingItineraryTripKey = null;
      input.value = "";
      return;
    }

    try {
      // Build URL with action + tripKey in query string
      const url = new URL(CONFIG.ENDPOINT);
      url.searchParams.set("action", "uploadItineraryPdf");
      url.searchParams.set("tripKey", tripKey);

      toastShow("Uploading PDF...", "loading", { indeterminate: true, source: "pdf-upload" });

      // Read file as Base64 Data URL
      const reader = new FileReader();
      const base64Url = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Prepare JSON payload
      const payload = {
        filename: file.name,
        mimeType: file.type,
        base64Data: base64Url,
      };

      const resp = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          // Sending as text/plain prevents the browser from sending a CORS preflight OPTIONS request
          "Content-Type": "text/plain;charset=utf-8",
        },
        mode: "cors",
        credentials: "omit",
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json = await resp.json();
      if (!json.ok) {
        throw new Error(json.error || "Upload failed");
      }

      const pdfUrl = json.itineraryPdfUrl || json.url;
      if (!pdfUrl) {
        throw new Error("No URL returned from server");
      }

      const trip = state.tripByKey?.[tripKey];
      if (trip) {
        trip.itineraryPdfUrl = pdfUrl;
        trip.itineraryStatus = "Received";
        scheduleAgendaReflow();
      }

      toastHide(0, { source: "pdf-upload" });
      toast("PDF Uploaded ✓", "success", 1800);
    } catch (err) {
      console.error(err);
      toastHide(0, { source: "pdf-upload" });
      toast(`Could not upload itinerary PDF: ${err.message || err}`, "danger", 3500);
    } finally {
      state.pendingItineraryTripKey = null;
      input.value = "";
      closeTripContextMenu();
    }
  });

  // NEW TRIP BUTTON (Cell Context Menu)
  dom.ctxNewTripBtn?.addEventListener("click", () => {
    if (activeCellContext) {
      const { busId, dateStr } = activeCellContext;
      closeCellContextMenu();

      // Switch to Trip Editor
      // dom.newBtn.click() calls setModeNew() which calls setSidePanelMode("trip")
      // But we call it explicit just in case
      setSidePanelMode("trip");

      // Trigger "New Trip" logic (resets form)
      dom.newBtn.click();

      // Force 1 bus needed -> triggers row visibility
      if (dom.busesNeeded) {
        dom.busesNeeded.value = "1";
        dom.busesNeeded.dispatchEvent(new Event("input"));
        dom.busesNeeded.dispatchEvent(new Event("change"));
      }

      // Allow a microtab for DOM to update bus rows? Usually synchronous if no animation delay blocks it.
      // But let's try setting it immediately.

      // Target the dynamic "bus1" select
      const bus1Input = document.querySelector('select[name="bus1"]');
      if (bus1Input) {
        bus1Input.value = busId;
        bus1Input.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        console.warn("Could not find select[name='bus1']");
      }

      // Trip Date
      const tripDateInput = document.getElementById("tripDate");
      if (tripDateInput) {
        tripDateInput.value = dateStr;
        tripDateInput.dispatchEvent(new Event("change")); // To auto-fill arrival
      }

      // Ensure status fields default to Pending (bus1 and tripDate are set above)
      maybeApplyPendingDefaults();
    }
  });

  containers.forEach((container) => {
    // 1. Context Menu (Right Click) - Desktop & Mobile Long Press
    container.addEventListener("contextmenu", (e) => handleScheduleInteraction(e, true));

    // 2. Click (Tap) - Mobile Only and specific icon clicks
    container.addEventListener("click", (e) => {
      // Always allow driver contact icon clicks (desktop and mobile)
      const driverContactIcon = e.target.closest('[data-action="showDriverContact"]');
      if (driverContactIcon) {
        e.stopPropagation();
        const tripBar = driverContactIcon.closest(".schedule-grid__trip-bar");
        if (tripBar && tripBar.dataset.tripkey) {
          openDriverContactModal(tripBar.dataset.tripkey);
        }
        return;
      }

        // Selection (all devices)
      const clickedBar = e.target.closest(".schedule-grid__trip-bar");
      selectTripBar(clickedBar || null);

      // Quick-edit popover on desktop left-click
      if (!isMobileOnly() && clickedBar) {
        const tripKey = clickedBar.dataset.tripkey;
        if (tripKey) {
          if (quickEditTripKey === tripKey) {
            closeQuickEditPopover();
          } else {
            showQuickEditPopover(tripKey, clickedBar);
          }
        }
        return;
      }

      // Only handle Taps on touch devices for the general context menu
      if (isMobileOnly()) {
        handleScheduleInteraction(e, false);
      }
    });

    // Keep Enter/Space for accessibility (default to Edit for now, or open menu?)
    // Let's act like left click -> Open Menu
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const bar = e.target.closest(".schedule-grid__trip-bar");
      if (!bar) return;

      e.preventDefault();
      const tripKey = bar.dataset.tripkey;
      if (!tripKey) return;

      // Calculate center of bar for position
      const rect = bar.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2 + window.scrollY;

      showTripContextMenu(x, y, tripKey);
    });
  });
}

// ======================================================
// 35) PREFS
// ======================================================
function loadPrefs() {
  try {
    state.weekStartsOnMonday = localStorage.getItem("weekStartMonday") === "1";
  } catch {
    state.weekStartsOnMonday = false;
  }
}

// ======================================================
// 35.5) GLASS SELECT DROPDOWNS (trip editor status fields + bus grid)
// ======================================================
function wrapSelectInGlassDropdown(sel, opts) {
  const { statusId, rebuildMenuOnOpen, cellClass, searchable } = opts || {};
  const statusIds = new Set([
    "itineraryStatus",
    "contactStatus",
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
  ]);

  const wrapper = document.createElement("div");
  wrapper.className = "dropdown select-dropdown" + (cellClass ? " " + cellClass : "");
  wrapper.dataset.selectName = sel.name || "";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "dropdown__menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  // Mutually Exclusive: Close when any other floating menu opens
  window.addEventListener("close-all-floating-menus", closeMenu);

  function getSelectedText() {
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent.trim() : "";
  }

  function getBusDriverRoleIcon(name) {
    if (name.includes("_driver1Status")) return "person";
    if (name.includes("_driver2Status")) return "person";
    if (name.includes("_driver3Status") || name.includes("_driver4Status")) return "emergency_home";
    return "";
  }

  function getBusDriverNameIcon(name) {
    if (!name) return "";
    if (/_driver1$/.test(name)) return "person";
    if (/_driver2$/.test(name)) return "group";
    if (/_driver3$/.test(name) || /_driver4$/.test(name)) return "emergency_home";
    return "";
  }

  function getSelectedIcon() {
    const opt = sel.options[sel.selectedIndex];
    if (opt) {
      // Bus grid driver status selects: check slot name first for role icon
      if (sel.name) {
        const roleIcon = getBusDriverRoleIcon(sel.name);
        if (roleIcon) return roleIcon;
      }
      // All other status fields: use statusId-based icon
      if (statusId && statusIds.has(statusId)) {
        return getStatusIcon(statusId, opt.value);
      }
    }
    return "";
  }

  function getStatusColorClass(id, v) {
    if (!v) return "";
    let addClass = "";
    if (id === "driverStatus") {
      if (v === "pending") addClass = "status-pending";
      else if (v === "assigned") addClass = "status-assigned";
      else if (v === "confirmed") addClass = "status-ok";
      else addClass = "status-ok";
    } else if (id === "paymentStatus") {
      if (v === "pending quote") addClass = "status-pending";
      else if (v === "quoted") addClass = "status-assigned";
      else addClass = "status-ok";
    } else if (id === "invoiceStatus") {
      if (v === "pending invoice") addClass = "status-pending";
      else if (v === "invoiced") addClass = "status-assigned";
      else if (v === "deposit received") addClass = "status-blue";
      else if (v === "paid in full") addClass = "status-ok";
    } else {
      addClass = v === "pending" ? "status-pending" : "status-ok";
    }
    return addClass;
  }

  function updateTrigger() {
    trigger.innerHTML = "";
    const v = (sel.value ?? "").trim();

    const roleIcon = getBusDriverNameIcon(sel.name);
    if (roleIcon) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "material-symbols-outlined driver-role-icon";
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.textContent = roleIcon;
      trigger.appendChild(iconSpan);
    }

    const textSpan = document.createElement("span");
    textSpan.style.flex = "1";
    textSpan.style.textAlign = "left";
    textSpan.textContent = getSelectedText();
    trigger.appendChild(textSpan);

    if (statusId && statusIds.has(statusId)) updateStatusSelect(sel);
    trigger.classList.toggle("is-empty", !v || v === "None");
  }

  function populateMenu() {
    menu.innerHTML = "";

    if (searchable) {
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "dropdown__search";
      searchInput.placeholder = "Search…";
      searchInput.setAttribute("aria-label", "Search options");
      // Prevent clicks inside input from closing the menu
      searchInput.addEventListener("click", (e) => e.stopPropagation());
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const first = menu.querySelector(".dropdown__item:not([hidden])");
          if (first) first.click();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const first = menu.querySelector(".dropdown__item:not([hidden])");
          if (first) first.focus();
        } else if (e.key === "Escape") {
          closeMenu();
        }
      });
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        menu.querySelectorAll(".dropdown__item").forEach((btn) => {
          btn.hidden = q !== "" && !btn.textContent.trim().toLowerCase().includes(q);
        });
      });
      menu.appendChild(searchInput);
    }

    Array.from(sel.options).forEach((opt) => {
      if (opt.disabled && !String(opt.value).trim()) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dropdown__item";
      btn.setAttribute("role", "option");
      btn.dataset.value = opt.value;

      const v = String(opt.value).trim();
      const lcValue = v.toLowerCase();
      // Add icon if applicable to the dropdown options
      const isStatusField =
        (statusId && statusIds.has(statusId)) || (sel.name && sel.name.endsWith("Status"));
      if (isStatusField && v) {
        // Apply status color class to button (icons removed, but colors remain via class)
        const colorClass = getStatusColorClass(
          statusId || "driverStatus",
          lcValue,
        );
        if (colorClass) {
          btn.classList.add(colorClass);
        }
      }

      const itemTextSpan = document.createElement("span");
      itemTextSpan.style.flex = "1";
      itemTextSpan.textContent = opt.textContent.trim();
      btn.appendChild(itemTextSpan);

      // Warn if this driver is already booked on another overlapping trip
      const isPrimaryConflict = v && v !== "None" && state.driverConflicts?.has(v);
      const isReliefConflict = v && v !== "None" && state.driverReliefConflicts?.has(v);
      if (isPrimaryConflict || isReliefConflict) {
        btn.classList.add("driver-conflict-item");
        const warnIcon = document.createElement("span");
        warnIcon.className = "material-symbols-outlined dropdown__conflict-icon";
        warnIcon.textContent = isPrimaryConflict ? "person" : "emergency_home";
        warnIcon.title = isPrimaryConflict
          ? `${v} is already assigned as a driver on these dates`
          : `${v} is already assigned as a relief driver on these dates`;
        btn.appendChild(warnIcon);
      }

      btn.addEventListener("click", () => {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        updateTrigger();
        closeMenu();

        // If this is part of the bus grid, sync the empty states (e.g., hide/show status)
        if (sel.closest(".bus-assign")) {
          syncBusSelectEmptyState();
        }
      });
      menu.appendChild(btn);
    });
  }

  function closeMenu() {
    menu.hidden = true;
    menu.classList.remove("dropdown__menu--up");
    trigger.setAttribute("aria-expanded", "false");
    trigger.classList.remove("is-open");
    document.removeEventListener("click", outsideClick);
    document.removeEventListener("keydown", handleEscape);
  }

  function handleEscape(e) {
    if (e.key === "Escape") closeMenu();
  }

  function outsideClick(e) {
    if (!wrapper.contains(e.target)) closeMenu();
  }

  sel.parentNode.insertBefore(wrapper, sel);
  wrapper.appendChild(sel);
  sel.classList.add("select-native");

  // Portal: attach menu to body so overflow:hidden on ancestor cards can't clip it
  menu.style.position = "fixed";
  menu.style.zIndex = "10500";
  menu.style.insetInlineEnd = "auto"; // reset CSS default that would anchor to viewport right edge
  document.body.appendChild(menu);

  function positionMenu() {
    const triggerRect = trigger.getBoundingClientRect();
    const gap = 4;
    const cssMaxH = 300; // must match dropdown.css max-height
    const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
    const spaceAbove = triggerRect.top - gap;
    // Open upward when there's meaningfully more room above than below
    const openUpward = spaceAbove > spaceBelow && spaceAbove > 80;
    menu.classList.toggle("dropdown__menu--up", openUpward);
    menu.style.left = triggerRect.left + "px";
    menu.style.minWidth = triggerRect.width + "px";
    if (openUpward) {
      menu.style.top = "auto";
      menu.style.bottom = (window.innerHeight - triggerRect.top + gap) + "px";
      menu.style.maxHeight = Math.min(cssMaxH, spaceAbove) + "px";
    } else {
      menu.style.top = (triggerRect.bottom + gap) + "px";
      menu.style.bottom = "auto";
      menu.style.maxHeight = Math.min(cssMaxH, spaceBelow) + "px";
    }
  }

  if (!rebuildMenuOnOpen) populateMenu();

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      closeAllFloatingMenus();
      if (rebuildMenuOnOpen) populateMenu();
      positionMenu();
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      trigger.classList.add("is-open");
      document.addEventListener("click", outsideClick);
      document.addEventListener("keydown", handleEscape);
      if (searchable) {
        const searchInput = menu.querySelector(".dropdown__search");
        if (searchInput) {
          searchInput.value = "";
          menu.querySelectorAll(".dropdown__item").forEach((btn) => (btn.hidden = false));
          requestAnimationFrame(() => searchInput.focus());
        }
      }
    } else {
      closeMenu();
    }
  });

  wrapper.appendChild(trigger);

  sel.addEventListener("change", updateTrigger);
  updateTrigger();
}

function initGlassSelects() {
  const statusIds = new Set([
    "itineraryStatus",
    "contactStatus",
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
  ]);
  const ids = [
    "busesNeeded",
    "tripColor",
    "itineraryStatus",
    "contactStatus",
    "paymentStatus",
    "driverStatus",
    "invoiceStatus",
    "quoteLDRate",
    "quoteSeasonalRate",
    "quoteDiscountType",
    "quoteReliefDriver",
    "quoteCCFeeToggle",
    "quoteHalfDay",
    "quoteTotalDaysInput",
  ];
  ids.forEach((id) => {
    const sel = $(id);
    if (!sel || sel.tagName !== "SELECT") return;
    wrapSelectInGlassDropdown(sel, { statusId: id });
  });

  // Bus assignment and driver selects (dynamic options, rebuild menu on open)
  dom.busGrid?.querySelectorAll("select").forEach((sel) => {
    const isStatus = sel.name && sel.name.endsWith("Status");
    wrapSelectInGlassDropdown(sel, {
      rebuildMenuOnOpen: true,
      cellClass: isStatus ? "bus-assign__status-cell" : "bus-assign__cell",
      statusId: isStatus ? "driverStatus" : null,
      searchable: !isStatus,
    });
  });
}

// ======================================================
// 35B) QUOTE CALCULATOR LOGIC — moved to quoteCalculator.js
// ======================================================

// ======================================================
// 36) EVENTS
// ======================================================
function wireEvents() {
  initGlassSelects();

  // Re-apply bus row visibility after wrapping (initGlassSelects wraps selects;
  // updateBusRowVisibility ran in buildBusRowsOnce before wrapping, so wrappers never got is-hidden)
  updateBusRowVisibility();
  syncBusPanelState();

  // Ensure status fields update to 'Pending' when a bus is selected after date is picked
  // (fix for manual entry case)
  const observeBusGrid = () => {
    // Listen for changes on any select in the busGrid
    dom.busGrid.addEventListener("change", (e) => {
      if (e.target && e.target.tagName === "SELECT") {
        maybeApplyPendingDefaults();
      }
    });
  };
  // Call once on load
  observeBusGrid();
  ["paymentStatus", "driverStatus", "invoiceStatus"].forEach(
    (id) => {
      const el = $(id);
      updateStatusSelect(el);
      el.addEventListener("change", () => updateStatusSelect(el));
    },
  );

  // Auto-Refresh
  setInterval(() => {
    if (navigator.onLine && !document.hidden) {
      refreshWeekData({ silent: true });
      if (state.cardPanelAssignments?.todo) syncChecklistFromServer(ymd(new Date()));
    }
  }, CONFIG.AUTO_REFRESH_INTERVAL);

  dom.todayBtn?.addEventListener("click", () => {
    if (!confirmDiscardIfDirty()) return;
    state.currentDate = startOfWeek(new Date());
    updateWeekDates();
  });
  dom.prevWeekBtn.addEventListener("click", () => changeWeek(-1));
  dom.nextWeekBtn.addEventListener("click", () => changeWeek(1));

  dom.agendaLeftBtn?.addEventListener("click", () => {
    if (dom.weekPicker) {
      dom.weekPicker.focus();
      if (dom.weekPicker.showPicker) dom.weekPicker.showPicker();
    }
  });
  dom.weekPicker?.addEventListener("change", (e) => {
    if (!confirmDiscardIfDirty()) {
      e.target.value = toLocalDateInputValue(state.currentDate);
      return;
    }
    const d = parseYMD(e.target.value);
    if (d) {
      state.currentDate = startOfWeek(d);
      updateWeekDates();
    }
  });

  dom.tripInputBtn.addEventListener("click", () => {
    if (isMobileOnly()) return;
    toggleCard("trip");
  });

  dom.driversBtn.addEventListener("click", () => {
    if (isMobileOnly()) return;
    toggleCard("drivers");
  });

  dom.quoteBtn.addEventListener("click", () => {
    if (isMobileOnly()) return;
    toggleCard("quote");
  });

  // Close-card buttons (×) inside card headers
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".btn-close-card");
    if (!closeBtn) return;
    const cardType = closeBtn.dataset.card;
    if (!cardType) return;

    hideCard(cardType);
  });

  dom.driverWeekBody?.addEventListener("click", (e) => {
    const scheduleIcon = e.target.closest('[data-action="showDriverWeekSchedule"]');
    if (scheduleIcon) {
      openDriverWeekScheduleModal(scheduleIcon.dataset.driverName);
      return;
    }
    const nameCell = e.target.closest(".driver-week__name-cell");
    if (!nameCell) return;
    selectDriverBars(nameCell.dataset.driverName);
  });

  dom.driverWeekBody.addEventListener("mousedown", (e) => {
    const td = e.target.closest("td");
    if (!td || !td.dataset.driver || !td.dataset.date) return;
    if (td.classList.contains("driver-week__cell--on")) return;

    state.dragSelection.active = true;
    state.dragSelection.driver = td.dataset.driver;
    state.dragSelection.mode = td.classList.contains("driver-week__cell--unavailable")
      ? "remove"
      : "add";
    state.dragSelection.dates.clear();

    // Toggle first cell immediately
    toggleDragCell(td);
  });

  dom.driverWeekBody.addEventListener(
    "mouseover",
    (e) => {
      if (!state.dragSelection.active) return;
      const td = e.target.closest("td");
      if (!td || td.dataset.driver !== state.dragSelection.driver || !td.dataset.date) return;
      if (td.classList.contains("driver-week__cell--on")) return;

      // Don't re-toggle the same cell in one drag pass
      if (state.dragSelection.dates.has(td.dataset.date)) return;

      toggleDragCell(td);
    },
    true,
  );

  window.addEventListener("mouseup", async () => {
    if (!state.dragSelection.active) return;

    const { driver, mode, dates } = state.dragSelection;
    state.dragSelection.active = false;

    if (dates.size === 0) return;

    const dateList = Array.from(dates);
    const action = mode === "add" ? "unavailable" : "available";
    const dayCount = dateList.length;
    const dayWord = dayCount === 1 ? "day" : "days";

    // Confirmation dialog
    if (!confirm(`Mark ${driver} as ${action} for ${dayCount} ${dayWord}?`)) {
      // User cancelled - rollback UI
      refreshWeekData({ silent: true });
      return;
    }

    toastShow(mode === "add" ? "Marking as unavailable..." : "Marking as available...", "loading");

    try {
      const resp = await api.batchUnavailability(driver, dateList, mode);
      if (resp.ok) {
        toast(
          mode === "add" ? "Marked as unavailable ✓" : "Marked as available ✓",
          "success",
          1500,
        );
      } else {
        toast("Failed to update status", "danger", 2500);
        refreshWeekData({ silent: true }); // Rollback UI
      }
    } catch (err) {
      console.error(err);
      toast("Error updating status", "danger", 2500);
      refreshWeekData({ silent: true }); // Rollback UI
    }
  });

  function toggleDragCell(td) {
    const date = td.dataset.date;
    const driver = td.dataset.driver;
    const mode = state.dragSelection.mode;

    if (mode === "add") {
      td.className = "driver-week__cell--unavailable";
      (state.unavailabilityByDriver[driver] ||= {})[date] = true;
    } else {
      td.className = "driver-week__cell--off";
      if (state.unavailabilityByDriver[driver]) {
        delete state.unavailabilityByDriver[driver][date];
      }
    }
    state.dragSelection.dates.add(date);
  }

  dom.notesBtn.addEventListener("click", () => toggleCard("notes"));

  dom.todoBtn?.addEventListener("click", () => toggleCard("todo"));

  dom.logBtn?.addEventListener("click", () => {
    toggleCard("log");
    if (getCardPanel("log")) fetchActivityLog(logActiveTripKey).then(renderLogList).catch(console.error);
  });

  dom.logRefreshBtn?.addEventListener("click", () => {
    fetchActivityLog(logActiveTripKey).then(renderLogList).catch(console.error);
  });

  dom.logClearFilterBtn?.addEventListener("click", () => setLogFilter(null));

  // Track notes dirty state
  dom.scheduleNotes?.addEventListener("input", () => {
    state.notesDirty = dom.scheduleNotes.value !== state.savedNotesValue;
  });

  dom.saveNotesBtn?.addEventListener("click", async () => {
    const notes = dom.scheduleNotes.value;

    dom.saveNotesBtn.disabled = true;
    toastShow("Saving notes...", "loading");

    try {
      const res = await api.saveWeekNote(notes);
      if (res.ok) {
        state.savedNotesValue = notes;
        state.notesDirty = false;
        clearCacheForCurrentView();
        refreshWeekData({ silent: true });
        toast("Notes saved ✓", "success", 1500);
      } else {
        toast("Failed to save notes", "danger", 2500);
      }
    } catch (e) {
      console.error(e);
      toast("Error saving notes", "danger", 2500);
    } finally {
      dom.saveNotesBtn.disabled = false;
    }
  });

  // Waiting List Toggle
  const wlVisible = false; // Always start hidden (User Request)

  function setWaitingListVisible(visible) {
    if (dom.waitingBody) {
      dom.waitingBody.hidden = !visible;
      dom.waitingBody.classList.toggle("is-hidden", !visible);
    }
    if (dom.waitingListBtn) {
      dom.waitingListBtn.setAttribute("aria-pressed", String(visible));
      // Optional: change icon style/color if active
      dom.waitingListBtn.classList.toggle("active", visible);
    }
    localStorage.setItem("waitingListVisible", visible ? "1" : "0");
  }

  // Init
  setWaitingListVisible(wlVisible);

  dom.waitingListBtn?.addEventListener("click", () => {
    const isVisible = !dom.waitingBody.classList.contains("is-hidden");
    setWaitingListVisible(!isVisible);
  });

  // Today Highlight Toggle
  let todayHighlightActive = false;

  function applyTodayHighlight() {
    const todayYMD = ymd(new Date());
    const todayKeys = new Set(
      (state.trips || [])
        .filter((t) => t.tripColor !== "Out of Service" && t.departureDate === todayYMD)
        .map((t) => String(t.tripKey))
    );
    document.querySelectorAll(".schedule-grid__trip-bar").forEach((bar) => {
      bar.classList.toggle("today-highlighted", todayKeys.has(bar.dataset.tripkey));
    });
  }

  function setTodayHighlight(active) {
    todayHighlightActive = active;
    if (active) {
      applyTodayHighlight();
    } else {
      document.querySelectorAll(".schedule-grid__trip-bar.today-highlighted")
        .forEach((bar) => bar.classList.remove("today-highlighted"));
    }
    dom.todayHighlightBtn?.setAttribute("aria-pressed", String(active));
  }

  dom.todayHighlightBtn?.addEventListener("click", () => {
    setTodayHighlight(!todayHighlightActive);
  });

  syncWeekStartUI();
  // applyWeekStart moved to global scope
  // Old buttons (weekStartSunBtn) removed from DOM

  dom.itineraryModal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeItineraryModal();
  });
  document.addEventListener("keydown", (e) => {
    if (!dom.itineraryModal.hidden && e.key === "Escape") closeItineraryModal();
  });
  dom.itinerarySaveBtn.addEventListener("click", closeItineraryModal);
  dom.itineraryCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(dom.itineraryModalField.value || "");
      toast("Copied ✓", "success", 900);
    } catch {
      toast("Copy failed", "danger", 1200);
    }
  });

  /* agendaBody click listener removed - refactoring to use delegation in wireDelegatedBarEvents */
  dom.busGrid.addEventListener("change", (e) => {
    const sel = e.target;
    if (!sel || sel.tagName !== "SELECT") return;
    syncBusSelectEmptyState();

    // Sync paired status when a driver slot changes
    if (sel.name && /^bus\d+_driver\d+$/.test(sel.name)) {
      const statusSel = dom.busGrid.querySelector(`select[name="${sel.name}Status"]`);
      if (statusSel) {
        if (!sel.value || sel.value === "None") {
          statusSel.value = "";
        } else if (!statusSel.value) {
          statusSel.value = "Pending";
        }
        statusSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  dom.busesNeeded.addEventListener("change", () => {
    updateBusRowVisibility();
    syncBusPanelState();
    maybeApplyPendingDefaults();
  });

  $("tripDate").addEventListener("change", () => {
    const dep = $("tripDate").value;
    const arrival = $("arrivalDate");

    // Validate year is reasonable (e.g. >= 2000) before auto-filling
    const year = parseInt(dep.split("-")[0], 10);
    const isValidYear = !isNaN(year) && year >= 2000;

    if (isValidYear && dep && arrival && !arrival.value) {
      arrival.value = dep;
    }
    arrival.dispatchEvent(new Event("change", { bubbles: true }));
    maybeApplyPendingDefaults();
    checkDriverDoubleBookings();
  });

  $("arrivalDate").addEventListener("change", () => {
    checkDriverDoubleBookings();
  });

  $("quotedPrice")?.addEventListener("blur", () => {
    const el = $("quotedPrice");
    const v = el.value.trim();
    if (v && !v.startsWith("$")) el.value = "$" + v;
  });

  dom.hiddenIframe.addEventListener("load", () => {
    if (!state.pendingWrite) return;
    toastProgress(60, "Server responded… verifying… 60%");
    clearVerifyFallback();
    verifyWriteResult();
  });

  dom.newBtn.addEventListener("click", () => {
    // Warn if clearing while there are unsaved trip changes
    if (state.tripFormDirty) {
      const discard = confirm("You have unsaved trip changes. Discard them?");
      if (!discard) return;
    }

    clearTripInfoCardForNextTrip();
    toast("Ready", "info", 900);
  });
  // ✅ IMPORTANT: Always POST to the same Apps Script deployment as GET
  dom.tripForm.action = CONFIG.ENDPOINT;

  dom.deleteBtn.addEventListener("click", () => {
    if (!dom.tripKey.value) return;
    if (!confirm("Delete this trip?")) return;

    dom.action.value = "delete";
    dom.saveBtn.disabled = true;

    // OPTIMISTIC UPDATE: Remove locally immediately
    const key = String(dom.tripKey.value);

    // Backup for rollback
    const originalTrips = [...state.trips];
    const originalTripByKey = { ...state.tripByKey };
    const originalAssignments = { ...state.assignmentsByTripKey };

    // 1. Remove from state
    state.trips = state.trips.filter((t) => String(t.tripKey) !== key);
    delete state.tripByKey[key];
    delete state.assignmentsByTripKey[key];

    // 2. Invalidate cache for current view
    clearCacheForCurrentView();

    // 3. Re-render UI
    scheduleAgendaReflow();
    updateDriverWeekIfVisible();

    // 4. Feedback & Modal Close (don't reset form yet so it can submit)
    closeTripDetailsModal();
    toast("Trip deleted ✓", "success", 1500);

    // OPTIMISTIC UI: Clear form for next entry
    setTimeout(() => {
      resetTripFormUI();
    }, 100);

    state.pendingWrite = {
      action: "delete",
      tripKey: key,
      originalTrips,
      originalTripByKey,
      originalAssignments,
    };

    startVerifyFallback();

    // Explicitly set these for the native submission
    dom.action.value = "delete";
    dom.tripKey.value = key;

    dom.tripForm.submit();
  });

  dom.tripForm.addEventListener("submit", (e) => {
    // If we're deleting, don't preventDefault (in case form.submit() triggers this)
    if (dom.action.value === "delete") return;

    e.preventDefault();

    // Run native HTML5 constraint validation (respects `required`, etc.)
    // If any field is invalid, the browser will show messages and we skip saving.
    if (!dom.tripForm.reportValidity()) {
      return;
    }

    if (dom.saveBtn.disabled) return;
    if (dom.action.value === "delete") return;

    const dep = $("tripDate").value;
    const arr = $("arrivalDate").value;
    if (dep && !arr) {
      $("arrivalDate").value = dep;
      $("arrivalDate").dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Basic consistency check: arrival date should not be before departure date.
    const depDate = $("tripDate").value;
    const arrDate = $("arrivalDate").value;
    if (depDate && arrDate && arrDate < depDate) {
      toast("Arrival date can’t be before departure date.", "danger", 2500);
      $("arrivalDate").focus();
      return;
    }

    if (dom.action.value === "create" && !dom.tripKey.value) dom.tripKey.value = safeUUID();

    $("departureTime").value = normalizeTime($("departureTime").value);
    $("spotTime").value = normalizeTime($("spotTime").value);
    $("arrivalTime").value = normalizeTime($("arrivalTime").value);

    // OPTIMISTIC UPDATE: Save locally immediately
    const action = dom.action.value;
    const key = String(dom.tripKey.value || "");

    // Backup for rollback
    const originalTrips = [...state.trips];
    const originalTripByKey = { ...state.tripByKey };
    const originalAssignments = { ...state.assignmentsByTripKey };

    // Construct assignments from state.busRows for instant rendering
    const numBuses = parseInt(dom.busesNeeded.value) || 0;
    const optimisticAssignments = [];
    let hasAssignedBus = false;
    for (let i = 0; i < numBuses; i++) {
      const row = state.busRows[i];
      if (row) {
        const busId = String(row.busSel.value || "").trim();
        const driver1 = String(row.d1Sel.value || "").trim();
        const driver2 = String(row.d2Sel.value || "").trim();
        const driver3 = String(row.d3Sel.value || "").trim();
        const driver4 = String(row.d4Sel.value || "").trim();

        if (busId && busId !== "None") hasAssignedBus = true;

        const d1Status = String(row.d1StatusSel?.value || "Pending").trim();
        const d2Status = String(row.d2StatusSel?.value || "Pending").trim();
        const d3Status = String(row.d3StatusSel?.value || "Pending").trim();
        const d4Status = String(row.d4StatusSel?.value || "Pending").trim();

        optimisticAssignments.push({
          busId,
          busNumber: i + 1,
          driver1,
          driver2,
          driver3,
          driver4,
          driver1Status: driver1 && driver1 !== "None" ? d1Status : "",
          driver2Status: driver2 && driver2 !== "None" ? d2Status : "",
          driver3Status: driver3 && driver3 !== "None" ? d3Status : "",
          driver4Status: driver4 && driver4 !== "None" ? d4Status : "",
          driver1Pay: row.d1Pay?.value || "",
          driver2Pay: row.d2Pay?.value || "",
          driver3Pay: row.d3Pay?.value || "",
          driver4Pay: row.d4Pay?.value || "",
        });
      }
    }

    // Guard: if buses are needed, require at least one actual bus assignment.
    if (numBuses > 0 && !hasAssignedBus) {
      toast("Select at least one bus for this trip.", "danger", 2500);
      // Focus first bus dropdown trigger (visible control; native select is hidden)
      const firstRow = state.busRows[0];
      const busTrigger = firstRow?.busSel
        ?.closest?.(".select-dropdown")
        ?.querySelector?.(".select-trigger");
      if (busTrigger && !firstRow?.busSel?.disabled) busTrigger.focus();
      return;
    }

    // Derive trip-level driverStatus from per-driver status (for backend compatibility)
    const driverStatuses = [];
    for (let i = 0; i < numBuses; i++) {
      const row = state.busRows[i];
      if (!row) continue;
      const busId = String(row.busSel.value || "").trim();
      if (!busId || busId === "None") continue;
      const d1 = String(row.d1Sel.value || "").trim();
      const d2 = String(row.d2Sel.value || "").trim();
      const d3 = String(row.d3Sel.value || "").trim();
      const d4 = String(row.d4Sel.value || "").trim();
      if (d1 && d1 !== "None")
        driverStatuses.push(String(row.d1StatusSel?.value || "Pending").trim());
      if (d2 && d2 !== "None")
        driverStatuses.push(String(row.d2StatusSel?.value || "Pending").trim());
      if (d3 && d3 !== "None")
        driverStatuses.push(String(row.d3StatusSel?.value || "Pending").trim());
      if (d4 && d4 !== "None")
        driverStatuses.push(String(row.d4StatusSel?.value || "Pending").trim());
    }
    const statusOrder = { Pending: 0, Assigned: 1, Confirmed: 2 };
    const worst = driverStatuses.length
      ? driverStatuses.reduce((a, b) => ((statusOrder[a] ?? 0) <= (statusOrder[b] ?? 0) ? a : b))
      : "Pending";
    $("driverStatus").value = worst;
    $("driverStatus").dispatchEvent(new Event("change", { bubbles: true }));

    // Auto-derive contact status from contact fields (preserve "Not Required" if already set)
    const envelopeContact = String($("envelopeTripContact")?.value || "").trim();
    const envelopePhone = String($("envelopeTripPhone")?.value || "").trim();
    let contactStatusValue = $("contactStatus").value;
    if (contactStatusValue !== "Not Required") {
      contactStatusValue = (envelopeContact && envelopePhone) ? "Received" : "Pending";
      $("contactStatus").value = contactStatusValue;
    }

    // Construct trip from form
    const existingTrip = state.tripByKey[key] || null;
    const optimisticTrip = {
      tripKey: key,
      destination: $("destination").value,
      customer: $("customer").value,
      contactName: $("contactName").value,
      phone: $("phone").value,
      departureDate: $("tripDate").value,
      arrivalDate: $("arrivalDate").value,
      departureTime: $("departureTime").value,
      spotTime: $("spotTime").value,
      arrivalTime: $("arrivalTime").value,
      itineraryStatus: (() => {
        const cur = $("itineraryStatus").value;
        if (cur === "Not Required") return cur;
        const hasPdf = !!(existingTrip?.itineraryPdfUrl);
        const hasContent = !!(dom.itineraryField?.value?.trim());
        const derived = (hasPdf || hasContent) ? "Received" : "Pending";
        $("itineraryStatus").value = derived;
        return derived;
      })(),
      contactStatus: contactStatusValue,
      paymentStatus: $("paymentStatus").value,
      driverStatus: $("driverStatus").value,
      invoiceStatus: (() => {
        const sel = $("invoiceStatus");
        if ($("invoiceNumber").value.trim() && sel?.value === "Pending Invoice") {
          sel.value = "Invoiced";
        }
        return sel?.value || "";
      })(),
      invoiceNumber: $("invoiceNumber").value,
      tripColor: $("tripColor").value,
      busesNeeded: $("busesNeeded").value,
      itinerary: dom.itineraryField.value,
      // Preserve attached PDF URL during optimistic save/update re-renders.
      itineraryPdfUrl: existingTrip?.itineraryPdfUrl || "",
      paymentType: $("paymentType")?.value || "",
      estimatedMileage: $("estimatedMileage")?.value || "",
      drivingHours: $("drivingHours")?.value || "",
      onDutyHours:  $("onDutyHours")?.value  || "",
      quotedPrice: $("quotedPrice")?.value || "",
      tripMiles: $("tripMiles")?.value || "",
      datePaid: $("datePaid")?.value || "",
      notes: $("notes").value,
      comments: $("comments").value,
      // Envelope-only fields (do not affect quote contact/phone/notes)
      envelopePickup: $("envelopePickup")?.value || "",
      envelopeTripContact: $("envelopeTripContact")?.value || "",
      envelopeTripPhone: $("envelopeTripPhone")?.value || "",
      envelopeTripNotes: $("envelopeTripNotes")?.value || "",
      req56Pass: $("req56Pass")?.getAttribute("aria-pressed") === "true",
      reqSleeper: $("reqSleeper")?.getAttribute("aria-pressed") === "true",
      reqLift: $("reqLift")?.getAttribute("aria-pressed") === "true",
      reqRelief: $("reqRelief")?.getAttribute("aria-pressed") === "true",
      reqRelief2: $("reqRelief2")?.getAttribute("aria-pressed") === "true",
      reqCoDriver: $("reqCoDriver")?.getAttribute("aria-pressed") === "true",
      reqHotel: $("reqHotel")?.getAttribute("aria-pressed") === "true",
      reqFuelCard: $("reqFuelCard")?.getAttribute("aria-pressed") === "true",
      reqWifi: $("reqWifi")?.getAttribute("aria-pressed") === "true",
      driverInfoSent: $("driverInfoSent")?.getAttribute("aria-pressed") === "true",
      tripReminderSent: $("tripReminderSent")?.getAttribute("aria-pressed") === "true",
      tripReviewed: $("tripReviewed")?.getAttribute("aria-pressed") === "true",
    };

    // Proactive Conflict Check
    const conflict = checkPotentialConflicts(optimisticTrip, optimisticAssignments);
    if (conflict) {
      const msg = `Schedule Overlap Detected!\n\nBus ${conflict.busId} is already assigned to "${conflict.otherTrip}" on ${conflict.dateRange}.\n\nDo you want to save anyway?`;
      if (!confirm(msg)) {
        dom.saveBtn.disabled = false;
        return;
      }
    }

    // Update state
    if (action === "create") {
      state.trips.push(optimisticTrip);
    } else {
      const idx = state.trips.findIndex((t) => String(t.tripKey) === key);
      if (idx >= 0) state.trips[idx] = optimisticTrip;
      else state.trips.push(optimisticTrip);
    }
    state.tripByKey[key] = optimisticTrip;
    state.assignmentsByTripKey[key] = optimisticAssignments;

    // Rerender UI
    scheduleAgendaReflow();
    updateDriverWeekIfVisible();

    // Invalidate cache
    clearCacheForCurrentView();

    toast("Saving…", "info", 1000);

    dom.saveBtn.disabled = true;

    // Sync requirement toggles to hidden inputs so backend receives them
    ["req56Pass", "reqSleeper", "reqLift", "reqRelief", "reqRelief2", "reqCoDriver", "reqHotel", "reqFuelCard", "driverInfoSent", "tripReminderSent", "tripReviewed"].forEach((id) => {
      const btn = $(id);
      const hidden = $(id + "Value");
      if (btn && hidden) {
        hidden.value = btn.getAttribute("aria-pressed") === "true" ? "true" : "false";
      }
    });

    state.pendingWrite = {
      action,
      tripKey: key,
      originalTrips,
      originalTripByKey,
      originalAssignments,
    };

    // CLEANLINESS: Clear status values for unassigned drivers so backend doesn't save them
    for (let i = 0; i < 10; i++) {
      const row = state.busRows[i];
      if (!row) continue;
      if (row.d1Sel.value === "None") row.d1StatusSel.value = "";
      if (row.d2Sel.value === "None") row.d2StatusSel.value = "";
      if (row.d3Sel.value === "None") row.d3StatusSel.value = "";
      if (row.d4Sel.value === "None") row.d4StatusSel.value = "";
    }

    startVerifyFallback();
    dom.tripForm.submit();

    // OPTIMISTIC UI: Clear form immediately for next entry
    // (Small delay to ensure browser captures data for hidden_iframe submit)
    setTimeout(() => {
      resetTripFormUI();
      toast("Saved ✓", "success", 1200);
    }, 100);
  });

  function resetTripFormUI() {
    dom.tripForm.reset();
    resetRequirementToggles();
    refreshEmptyStateUI();
    setModeNew();

    // Reset custom selects to placeholder so triggers sync (form.reset doesn't fire change)
    setSelectToPlaceholder("busesNeeded");
    setSelectToPlaceholder("tripColor");
    ["paymentStatus", "driverStatus", "invoiceStatus"].forEach(
      setSelectToPlaceholder,
    );

    dom.busesNeeded.value = "";
    updateBusRowVisibility();
    syncBusPanelState();
    refreshBusSelectOptions();

    // Reset bus/driver selects and sync triggers
    state.busRows.forEach((r) => {
      r.busSel.value = "None";
      r.d1Sel.value = "None"; r.d1StatusSel.value = ""; if (r.d1Pay) r.d1Pay.value = "";
      r.d2Sel.value = "None"; r.d2StatusSel.value = ""; if (r.d2Pay) r.d2Pay.value = "";
      r.d3Sel.value = "None"; r.d3StatusSel.value = ""; if (r.d3Pay) r.d3Pay.value = "";
      r.d4Sel.value = "None"; r.d4StatusSel.value = ""; if (r.d4Pay) r.d4Pay.value = "";
      r.busSel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d1Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d2Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d3Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d4Sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    syncBusSelectEmptyState();

    ["paymentStatus", "driverStatus", "invoiceStatus"].forEach(
      (id) => updateStatusSelect($(id)),
    );
    updateInvoiceNumberVisibility();

    // Form has just been reset after save/delete; treat as clean.
    state.tripFormDirty = false;
    if (typeof syncEmptyFields === "function") syncEmptyFields();
  }

  function clearCacheForCurrentView() {
    // For simplicity and to avoid any stale local snapshots after edits,
    // clear all cached week data (both in-memory and persistent).
    try {
      state.weekCache.clear();
    } catch (e) {
      console.error("Failed to clear weekCache:", e);
    }

    try {
      if (CACHE && CACHE.clearAll) {
        CACHE.clearAll();
      }
    } catch (e) {
      console.error("Failed to clear persistent CACHE:", e);
    }
  }

  dom.tripDetailsModal?.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-details]")) closeTripDetailsModal();
  });

  document.addEventListener("keydown", (e) => {
    if (!dom.tripDetailsModal?.hidden && e.key === "Escape") closeTripDetailsModal();
  });


  // Toggle buttons — click toggles aria-pressed
  document.querySelectorAll(".rux-btn--toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pressed = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", pressed ? "false" : "true");
      updateBusRowVisibility();
    });
  });
}

// ======================================================
// 37) WIRE SETTINGS MENU
// ======================================================
function wireSettingsMenu() {
  if (!dom.settingsBtn || !dom.settingsMenu) return;

  function settingsOutsideClick(e) {
    if (!dom.settingsMenu.contains(e.target) && !dom.settingsBtn.contains(e.target)) {
      closeSettings();
    }
  }

  function closeSettings() {
    dom.settingsMenu.hidden = true;
    dom.settingsBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", settingsOutsideClick);
  }

  dom.settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dom.settingsMenu.hidden) {
      closeAllFloatingMenus();
      dom.settingsMenu.hidden = false;
      dom.settingsBtn.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => document.addEventListener("click", settingsOutsideClick));
    } else {
      closeSettings();
    }
  });

  // 1. Jump directly to Today
  dom.todayBtn2?.addEventListener("click", () => {
    if (!confirmDiscardIfDirty()) return;
    state.currentDate = startOfWeek(new Date());
    updateWeekDates();
    closeSettings();
  });

  // Next Day Maintenance Report
  dom.nextDayReportBtn?.addEventListener("click", () => {
    closeSettings();
    generateNextDayReport();
  });

  // Daily Maintenance Plan
  dom.dailyMaintenancePlanBtn?.addEventListener("click", () => {
    closeSettings();
    generateDailyMaintenancePlan();
  });

  // 3. Print (Legal, 2 pages)
  dom.printBtn2?.addEventListener("click", () => {
    closeSettings();
    setSidePanelMode("off");
    requestAnimationFrame(() => {
      setPrintPageSize("legal");
      buildPrintScheduleLegalCSSGrid();
      window.print();
    });
  });

  // 3b. Print Full (Letter, 1 page)
  dom.printBtn2Full?.addEventListener("click", () => {
    closeSettings();
    setSidePanelMode("off");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPrintPageSize("letter");
        buildPrintScheduleFullLetter();
        window.print();
      });
    });
  });

  // 4. Week Start
  dom.weekStartToggle?.addEventListener("click", () => {
    applyWeekStart(!state.weekStartsOnMonday);
    // Don't close menu so user can see the toggle change
  });

  // 5. Refresh
  dom.refreshBtn2?.addEventListener("click", () => {
    closeSettings();
    CACHE.clearAll();
    state.weekCache.clear();
    loadDriversAndBuses(true).then(() => refreshWeekData());
  });

  // 6. Auto-close whenever ANY dropdown item is clicked inside this menu
  dom.settingsMenu.addEventListener("click", (e) => {
    if (e.target.closest(".dropdown__item")) closeSettings();
  });
}

// ======================================================
// 38) WEEKLY MAINTENANCE REPORT
// ======================================================
function generateNextDayReport(selectedDate = null) {
  let startD = selectedDate ? new Date(selectedDate) : new Date(state.currentDate || new Date());

  if (!selectedDate) {
    if (state.weekStartsMonday) {
      if (startD.getDay() === 0) startD = addDays(startD, -6);
      else startD = addDays(startD, 1 - startD.getDay());
    } else {
      startD = addDays(startD, -startD.getDay());
    }
  }

  const startYMD = ymd(startD);
  if (dom.nextDayReportDateInput && dom.nextDayReportDateInput.value !== startYMD) {
    dom.nextDayReportDateInput.value = startYMD;
  }

  let fullHtml = `<div class="next-day-report">`;

  // Loop 7 days
  for (let i = 0; i < 7; i++) {
    const today = addDays(startD, i);
    const tomorrow = addDays(today, 1);
    const todayYMD = ymd(today);
    const tomorrowYMD = ymd(tomorrow);

    // Find all buses that have a trip departing tomorrow
    const busesDepartingTomorrow = new Set();
    const tripsDepartingTomorrow = state.trips.filter((t) => t.departureDate === tomorrowYMD);

    tripsDepartingTomorrow.forEach((trip) => {
      const assigns = state.assignmentsByTripKey[trip.tripKey] || [];
      assigns.forEach((a) => {
        const busId = String(a.busId || "").trim();
        if (busId && busId !== "None" && busId !== "WAITING_LIST") {
          busesDepartingTomorrow.add(busId);
        }
      });
    });

    // For these buses, find when they arrive today
    const reportData = [];
    const priorityBusesInfo = [];

    busesDepartingTomorrow.forEach((busId) => {
      // Find trips for this bus arriving today
      let arrivalTimeToday = "Already in yard / No arrival today";
      let departureTimeTomorrow = "Unknown";
      let maintenanceWindow = "Flexible (Bus is in yard)";

      // Find departure time tomorrow
      const tomorrowTrip = tripsDepartingTomorrow.find((t) => {
        const assigns = state.assignmentsByTripKey[t.tripKey] || [];
        return assigns.some((a) => String(a.busId).trim() === busId);
      });

      if (tomorrowTrip && tomorrowTrip.departureTime) {
        departureTimeTomorrow = formatTime12(tomorrowTrip.departureTime);
      }

      // Find arrival time today
      const tripsArrivingToday = state.trips.filter((t) => {
        const arrDate = t.arrivalDate || t.departureDate;
        if (arrDate !== todayYMD) return false;
        const assigns = state.assignmentsByTripKey[t.tripKey] || [];
        return assigns.some((a) => String(a.busId).trim() === busId);
      });

      // Sort by arrival time descending
      tripsArrivingToday.sort((a, b) => {
        const timeA = normalizeTime(a.arrivalTime) || "00:00";
        const timeB = normalizeTime(b.arrivalTime) || "00:00";
        return timeB.localeCompare(timeA);
      });

      if (tripsArrivingToday.length > 0) {
        const lastTripToday = tripsArrivingToday[0];
        if (lastTripToday.arrivalTime) {
          arrivalTimeToday = formatTime12(lastTripToday.arrivalTime);

          let arrHour = 0;
          const normedArr = normalizeTime(lastTripToday.arrivalTime);
          if (normedArr) {
            arrHour = parseInt(normedArr.split(":")[0], 10);
          }

          if (arrHour < 8) {
            maintenanceWindow = "8:00 AM - 4:00 PM";
          } else if (arrHour >= 8 && arrHour <= 16) {
            maintenanceWindow = "4:00 PM - 12:00 AM (Midnight)";
          } else {
            maintenanceWindow = "Night Shift (After Arrival)";
          }
        }

        let arrTimeNum = 0;
        if (lastTripToday.arrivalTime) {
          const normedArr = normalizeTime(lastTripToday.arrivalTime);
          if (normedArr) {
            arrTimeNum =
              parseInt(normedArr.split(":")[0], 10) + parseInt(normedArr.split(":")[1], 10) / 60;
          }
        }

        let depTimeNum = 32; // Default 8 AM tomorrow
        if (tomorrowTrip && tomorrowTrip.departureTime) {
          const normedDep = normalizeTime(tomorrowTrip.departureTime);
          if (normedDep) {
            depTimeNum =
              24 +
              parseInt(normedDep.split(":")[0], 10) +
              parseInt(normedDep.split(":")[1], 10) / 60;
          }
        }
        priorityBusesInfo.push({ a: arrTimeNum, d: depTimeNum });

        reportData.push({
          busId,
          arrivalTimeToday,
          departureTimeTomorrow,
          maintenanceWindow,
          priority: tripsArrivingToday.length > 0 ? 1 : 2, // 1 High Priority (arriving today), 2 Low Priority (in yard)
        });
      } else {
        reportData.push({
          busId,
          arrivalTimeToday,
          departureTimeTomorrow,
          maintenanceWindow,
          priority: 2, // Low Priority (in yard)
        });
      }
    });

    // Sort by Priority first (1 then 2), then by bus number
    reportData.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return parseInt(a.busId) - parseInt(b.busId);
    });

    // Calculate best 8-hour shift
    let shiftDisplay = "";
    if (priorityBusesInfo.length > 0) {
      let bestShift = null;
      for (let s = 12; s <= 32; s += 0.5) {
        let valid = true;
        for (const b of priorityBusesInfo) {
          const overlap = Math.min(s + 8, b.d) - Math.max(s, b.a);
          if (overlap < 2) {
            valid = false;
            break;
          }
        }
        if (valid) {
          bestShift = s;
          break; // Earliest valid 8-hour window
        }
      }

      if (bestShift !== null) {
        const formatTimeNum = (num) => {
          let isTmrw = num >= 24;
          let h = Math.floor(num) % 24;
          let m = Math.round((num - Math.floor(num)) * 60);
          let ampm = h >= 12 ? "PM" : "AM";
          h = h % 12;
          if (h === 0) h = 12;
          let ms = String(m).padStart(2, "0");
          let dayStr = isTmrw ? " (Next Day)" : "";
          if (isTmrw && h === 12 && ampm === "AM") dayStr = ""; // it's just midnight
          return `${h}:${ms} ${ampm}${dayStr}`;
        };

        shiftDisplay = `<div class="next-day-report__shift">
        <strong class="next-day-report__shift-title">Optimal 8-Hour Maintenance Shift: <span class="next-day-report__shift-title--accent">${formatTimeNum(bestShift)} - ${formatTimeNum(bestShift + 8)}</span></strong>
        <span class="next-day-report__shift-desc">This window guarantees at least 2 hours of available yard time for every priority bus.</span>
      </div>`;
      } else {
        shiftDisplay = `<div class="next-day-report__shift next-day-report__shift--danger">
        <strong class="next-day-report__shift-title next-day-report__shift-title--danger">No single 8-hour shift possible</strong>
        <span class="next-day-report__shift-desc">Cannot find a single 8-hour window that gives 2+ hours to all priority buses. You may need staggered shifts.</span>
      </div>`;
      }
    } else if (reportData.length > 0) {
      shiftDisplay = `<div class="next-day-report__shift next-day-report__shift--success">
        <strong class="next-day-report__shift-title next-day-report__shift-title--success">All Buses in Yard (Flexible)</strong>
        <span class="next-day-report__shift-desc">No priority arrivals. Maintenance shifts can be scheduled anytime.</span>
      </div>`;
    }

    // Build HTML for loop iteration
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    let dayHtml = `<div class="next-day-report__day weekly-report-day">
      <h3 class="next-day-report__day-title">
        ${dayName} Maintenance Schedule
        <span class="next-day-report__day-subtitle">
          (Handling arrivals from ${formatDateForToast(todayYMD)} for departures on ${formatDateForToast(tomorrowYMD)})
        </span>
      </h3>`;

    dayHtml += shiftDisplay;
    if (reportData.length === 0) {
      dayHtml += `<p class="next-day-report__empty">No buses found that depart tomorrow (${tomorrowYMD}).</p>`;
    } else {
      dayHtml += `<table class="next-day-report__table next-day-report-table">
        <thead>
          <tr>
            <th>Bus</th>
            <th>Status</th>
            <th>Depart Tomorrow</th>
            <th>Suggested Window</th>
          </tr>
        </thead>
        <tbody>`;
      reportData.forEach((row) => {
        const priorityLabel =
          row.priority === 1
            ? `<span class="next-day-report__badge--priority">PRIORITY</span>`
            : `<span class="next-day-report__badge--yard">IN YARD</span>`;

        dayHtml += `<tr>
          <td><strong>${row.busId}</strong><br/>${priorityLabel}</td>
          <td>${row.priority === 1 ? `Arrives Today: <br/><strong>${row.arrivalTimeToday}</strong>` : `Already in yard`}</td>
          <td><strong>${row.departureTimeTomorrow}</strong></td>
          <td>${row.maintenanceWindow}</td>
        </tr>`;
      });
      dayHtml += `</tbody></table>`;
    }

    dayHtml += `</div>`;
    fullHtml += dayHtml;
  }

  fullHtml += `</div>`;
  dom.nextDayReportBody.innerHTML = fullHtml;
  openModalA11y(dom.nextDayReportModal, dom.nextDayReportDateInput || dom.printNextDayReportBtn);
}

// Close and Print handlers
if (dom.nextDayReportDateInput) {
  dom.nextDayReportDateInput.addEventListener("change", (e) => {
    const d = parseYMD(e.target.value);
    if (d) {
      generateNextDayReport(d);
    }
  });
}
if (dom.closeNextDayReportBtn) {
  dom.closeNextDayReportBtn.addEventListener("click", () => {
    closeModalA11y(dom.nextDayReportModal);
  });
}
if (dom.closeNextDayReportBackdrop) {
  dom.closeNextDayReportBackdrop.addEventListener("click", () => {
    closeModalA11y(dom.nextDayReportModal);
  });
}
if (dom.nextDayReportModal) {
  document.addEventListener("keydown", (e) => {
    if (!dom.nextDayReportModal.hidden && e.key === "Escape") {
      closeModalA11y(dom.nextDayReportModal);
    }
  });
}
if (dom.printNextDayReportBtn) {
  dom.printNextDayReportBtn.addEventListener("click", () => {
    const printWindow = window.open("", "", "height=800,width=1000");
    printWindow.document.write("<html><head><title>Weekly Maintenance Report</title>");

    // Inject custom print styles tailored for fitting 7 days into 1 page
    printWindow.document.write(`
      <style>
        @page { size: portrait; margin: 0.5in; }
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
          padding: 0; 
          margin: 0;
          font-size: 11px;
          color: #222; 
          line-height: 1.3;
        }
        
        /* Clean Header */
        h2 { 
          text-align: center; 
          font-size: 18px; 
          margin: 0 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 2px solid #222;
          padding-bottom: 6px;
          color: #111;
        }
        
        .print-wrapper {
          display: block;
          width: 100%;
        }
        
        /* Day Blocks */
        .weekly-report-day {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: 24px !important;
          padding-bottom: 12px !important;
          border-bottom: 1px dashed #ccc !important;
        }
        
        .weekly-report-day:last-child {
          border-bottom: none !important;
        }
        
        /* Date Headers */
        h3 { 
          font-size: 14px !important; 
          margin: 0 0 8px 0 !important; 
          color: #111 !important; 
          font-weight: 700 !important;
          line-height: 1.2 !important;
        }
        h3 span { 
          color: #555 !important; 
          font-weight: 400 !important; 
          font-size: 11px !important;
          display: block;
          margin-top: 2px !important;
        }
        
        /* Shift Alert Box */
        .next-day-report__shift {
          background: #fdfdfd !important;
          border: 1px solid #e0e0e0 !important;
          border-left: 3px solid #0284c7 !important; 
          padding: 8px 12px !important;
          box-shadow: none !important;
          border-radius: 4px !important;
          margin-bottom: 12px !important;
        }
        
        .next-day-report__shift--danger { border-left-color: #dc2626 !important; }
        .next-day-report__shift--success { border-left-color: #10b981 !important; }
        
        /* Table Styling */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 8px !important; 
          font-size: 11px !important; 
          table-layout: auto;
        }
        
        th, td { 
          padding: 6px 4px !important; 
          border-bottom: 1px solid #f0f0f0 !important; 
          text-align: left; 
          color: #222 !important;
          vertical-align: top;
        }
        th { 
          color: #444 !important; 
          font-weight: 700 !important; 
          border-bottom: 1px solid #999 !important; 
          text-transform: capitalize;
        }
        
        td strong { 
          color: #111 !important; 
          font-weight: 600;
        }
        
        /* Override dark mode / ensure print-friendly text */
        .next-day-report__shift-title { color: #111 !important; font-size: 11px !important; }
        .next-day-report__shift-title--accent { color: #0369a1 !important; }
        .next-day-report__shift-title--danger { color: #b91c1c !important; }
        .next-day-report__shift-title--success { color: #047857 !important; }
        .next-day-report__shift-desc { color: #444 !important; font-size: 10px !important; display: block; margin-top: 2px; }
        .next-day-report__day-subtitle { color: #555 !important; }
        
        .next-day-report__badge--priority,
        .next-day-report__badge--yard {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          letter-spacing: 0.5px;
          display: block;
          margin-top: 2px;
        }
        
        p { margin: 4px 0 !important; color: #444 !important; }
      </style>
    `);

    printWindow.document.write("</head><body>");
    printWindow.document.write("<h2>Weekly Maintenance Report</h2>");
    printWindow.document.write('<div class="print-wrapper">');
    printWindow.document.write(dom.nextDayReportBody.innerHTML);
    printWindow.document.write("</div>");
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();

    // setTimeout to allow rendering before the print dialog freezes the thread
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  });
}

function generateDailyMaintenancePlan(selectedDate = null) {
  let startD = selectedDate ? new Date(selectedDate) : new Date(state.currentDate || new Date());

  if (!selectedDate) {
    if (state.weekStartsMonday) {
      if (startD.getDay() === 0) startD = addDays(startD, -6);
      else startD = addDays(startD, 1 - startD.getDay());
    } else {
      startD = addDays(startD, -startD.getDay());
    }
  }

  const startYMD = ymd(startD);
  if (dom.dailyMaintenancePlanDateInput && dom.dailyMaintenancePlanDateInput.value !== startYMD) {
    dom.dailyMaintenancePlanDateInput.value = startYMD;
  }

  const buses = ["218", "763", "470", "133", "506", "746", "607", "897", "898", "474"];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const endD = addDays(startD, 6);
  let titleStr = `${monthNames[startD.getMonth()]} ${startD.getDate()} - ${endD.getDate()}, ${endD.getFullYear()}`;
  if (startD.getMonth() !== endD.getMonth()) {
    titleStr = `${monthNames[startD.getMonth()]} ${startD.getDate()} - ${monthNames[endD.getMonth()]} ${endD.getDate()}, ${endD.getFullYear()}`;
  }

  let fullHtml = `<div class="daily-plan">`;
  fullHtml += `<h1 class="daily-plan__title">Weekly Maintenance Priority Plan: <span>${titleStr}</span></h1>`;

  for (let i = 0; i < 7; i++) {
    const currentDay = addDays(startD, i);
    const currentYMD = ymd(currentDay);
    const tomorrowYMD = ymd(addDays(currentDay, 1));
    const dayName = currentDay.toLocaleDateString("en-US", { weekday: "long" });
    const formattedDate = `${monthNames[currentDay.getMonth()]} ${currentDay.getDate()}`;

    let tripsDepartingTomorrow = state.trips.filter((t) => t.departureDate === tomorrowYMD);
    let busesDepartingTomorrow = new Set();
    tripsDepartingTomorrow.forEach((trip) => {
      let assigns = state.assignmentsByTripKey[trip.tripKey] || [];
      assigns.forEach((a) => {
        let busId = String(a.busId || "").trim();
        if (busId && busId !== "None" && busId !== "WAITING_LIST") {
          busesDepartingTomorrow.add(busId);
        }
      });
    });

    let priority1 = []; // Arriving Today
    let priority3 = []; // Already in yard (Flexible)

    let nightShiftRequired = false;

    buses.forEach((busId) => {
      if (busesDepartingTomorrow.has(busId)) {
        let arrivalTimeToday = "In Yard";
        let departureTimeTomorrow = "Unknown";
        let arrivalHour = 0;
        let arrivingToday = false;

        let tomorrowTrip = tripsDepartingTomorrow.find((t) => {
          let assigns = state.assignmentsByTripKey[t.tripKey] || [];
          return assigns.some((a) => String(a.busId).trim() === busId);
        });
        if (tomorrowTrip && tomorrowTrip.departureTime) {
          departureTimeTomorrow = formatTime12(tomorrowTrip.departureTime);
        }

        let tripsArrivingToday = state.trips.filter((t) => {
          let arrDate = t.arrivalDate || t.departureDate;
          if (arrDate !== currentYMD) return false;
          let assigns = state.assignmentsByTripKey[t.tripKey] || [];
          return assigns.some((a) => String(a.busId).trim() === busId);
        });

        tripsArrivingToday.sort((a, b) => {
          let timeA = normalizeTime(a.arrivalTime) || "00:00";
          let timeB = normalizeTime(b.arrivalTime) || "00:00";
          return timeB.localeCompare(timeA);
        });

        if (tripsArrivingToday.length > 0) {
          arrivingToday = true;
          let lastTripToday = tripsArrivingToday[0];
          if (lastTripToday.arrivalTime) {
            arrivalTimeToday = formatTime12(lastTripToday.arrivalTime);
            let normedArr = normalizeTime(lastTripToday.arrivalTime);
            if (normedArr) arrivalHour = parseInt(normedArr.split(":")[0], 10);
          }
        }

        let info = { busId: busId, in: arrivalTimeToday, out: departureTimeTomorrow };

        if (arrivingToday) {
          priority1.push(info);
          if (arrivalHour >= 8) {
            nightShiftRequired = true; // Any late arrival forces a night shift to fix it
          }
        } else {
          priority3.push(info);
        }
      }
    });

    let recommendedShift = nightShiftRequired
      ? "Night Shift (6:00 PM - 2:00 AM)"
      : "Morning Shift (8:00 AM - 5:00 PM)";
    let shiftColor = nightShiftRequired ? "#b45309" : "#0e7490";
    if (priority1.length === 0 && priority3.length === 0) {
      recommendedShift = "No Shift Needed";
      shiftColor = "#9ca3af";
    }

    const shiftClass =
      recommendedShift === "No Shift Needed"
        ? "daily-plan__shift-summary--none"
        : nightShiftRequired
          ? "daily-plan__shift-summary--night"
          : "daily-plan__shift-summary--morning";

    fullHtml += `<div class="daily-plan__day">`;
    fullHtml += `<h2 class="daily-plan__day-header">${dayName} <span>- ${formattedDate}</span></h2>`;

    fullHtml += `<div class="daily-plan__shift-summary ${shiftClass}">Recommended Schedule: ${recommendedShift}</div>`;

    fullHtml += `<div class="daily-plan__section">`;
    fullHtml += `<h3 class="daily-plan__section-title daily-plan__section-title--priority">Priority:</h3>`;
    if (priority1.length > 0) {
      priority1.forEach((b) => {
        fullHtml += `<div class="daily-plan__bus-line"><b>Bus ${b.busId}</b> &nbsp;&nbsp;|&nbsp;&nbsp; <span class="daily-plan__in-arriving">In: ${b.in}</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span class="daily-plan__out-tomorrow">Out: ${b.out} (Tomorrow)</span></div>`;
      });
    } else {
      fullHtml += `<div class="daily-plan__bus-line daily-plan__bus-line--muted">None</div>`;
    }

    fullHtml += `<h3 class="daily-plan__section-title daily-plan__section-title--yard">Already in Yard Today:</h3>`;
    if (priority3.length > 0) {
      priority3.forEach((b) => {
        fullHtml += `<div class="daily-plan__bus-line"><b>Bus ${b.busId}</b> &nbsp;&nbsp;|&nbsp;&nbsp; <span class="daily-plan__in-yard">In: Yard</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span class="daily-plan__out-tomorrow">Out: ${b.out} (Tomorrow)</span></div>`;
      });
    } else {
      fullHtml += `<div class="daily-plan__bus-line daily-plan__bus-line--muted">None</div>`;
    }
    fullHtml += `</div></div>`;
  }

  fullHtml += `</div>`;
  dom.dailyMaintenancePlanBody.innerHTML = fullHtml;
  openModalA11y(
    dom.dailyMaintenancePlanModal,
    dom.dailyMaintenancePlanDateInput || dom.printDailyMaintenancePlanBtn,
  );
}

if (dom.dailyMaintenancePlanDateInput) {
  dom.dailyMaintenancePlanDateInput.addEventListener("change", (e) => {
    const d = parseYMD(e.target.value);
    if (d) {
      generateDailyMaintenancePlan(d);
    }
  });
}
if (dom.closeDailyMaintenancePlanBtn) {
  dom.closeDailyMaintenancePlanBtn.addEventListener("click", () => {
    closeModalA11y(dom.dailyMaintenancePlanModal);
  });
}
if (dom.closeDailyMaintenancePlanBackdrop) {
  dom.closeDailyMaintenancePlanBackdrop.addEventListener("click", () => {
    closeModalA11y(dom.dailyMaintenancePlanModal);
  });
}
if (dom.dailyMaintenancePlanModal) {
  document.addEventListener("keydown", (e) => {
    if (!dom.dailyMaintenancePlanModal.hidden && e.key === "Escape") {
      closeModalA11y(dom.dailyMaintenancePlanModal);
    }
  });
}

// Driver Week Schedule events
dom.copyDriverWeekScheduleBtn?.addEventListener("click", async () => {
  const text = dom.driverWeekSchedulePreview?.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast("Week schedule copied!");
  } catch (_) {
    toast("Copy failed — please select and copy manually.");
  }
});
document.getElementById("closeDriverWeekScheduleBtn")
  ?.addEventListener("click", () => closeModalA11y(dom.driverWeekScheduleModal));
document.getElementById("closeDriverWeekScheduleBackdrop")
  ?.addEventListener("click", () => closeModalA11y(dom.driverWeekScheduleModal));

// Driver Contact events
if (dom.closeDriverContactBtn) {
  dom.closeDriverContactBtn.addEventListener("click", () => {
    closeModalA11y(dom.driverContactModal);
  });
}
if (dom.closeDriverContactBackdrop) {
  dom.closeDriverContactBackdrop.addEventListener("click", () => {
    closeModalA11y(dom.driverContactModal);
  });
}
if (dom.driverContactModal) {
  document.addEventListener("keydown", (e) => {
    if (!dom.driverContactModal.hidden && e.key === "Escape") {
      closeModalA11y(dom.driverContactModal);
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;

  const openModal =
    [
      dom.envelopeModal,
      dom.driverContactModal,
      dom.driverWeekScheduleModal,
      dom.dailyMaintenancePlanModal,
      dom.nextDayReportModal,
      dom.tripDetailsModal,
      dom.itineraryModal,
    ].find((modalEl) => modalEl && !modalEl.hidden) || null;

  if (!openModal) return;
  trapModalFocus(openModal, e);
});
if (dom.copyDriverContactBtn) {
  dom.copyDriverContactBtn.addEventListener("click", async () => {
    const text = dom.driverContactBody.value;
    if (!text) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast("Office/Customer Info copied!");
      } else {
        dom.driverContactBody.select();
        document.execCommand("copy");
        toast("Office/Customer Info copied!");
      }
    } catch (err) {
      toast("Failed to copy", "danger");
    }
  });
}

if (dom.copyDriverReminderBtn) {
  dom.copyDriverReminderBtn.addEventListener("click", async () => {
    const text = dom.driverReminderBody.value;
    if (!text) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast("Driver Reminder copied!");
      } else {
        dom.driverReminderBody.select();
        document.execCommand("copy");
        toast("Driver Reminder copied!");
      }
    } catch (err) {
      toast("Failed to copy", "danger");
    }
  });
}

if (dom.copyTripInfoBtn) {
  dom.copyTripInfoBtn.addEventListener("click", async () => {
    const text = dom.tripInfoBody.value;
    if (!text) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast("Trip Info copied!");
      } else {
        dom.tripInfoBody.select();
        document.execCommand("copy");
        toast("Trip Info copied!");
      }
    } catch (err) {
      toast("Failed to copy", "danger");
    }
  });
}

// Envelope modal events
if (dom.closeEnvelopeBtn) {
  dom.closeEnvelopeBtn.addEventListener("click", closeEnvelopeModal);
}
if (dom.closeEnvelopeBackdrop) {
  dom.closeEnvelopeBackdrop.addEventListener("click", closeEnvelopeModal);
}
if (dom.envelopeModal) {
  document.addEventListener("keydown", (e) => {
    if (!dom.envelopeModal.hidden && e.key === "Escape") closeEnvelopeModal();
  });
}
if (dom.envelopeAssignmentSelect) {
  dom.envelopeAssignmentSelect.addEventListener("change", () => {
    const idx = parseInt(dom.envelopeAssignmentSelect.value, 10);
    if (!isNaN(idx)) updateEnvelopeModalSelection(idx);
  });
}

if (dom.envelopeFormatSelect) {
  dom.envelopeFormatSelect.addEventListener("change", () => {
    stateEnvelope.format = dom.envelopeFormatSelect.value;
    openEnvelopeModal(stateEnvelope.tripKey);
  });
}
// Removed envelopeSaveBtn event listener
if (dom.envelopePrintBtn) {
  dom.envelopePrintBtn.addEventListener("click", printEnvelopePages);
}
if (dom.envelopeYellowBtn) {
  dom.envelopeYellowBtn.addEventListener("click", () => {
    stateEnvelope.bg = "yellow";
    dom.envelopeModalPages?.querySelectorAll(".envelope-page").forEach((p) => {
      p.classList.remove("env-white");
      p.classList.add("env-yellow");
    });
    dom.envelopeYellowBtn?.classList.add("active");
    dom.envelopeWhiteBtn?.classList.remove("active");
  });
}
if (dom.envelopeWhiteBtn) {
  dom.envelopeWhiteBtn.addEventListener("click", () => {
    stateEnvelope.bg = "white";
    dom.envelopeModalPages?.querySelectorAll(".envelope-page").forEach((p) => {
      p.classList.remove("env-yellow");
      p.classList.add("env-white");
    });
    dom.envelopeWhiteBtn?.classList.add("active");
    dom.envelopeYellowBtn?.classList.remove("active");
  });
}
// Wrap envelope Bus / Driver select in the same glass dropdown treatment
const envSel = document.getElementById("envelopeAssignmentSelect");
if (envSel && envSel.tagName === "SELECT") {
  wrapSelectInGlassDropdown(envSel, { rebuildMenuOnOpen: true });
}

if (dom.printDailyMaintenancePlanBtn) {
  dom.printDailyMaintenancePlanBtn.addEventListener("click", () => {
    const printWindow = window.open("", "", "height=800,width=800");
    printWindow.document.write("<html><head><title>Daily Maintenance Plan</title>");
    printWindow.document.write(`
      <style>
        @page { size: portrait; margin: 0.5in; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `);
    printWindow.document.write("</head><body>");
    printWindow.document.write(dom.dailyMaintenancePlanBody.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  });
}

// ======================================================
// 39) BOOT
// ======================================================
(function boot() {
  warnOnMissingRequiredHooks();

  try {
    const style = document.createElement("style");
    style.textContent = `
  ${SELECTORS.scheduleGridWrapHook}.is-loading-bars .schedule-grid__trip-bar { opacity: 0.18; pointer-events: none; }
`;
    document.head.appendChild(style);
  } catch { }

  setSidePanelMode("off");
  enforceDesktopEditing();

  loadPrefs();
  syncWeekStartUI();

  const today = new Date();
  state.currentDate = startOfWeek(today);

  buildBusRowsOnce();
  syncBusPanelState();

  buildAgendaRows();
  setHeaderOrder();

  syncEmptyStateForForm();
  setModeNew();

  // moveTopControlsToButtonRow(); // Removed (Layout now static)

  wireSettingsMenu();
  wireEvents();
  wireDelegatedBarEvents();
  wireQuickEditPopover();

  window.addEventListener(
    "resize",
    () => {
      suppressScrollbarDuringResize();
      enforceDesktopEditing();
      state.lastColMetrics = null;
      state.barMetrics = null;
      scheduleAgendaReflow();
    },
    { passive: true },
  );

  const tableWrap = getScheduleGridWrapEl();
  const scheduleCard = getScheduleMainCardEl();
  if (tableWrap && "ResizeObserver" in window) {
    const onResize = () => {
      state.lastColMetrics = null;
      scheduleAgendaReflow();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(tableWrap);
    if (scheduleCard && scheduleCard !== tableWrap) ro.observe(scheduleCard);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      state.lastColMetrics = null;
      scheduleAgendaReflow();
    });
  }

  (async function init() {
    setWeekSyncStatus("loading");
    try {
      await loadDriversAndBuses();
    } catch (e) {
      console.warn("Could not load drivers/buses yet. Using placeholders.", e);
      state.driversList = [
        { driverName: "None" },
        { driverName: "Driver A" },
        { driverName: "Driver B" },
      ];
      state.busesList = [
        { busId: "218", busName: "Bus 218" },
        { busId: "763", busName: "Bus 763" },
      ];
      refreshBusSelectOptions();
    }
    updateWeekDates();
  })();

  window.addEventListener("error", (e) => {
    console.error("Global error:", e?.error || e?.message || e);
    toast("Something went wrong (see console)", "danger", 2200);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e?.reason || e);
    toast("Network / async error occurred", "danger", 2200);
  });

  // ========================================================================
  // DATE PICKER ICON TRIGGER (Overlay + Failsafe)
  // ========================================================================
  // ========================================================================
  // DATE PICKER AUTO-OPEN (For Clickable Title)
  // ========================================================================
  // Date picker click listener removed
})();

// ======================================================
// HELPER: Auto-scale Title Font (Mobile)
// ======================================================
function fitDateTitle() {
  const title = document.querySelector(".week-heading");
  if (!title) return;

  // Reset to max size first to check overflow
  title.style.fontSize = "";

  // Only run if overflow/scrollWidth > clientWidth
  // But wait, ellipsis hides overflow. We compare scrollWidth > clientWidth
  // Force a small delay to let bold/layout settle? usually safe immediately.

  if (window.innerWidth >= 900) return; // Only for mobile layout

  let size = 22; // Start max
  const minSize = 12;

  // Check if ScrollWidth > ClientWidth
  // Note: scrollWidth typically equals clientWidth if overflow:hidden + whitespace:nowrap is set unless content is actually clipped.
  // Wait, if text-overflow: ellipsis is active, scrollWidth might report the full width?
  // Let's assume clamping makes it fit. If scrollWidth > clientWidth, text is overflowing.

  // First, clear inline style to let CSS clamp work
  title.style.fontSize = "";

  if (title.scrollWidth > title.clientWidth) {
    size = parseFloat(window.getComputedStyle(title).fontSize);

    while (title.scrollWidth > title.clientWidth && size > minSize) {
      size--;
      title.style.fontSize = size + "px";
    }
  }
}

window.addEventListener("resize", fitDateTitle);
// Also call on load just in case
window.addEventListener("load", fitDateTitle);
window.addEventListener("load", fitDateTitle);
// ======================================================
function fitDateTitle() {
  const title = document.querySelector(".week-heading");
  if (!title) return;

  // Reset to max size first to check overflow
  title.style.fontSize = "";

  // Only run if overflow/scrollWidth > clientWidth
  // But wait, ellipsis hides overflow. We compare scrollWidth > clientWidth
  // Force a small delay to let bold/layout settle? usually safe immediately.

  if (window.innerWidth >= 900) return; // Only for mobile layout

  let size = 22; // Start max
  const minSize = 12;

  // Check if ScrollWidth > ClientWidth
  // Note: scrollWidth typically equals clientWidth if overflow:hidden + whitespace:nowrap is set unless content is actually clipped.
  // Wait, if text-overflow: ellipsis is active, scrollWidth might report the full width?
  // Let's assume clamping makes it fit. If scrollWidth > clientWidth, text is overflowing.

  // First, clear inline style to let CSS clamp work
  title.style.fontSize = "";

  if (title.scrollWidth > title.clientWidth) {
    size = parseFloat(window.getComputedStyle(title).fontSize);

    while (title.scrollWidth > title.clientWidth && size > minSize) {
      size--;
      title.style.fontSize = size + "px";
    }
  }
}

window.addEventListener("resize", fitDateTitle);
// Also call on load just in case
window.addEventListener("load", fitDateTitle);
window.addEventListener("load", fitDateTitle);
