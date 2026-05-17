// ======================================================
// PROFILE — User profile + Supabase Realtime Presence
// Loaded after api.js, before events.js.
// All DOM work is deferred until initProfile() is called.
// ======================================================

const AVATAR_COLORS = [
  'oklch(60% 0.18 250)',
  'oklch(55% 0.22 25)',
  'oklch(65% 0.18 65)',
  'oklch(60% 0.20 155)',
  'oklch(55% 0.18 300)',
  'oklch(60% 0.22 350)',
  'oklch(65% 0.15 210)',
  'oklch(60% 0.20 80)',
  'oklch(50% 0.06 250)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name || !name.trim()) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function buildAvatarEl(profile, size) {
  const sz = size === 'sm' ? 'var(--profile-avatar-size-sm)' : 'var(--profile-avatar-size-lg)';
  if (profile.avatarUrl) {
    const img = document.createElement('img');
    img.className = 'profile-avatar profile-avatar--photo';
    img.src = profile.avatarUrl;
    img.alt = profile.displayName || 'Avatar';
    img.style.cssText = `width:${sz};height:${sz};`;
    return img;
  }
  const div = document.createElement('div');
  div.className = 'profile-avatar profile-avatar--initials';
  div.style.cssText = `width:${sz};height:${sz};background:${profile.avatarColor};`;
  div.textContent = getInitials(profile.displayName || profile.email);
  return div;
}

// ── Supabase profile I/O ──────────────────────────────────────────────────────

async function fetchProfile(userId) {
  const { data, error } = await _sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.warn('[profile] fetch error', error);
  }
  return data || null;
}

async function saveProfileToSupabase() {
  if (!state.profile.id) return;
  const { error } = await _sb.from('profiles').upsert({
    id:           state.profile.id,
    display_name: state.profile.displayName,
    avatar_color: state.profile.avatarColor,
    avatar_url:   state.profile.avatarUrl,
    preferences:  state.profile.preferences,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) console.warn('[profile] save error', error);
}

// ── Preference helpers ────────────────────────────────────────────────────────

function setPref(key, value) {
  state.profile.preferences[key] = value;
  try {
    localStorage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
    localStorage.setItem('pref_ts_' + key, Date.now());
  } catch (_) {}
  saveProfileToSupabase().catch(e => console.warn('[profile] pref save failed', e));
}

function _applyPrefsFromProfile(remoteUpdatedAt) {
  const prefMap = {
    theme:           v => { document.documentElement.setAttribute('data-theme', v); try { localStorage.setItem('theme', v); } catch(_){} },
    weekStartMonday: v => { if (typeof applyWeekStart === 'function') applyWeekStart(v); },
    barsCompact:     v => {
      const isCompact = document.body.classList.contains('bars-compact');
      if (v !== isCompact) document.getElementById('compactBarsBtn')?.click();
    },
  };

  for (const [key, apply] of Object.entries(prefMap)) {
    const remoteVal = state.profile.preferences[key];
    const localTs = parseInt(localStorage.getItem('pref_ts_' + key) || '0', 10);
    const remoteTs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
    if (remoteTs > localTs) {
      apply(remoteVal);
      try {
        const stored = typeof remoteVal === 'boolean' ? (remoteVal ? '1' : '0') : remoteVal;
        localStorage.setItem(key, stored);
        localStorage.setItem('pref_ts_' + key, remoteTs);
      } catch(_) {}
    }
  }
}

// ── Avatar render ─────────────────────────────────────────────────────────────

function renderAvatarBtn() {
  const btn = document.getElementById('avatarBtn');
  if (!btn) return;
  btn.innerHTML = '';
  btn.appendChild(buildAvatarEl(state.profile, 'lg'));
}

// ── Presence strip ────────────────────────────────────────────────────────────

function onPresenceSync(presenceState) {
  const users = [];
  for (const key of Object.keys(presenceState)) {
    for (const presence of presenceState[key]) {
      if (presence.userId && presence.userId !== state.profile.id) {
        users.push({
          userId:      presence.userId,
          displayName: presence.displayName || '',
          avatarColor: presence.avatarColor || 'oklch(60% 0.15 250)',
          avatarUrl:   presence.avatarUrl   || '',
        });
      }
    }
  }
  // Deduplicate by userId
  const seen = new Set();
  state.presenceUsers = users.filter(u => seen.has(u.userId) ? false : seen.add(u.userId));
  renderPresenceStrip(state.presenceUsers);
}

function renderPresenceStrip(users) {
  const strip = document.getElementById('presenceStrip');
  if (!strip) return;
  if (!users.length) { strip.hidden = true; return; }
  strip.hidden = false;
  strip.innerHTML = '';
  users.forEach(user => {
    const wrap = document.createElement('div');
    wrap.className = 'presence-strip__avatar';
    wrap.title = user.displayName || user.userId;
    wrap.setAttribute('aria-label', user.displayName || 'Online user');
    wrap.appendChild(buildAvatarEl(user, 'sm'));
    strip.appendChild(wrap);
  });
}

// ── Profile popover ───────────────────────────────────────────────────────────

function openProfilePopover() {
  const popover = document.getElementById('profilePopover');
  const btn = document.getElementById('avatarBtn');
  if (!popover) return;

  // Populate identity
  const nameInput = document.getElementById('profileDisplayName');
  if (nameInput) nameInput.value = state.profile.displayName;
  const emailEl = document.getElementById('profileEmail');
  if (emailEl) emailEl.textContent = state.profile.email;

  // Render avatar in popover header
  const avatarWrap = document.getElementById('profilePopoverAvatar');
  if (avatarWrap) {
    avatarWrap.innerHTML = '';
    avatarWrap.appendChild(buildAvatarEl(state.profile, 'lg'));
  }

  // Build color swatches
  const swatchWrap = document.getElementById('profileColorSwatches');
  if (swatchWrap) {
    swatchWrap.innerHTML = '';
    AVATAR_COLORS.forEach(color => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'profile-color-swatch' + (color === state.profile.avatarColor ? ' is-selected' : '');
      s.style.background = color;
      s.dataset.color = color;
      s.setAttribute('aria-label', 'Avatar color');
      swatchWrap.appendChild(s);
    });
  }

  // Sync pref toggles
  _syncPrefToggles();

  popover.hidden = false;
  btn?.setAttribute('aria-expanded', 'true');
}

