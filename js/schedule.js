// ======================================================
// 16) BAR RENDER TOAST + LOADING DIMMER
// ======================================================
let scheduleRenderToastTimer = null;

function showScheduleRenderToastDelayed() {
  clearTimeout(scheduleRenderToastTimer);

  // Header status progress is now owned by week-load/trip-load pipelines.
  // Keep this timer for render lifecycle parity, but do not emit standalone render notices.
  scheduleRenderToastTimer = setTimeout(() => {}, 120);
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
  dom.agendaBody?.querySelectorAll(".schedule-grid__row-bars").forEach((b) => {
    b.innerHTML = "";
    // Reset any z-index left over from an expanded bar that was cleared mid-expansion.
    b.style.zIndex = "";
    const td = b.parentElement;
    if (td?.tagName === "TD") td.style.zIndex = "";
  });
  state.barElByKey?.clear?.();
}

function barKey(tripKey, busId, driver1, driver2) {
  return `${tripKey}|${busId}|${driver1 || ""}|${driver2 || ""}`;
}

function pruneOldBars(pass) {
  for (const [k, el] of state.barElByKey) {
    if (el._renderPass !== pass) {
      // If the bar was expanded when pruned, restore its parent containers'
      // z-index so they don't stay permanently elevated.
      if (el.classList.contains("expanded") && el.parentElement) {
        el.parentElement.style.zIndex = "";
        const td = el.parentElement.parentElement;
        if (td?.tagName === "TD") td.style.zIndex = "";
      }
      el.remove();
      state.barElByKey.delete(k);
    }
  }
}

