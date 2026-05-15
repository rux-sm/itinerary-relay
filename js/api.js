// ======================================================
// 11) FETCH + RETRY + API
// ======================================================
async function fetchAPI(fn, params = {}, timeoutMs = CONFIG.JSONP_TIMEOUT) {
  return withRetry(
    async (attempt) => {
      const url = new URL(CONFIG.ENDPOINT);
      url.searchParams.set("fn", fn);

      url.searchParams.set("_", Date.now().toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });

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
      totalTimeoutMs: 60000,
      shouldRetry: (err) => {
        if (err.status && err.status >= 400 && err.status < 500) return false;
        return true;
      },
    },
  );
}

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

  async saveTrip(body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.JSONP_TIMEOUT);
    try {
      const resp = await fetch(CONFIG.ENDPOINT, {
        method: "POST",
        body,
        mode: "cors",
        credentials: "omit",
        signal: controller.signal,
      }).then((r) => r.json());
      if (!resp?.ok) throw new Error(resp?.error || "Save failed");
      return resp;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async setChecklist(tripKey, date, saved, signal) {
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
      signal,
    }).then((r) => r.json());
    if (!resp?.ok) console.warn("[checklist setChecklist] GAS error:", resp?.error, resp);
    return resp;
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

    const existingTrips = state.trips.filter((t) => String(t.tripKey) !== String(trip.tripKey));

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
// ERROR LOGGING
// ======================================================
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

      await fetchAPI("logError", errorData);
    } catch (e) {
      // Silently fail
    }
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
    promise: String(e.promise),
  });
});
