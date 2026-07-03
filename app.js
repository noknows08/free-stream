/*
 * FreeReel — home / browse controller (ES module).
 * Renders hero + rows, wires live search, the auth modal and the personal
 * watchlist. Works fully with or without Supabase.
 *
 * When a TMDB key is present (config.js → window.TMDB_KEY) it ALSO renders a
 * "latest movies" discovery layer: a trending billboard + rows of real current
 * films whose OFFICIAL TRAILERS play in a detail modal. The 17 public-domain
 * titles remain the only FULL playable movies and keep their own clearly
 * labelled "Free Full Movies" section linking to watch.html. With the key blank
 * the page behaves exactly as it did before.
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
// Query string must match the <script type="module" src="tmdb.js?v=5"> tag in
// index.html so the browser resolves both to a single shared module instance.
import { tmdbEnabled, getRows, getHero, getTrailer, searchTmdb } from "./tmdb.js?v=5";

/* ------------------------------- State ------------------------------- */

let MOVIES = [];
let BY_ID = new Map();
let USER = null;
let WATCH = new Set();
let FEATURED = null;
let currentView = "rows"; // "rows" | "search" | "mylist"
let authMode = "signin";

const TMDB_ON = tmdbEnabled;   // discovery layer active?
const showPills = tmdbEnabled; // label full-movie cards only when trailers exist too
let HERO_SHOWN = false;        // is the billboard currently populated?
let searchSeq = 0;             // guards out-of-order async search renders
let detailReq = 0;             // guards out-of-order trailer fetches

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

function tmdbUrl(id) { return "https://www.themoviedb.org/movie/" + encodeURIComponent(id); }

function metaHtml(m) {
  const parts = [String(m.year), m.runtime].filter(Boolean);
  const genres = (m.genres || []).join(", ");
  let html = parts.map(escapeHtml).join(' <span class="dot">&bull;</span> ');
  if (genres) html += ' <span class="dot">&bull;</span> ' + escapeHtml(genres);
  return html;
}

/** Meta line for a TMDB item: year <span class="dot">·</span> ⭐rating (genres appended later). */
function tmdbMetaHtml(item, extraGenres) {
  const parts = [];
  if (item.year) parts.push('<span>' + escapeHtml(item.year) + '</span>');
  if (item.rating) parts.push('<span class="rating-badge">&#9733; ' + escapeHtml(item.rating.toFixed(1)) + '</span>');
  const genres = (extraGenres && extraGenres.length) ? extraGenres.join(", ") : "";
  if (genres) parts.push('<span>' + escapeHtml(genres) + '</span>');
  return parts.join(' <span class="dot">&bull;</span> ');
}

/** Build a public-domain "full movie" card (anchor → watch.html). */
function makeCard(m) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = watchHref(m.id);
  a.setAttribute("aria-label", m.title + " (" + m.year + ")");
  const sub = [String(m.year), (m.genres || []).slice(0, 2).join(", ")].filter(Boolean).join("  ·  ");
  const pill = showPills ? '<span class="pill pill-full">Full Movie</span>' : "";
  a.innerHTML =
    '<div class="card-poster">' +
      '<div class="card-fallback">' + escapeHtml(m.title) + '</div>' +
      '<img class="card-img" loading="lazy" alt="" src="' + escapeHtml(m.poster) + '">' +
      pill +
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

/** Build a TMDB discovery card (button → trailer detail modal). */
function makeTmdbCard(item) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card card-tmdb";
  btn.setAttribute("aria-label", item.title + (item.year ? " (" + item.year + ")" : "") + " — watch trailer");
  const sub = [item.year, "Trailer"].filter(Boolean).join("  ·  ");
  const rating = item.rating
    ? '<span class="rating-badge">&#9733; ' + escapeHtml(item.rating.toFixed(1)) + '</span>'
    : "";
  btn.innerHTML =
    '<div class="card-poster">' +
      '<div class="card-fallback">' + escapeHtml(item.title) + '</div>' +
      '<img class="card-img" loading="lazy" alt="" src="' + escapeHtml(item.poster) + '">' +
      '<span class="pill pill-trailer">Trailer</span>' +
      rating +
      '<span class="card-play" aria-hidden="true">&#9654;</span>' +
    '</div>' +
    '<div class="card-info">' +
      '<div class="card-title">' + escapeHtml(item.title) + '</div>' +
      '<div class="card-sub">' + escapeHtml(sub) + '</div>' +
    '</div>';
  const img = btn.querySelector(".card-img");
  img.addEventListener("error", function () { img.style.display = "none"; });
  btn.addEventListener("click", function () { openDetailModal(item); });
  return btn;
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

/** Local (public-domain) billboard — the original behavior. */
function renderHero() {
  FEATURED = pickFeatured();
  const hero = $("hero");
  if (!FEATURED) { hero.hidden = true; HERO_SHOWN = false; return; }

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
  HERO_SHOWN = true;
  refreshWatchUI();
}