function closeProfilePopover() {
  const popover = document.getElementById('profilePopover');
  const btn = document.getElementById('avatarBtn');
  if (!popover) return;
  popover.hidden = true;
  btn?.setAttribute('aria-expanded', 'false');
}

function _syncPrefToggles() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeBtn = document.getElementById('profileThemeToggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    const icon = themeBtn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
  }

  const weekBtn = document.getElementById('profileWeekStartToggle');
  if (weekBtn) {
    weekBtn.setAttribute('aria-pressed', String(state.weekStartsOnMonday));
    const icon = weekBtn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = state.weekStartsOnMonday ? 'toggle_on' : 'toggle_off';
  }

  const compactBtn = document.getElementById('profileCompactToggle');
  if (compactBtn) {
    const isCompact = document.body.classList.contains('bars-compact');
    compactBtn.setAttribute('aria-pressed', String(isCompact));
  }
}

// ── Photo upload ──────────────────────────────────────────────────────────────

async function uploadAvatarPhoto(file) {
  if (!state.profile.id) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${state.profile.id}/${Date.now()}.${ext}`;

  if (typeof toast === 'function') toast('Uploading photo…', 'info', 10000);

  const { error: upErr } = await _sb.storage.from('avatars').upload(path, file, { upsert: true });
  if (upErr) {
    if (typeof toast === 'function') toast('Upload failed: ' + upErr.message, 'danger', 3000);
    return;
  }

  const { data: urlData } = _sb.storage.from('avatars').getPublicUrl(path);
  state.profile.avatarUrl = urlData.publicUrl;

  renderAvatarBtn();

  const avatarWrap = document.getElementById('profilePopoverAvatar');
  if (avatarWrap) {
    avatarWrap.innerHTML = '';
    avatarWrap.appendChild(buildAvatarEl(state.profile, 'lg'));
  }

  await saveProfileToSupabase();
  await retrackPresence();

  if (typeof toast === 'function') toast('Photo updated.', 'success', 2000);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function initProfile(session) {
  state.profile.id    = session.user.id;
  state.profile.email = session.user.email;

  const row = await fetchProfile(session.user.id);

  if (row) {
    state.profile.displayName = row.display_name || '';
    state.profile.avatarColor = row.avatar_color || state.profile.avatarColor;
    state.profile.avatarUrl   = row.avatar_url   || '';

    if (row.preferences && typeof row.preferences === 'object') {
      Object.assign(state.profile.preferences, row.preferences);
    }

    _applyPrefsFromProfile(row.updated_at);
  } else {
    // New user — create profile row
    await saveProfileToSupabase();
  }

  renderAvatarBtn();
}
