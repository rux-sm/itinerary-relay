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
  toastTimer: null,
  weekLoadSafetyTimer: null,
  statusNoticeExpiryTimer: null,
  activeStatusNotice: null,
  statusNoticeToken: 0,
  baseWeekSyncStatus: {
    mode: "loading",
    message: "Loading…",
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

  pendingItineraryTripKey: null,

  notesDirty: false,
  savedNotesValue: "",
  notesLoaded: false,

  tripFormDirty: false,
  tripFormWeekKey: null,

  activeAbortController: null,

  formListenersWired: false,

  unavailabilityByDriver: {},

  dragSelection: {
    active: false,
    driver: null,
    mode: null,
    dates: new Set(),
  },

  lastFocusedElement: null,

  cardPanelAssignments: {},

  pendingRefreshDeferred: false,
  pendingQuickEditSave: [],
  tripFormOpen: false,
  mutationId: 0,
  checklistWriteTs: {},
  checklistAbortControllers: {},
};