/** TMDB (trending) billboard — plays the OFFICIAL TRAILER in the detail modal. */
function renderTmdbHero(item) {
  const hero = $("hero");
  if (!item) { hero.hidden = true; HERO_SHOWN = false; return; }
  FEATURED = null; // TMDB hero is not a watchlist/full-movie item

  const bg = $("hero-bg");
  const src = item.backdrop || item.poster;
  if (src) {
    const probe = new Image();
    probe.onload = function () { bg.style.backgroundImage = "url('" + src + "')"; };
    probe.src = src;
  }

  const eb = document.querySelector(".hero-eyebrow");
  if (eb) eb.innerHTML = "&#9654; Trending Now";
  $("hero-title").textContent = item.title;
  $("hero-meta").innerHTML = tmdbMetaHtml(item);
  $("hero-desc").textContent = item.overview || "";

  const play = $("hero-play");
  play.href = tmdbUrl(item.id);
  play.innerHTML = "&#9654; Watch Trailer";
  play.onclick = function (e) { e.preventDefault(); openDetailModal(item); };

  const info = $("hero-mylist");
  info.classList.remove("in-list");
  info.innerHTML = "&#8505; More Info";
  info.onclick = function () { openDetailModal(item); };

  hero.hidden = false;
  HERO_SHOWN = true;
}

/* ------------------------------- Rows -------------------------------- */

/** Original rows built from window.ROWS + the local catalog. */
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

/** The clearly-labelled "Free Full Movies" section (public-domain, playable). */
function buildFullMoviesSection() {
  const section = document.createElement("section");
  section.className = "row row-full";
  const h2 = document.createElement("h2");
  h2.className = "section-title section-title-full";
  h2.innerHTML = "&#9654; Free Full Movies &mdash; Watch Now";
  const sub = document.createElement("p");
  sub.className = "section-subtitle";
  sub.textContent = "Public-domain & Creative Commons classics — play the entire film free, no account needed.";
  const track = document.createElement("div");
  track.className = "track";
  MOVIES.forEach(function (m) { track.appendChild(makeCard(m)); });
  section.appendChild(h2);
  section.appendChild(sub);
  section.appendChild(track);
  return section;
}

/** Discovery rows from TMDB, ABOVE the "Free Full Movies" section. */
function renderTmdbRows(rows) {
  const wrap = $("rows");
  wrap.innerHTML = "";
  (rows || []).forEach(function (row) {
    if (!row.items || !row.items.length) return;
    const section = document.createElement("section");
    section.className = "row";
    const h2 = document.createElement("h2");
    h2.className = "section-title";
    h2.textContent = row.title;
    const track = document.createElement("div");
    track.className = "track";
    row.items.forEach(function (it) { track.appendChild(makeTmdbCard(it)); });
    section.appendChild(h2);
    section.appendChild(track);
    wrap.appendChild(section);
  });
  wrap.appendChild(buildFullMoviesSection());
}

/* --------------------------- Results / grid -------------------------- */

function buildResultsHead(heading) {
  const head = document.createElement("div");
  head.className = "results-head";
  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = heading;
  head.appendChild(h2);
  return head;
}

function buildGrid(list, isTmdb) {
  const grid = document.createElement("div");
  grid.className = "grid";
  list.forEach(function (m) { grid.appendChild(isTmdb ? makeTmdbCard(m) : makeCard(m)); });
  return grid;
}

function renderGrid(container, heading, list) {
  container.innerHTML = "";
  container.appendChild(buildResultsHead(heading));
  container.appendChild(buildGrid(list, false));
}

