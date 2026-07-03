/*
 * FreeReel — player controller (ES module).
 * Reads ?v=<id>, plays the film, shows details + "More Like This", and wires
 * the watchlist toggle / auth. Works fully with or without Supabase.
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
let MOVIE = null;
let USER = null;
let WATCH = new Set();
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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function getQueryId() {
  return new URLSearchParams(location.search).get("v");
}

/* --------------------------- Render movie ---------------------------- */

function refreshWatchBtn() {
  const btn = $("watch-mylist");
  if (!btn || !MOVIE) return;
  const inList = WATCH.has(MOVIE.id);
  btn.textContent = inList ? "✓ In My List" : "+ My List";
  btn.classList.toggle("in-list", inList);
}

function renderMovie() {
  document.title = MOVIE.title + " — FreeReel";

  const video = $("player");
  video.src = MOVIE.video;
  video.setAttribute("poster", MOVIE.poster);

  const info = $("watch-info");
  const tags = (MOVIE.genres || []).map(function (g) {
    return '<span class="tag">' + escapeHtml(g) + "</span>";
  }).join("");
  info.innerHTML =
    '<h1 class="watch-title">' + escapeHtml(MOVIE.title) + "</h1>" +
    '<div class="watch-meta">' + metaHtml(MOVIE) + "</div>" +
    (tags ? '<div class="genre-tags">' + tags + "</div>" : "") +
    '<p class="watch-desc">' + escapeHtml(MOVIE.desc) + "</p>" +
    '<div class="watch-actions">' +
      '<button class="btn btn-secondary" id="watch-mylist" type="button">+ My List</button>' +
      '<a class="btn btn-ghost" href="index.html">&#9664; Back to browse</a>' +
    "</div>";

  $("watch-mylist").addEventListener("click", function () { toggleWatch(MOVIE.id); });
  refreshWatchBtn();

  renderMore();
}

function renderMore() {
  const others = MOVIES.filter(function (m) { return m.id !== MOVIE.id; });
  const genres = new Set(MOVIE.genres || []);
  let related = others.filter(function (m) {
    return (m.genres || []).some(function (g) { return genres.has(g); });
  });
  if (related.length < 4) {
    const have = new Set(related.map(function (m) { return m.id; }));
    const extra = shuffle(others.filter(function (m) { return !have.has(m.id); }));
    related = related.concat(extra);
  }
  related = related.slice(0, 12);
  if (!related.length) return;

  const track = $("more-track");
  track.innerHTML = "";
  related.forEach(function (m) { track.appendChild(makeCard(m)); });
  $("more").hidden = false;
}

function showNotFound() {
  $("watch-root").hidden = true;
  $("not-found").hidden = false;
  document.title = "Movie not found — FreeReel";
}

/* ---------------------------- Watchlist ------------------------------ */

async function toggleWatch(id) {
  if (!supabaseEnabled) { openAuthModal(); return; }
  if (!USER) { openAuthModal("signin"); return; }
  if (WATCH.has(id)) {
    WATCH.delete(id);
    refreshWatchBtn();
    await removeFromWatchlist(USER.id, id);
  } else {
    WATCH.add(id);
    refreshWatchBtn();
    await addToWatchlist(USER.id, id);
  }
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
    listBtn.addEventListener("click", function () { location.href = "index.html#mylist"; });

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

async function initAuth() {
  renderAuthArea();
  if (!supabaseEnabled) return;
  try {
    USER = await getUser();
    if (USER) WATCH = new Set(await getWatchlist(USER.id));
    renderAuthArea();
    refreshWatchBtn();
    await onAuth(async function (u) {
      USER = u;
      WATCH = u ? new Set(await getWatchlist(u.id)) : new Set();
      renderAuthArea();
      refreshWatchBtn();
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
}

function wireSearch() {
  // On the player page the nav search hands off to the browse page.
  const input = $("search");
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const q = input.value.trim();
      location.href = q ? "index.html?q=" + encodeURIComponent(q) : "index.html";
    }
  });
}

async function init() {
  wireNavScroll();
  wireSearch();
  wireAuthModal();

  MOVIES = await fetchMovies();
  BY_ID = new Map(MOVIES.map(function (m) { return [m.id, m]; }));

  const id = getQueryId();
  MOVIE = id ? BY_ID.get(id) : null;

  if (!MOVIE) {
    showNotFound();
    await initAuth();
    return;
  }

  renderMovie();
  await initAuth();
}

init();
