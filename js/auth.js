// ======================================================
// AUTH — Supabase session gate
// Runs before app.js boot. Resolves _authGate when the
// user has a valid session, blocking API calls until then.
// ======================================================

window._authGate = (async () => {
  const overlay = document.getElementById("loginOverlay");
  const $ = (id) => document.getElementById(id);

  function showView(viewId, title) {
    ["loginSignInView", "loginForgotView", "loginResetSentView", "loginSetPasswordView"].forEach(id => {
      const el = $(id);
      if (el) el.hidden = id !== viewId;
    });
    const titleEl = $("loginTitle");
    if (titleEl && title) titleEl.textContent = title;
  }

  function showError(elId, msg) {
    const el = $(elId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
  }

  function clearError(elId) {
    const el = $(elId);
    if (el) el.style.display = "none";
  }

  // Supabase auth callbacks arrive as URL hash params
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const hashType   = hashParams.get("type");
  const hashError  = hashParams.get("error_code");

  // Clean up hash so it doesn't linger on reload
  if (hashType || hashError) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  const { data: { session } } = await _sb.auth.getSession();

  // Already signed in and not a recovery flow — proceed
  if (session && hashType !== "recovery") {
    if (overlay) overlay.style.display = "none";
    if (typeof initRealtime === "function") initRealtime();
    if (typeof initProfile === "function") initProfile(session);
    return;
  }

  // Show the overlay for all remaining cases
  if (overlay) overlay.style.display = "flex";

  return new Promise((resolve) => {
    // Determine which view to show initially
    if (session && hashType === "recovery") {
      showView("loginSetPasswordView", "Set new password");
    } else if (hashError === "otp_expired") {
      showView("loginSignInView", "Sign in");
      showError("loginError", "Your reset link has expired. Use Forgot password to get a new one.");
    } else {
      showView("loginSignInView", "Sign in");
    }

    // ── Sign-in form ───────────────────────────────────────────────────────────
    $("loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError("loginError");
      const btn = $("loginBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }

      const { error } = await _sb.auth.signInWithPassword({
        email:    $("loginEmail")?.value?.trim() || "",
        password: $("loginPassword")?.value || "",
      });

      if (error) {
        showError("loginError", error.message || "Sign in failed. Check your email and password.");
        if (btn) { btn.disabled = false; btn.textContent = "Sign in"; }
        return;
      }

      if (overlay) overlay.style.display = "none";
      if (typeof initRealtime === "function") initRealtime();
      if (typeof initProfile === "function") {
        const { data: { session: s } } = await _sb.auth.getSession();
        if (s) initProfile(s);
      }
      resolve();
    });

    // ── Forgot password ────────────────────────────────────────────────────────
    $("loginForgotBtn")?.addEventListener("click", () => {
      clearError("loginError");
      showView("loginForgotView", "Reset password");
    });

    $("loginBackBtn")?.addEventListener("click", () => {
      clearError("loginForgotError");
      showView("loginSignInView", "Sign in");
    });

    $("loginForgotForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError("loginForgotError");
      const btn = $("loginResetBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

      const { error } = await _sb.auth.resetPasswordForEmail(
        $("loginForgotEmail")?.value?.trim() || "",
        { redirectTo: window.location.origin + window.location.pathname }
      );

      if (error) {
        showError("loginForgotError", error.message || "Could not send reset email.");
        if (btn) { btn.disabled = false; btn.textContent = "Send reset link"; }
        return;
      }

      showView("loginResetSentView", "Check your email");
    });

    $("loginBackBtn2")?.addEventListener("click", () => {
      showView("loginSignInView", "Sign in");
    });

    // ── Set new password (recovery token) ─────────────────────────────────────
    $("loginSetPasswordForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError("loginSetPasswordError");
      const btn = $("loginUpdateBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Updating…"; }

      const { error } = await _sb.auth.updateUser({
        password: $("loginNewPassword")?.value || "",
      });

      if (error) {
        showError("loginSetPasswordError", error.message || "Could not update password.");
        if (btn) { btn.disabled = false; btn.textContent = "Update password"; }
        return;
      }

      if (overlay) overlay.style.display = "none";
      if (typeof initRealtime === "function") initRealtime();
      if (typeof initProfile === "function") {
        const { data: { session: s } } = await _sb.auth.getSession();
        if (s) initProfile(s);
      }
      resolve();
    });
  });
})();

// ── Logout helper — call from Settings menu ───────────────────────────────────
async function authSignOut() {
  await _sb.auth.signOut();
  window.location.reload();
}