function emptyLine(text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function showRows() {
  currentView = "rows";
  $("hero").hidden = !HERO_SHOWN;
  $("rows").hidden = false;
  $("results").hidden = true;
}

function localMatches(query) {
  const q = query.toLowerCase();
  return MOVIES.filter(function (m) {
    return m.title.toLowerCase().indexOf(q) !== -1 ||
      (m.genres || []).join(" ").toLowerCase().indexOf(q) !== -1 ||
      String(m.year).indexOf(q) !== -1;
  });
}

async function showSearch(query) {
  currentView = "search";
  $("hero").hidden = true;
  $("rows").hidden = true;
  const results = $("results");
  results.hidden = false;

  const local = localMatches(query);

  // Local-only search — unchanged from the original behavior.
  if (!TMDB_ON) {
    if (!local.length) {
      results.innerHTML =
        '<div class="results-head"><h2 class="section-title">No results for &ldquo;' +
        escapeHtml(query) + '&rdquo;</h2></div>' +
        '<p class="empty">Try another title, genre, or year.</p>';
      return;
    }
    renderGrid(results, "Results for “" + query + "”", local);
    return;
  }

  // Discovery search: TMDB trailers ("Movies") + local "Free Full Movies".
  const seq = ++searchSeq;
  results.innerHTML = "";

  const moviesSection = document.createElement("section");
  moviesSection.className = "results-section";
  moviesSection.appendChild(buildResultsHead("Movies"));
  moviesSection.appendChild(emptyLine("Searching…"));
  results.appendChild(moviesSection);

  const localSection = document.createElement("section");
  localSection.className = "results-section";
  localSection.appendChild(buildResultsHead("Free Full Movies"));
  if (local.length) {
    localSection.appendChild(buildGrid(local, false));
  } else {
    localSection.appendChild(emptyLine("No public-domain match — see the trailers above."));
  }
  results.appendChild(localSection);

  const tmdb = await searchTmdb(query);
  if (seq !== searchSeq) return; // a newer query superseded this one
  moviesSection.innerHTML = "";
  moviesSection.appendChild(buildResultsHead("Movies"));
  if (tmdb.length) {
    moviesSection.appendChild(buildGrid(tmdb, true));
  } else {
    moviesSection.appendChild(emptyLine("No trailers found for “" + query + "”."));
  }
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

/* ---------------------------- Detail modal --------------------------- */

function openDetailModal(item) {
  if (!item) return;
  const modal = $("detail-modal");
  if (!modal) return;

  const reqId = ++detailReq;

  const bd = $("detail-backdrop");
  bd.style.backgroundImage = "";
  const bsrc = item.backdrop || item.poster;
  if (bsrc) {
    const probe = new Image();
    probe.onload = function () { if (reqId === detailReq) bd.style.backgroundImage = "url('" + bsrc + "')"; };
    probe.src = bsrc;
  }

  $("detail-title").textContent = item.title;
  $("detail-meta").innerHTML = tmdbMetaHtml(item);
  $("detail-overview").textContent = item.overview || "";
  $("detail-actions").innerHTML =
    '<a class="btn btn-secondary" href="' + escapeHtml(tmdbUrl(item.id)) +
    '" target="_blank" rel="noopener">View on TMDB &#8599;</a>';

  const trailer = $("detail-trailer");
  trailer.className = "trailer-embed is-loading";
  trailer.innerHTML =
    '<div class="trailer-spinner" aria-hidden="true"></div>' +
    '<p class="trailer-status">Loading trailer…</p>';

  modal.hidden = false;
  document.body.classList.add("modal-open");
  const closeBtn = $("detail-close");
  if (closeBtn) closeBtn.focus();

  getTrailer(item.id).then(function (info) {
    if (reqId !== detailReq) return; // modal closed or another opened
    if (info && info.genres && info.genres.length) {
      $("detail-meta").innerHTML = tmdbMetaHtml(item, info.genres);
    }
    if (info && info.overview && !item.overview) {
      $("detail-overview").textContent = info.overview;
    }
    if (info && info.key) {
      trailer.className = "trailer-embed";
      trailer.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(info.key) +
        '?rel=0" title="' + escapeHtml(item.title) + ' — official trailer" ' +
        'allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>';
    } else {
      trailer.className = "trailer-embed trailer-unavailable";
      trailer.innerHTML =
        '<div class="trailer-msg">' +
          '<p>Official trailer unavailable.</p>' +
          '<a class="btn btn-secondary" href="' + escapeHtml(tmdbUrl(item.id)) +
          '" target="_blank" rel="noopener">Find it on TMDB &#8599;</a>' +
        '</div>';
    }
  });
}

function closeDetailModal() {
  const modal = $("detail-modal");
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  detailReq++;                       // invalidate any in-flight trailer fetch
  const trailer = $("detail-trailer");
  if (trailer) trailer.innerHTML = ""; // stop playback / free the iframe
}

function wireDetailModal() {
  const modal = $("detail-modal");
  if (!modal) return;
  const close = $("detail-close");
  if (close) close.addEventListener("click", closeDetailModal);
  modal.addEventListener("click", function (e) {
    if (e.target === e.currentTarget) closeDetailModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeDetailModal();
  });
}

/* ------------------------------ Search ------------------------------- */

function wireSearch() {
  const input = $("search");
  let debounce = null;
  input.addEventListener("input", function () {
    const raw = input.value.trim();
    if (!raw) {
      clearTimeout(debounce);
      searchSeq++; // cancel any pending discovery search
      showRows();
      return;
    }
    if (!TMDB_ON) { showSearch(raw); return; } // instant, local-only
    clearTimeout(debounce);
    debounce = setTimeout(function () { showSearch(raw); }, 250);
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
    ? "Optional — create a free account only if you want a personal watchlist."
    : "Optional — sign in only if you want a personal watchlist. Every film plays free either way.";
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
  var skip = $("auth-skip");
  if (skip) skip.addEventListener("click", closeAuthModal);
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

  if (TMDB_ON) {
    // Fetch the billboard + discovery rows in parallel; degrade gracefully.
    const [heroItem, rows] = await Promise.all([getHero(), getRows()]);
    if (!heroItem && !rows.length) {
      // TMDB unreachable (bad key / offline) — fall back to the local experience.
      renderHero();
      renderRows();
    } else {
      if (heroItem) renderTmdbHero(heroItem);
      else renderHero();
      renderTmdbRows(rows);
    }
  } else {
    renderHero();
    renderRows();
  }

  showRows();
  wireSearch();
  wireAuthModal();
  wireDetailModal();
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
