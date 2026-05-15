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
  dom.ctxEnvelopeBtn?.addEventListener("click", () => {
    if (activeContextTripKey) {
      openEnvelopeModal(activeContextTripKey);
      closeTripContextMenu();
    }
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
      if (
        !confirmDiscardIfDirty(
          "You have unsaved changes. Loading this trip to remove its PDF will discard them. Continue?",
        )
      )
        return;
      toastShow("Loading trip to remove PDF...", "loading", {
        indeterminate: true,
        source: "pdf-delete",
      });
      await openTripForEdit(capturedTripKey);
    }

    toastShow("Deleting PDF...", "loading", { indeterminate: true, source: "pdf-delete" });
    trip.itineraryPdfUrl = ""; // Clear from local state
    refreshShortcutRow();
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
      if (
        !confirmDiscardIfDirty(
          "You have unsaved changes. Loading this trip will discard them. Continue?",
        )
      )
        return;
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
      if (
        !confirmDiscardIfDirty(
          "You have unsaved changes. Loading this trip will discard them. Continue?",
        )
      )
        return;
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
        trip.itineraryStatus = json.itineraryStatus || trip.itineraryStatus;
        scheduleAgendaReflow();
      }

      toastHide(0, { source: "pdf-upload" });
      toast("PDF Uploaded ✓", "success", 1800);
      refreshShortcutRow();
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
    // Click (Tap) - all devices and specific icon clicks
    container.addEventListener("click", async (e) => {
      // Action row button clicks (delegated)
      const actionBtn = e.target.closest(".schedule-grid__trip-bar__action-btn");
      if (actionBtn) {
        e.stopPropagation();
        const bar = actionBtn.closest(".schedule-grid__trip-bar");
        const tripKey = bar?.dataset?.tripkey;
        if (!tripKey) return;
        const action = actionBtn.dataset.action;
        if (action === "load") {
          openTripForEdit(tripKey);
        } else if (action === "pdf") {
          if (actionBtn.dataset.pdfState === "view") {
            const trip = state.tripByKey?.[tripKey];
            if (trip?.itineraryPdfUrl) window.open(trip.itineraryPdfUrl, "_blank");
          } else {
            // Reuse the existing hidden file input + upload handler
            state.pendingItineraryTripKey = tripKey;
            dom.itineraryPdfInput?.click();
          }
        } else if (action === "driverContact") {
          openDriverContactModal(tripKey);
        } else if (action === "envelope") {
          openEnvelopeModal(tripKey);
        } else if (action === "tripReview") {
          openTripDetailsModal(tripKey);
        } else if (action === "more") {
          const rect = bar.getBoundingClientRect();
          showTripContextMenu(rect.left + rect.width / 2, rect.bottom + window.scrollY, tripKey);
        }
        return;
      }

      // Selection (all devices)
      const clickedBar = e.target.closest(".schedule-grid__trip-bar");
      selectTripBar(clickedBar || null);

      // On desktop, expand only the clicked bar (not all bars for the trip)
      if (!isMobileOnly() && clickedBar) {
        const wasExpanded = clickedBar.classList.contains("expanded");

        // Collapse any currently expanded bar — class removal switches the
        // transition back to collapse timing; setting height back to the
        // stored collapsed px animates the bar shut.
        document.querySelectorAll(".schedule-grid__trip-bar.expanded").forEach((b) => {
          b.classList.remove("expanded");
          b.style.height = b.dataset.collapsedHeight || "";
          delete b.dataset.collapsedHeight;
          b.parentElement.style.zIndex = "";
          const td = b.parentElement.parentElement;
          if (td?.tagName === "TD") td.style.zIndex = "";
        });

        if (!wasExpanded) {
          // 1. Snapshot the current rendered height as a concrete px value.
          //    positionBarWithinOverlay sets style.height to calc() — browsers
          //    won't reliably transition from calc()→px even when they resolve
          //    to the same length, so we convert to px first.
          const collapsedPx = clickedBar.getBoundingClientRect().height;
          clickedBar.dataset.collapsedHeight = collapsedPx + "px";
          clickedBar.style.height = collapsedPx + "px";

          // 2. Flush layout so the browser commits collapsedPx as the
          //    "before" state before we change timing and target height.
          void clickedBar.offsetHeight;

          // 3. Add class — switches transition to expand timing and sets
          //    --tripbar-action-row-height: 30px for the grid track.
          clickedBar.classList.add("expanded");

          // Elevate both the .schedule-grid__row-bars overlay AND its parent <td>
          // (.schedule-grid__cell has position:relative, so adding z-index creates
          // a stacking context that clears the cell above all other row cells).
          clickedBar.parentElement.style.zIndex = "50";
          const expandedTd = clickedBar.parentElement.parentElement;
          if (expandedTd?.tagName === "TD") expandedTd.style.zIndex = "50";

          // 4. Read the action-row height now that .expanded is applied,
          //    then grow the bar by exactly that amount + one row-gap.
          //    The content grows by actionRowH; the bar grows by actionRowH +
          //    rowGapH, so the two stay in lockstep — overflow:hidden never
          //    clips anything mid-animation.
          const cs = getComputedStyle(clickedBar);
          const actionRowH = parseFloat(cs.getPropertyValue("--tripbar-action-row-height")) || 30;
          const rowGapH = parseFloat(cs.getPropertyValue("--tripbar-row-gap")) || 0;
          // In compact mode rows 5, 6 & 8 are 0px when collapsed but CSS restores them
          // once .expanded is added, so we must account for their heights here.
          const hiddenRowsH = document.body.classList.contains("bars-compact")
            ? (parseFloat(cs.getPropertyValue("--tripbar-r5-row-height")) || 16) +
              (parseFloat(cs.getPropertyValue("--tripbar-r6-row-height")) || 16) +
              (parseFloat(cs.getPropertyValue("--tripbar-r8-row-height")) || 16)
            : 0;
          clickedBar.style.height = collapsedPx + hiddenRowsH + actionRowH + rowGapH + "px";
        }
        return;
      }

    });

    // Enter/Space — same as clicking the bar
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const bar = e.target.closest(".schedule-grid__trip-bar");
      if (!bar) return;
      e.preventDefault();
      bar.click();
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
  window.addEventListener("beforeunload", (e) => {
    if (state.tripFormDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // Delegated handler for conflict list — avoids accumulating listeners on each re-render
  // Single Escape handler for all modals — replaces per-modal document.addEventListener calls
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modalClosers = [
      { el: dom.itineraryModal, close: closeItineraryModal },
      { el: dom.tripDetailsModal, close: closeTripDetailsModal },
      { el: dom.envelopeModal, close: closeEnvelopeModal },
      { el: dom.nextDayReportModal, close: () => closeModalA11y(dom.nextDayReportModal) },
      {
        el: dom.dailyMaintenancePlanModal,
        close: () => closeModalA11y(dom.dailyMaintenancePlanModal),
      },
      { el: dom.driverWeekScheduleModal, close: () => closeModalA11y(dom.driverWeekScheduleModal) },
      { el: dom.driverContactModal, close: () => closeModalA11y(dom.driverContactModal) },
    ];
    for (const { el, close } of modalClosers) {
      if (el && !el.hidden) {
        close();
        break;
      }
    }
  });

  dom.conflictList?.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tripkey]");
    if (!el) return;
    if (isMobileOnly()) return openTripDetailsModal(el.dataset.tripkey);
    if (!confirmDiscardIfDirty()) return;
    openTripForEdit(el.dataset.tripkey);
  });
  dom.conflictList?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("[data-tripkey]");
    if (!el) return;
    e.preventDefault();
    if (isMobileOnly()) return openTripDetailsModal(el.dataset.tripkey);
    if (!confirmDiscardIfDirty()) return;
    openTripForEdit(el.dataset.tripkey);
  });

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
  ["paymentStatus", "driverStatus", "invoiceStatus"].forEach((id) => {
    const el = $(id);
    updateStatusSelect(el);
    el.addEventListener("change", () => updateStatusSelect(el));
  });

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

  // Compact bars toggle — hides rows 5 (status) and 6 (pre-drivers) until a bar is expanded.
  (function initCompactBars() {
    const btn = dom.compactBarsBtn;
    if (!btn) return;

    function applyCompact(compact) {
      document.body.classList.toggle("bars-compact", compact);
      btn.setAttribute("aria-pressed", String(compact));
      const glyph = btn.querySelector(".material-symbols-outlined");
      if (glyph) glyph.textContent = compact ? "unfold_more" : "unfold_less";
      btn.title = compact ? "Show all rows" : "Compact bars";
      btn.setAttribute("aria-label", btn.title);
      // Bust the cached bar metrics so JS re-reads --tripbar-height on next render
      state.barMetrics = null;
      // Collapse any expanded bar before re-rendering
      document.querySelectorAll(".schedule-grid__trip-bar.expanded").forEach((b) => {
        b.classList.remove("expanded");
        b.style.height = b.dataset.collapsedHeight || "";
        delete b.dataset.collapsedHeight;
        b.parentElement.style.zIndex = "";
        const td = b.parentElement.parentElement;
        if (td?.tagName === "TD") td.style.zIndex = "";
      });
      // Re-render so bars reposition against the new row height
      _renderAgendaInner();
      try { localStorage.setItem("barsCompact", compact ? "1" : "0"); } catch (_) {}
    }

    // Restore persisted state
    try {
      if (localStorage.getItem("barsCompact") === "1") applyCompact(true);
    } catch (_) {}

    btn.addEventListener("click", () => {
      applyCompact(!document.body.classList.contains("bars-compact"));
    });
  })();

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

  dom.quoteBtn?.addEventListener("click", () => {
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

  let _lastDragCell = null;
  dom.driverWeekBody.addEventListener(
    "mouseover",
    (e) => {
      if (!state.dragSelection.active) return;
      const td = e.target.closest("td");
      if (!td || td === _lastDragCell) return;
      _lastDragCell = td;
      if (td.dataset.driver !== state.dragSelection.driver || !td.dataset.date) return;
      if (td.classList.contains("driver-week__cell--on")) return;
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
    if (getCardPanel("log")) loadActivityLog(logActiveTripKey);
  });

  dom.logRefreshBtn?.addEventListener("click", () => {
    loadActivityLog(logActiveTripKey);
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
    try {
      localStorage.setItem("waitingListVisible", visible ? "1" : "0");
    } catch {}
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
        .map((t) => String(t.tripKey)),
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
      document
        .querySelectorAll(".schedule-grid__trip-bar.today-highlighted")
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

  dom.shortcutEnvelopeBtn?.addEventListener("click", () => {
    const key = dom.tripKey.value;
    if (!key) {
      toast("Save the trip first.", "warning", 2000);
      return;
    }
    openEnvelopeModal(key);
  });

  dom.shortcutItineraryBtn?.addEventListener("click", () => {
    openItineraryModal();
  });

  dom.shortcutPdfBtn?.addEventListener("click", () => {
    const key = dom.tripKey.value;
    if (!key) {
      toast("Save the trip first.", "warning", 2000);
      return;
    }
    const trip = state.tripByKey?.[key];
    if (trip?.itineraryPdfUrl) {
      window.open(trip.itineraryPdfUrl, "_blank");
    } else {
      state.pendingItineraryTripKey = key;
      dom.itineraryPdfInput.click();
    }
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
    syncBusSegButtons();
  });

  document.querySelectorAll("#busesNeededSeg .rux-btn--toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      setBusesNeededAndSync(btn.dataset.value);
      syncBusSegButtons();
    });
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
    if (!dom.tripKey.value || state.pendingWrite) return;
    if (!confirm("Delete this trip?")) return;

    dom.saveBtn.disabled = true;

    const key = String(dom.tripKey.value);
    const tripId = String(dom.tripId?.value || "");

    const originalTrips = [...state.trips];
    const originalTripByKey = { ...state.tripByKey };
    const originalAssignments = { ...state.assignmentsByTripKey };

    const tripDate = state.tripByKey[key]?.departureDate || null;
    const tripArrival = state.tripByKey[key]?.arrivalDate || null;

    // Optimistic remove
    state.trips = state.trips.filter((t) => String(t.tripKey) !== key);
    delete state.tripByKey[key];
    delete state.assignmentsByTripKey[key];

    // Evict every week covered by the trip
    {
      let d = parseYMD(tripDate);
      const tripEnd = parseYMD(tripArrival || tripDate);
      while (d && tripEnd && d <= tripEnd) {
        clearCacheForTrip(ymd(d));
        d = addDays(d, 7);
      }
    }

    scheduleAgendaReflow();
    updateDriverWeekIfVisible();

    closeTripDetailsModal();
    toast("Trip deleted ✓", "success", 1500);
    resetTripFormUI();

    const _pwDep2 = tripDate ? parseYMD(tripDate) : null;
    const _pwWs2 = _pwDep2 ? startOfWeek(_pwDep2) : null;
    const writeWeekKey = _pwWs2 ? weekKey(ymd(_pwWs2), ymd(addDays(_pwWs2, 6))) : null;

    state.pendingWrite = {
      action: "delete",
      tripKey: key,
      mutationId: ++state.mutationId,
      writeWeekKey,
      originalTrips,
      originalTripByKey,
      originalAssignments,
    };

    const formBody = new URLSearchParams({ action: "delete", tripKey: key, tripId });

    api
      .saveTrip(formBody)
      .then(() => {
        state.weekCache.clear();
      })
      .catch((err) => {
        console.error(err);
        if (state.pendingWrite) {
          state.trips = state.pendingWrite.originalTrips;
          state.tripByKey = state.pendingWrite.originalTripByKey;
          state.assignmentsByTripKey = state.pendingWrite.originalAssignments;
          if (tripDate) clearCacheForTrip(tripDate);
          scheduleAgendaReflow();
          updateDriverWeekIfVisible();
        }
        toast("Delete may have failed — data restored. Refresh to confirm.", "danger", 8000);
      })
      .finally(() => {
        state.pendingWrite = null;
        dom.saveBtn.disabled = false;
        dom.action.value = "create";
        const { start, end } = getWeekRange();
        state.weekInFlight.delete(weekKey(start, end));
        if (state.pendingRefreshDeferred) {
          state.pendingRefreshDeferred = false;
          refreshWeekData({ silent: true });
        }
        if (state.pendingQuickEditSave.length) {
          const fn = state.pendingQuickEditSave.shift();
          if (!state.pendingQuickEditSave.length) toastHide(0, { source: "quick-edit-queue" });
          fn();
        }
      });
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

    if (dom.saveBtn.disabled || state.pendingWrite) return;
    if (dom.action.value === "delete") return;

    if (!dom.busesNeeded.value) {
      toast("Select the number of buses.", "danger", 2500);
      return;
    }

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

    // Auto-derive contact status from contact fields.
    // Only auto-derive when the field is in a default/unset state — preserve any
    // explicit user choice (e.g. "Assigned") so it isn't silently overridden to Pending.
    const envelopeContact = String($("envelopeTripContact")?.value || "").trim();
    const envelopePhone = String($("envelopeTripPhone")?.value || "").trim();
    let contactStatusValue = $("contactStatus").value;
    const AUTO_DERIVE_CONTACT = ["", "Pending", "Received"];
    if (contactStatusValue !== "Not Required" && AUTO_DERIVE_CONTACT.includes(contactStatusValue)) {
      contactStatusValue = envelopeContact && envelopePhone ? "Received" : "Pending";
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
        // Only auto-derive when the field is in an unset/default state.
        // Preserve explicit user choices (e.g. "Assigned") instead of silently forcing to Pending.
        const AUTO_DERIVE_ITINERARY = ["", "Pending", "Received"];
        if (!AUTO_DERIVE_ITINERARY.includes(cur)) return cur;
        const hasPdf = !!existingTrip?.itineraryPdfUrl;
        const hasContent = !!dom.itineraryField?.value?.trim();
        const derived = hasPdf || hasContent ? "Received" : "Pending";
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
      onDutyHours: $("onDutyHours")?.value || "",
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

    // Evict every week covered by the trip so multi-week trips don't leave stale middle-week caches
    {
      let d = parseYMD(optimisticTrip.departureDate);
      const tripEnd = parseYMD(optimisticTrip.arrivalDate || optimisticTrip.departureDate);
      while (d && tripEnd && d <= tripEnd) {
        clearCacheForTrip(ymd(d));
        d = addDays(d, 7);
      }
    }

    dom.saveBtn.disabled = true;

    // Sync requirement toggles to hidden inputs so backend receives them
    [
      "req56Pass",
      "reqSleeper",
      "reqLift",
      "reqRelief",
      "reqRelief2",
      "reqCoDriver",
      "reqHotel",
      "reqFuelCard",
      "reqWifi",
      "driverInfoSent",
      "tripReminderSent",
    ].forEach((id) => {
      const btn = $(id);
      const hidden = $(id + "Value");
      if (btn && hidden) {
        hidden.value = btn.getAttribute("aria-pressed") === "true" ? "true" : "false";
      }
    });

    // Clear status values for unassigned drivers so backend doesn't save them
    for (let i = 0; i < 10; i++) {
      const row = state.busRows[i];
      if (!row) continue;
      if (row.d1Sel.value === "None") row.d1StatusSel.value = "";
      if (row.d2Sel.value === "None") row.d2StatusSel.value = "";
      if (row.d3Sel.value === "None") row.d3StatusSel.value = "";
      if (row.d4Sel.value === "None") row.d4StatusSel.value = "";
    }

    // Capture form data before resetting (fetch POST replaces iframe submit)
    const formBody = new URLSearchParams(new FormData(dom.tripForm));

    const _pwDep = parseYMD(optimisticTrip.departureDate);
    const _pwWs = _pwDep ? startOfWeek(_pwDep) : null;
    const writeWeekKey = _pwWs ? weekKey(ymd(_pwWs), ymd(addDays(_pwWs, 6))) : null;

    state.pendingWrite = {
      action,
      tripKey: key,
      mutationId: ++state.mutationId,
      writeWeekKey,
      originalTrips,
      originalTripByKey,
      originalAssignments,
    };

    // Reset form immediately and show optimistic success
    resetTripFormUI();
    toast("Saved ✓", "success", 1200);

    api
      .saveTrip(formBody)
      .then((resp) => {
        const sKey = resp.trip ? String(resp.trip.tripKey || key) : key;
        if (resp.trip) {
          state.tripByKey[sKey] = resp.trip;
          const idx = state.trips.findIndex((t) => String(t.tripKey) === sKey);
          if (idx >= 0) state.trips[idx] = resp.trip;
        }
        if (resp.assignments) {
          state.assignmentsByTripKey[sKey] = resp.assignments
            .map(normalizeAssignment)
            .filter(Boolean);
        }
        scheduleAgendaReflow();
        updateDriverWeekIfVisible();
      })
      .catch((err) => {
        console.error(err);
        if (state.pendingWrite) {
          state.trips = state.pendingWrite.originalTrips;
          state.tripByKey = state.pendingWrite.originalTripByKey;
          state.assignmentsByTripKey = state.pendingWrite.originalAssignments;
          const orig = state.pendingWrite.originalTripByKey[key];
          if (orig?.departureDate) {
            clearCacheForTrip(orig.departureDate);
            if (orig.arrivalDate && orig.arrivalDate !== orig.departureDate) {
              clearCacheForTrip(orig.arrivalDate);
            }
          }
          scheduleAgendaReflow();
          updateDriverWeekIfVisible();
        }
        toast("Save failed — data restored. Please retry.", "danger", 8000);
      })
      .finally(() => {
        state.pendingWrite = null;
        dom.saveBtn.disabled = false;
        dom.action.value = dom.tripKey.value ? "update" : "create";
        const { start, end } = getWeekRange();
        state.weekInFlight.delete(weekKey(start, end));
        if (state.pendingRefreshDeferred) {
          state.pendingRefreshDeferred = false;
          refreshWeekData({ silent: true });
        }
        if (state.pendingQuickEditSave.length) {
          const fn = state.pendingQuickEditSave.shift();
          if (!state.pendingQuickEditSave.length) toastHide(0, { source: "quick-edit-queue" });
          fn();
        }
      });
  });

  function resetTripFormUI() {
    dom.tripForm.reset();
    resetRequirementToggles();
    refreshEmptyStateUI();
    setModeNew();

    // Reset custom selects to placeholder so triggers sync (form.reset doesn't fire change)
    setSelectToPlaceholder("busesNeeded");
    setSelectToPlaceholder("tripColor");
    ["paymentStatus", "driverStatus", "invoiceStatus"].forEach(setSelectToPlaceholder);

    dom.busesNeeded.value = "";
    syncBusSegButtons();
    updateBusRowVisibility();
    syncBusPanelState();
    refreshBusSelectOptions();

    // Reset bus/driver selects and sync triggers
    state.busRows.forEach((r) => {
      r.busSel.value = "None";
      r.d1Sel.value = "None";
      r.d1StatusSel.value = "";
      if (r.d1Pay) r.d1Pay.value = "";
      r.d2Sel.value = "None";
      r.d2StatusSel.value = "";
      if (r.d2Pay) r.d2Pay.value = "";
      r.d3Sel.value = "None";
      r.d3StatusSel.value = "";
      if (r.d3Pay) r.d3Pay.value = "";
      r.d4Sel.value = "None";
      r.d4StatusSel.value = "";
      if (r.d4Pay) r.d4Pay.value = "";
      r.busSel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d1Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d2Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d3Sel.dispatchEvent(new Event("change", { bubbles: true }));
      r.d4Sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    syncBusSelectEmptyState();

    ["paymentStatus", "driverStatus", "invoiceStatus"].forEach((id) => updateStatusSelect($(id)));
    updateInvoiceNumberVisibility();

    // Form has just been reset after save/delete; treat as clean.
    state.tripFormDirty = false;
    state.tripFormOpen = false;
    state.tripFormWeekKey = null;
    if (typeof syncEmptyFields === "function") syncEmptyFields();
    refreshShortcutRow();
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

  // Toggle buttons — click toggles aria-pressed
  // Skip bus-seg buttons: they're a single-select segmented control with their
  // own click handler in wireBusSegButtons (above), not independent toggles.
  document.querySelectorAll(".rux-btn--toggle").forEach((btn) => {
    if (btn.closest("#busesNeededSeg")) return;
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

// ── Top-level event wiring (report/envelope/driver modals) ──
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
document
  .getElementById("closeDriverWeekScheduleBtn")
  ?.addEventListener("click", () => closeModalA11y(dom.driverWeekScheduleModal));
document
  .getElementById("closeDriverWeekScheduleBackdrop")
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
