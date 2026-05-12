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

  if (dom.scheduleStatusLabel) {
    const isIdle = safeMode === "idle";
    dom.scheduleStatusLabel.textContent = isIdle ? "" : label;
    dom.scheduleStatusLabel.classList.toggle("is-visible", !isIdle);
    dom.scheduleStatusLabel.classList.toggle("is-stale", safeMode === "stale");
    dom.scheduleStatusLabel.classList.toggle("is-error", safeMode === "error");
  }
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
  if (token == null) return;

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
