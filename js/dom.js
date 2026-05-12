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

  headerWeek: $("headerWeek"),
  weekWrapper: $("dateWrapper"),
  weekSyncStatus: $("weekSyncStatus"),
  scheduleStatusLabel: (() => {
    const el = document.createElement("span");
    el.id = "scheduleStatusLabel";
    el.className = "schedule-status-label";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
    return el;
  })(),
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
  nextDayReportModal: $("nextDayReportModal"),
  nextDayReportBody: $("nextDayReportBody"),
  closeNextDayReportBtn: $("closeNextDayReportBtn"),
  closeNextDayReportBackdrop: $("closeNextDayReportBackdrop"),
  printNextDayReportBtn: $("printNextDayReportBtn"),
  nextDayReportDateInput: $("nextDayReportDateInput"),

  dailyMaintenancePlanBtn: $("dailyMaintenancePlanBtn"),
  dailyMaintenancePlanModal: $("dailyMaintenancePlanModal"),
  dailyMaintenancePlanBody: $("dailyMaintenancePlanBody"),
  closeDailyMaintenancePlanBtn: $("closeDailyMaintenancePlanBtn"),
  closeDailyMaintenancePlanBackdrop: $("closeDailyMaintenancePlanBackdrop"),
  printDailyMaintenancePlanBtn: $("printDailyMaintenancePlanBtn"),
  dailyMaintenancePlanDateInput: $("dailyMaintenancePlanDateInput"),

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

  cellCtxMenu: $("cellContextMenu"),
  ctxNewTripBtn: $("ctxNewTripBtn"),

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
