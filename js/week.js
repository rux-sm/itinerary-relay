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

// Surgically evict only the week(s) that contain tripDate, leaving adjacent prefetched
// weeks intact. Falls back to the current view's week when tripDate is absent or unparseable.
function clearCacheForTrip(tripDate) {
  let start, end;
  if (tripDate) {
    const d = parseYMD(tripDate);
    if (d) {
      const ws = startOfWeek(d);
      start = ymd(ws);
      end = ymd(addDays(ws, 6));
    }
  }
  if (!start) {
    const range = getWeekRange();
    start = range.start;
    end = range.end;
  }
  state.weekCache.delete(weekKey(start, end));
  try { localStorage.removeItem(weekCacheKey(start, end)); } catch (_) {}
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

function applyWeekRespToState(resp, weekStart, weekEnd) {
  if (state.tripFormOpen) {
    // Only block the week the form is editing — other weeks render immediately.
    const formSameWeek = !state.tripFormWeekKey || !weekStart
      || weekStart === state.tripFormWeekKey;
    if (formSameWeek) {
      state.pendingRefreshDeferred = true;
      return false;
    }
  }
  if (state.pendingWrite) {
    const pw = state.pendingWrite;
    // Only block the week being written to — other weeks render immediately.
    const sameWeek = !pw.writeWeekKey || !weekStart || !weekEnd
      || weekKey(weekStart, weekEnd) === pw.writeWeekKey;
    if (sameWeek) {
      state.pendingRefreshDeferred = true;
      return false;
    }
  }

  const ok = !!resp?.ok;

  let trips = ok ? asArray(resp.trips) : [];

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

  let asnList = ok ? asArray(resp.assignments) : [];

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
  return true;
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
    const applied = applyWeekRespToState(cached, start, end);
    if (applied) {
      updateDriverWeekIfVisible();
      updateTodoCardIfVisible();
      scheduleAgendaReflow();
    }
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
    const appliedLocal = applyWeekRespToState(localData, start, end);
    if (appliedLocal) {
      updateDriverWeekIfVisible();
      updateTodoCardIfVisible();
      scheduleAgendaReflow();
    }
    setWeekSyncStatus("sync");

    // Reveal the bars immediately if we have local data.
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

  const applied = applyWeekRespToState(resp, start, end);
  if (applied) {
    updateDriverWeekIfVisible();
    updateTodoCardIfVisible();
    scheduleAgendaReflow();
  }

  if (resp?.__stale) {
    setWeekSyncStatus("stale");
  }
}

async function refreshWeekData({ silent = false } = {}) {
  // CRITICAL: Skip background refresh if a delete/save is pending
  // to avoid applying stale data before the server mutation completes.
  // Queue the refresh so it fires once the mutation clears.
  if (silent && state.pendingWrite) {
    state.pendingRefreshDeferred = true;
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
    setBarsHidden(false);
    scheduleAgendaReflow();
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
