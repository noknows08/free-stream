/*
 * FreeReel — home / browse controller (ES module).
 * Renders hero + rows from fetchMovies(), wires live search, auth modal,
 * and the personal watchlist. Works fully with or without Supabase.
 */
import {
  fetchMovies,
  supabaseEnabled,
  getUser,
  signIn,
  signUp,
  signOut,
  onAuth,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
} from "./supabase-client.js";

/* ------------------------------- State ------------------------------- */

let MOVIES = [];
let BY_ID = new Map();
let USER = null;
let WATCH = new Set();
let FEATURED = null;
let currentView = "rows"; // "rows" | "search" | "mylist"
let authMode = "signin";

/* ------------------------------ Helpers ------------------------------ */

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function watchHref(id) { return "watch.html?v=" + encodeURIComponent(id); }

function metaHtml(m) {
  const parts = [String(m.year), m.runtime].filter(Boolean);
  const genres = (m.genres || []).join(", ");
  let html = parts.map(escapeHtml).join(' <span class="dot">&bull;</span> ');
  if (genres) html += ' <span class="dot">&bull;</span> ' + escapeHtml(genres);
  return html;
}

/** Build a poster card (anchor) with graceful image fallback. */
function makeCard(m) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = watchHref(m.id);
  a.setAttribute("aria-label", m.title + " (" + m.year + ")");
  const sub = [String(m.year), (m.genres || []).slice(0, 2).join(", ")].filter(Boolean).join("  ·  ");
  a.innerHTML =
    '<div class="card-poster">' +
      '<div class="card-fallback">' + escapeHtml(m.title) + '</div>' +
      '<img class="card-img" loading="lazy" alt="" src="' + escapeHtml(m.poster) + '">' +
      '<span class="card-play" aria-hidden="true">&#9654;</span>' +
    '</div>' +
    '<div class="card-info">' +
      '<div class="card-title">' + escapeHtml(m.title) + '</div>' +
      '<div class="card-sub">' + escapeHtml(sub) + '</div>' +
    '</div>';
  const img = a.querySelector(".card-img");
  img.addEventListener("error", function () { img.style.display = "none"; });
  return a;
}

/* ------------------------------- Hero -------------------------------- */

function pickFeatured() {
  const ids = (window.FEATURED_IDS || []).filter(function (id) { return BY_ID.has(id); });
  if (ids.length) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    return BY_ID.get(id);
  }
  return MOVIES[0] || null;
}

function renderHero() {
  FEATURED = pickFeatured();
  const hero = $("hero");
  if (!FEATURED) { hero.hidden = true; return; }

  const bg = $("hero-bg");
  // Only apply the poster once it actually loads, so a failed image simply
  // leaves the dark gradient fallback instead of a broken background.
  const probe = new Image();
  probe.onload = function () { bg.style.backgroundImage = "url('" + FEATURED.poster + "')"; };
  probe.src = FEATURED.poster;

  $("hero-title").textContent = FEATURED.title;
  $("hero-meta").innerHTML = metaHtml(FEATURED);
  $("hero-desc").textContent = FEATURED.desc;
  $("hero-play").href = watchHref(FEATURED.id);

  const mylistBtn = $("hero-mylist");
  mylistBtn.onclick = function () { toggleWatch(FEATURED.id); };
  refreshWatchUI();
}

/* ------------------------------- Rows -------------------------------- */

function renderRows() {
  const wrap = $("rows");
  wrap.innerHTML = "";
  (window.ROWS || []).forEach(function (row) {
    const movies = (row.ids || []).map(function (id) { return BY_ID.get(id); }).filter(Boolean);
    if (!movies.length) return;
    const section = document.createElement("section");
    section.className = "row";
    const h2 = document.createElement("h2");
    h2.className = "section-title";
    h2.textContent = row.title;
    const track = document.createElement("div");
    track.className = "track";
    movies.forEach(function (m) { track.appendChild(makeCard(m)); });
    section.appendChild(h2);
    section.appendChild(track);
    wrap.appendChild(section);
  });
}

/* --------------------------- Results / grid -------------------------- */

