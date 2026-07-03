/*
 * FreeReel data + auth layer (ES module).
 *
 * Supabase is 100% optional. When SUPABASE_URL / SUPABASE_ANON_KEY are blank
 * (see config.js), every function degrades gracefully to the built-in
 * window.CATALOG and all auth/watchlist helpers become safe no-ops — so the
 * site works fully with no backend and never throws in the console.
 */

const SB_URL = (typeof window !== "undefined" && window.SUPABASE_URL ? String(window.SUPABASE_URL) : "").trim();
const SB_KEY = (typeof window !== "undefined" && window.SUPABASE_ANON_KEY ? String(window.SUPABASE_ANON_KEY) : "").trim();

/** True only when BOTH Supabase values are present. */
export const supabaseEnabled = !!(SB_URL && SB_KEY);

let _clientPromise = null;

/** Lazily import + memoize the Supabase client. Returns null when disabled. */
export async function getSupabase() {
  if (!supabaseEnabled) return null;
  if (!_clientPromise) {
    _clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(function (mod) {
        return mod.createClient(SB_URL, SB_KEY, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
      })
      .catch(function (err) {
        console.warn("[FreeReel] Could not load Supabase; using built-in catalog.", err);
        _clientPromise = null; // allow a retry later
        return null;
      });
  }
  return _clientPromise;
}

/** Map a DB row to the same shape as window.CATALOG entries. */
function mapRow(r) {
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    runtime: r.runtime,
    genres: Array.isArray(r.genres) ? r.genres : [],
    desc: r.description || "",
    video: r.video_url,
    poster: r.poster_url
  };
}

/** Built-in catalog, always safe to return. */
function localCatalog() {
  return (typeof window !== "undefined" && Array.isArray(window.CATALOG)) ? window.CATALOG : [];
}

/**
 * Fetch the movie list. Uses Supabase when configured, otherwise the built-in
 * catalog. Any error, empty result, or missing backend falls back to CATALOG.
 */
export async function fetchMovies() {
  if (!supabaseEnabled) return localCatalog();
  try {
    const sb = await getSupabase();
    if (!sb) return localCatalog();
    const { data, error } = await sb.from("movies").select("*");
    if (error || !data || !data.length) return localCatalog();
    return data.map(mapRow);
  } catch (err) {
    console.warn("[FreeReel] fetchMovies fell back to built-in catalog.", err);
    return localCatalog();
  }
}

/* ------------------------------- Auth ---------------------------------- */

export async function getUser() {
  if (!supabaseEnabled) return null;
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data ? data.user : null;
  } catch (err) {
    return null;
  }
}

export async function signUp(email, password) {
  if (!supabaseEnabled) throw new Error("Accounts are not enabled on this deployment.");
  const sb = await getSupabase();
  if (!sb) throw new Error("Accounts are temporarily unavailable.");
  const { data, error } = await sb.auth.signUp({ email: email, password: password });
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  if (!supabaseEnabled) throw new Error("Accounts are not enabled on this deployment.");
  const sb = await getSupabase();
  if (!sb) throw new Error("Accounts are temporarily unavailable.");
  const { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!supabaseEnabled) return;
  try {
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
  } catch (err) {
    /* ignore */
  }
}

/**
 * Subscribe to auth changes. Returns an unsubscribe function (no-op when
 * disabled). The callback receives the current user or null.
 */
export async function onAuth(cb) {
  if (!supabaseEnabled) return function () {};
  try {
    const sb = await getSupabase();
    if (!sb) return function () {};
    const { data } = sb.auth.onAuthStateChange(function (_event, session) {
      cb(session ? session.user : null);
    });
    return function () {
      try { data.subscription.unsubscribe(); } catch (err) { /* ignore */ }
    };
  } catch (err) {
    return function () {};
  }
}

/* ----------------------------- Watchlist ------------------------------- */

export async function getWatchlist(userId) {
  if (!supabaseEnabled || !userId) return [];
  try {
    const sb = await getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from("watchlist").select("movie_id").eq("user_id", userId);
    if (error || !data) return [];
    return data.map(function (r) { return r.movie_id; });
  } catch (err) {
    return [];
  }
}

export async function addToWatchlist(userId, movieId) {
  if (!supabaseEnabled || !userId) return;
  try {
    const sb = await getSupabase();
    if (!sb) return;
    await sb.from("watchlist").insert({ user_id: userId, movie_id: movieId });
  } catch (err) {
    /* ignore — optimistic UI already updated */
  }
}

export async function removeFromWatchlist(userId, movieId) {
  if (!supabaseEnabled || !userId) return;
  try {
    const sb = await getSupabase();
    if (!sb) return;
    await sb.from("watchlist").delete().eq("user_id", userId).eq("movie_id", movieId);
  } catch (err) {
    /* ignore */
  }
}