function getBarMetrics() {
  // Read from body, not documentElement — compact mode overrides
  // --tripbar-height and --tripbar-lane-step on body.bars-compact,
  // so getComputedStyle(documentElement) would miss those overrides.
  const bodyCss = getComputedStyle(document.body);
  const barH = parseFloat(bodyCss.getPropertyValue("--tripbar-height")) || 100;

  let step = parseFloat(bodyCss.getPropertyValue("--tripbar-lane-step"));
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
  if (bar.classList.contains("expanded")) {
    // Don't overwrite style.height while the bar is animating open or
    // sitting expanded — the JS expand handler owns height at this point.
    // Keep dataset.collapsedHeight current so the close animation snaps
    // back to the right size if the layout changed (e.g. resize).
    const parentH = bar.parentElement?.getBoundingClientRect().height ?? 0;
    bar.dataset.collapsedHeight = `${Math.max(0, parentH - insetT - insetB)}px`;
  } else {
    bar.style.height = `calc(100% - ${insetT + insetB}px)`;
  }
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

function formatDateShort(dateStr) {
  const d = parseYMD(dateStr);
  if (!d) return String(dateStr || "");
  return `${d.getMonth() + 1}/${d.getDate()}`;
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

  const busDayArrivals = {}; // "busId:dayIdx" → [{frac, tripKey, isSingleDay}]
  const busDayDepartures = {}; // "busId:dayIdx" → [{frac, tripKey, isSingleDay}]

  for (const t of visibleTrips) {
    const tDepY = ymd(t._dep);
    const tArrY = ymd(t._arr);
    const tIsSD = tDepY === tArrY;
    const tStart = tDepY < weekStart ? weekStart : tDepY;
    const tEnd = tArrY > weekEnd ? weekEnd : tArrY;
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
          (busDayArrivals[`${tBusId}:${tEi}`] ||= []).push({
            frac,
            tripKey: t.tripKey,
            isSingleDay: tIsSD,
          });
      }
      if (t.departureTime) {
        const frac = timeToFrac(t.departureTime);
        if (frac != null)
          (busDayDepartures[`${tBusId}:${tSi}`] ||= []).push({
            frac,
            tripKey: t.tripKey,
            isSingleDay: tIsSD,
          });
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

    let bestArrFrac = -Infinity,
      bestArrIsSD = false,
      bestArrTripKey = null;
    let bestDepFrac = Infinity,
      bestDepIsSD = false,
      bestDepTripKey = null;
    let hasValidPair = false;

    for (const arr of arrs) {
      for (const dep of deps) {
        if (arr.tripKey === dep.tripKey) continue; // skip self-match (single-day trips)
        if (arr.frac > dep.frac) continue; // times overlap — not a handoff
        hasValidPair = true;
        if (arr.frac > bestArrFrac) {
          bestArrFrac = arr.frac;
          bestArrIsSD = arr.isSingleDay;
          bestArrTripKey = arr.tripKey;
        }
        if (dep.frac < bestDepFrac) {
          bestDepFrac = dep.frac;
          bestDepIsSD = dep.isSingleDay;
          bestDepTripKey = dep.tripKey;
        }
      }
    }
    if (!hasValidPair) continue;

    let arrFrac = snapToThird(bestArrFrac);
    let depFrac = snapToThird(bestDepFrac);

    if (bestArrIsSD && bestDepIsSD) {
      arrFrac = 0.5;
      depFrac = 0.5;
    } else if (bestArrIsSD) {
      arrFrac = 2 / 3;
      depFrac = Math.max(depFrac, 2 / 3);
    } else if (bestDepIsSD) {
      depFrac = 1 / 3;
      arrFrac = Math.min(arrFrac, 1 / 3);
    } else if (arrFrac > depFrac) {
      arrFrac = 0.5;
      depFrac = 0.5;
    }

    handoffByBus[hBusId] ||= {};
    handoffByBus[hBusId][dayIdx] = {
      arrFrac,
      depFrac,
      arrTripKey: bestArrTripKey,
      depTripKey: bestDepTripKey,
    };
  }
  // ---- End handoff detection ----

  // Remove handoff days from synchronous conflict counts — handoff pairs don't actually conflict.
  if (cellCounts) {
    for (const [hBusId, days] of Object.entries(handoffByBus)) {
      for (const [dayStr, ho] of Object.entries(days)) {
        const key = `${hBusId}|${dayStr}`;
        if (!cellCounts[key] || cellCounts[key] <= 1) continue;
        const items = cellItems?.[key] || [];
        const keep = items.filter(
          (it) => it.tripKey !== ho.arrTripKey && it.tripKey !== ho.depTripKey,
        );
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
        if (occ[d]) {
          ok = false;
          break;
        }
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
        const isHandoffDepTrip =
          depY >= weekStart && handoffByBus[busId]?.[startIdx]?.depTripKey === t.tripKey;
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

        // Rows r1–r9 (r10 = action row, revealed on expand)
        const r1 = makeRow("1");
        const r2 = makeRow("2");
        const r3 = makeRow("3");
        const r4 = makeRow("4");
        const r5 = makeRow("5");
        const r6 = makeRow("6");
        const r7 = makeRow("7");

        // Action row — revealed at the bottom of the bar when expanded
        const rAction = document.createElement("div");
        rAction.className = "schedule-grid__trip-bar__row--11";
        let pdfBtn = null;
        [
          { action: "load", icon: "edit", title: "Load trip" },
          { action: "pdf", icon: "upload_file", title: "Attach itinerary PDF" },
          { action: "driverContact", icon: "chat", title: "Driver contact info" },
          { action: "envelope", icon: "mail_outline", title: "Envelope" },
          { action: "tripReview", icon: "manage_search", title: "Trip review" },
          { action: "more", icon: "more_horiz", title: "More options" },
        ].forEach(({ action, icon, title }) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "schedule-grid__trip-bar__action-btn";
          btn.dataset.action = action;
          btn.title = title;
          btn.setAttribute("aria-label", title);
          btn.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>`;
          rAction.appendChild(btn);
          if (action === "pdf") pdfBtn = btn;
        });

        // Row 1: [multiBadge] [title] [top-status badges] [paidBadge]
        const multiBadge = document.createElement("span");
        multiBadge.className = "schedule-grid__trip-bar__multi-badge";
        multiBadge.setAttribute("aria-hidden", "true");
        r1.appendChild(multiBadge);

        const line1 = document.createElement("div");
        line1.className = "schedule-grid__trip-bar__title";
        r1.appendChild(line1);

        // paidBadge and r1TopBadges are appended after bI/bC/b$ are created below

        // Row 2: Customer (sub)
        const line2 = document.createElement("div");
        line2.className = "schedule-grid__trip-bar__sub";
        r2.appendChild(line2);

        // Row 3: Contact name (sub)
        const line3 = document.createElement("div");
        line3.className = "schedule-grid__trip-bar__sub schedule-grid__trip-bar__contact";
        r3.appendChild(line3);

        // Row 4: [req icons] [notes — centered absolute] [paid badge — right]
        const barReqIcons = document.createElement("div");
        barReqIcons.className = "schedule-grid__trip-bar__req-icons";
        const notesEl = document.createElement("div");
        notesEl.className = "schedule-grid__trip-bar__notes";
        r4.append(barReqIcons, notesEl);

        // Row 5: Time row (depart · spot · arrive)
        const timeRow = document.createElement("div");
        timeRow.className = "schedule-grid__trip-bar__time-row";
        const left = document.createElement("span");
        left.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--left";
        const center = document.createElement("span");
        center.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--center";
        const right = document.createElement("span");
        right.className = "schedule-grid__trip-bar__time schedule-grid__trip-bar__time--right";
        timeRow.append(left, center, right);
        bar._timeRow = timeRow;
        r5.appendChild(timeRow);

        // Badge helpers — used in r1 top-status group, r6 driver slots
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

        const bI = makeMini("attach_file_off", true); // Itinerary — status indicator only
        const bC = makeMini("phone_enabled", true); // Contact
        const b$ = makeMini("description", true); // Payment / Approval
        const bD1 = makeMini("person", true); // Driver 1
        const bD2 = makeMini("person", true); // Driver 2 (co-driver)
        const bD3 = makeMini("autorenew", true); // Relief 1
        const bD4 = makeMini("autorenew", true); // Relief 2

        // Complete row 1: [title] → top-status group including paid badge
        const paidBadge = document.createElement("span");
        paidBadge.className =
          "schedule-grid__trip-bar__paid-badge material-symbols-outlined is-hidden";
        paidBadge.setAttribute("aria-hidden", "true");
        paidBadge.textContent = "check";

        const r1TopBadges = document.createElement("div");
        r1TopBadges.className = "schedule-grid__trip-bar__top-status-badges";
        r1TopBadges.setAttribute("aria-hidden", "true");
        r1TopBadges.append(b$, bI, bC, paidBadge);
        r1.appendChild(r1TopBadges);

        // Row 6: Drivers — each slot = [icon] [name]
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
        r6.appendChild(driversRow);

        // Row 7: Driver pay
        const driverPayRow = document.createElement("div");
        driverPayRow.className = "schedule-grid__trip-bar__driver-pay";

        const pay1Slot = document.createElement("span");
        pay1Slot.className = "schedule-grid__trip-bar__pay-slot";
        const pay2Slot = document.createElement("span");
        pay2Slot.className = "schedule-grid__trip-bar__pay-slot";
        const pay3Slot = document.createElement("span");
        pay3Slot.className = "schedule-grid__trip-bar__pay-slot";
        const pay4Slot = document.createElement("span");
        pay4Slot.className = "schedule-grid__trip-bar__pay-slot";

        driverPayRow.append(pay1Slot, pay2Slot, pay3Slot, pay4Slot);
        r7.appendChild(driverPayRow);

        // Row 8: Estimate fields — separate spans; order: price, mi, drv, dot
        const r8 = makeRow("8");
        const estimateRow = document.createElement("div");
        estimateRow.className = "schedule-grid__trip-bar__estimate-row";
        const estPrice = document.createElement("span");
        const estMi    = document.createElement("span");
        const estDrv   = document.createElement("span");
        const estDot   = document.createElement("span");
        estPrice.className = estMi.className =
          estDrv.className = estDot.className =
            "schedule-grid__trip-bar__estimate-summary";
        estimateRow.append(estPrice, estMi, estDrv, estDot);
        r8.appendChild(estimateRow);

        // Row 9: Billing / invoice fields (invoice number, PO, actual miles)
        const r9 = makeRow("9");
        const billingRow = document.createElement("div");
        billingRow.className = "schedule-grid__trip-bar__billing-row";
        r9.appendChild(billingRow);

        // Row 10: Payment references (ref1, ref2, ref3, paid date)
        const r10 = makeRow("10");
        const paymentRow = document.createElement("div");
        paymentRow.className = "schedule-grid__trip-bar__payment-row";
        r10.appendChild(paymentRow);

        // Append all rows — rAction is last (bottom of bar when expanded)
        bar.append(r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, rAction);

        // Keep your existing references working
        bar._multiBadge = multiBadge;
        bar._paidBadge = paidBadge;
        bar._r1TopBadges = r1TopBadges;
        bar._reqIcons = barReqIcons;
        bar._line1 = line1;
        bar._line2 = line2;
        bar._line3 = line3;
        bar._left = left;
        bar._center = center;
        bar._right = right;
        bar._bI = bI;
        bar._pdfBtn = pdfBtn;
        bar._bC = bC;
        bar._b$ = b$;
        bar._bD1 = bD1;
        bar._bD2 = bD2;
        bar._bD3 = bD3;
        bar._bD4 = bD4;
        bar._notes = notesEl;
        bar._estMi    = estMi;
        bar._estPrice = estPrice;
        bar._estDrv   = estDrv;
        bar._estDot   = estDot;
        bar._billingRow = billingRow;
        bar._paymentRow = paymentRow;
        bar._drivers = driversRow;
        bar._d1Slot = d1Slot;
        bar._d2Slot = d2Slot;
        bar._d3Slot = d3Slot;
        bar._d4Slot = d4Slot;
        bar._d1Name = d1Name;
        bar._d2Name = d2Name;
        bar._d3Name = d3Name;
        bar._d4Name = d4Name;
        bar._pay1 = pay1Slot;
        bar._pay2 = pay2Slot;
        bar._pay3 = pay3Slot;
        bar._pay4 = pay4Slot;

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
        const contactStatus = String(t.contactStatus || "")
          .trim()
          .toLowerCase();
        bar._bC.classList.toggle(
          "is-hidden",
          contactStatus === "not required" || contactStatus === "received",
        );
      }
      // Customer payment bar badge logic done below instead of generic setBadge
      if (bar._bD1) setBadge(bar._bD1, a.driver1Status || "Pending");
      if (bar._bD2) setBadge(bar._bD2, a.driver2Status || "Pending");
      if (bar._bD3) setBadge(bar._bD3, a.driver3Status || "Pending");
      if (bar._bD4) setBadge(bar._bD4, a.driver4Status || "Pending");

      // Custom payment status icon based on value for trip bars
      if (bar._b$) {
        const ps = String(t.paymentStatus || "")
          .trim()
          .toLowerCase();
        const inv = String(t.invoiceStatus || "")
          .trim()
          .toLowerCase();
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

      // Itinerary badge — pure status indicator, no click behaviour (PDF is via action row).
      // Hidden once the itinerary is confirmed (Received) or a PDF is attached, since the
      // PDF action button already surfaces that state.
      if (bar._bI) {
        const itinStatus = String(t.itineraryStatus || "")
          .trim()
          .toLowerCase();
        const itinDone =
          itinStatus === "not required" ||
          itinStatus === "received" ||
          !!t.itineraryPdfUrl;
        bar._bI.classList.toggle("is-hidden", itinDone);
        bar._bI.classList.remove("has-pdf");
        const glyph = bar._bI.querySelector(".schedule-grid__trip-bar__badge-glyph");
        if (glyph) glyph.textContent = t.itineraryPdfUrl ? "attach_file" : "attach_file_off";
      }

      // PDF action button — shows upload_file when no PDF, picture_as_pdf when one exists.
      // Hidden when itinerary is Not Required and no PDF is attached.
      if (bar._pdfBtn) {
        const hasPdf = !!t.itineraryPdfUrl;
        const notRequired =
          String(t.itineraryStatus || "")
            .trim()
            .toLowerCase() === "not required";
        bar._pdfBtn.classList.toggle("is-hidden", notRequired && !hasPdf);
        const glyph = bar._pdfBtn.querySelector(".material-symbols-outlined");
        if (hasPdf) {
          if (glyph) glyph.textContent = "attach_file";
          bar._pdfBtn.title = "Open itinerary PDF";
          bar._pdfBtn.setAttribute("aria-label", "Open itinerary PDF");
          bar._pdfBtn.dataset.pdfState = "view";
        } else {
          if (glyph) glyph.textContent = "upload_file";
          bar._pdfBtn.title = "Attach itinerary PDF";
          bar._pdfBtn.setAttribute("aria-label", "Attach itinerary PDF");
          bar._pdfBtn.dataset.pdfState = "upload";
        }
      }

      // Driver 1 status icon — static indicator only, contact opened via action row button
      if (bar._bD1) {
        bar._bD1.classList.remove("is-hidden", "has-action");
        const glyph = bar._bD1.querySelector(".schedule-grid__trip-bar__badge-glyph");
        if (glyph) {
          glyph.textContent = "person";
          delete glyph.dataset.action;
          delete glyph.dataset.tripkey;
          glyph.style.cursor = "";
        }
      }

      // Driver 2 (co-driver) slot
      if (bar._bD2) {
        const needsD2 = t.reqCoDriver || (a.driver2 && a.driver2 !== "None");
        bar._d2Slot.classList.toggle("is-hidden", !needsD2);
        if (needsD2) {
          const glyph = bar._bD2.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) glyph.textContent = "person";
        }
      }

      // Relief 1 slot — hide if no driver assigned AND this bus's slot is confirmed
      // (dispatcher marked relief not needed for this specific bus)
      if (bar._bD3) {
        const d3Assigned = a.driver3 && a.driver3 !== "None";
        const d3ConfirmedEmpty =
          !d3Assigned &&
          (a.driver3Status || "").trim().toLowerCase() === "confirmed";
        const needsD3 = (t.reqRelief || d3Assigned) && !d3ConfirmedEmpty;
        bar._d3Slot.classList.toggle("is-hidden", !needsD3);
        if (needsD3) {
          const glyph = bar._bD3.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) glyph.textContent = "autorenew";
        }
      }

      // Relief 2 slot — same logic as relief 1
      if (bar._bD4) {
        const d4Assigned = a.driver4 && a.driver4 !== "None";
        const d4ConfirmedEmpty =
          !d4Assigned &&
          (a.driver4Status || "").trim().toLowerCase() === "confirmed";
        const needsD4 = (t.reqRelief2 || d4Assigned) && !d4ConfirmedEmpty;
        bar._d4Slot.classList.toggle("is-hidden", !needsD4);
        if (needsD4) {
          const glyph = bar._bD4.querySelector(".schedule-grid__trip-bar__badge-glyph");
          if (glyph) glyph.textContent = "autorenew";
        }
      }

      if (bar._estPrice) {
        const estFields = [
          { el: bar._estPrice, val: t.quotedPrice      ? `$${t.quotedPrice}`          : "" },
          { el: bar._estMi,    val: t.estimatedMileage ? `${t.estimatedMileage}mi`    : "" },
          { el: bar._estDrv,   val: t.drivingHours     ? String(t.drivingHours)       : "" },
          { el: bar._estDot,   val: t.onDutyHours      ? String(t.onDutyHours)        : "" },
        ];
        let first = true;
        estFields.forEach(({ el, val }) => {
          if (val) {
            el.textContent  = val;
            el.style.display = "";
            first = false;
          } else {
            el.textContent  = "";
            el.style.display = "none";
          }
        });
      }

      // Requirement icons (left of status badges) from trip req flags
      const reqSpec = [
        { key: "req56Pass", icon: "tatami_seat" },
        { key: "reqSleeper", icon: "airline_seat_flat" },
        { key: "reqLift", icon: "accessible" },
        { key: "reqHotel", icon: "apartment" },
        { key: "reqFuelCard", icon: "credit_card" },
        { key: "reqWifi", icon: "wifi" },
      ];
      if (bar._reqIcons) {
        const reqSig = reqSpec.map(({ key }) => (t[key] ? "1" : "0")).join("");
        if (bar._reqSig !== reqSig) {
          bar._reqSig = reqSig;
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
      }

      bar.classList.toggle("cont-left", continuesLeft);
      bar.classList.toggle("cont-right", continuesRight);
      bar.classList.toggle("cont-single", (continuesLeft || continuesRight) && startIdx === endIdx);
      if (bar._timeRow) {
        if (continuesLeft && !bar._contLeftIcon) {
          const el = document.createElement("span");
          el.className =
            "material-symbols-outlined schedule-grid__trip-bar__time-arrow schedule-grid__trip-bar__time-arrow--left";
          el.textContent = "west";
          bar._timeRow.prepend(el);
          bar._contLeftIcon = el;
        } else if (!continuesLeft && bar._contLeftIcon) {
          bar._contLeftIcon.remove();
          bar._contLeftIcon = null;
        }
        if (continuesRight && !bar._contRightIcon) {
          const el = document.createElement("span");
          el.className =
            "material-symbols-outlined schedule-grid__trip-bar__time-arrow schedule-grid__trip-bar__time-arrow--right";
          el.textContent = "east";
          bar._timeRow.append(el);
          bar._contRightIcon = el;
        } else if (!continuesRight && bar._contRightIcon) {
          bar._contRightIcon.remove();
          bar._contRightIcon = null;
        }
      }

      const pay = String(t.paymentStatus || "").toLowerCase();
      // Red unconfirmed if "Pending Quote" or "Quoted" (or legacy "pending")
      const isUnconfirmed = pay === "pending quote" || pay === "quoted" || pay === "pending";
      bar.classList.toggle("unconfirmed", isUnconfirmed);

      if (bar._paidBadge) {
        const payment = String(t.paymentStatus || "")
          .trim()
          .toLowerCase();
        const invoice = String(t.invoiceStatus || "")
          .trim()
          .toLowerCase();
        const isAllClear =
          payment === "po received" || payment === "not required" || invoice === "paid in full";

        if (isAllClear) {
          bar._paidBadge.classList.add("material-symbols-outlined");
          bar._paidBadge.classList.remove("is-hidden", "is-alert", "is-solid", "is-date");
          bar._paidBadge.textContent = t.datePaid ? "paid" : "check";
        } else {
          bar._paidBadge.classList.add("is-hidden");
          bar._paidBadge.classList.remove("is-alert", "is-date");
        }
        bar.classList.toggle("has-paid-badge", isAllClear);
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
      } else if (tripColor && tripColor !== "round-trip") {
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

        bar._left.textContent = tDep || "—";
        bar._center.textContent = tSpot || "—";
        bar._right.textContent = tArr || "—";

        bar._left.dataset.severity = getTimeSeverity(depTime, "depart");
        bar._center.dataset.severity = "normal";
        bar._right.dataset.severity = getTimeSeverity(arrTime, "arrive");
      } else {
        // Multi-Day:
        // Left side shows Dep Time (only if this bar is the trip start)
        // Right side shows Arr Time (only if this bar is the trip end)
        if (isStartDay) {
          bar._left.textContent = formatTime12(depTime) || "—";
          bar._center.textContent = formatTime12(spotTime) || "—";
          bar._left.dataset.severity = getTimeSeverity(depTime, "depart");
          bar._center.dataset.severity = "normal";
        } else {
          bar._left.textContent = "";
          bar._center.textContent = "";
          bar._left.dataset.severity = "normal";
          bar._center.dataset.severity = "normal";
        }

        if (isEndDay) {
          bar._right.textContent = formatTime12(arrTime) || "—";
          bar._right.dataset.severity = getTimeSeverity(arrTime, "arrive");
        } else {
          bar._right.textContent = "";
          bar._right.dataset.severity = "normal";
        }
      }

      if (bar._billingRow) {
        const invPart = t.invoiceNumber ? `#${t.invoiceNumber}` : "#TBD";
        const poPart  = t.paymentType   ? `PO${t.paymentType}`  : "";
        const miPart  = t.tripMiles     ? `${t.tripMiles}mi`    : "";
        bar._billingRow.textContent = [invPart, poPart, miPart].filter(Boolean).join(" ");
      }

      if (bar._paymentRow) {
        const refs = [t.ref1, t.ref2, t.ref3].filter(Boolean);
        const paidPart = t.datePaid ? `PAID ${formatDateShort(t.datePaid)}` : "";
        bar._paymentRow.textContent = [...refs, paidPart].filter(Boolean).join(" • ");
      }

      if (bar._notes) {
        bar._notes.textContent = t.notes ? clipText(t.notes, 120) : "";
      }

      bar._d1Name.textContent = d1;
      bar._d2Name.textContent = d2 && d2 !== "—" ? d2 : "";
      bar._d3Name.textContent = d3 && d3 !== "—" ? d3 : "";
      bar._d4Name.textContent = d4 && d4 !== "—" ? d4 : "";

      // Row 7: driver pay — "$350 • TBD" format (no D1/D2 labels), combined into first slot
      if (bar._pay1) {
        const fmtSlot = (_idx, pay, driver) => {
          if (!driver || driver === "—") return "";
          return pay ? `$${String(pay).replace(/^\$/, "")}` : "TBD";
        };
        bar._pay1.textContent = [
          fmtSlot(1, a.driver1Pay, d1),
          fmtSlot(2, a.driver2Pay, d2),
          fmtSlot(3, a.driver3Pay, d3),
          fmtSlot(4, a.driver4Pay, d4),
        ].filter(Boolean).join(" • ");
        if (bar._pay2) bar._pay2.textContent = "";
        if (bar._pay3) bar._pay3.textContent = "";
        if (bar._pay4) bar._pay4.textContent = "";
      }

      positionBarWithinOverlay(bar, bars, col, startIdx, endIdx);

      // Handoff split: proportional allocation when another trip starts/ends on the same bus
      // on this day. Takes priority over the fixed half-day logic for the shared day.
      const busHandoff = handoffByBus[busId];
      const endHandoff = busHandoff?.[endIdx];
      const startHandoff = busHandoff?.[startIdx];
      const activeHandoffEnd = endHandoff && isEndDay && endHandoff.arrTripKey === t.tripKey;
      const activeHandoffStart =
        startHandoff && isStartDay && startHandoff.depTripKey === t.tripKey;

      if (activeHandoffEnd) {
        const clip = (1 - endHandoff.arrFrac) * (col.widths[endIdx] ?? 0);
        bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - clip)}px`;
        bar.dataset.handoffArr = String(endHandoff.arrFrac);
      } else {
        delete bar.dataset.handoffArr;
        // Half-day truncation: shorten bar to 1/3 of last column if trip returns 4AM–11:59AM
        const isHalfDayReturn =
          !isActualSingleDay && isEndDay && !!arrTime && arrTime >= "04:00" && arrTime < "12:00";
        bar.classList.toggle("half-day-return", isHalfDayReturn);
        if (isHalfDayReturn) {
          const currentWidth = parseFloat(bar.style.width) || 0;
          const lastColW = col.widths[endIdx] ?? 0;
          bar.style.width = `${Math.max(0, currentWidth - (lastColW * 2) / 3)}px`;
        }
      }

      if (activeHandoffStart) {
        const shift = startHandoff.depFrac * (col.widths[startIdx] ?? 0);
        bar.style.left = `${(parseFloat(bar.style.left) || 0) + shift}px`;
        bar.style.width = `${Math.max(0, (parseFloat(bar.style.width) || 0) - shift)}px`;
        bar.dataset.handoffDep = String(startHandoff.depFrac);
      } else {
        delete bar.dataset.handoffDep;
        // Half-day departure: shift bar right by 2/3 of first column if trip departs after 10PM
        const isHalfDayDepart = !isActualSingleDay && isStartDay && !!depTime && depTime >= "22:00";
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

  const barCss = getComputedStyle(document.body);
  const insetTopPx = parseFloat(barCss.getPropertyValue("--tripbar-inset-top")) || 0;
  const insetBottomPx = parseFloat(barCss.getPropertyValue("--tripbar-inset-bottom")) || 0;

  for (const [busId, list] of barsByBus) {
    const laneCount = (lanesByBus[busId] || []).length || 1;

    // Waiting list row grows to fit stacked trips; others use single row height
    const isWaitingList = busId === "WAITING_LIST";

    // FIX: Using 'step' (110px) instead of 'rowH' (100px) for the waiting list height
    // to ensure there is enough vertical room for the stacked bars + their gaps.
    const effectiveRowH = isWaitingList ? Math.max(1, laneCount) * step : rowH;
    const maxTop = Math.max(insetTopPx, effectiveRowH - barH - insetBottomPx);

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

      let topPx = lane * step + insetTopPx;
      // Clamp to ensure bar stays within its row bounds
      topPx = Math.max(insetTopPx, Math.min(topPx, maxTop));
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
          const keep = items.filter(
            (it) => it.tripKey !== ho.arrTripKey && it.tripKey !== ho.depTripKey,
          );
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