function renderGrid(container, heading, list) {
  container.innerHTML = "";
  const head = document.createElement("div");
  head.className = "results-head";
  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = heading;
  head.appendChild(h2);
  container.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "grid";
  list.forEach(function (m) { grid.appendChild(makeCard(m)); });
  container.appendChild(grid);
}

function showRows() {
  currentView = "rows";
  $("hero").hidden = !FEATURED;
  $("rows").hidden = false;
  $("results").hidden = true;
}

function showSearch(query) {
  currentView = "search";
  const q = query.toLowerCase();
  const matches = MOVIES.filter(function (m) {
    return m.title.toLowerCase().indexOf(q) !== -1 ||
      (m.genres || []).join(" ").toLowerCase().indexOf(q) !== -1 ||
      String(m.year).indexOf(q) !== -1;
  });
  $("hero").hidden = true;
  $("rows").hidden = true;
  const results = $("results");
  results.hidden = false;
  if (!matches.length) {
    results.innerHTML =
      '<div class="results-head"><h2 class="section-title">No results for &ldquo;' +
      escapeHtml(query) + '&rdquo;</h2></div>' +
      '<p class="empty">Try another title, genre, or year.</p>';
    return;
  }
  renderGrid(results, "Results for “" + query + "”", matches);
}

function showMyList() {
  currentView = "mylist";
  $("hero").hidden = true;
  $("rows").hidden = true;
  const results = $("results");
  results.hidden = false;
  if (!USER) {
    results.innerHTML =
      '<div class="results-head"><h2 class="section-title">My List</h2></div>' +
      '<p class="empty">Sign in to start building your list.</p>';
    return;
  }
  const list = MOVIES.filter(function (m) { return WATCH.has(m.id); });
  if (!list.length) {
    results.innerHTML =
      '<div class="results-head"><h2 class="section-title">My List</h2></div>' +
      '<p class="empty">Your list is empty. Tap &ldquo;+ My List&rdquo; on any film to save it here.</p>';
    return;
  }
  renderGrid(results, "My List", list);
}

/* ------------------------------ Search ------------------------------- */

function wireSearch() {
  const input = $("search");
  input.addEventListener("input", function () {
    const raw = input.value.trim();
    if (!raw) { showRows(); return; }
    showSearch(raw);
  });
}

/* ---------------------------- Watchlist UI --------------------------- */

function refreshWatchUI() {
  const btn = $("hero-mylist");
  if (btn && FEATURED) {
    const inList = WATCH.has(FEATURED.id);
    btn.textContent = inList ? "✓ My List" : "+ My List";
    btn.classList.toggle("in-list", inList);
  }
}

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3800);
}

async function toggleWatch(id) {
  // Signing in is optional — never force the modal; just hint gently.
  if (!supabaseEnabled) { toast("Accounts are off in this demo — every film plays free without one."); return; }
  if (!USER) { toast("Optional: tap “Sign in” (top right) to save films to your personal list."); return; }
  if (WATCH.has(id)) {
    WATCH.delete(id);
    refreshWatchUI();
    await removeFromWatchlist(USER.id, id);
  } else {
    WATCH.add(id);
    refreshWatchUI();
    await addToWatchlist(USER.id, id);
  }
  if (currentView === "mylist") showMyList();
}

/* ------------------------------ Auth UI ------------------------------ */

function renderAuthArea() {
  const el = $("auth-area");
  el.innerHTML = "";
  if (USER) {
    const email = document.createElement("span");
    email.className = "user-email";
    email.textContent = USER.email || "Account";

    const listBtn = document.createElement("button");
    listBtn.className = "btn btn-ghost";
    listBtn.type = "button";
    listBtn.textContent = "My List";
    listBtn.addEventListener("click", showMyList);

    const outBtn = document.createElement("button");
    outBtn.className = "btn btn-secondary";
    outBtn.type = "button";
    outBtn.textContent = "Sign out";
    outBtn.addEventListener("click", function () { signOut(); });

    el.append(email, listBtn, outBtn);
  } else {
    const inBtn = document.createElement("button");
    inBtn.className = "btn btn-primary";
    inBtn.type = "button";
    inBtn.textContent = "Sign in";
    inBtn.addEventListener("click", function () { openAuthModal("signin"); });
    el.appendChild(inBtn);
  }
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";
  const signup = authMode === "signup";
  $("auth-title").textContent = signup ? "Create account" : "Sign in";
  $("auth-sub").textContent = signup
    ? "Create a free account to build your personal list."
    : "Sign in to save films to your personal list.";
  $("auth-submit").textContent = signup ? "Create account" : "Sign in";
  $("auth-toggle-text").textContent = signup ? "Already have an account?" : "New here?";
  $("auth-toggle").textContent = signup ? "Sign in" : "Create an account";
  $("auth-password").setAttribute("autocomplete", signup ? "new-password" : "current-password");
}

