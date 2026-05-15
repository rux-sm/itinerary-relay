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
    state.tripFormOpen = false;
    state.tripFormWeekKey = null;
    // Close all cards
    Object.keys(CARD_CONFIG).forEach((cardType) => hideCard(cardType));
  } else {
    if (mode === "trip") {
      state.tripFormOpen = true;
      state.tripFormWeekKey = getWeekRange().start;
    }
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