function openAuthModal(mode) {
  const modal = $("auth-modal");
  const form = $("auth-form");
  const toggle = document.querySelector(".modal-toggle");
  const err = $("auth-error");
  err.hidden = true;
  err.textContent = "";

  if (!supabaseEnabled) {
    $("auth-title").textContent = "Accounts unavailable";
    $("auth-sub").textContent =
      "This demo is running on the built-in catalog only. Add your Supabase keys in config.js to enable accounts and a personal watchlist. Every film still plays without an account.";
    form.hidden = true;
    if (toggle) toggle.hidden = true;
  } else {
    form.hidden = false;
    if (toggle) toggle.hidden = false;
    setAuthMode(mode || "signin");
  }
  modal.hidden = false;
  document.body.classList.add("modal-open");
  if (supabaseEnabled) { const e = $("auth-email"); if (e) e.focus(); }
}

function closeAuthModal() {
  $("auth-modal").hidden = true;
  document.body.classList.remove("modal-open");
}

function wireAuthModal() {
  $("auth-close").addEventListener("click", closeAuthModal);
  $("auth-modal").addEventListener("click", function (e) {
    if (e.target === e.currentTarget) closeAuthModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("auth-modal").hidden) closeAuthModal();
  });
  $("auth-toggle").addEventListener("click", function () {
    setAuthMode(authMode === "signup" ? "signin" : "signup");
  });
  $("auth-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const err = $("auth-error");
    const submit = $("auth-submit");
    err.hidden = true;
    if (!email || password.length < 6) {
      err.textContent = "Enter a valid email and a password of at least 6 characters.";
      err.hidden = false;
      return;
    }
    const original = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Please wait…";
    try {
      if (authMode === "signup") { await signUp(email, password); }
      else { await signIn(email, password); }
      const u = await getUser();
      if (u) {
        closeAuthModal();
      } else {
        err.textContent = authMode === "signup"
          ? "Account created. If email confirmation is on, check your inbox, then sign in."
          : "Signed in — if nothing happens, please refresh.";
        err.hidden = false;
      }
    } catch (ex) {
      err.textContent = (ex && ex.message) ? ex.message : "Something went wrong. Please try again.";
      err.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });
}

/* ------------------------------- Auth -------------------------------- */

function checkHash() {
  if (location.hash === "#mylist") showMyList();
}

async function initAuth() {
  renderAuthArea();
  if (!supabaseEnabled) return;
  try {
    USER = await getUser();
    if (USER) WATCH = new Set(await getWatchlist(USER.id));
    renderAuthArea();
    refreshWatchUI();
    if (currentView === "mylist") showMyList();
    await onAuth(async function (u) {
      USER = u;
      WATCH = u ? new Set(await getWatchlist(u.id)) : new Set();
      renderAuthArea();
      refreshWatchUI();
      if (currentView === "mylist") showMyList();
    });
  } catch (err) {
    /* ignore — site still works without auth */
  }
}

/* ------------------------------ Nav / init --------------------------- */

function wireNavScroll() {
  const nav = $("nav");
  const onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 10); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("hashchange", checkHash);
}

async function init() {
  MOVIES = await fetchMovies();
  BY_ID = new Map(MOVIES.map(function (m) { return [m.id, m]; }));

  renderHero();
  renderRows();
  showRows();
  wireSearch();
  wireAuthModal();
  wireNavScroll();

  // Allow the watch page's nav search to hand off a query via ?q=
  const q = new URLSearchParams(location.search).get("q");
  if (q && q.trim()) {
    const input = $("search");
    input.value = q;
    showSearch(q.trim());
  } else {
    checkHash();
  }

  await initAuth();
}

init();
