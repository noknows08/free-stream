/*
 * FreeReel — TMDB discovery layer (ES module).
 *
 * Optional, legal metadata + trailer discovery powered by The Movie Database
 * (TMDB) via a public, client-usable v3 API key set in config.js
 * (window.TMDB_KEY). When the key is blank, `tmdbEnabled` is false and every
 * helper returns an empty/neutral value — the site still shows the free
 * public-domain films and nothing is logged to the console.
 *
 * IMPORTANT: TMDB supplies metadata + OFFICIAL TRAILERS only. FreeReel never
 * streams these titles in full — only the public-domain window.CATALOG films
 * play in full (on watch.html).
 */

const KEY = (typeof window !== "undefined" && window.TMDB_KEY ? String(window.TMDB_KEY) : "").trim();
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/";

/** True only when a TMDB key is configured. */
export const tmdbEnabled = Boolean(KEY);

/** Build a request URL: `?api_key=<key>` plus any extra params (`&k=v`). */
function url(path, params) {
  let u = API + path + "?api_key=" + encodeURIComponent(KEY);
  if (params) {
    for (const k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null) {
        u += "&" + k + "=" + encodeURIComponent(params[k]);
      }
    }
  }
  return u;
}

/** Fetch + parse JSON. Never throws; returns null on any failure. */
async function getJSON(path, params) {
  if (!tmdbEnabled) return null;
  try {
    const res = await fetch(url(path, params));
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/** Map a raw TMDB movie to FreeReel's discovery shape. Skips posterless items. */
function mapItem(r) {
  if (!r || !r.poster_path) return null;
  const score = typeof r.vote_average === "number" ? Math.round(r.vote_average * 10) / 10 : 0;
  return {
    id: r.id,
    title: r.title || r.name || "Untitled",
    year: r.release_date ? String(r.release_date).slice(0, 4) : "",
    rating: score,
    overview: r.overview || "",
    poster: IMG + "w342" + r.poster_path,
    backdrop: r.backdrop_path ? IMG + "w1280" + r.backdrop_path : "",
    source: "tmdb"
  };
}

/** Map a list endpoint's `.results` to discovery items (posterless removed). */
function mapList(data) {
  if (!data || !Array.isArray(data.results)) return [];
  return data.results.map(mapItem).filter(Boolean);
}

/**
 * Fetch the discovery rows in parallel. Returns [{title, items[]}] for the
 * rows that have content. Never throws; returns [] when disabled or on error.
 */
export async function getRows() {
  if (!tmdbEnabled) return [];
  try {
    const defs = [
      { title: "Trending This Week", path: "/trending/movie/week" },
      { title: "In Theaters Now", path: "/movie/now_playing" },
      { title: "Popular", path: "/movie/popular" },
      { title: "Top Rated", path: "/movie/top_rated" }
    ];
    const lists = await Promise.all(defs.map(function (d) { return getJSON(d.path); }));
    const rows = [];
    for (let i = 0; i < defs.length; i++) {
      const items = mapList(lists[i]);
      if (items.length) rows.push({ title: defs[i].title, items: items });
    }
    return rows;
  } catch (err) {
    return [];
  }
}

/** First trending movie that has a backdrop (for the billboard). null if none. */
export async function getHero() {
  if (!tmdbEnabled) return null;
  try {
    const items = mapList(await getJSON("/trending/movie/week"));
    for (let i = 0; i < items.length; i++) {
      if (items[i].backdrop) return items[i];
    }
    return null;
  } catch (err) {
    return null;
  }
}

const trailerCache = new Map();

/**
 * Detail lookup for one movie. Returns
 *   { key, overview, genres:[names], runtime }
 * where `key` is the YouTube id of the first "Trailer" (fallback "Teaser")
 * hosted on YouTube, or null. Cached per id. Never throws.
 */
export async function getTrailer(id) {
  const neutral = { key: null, overview: "", genres: [], runtime: 0 };
  if (!tmdbEnabled || id == null) return neutral;
  const cacheKey = String(id);
  if (trailerCache.has(cacheKey)) return trailerCache.get(cacheKey);

  let result = neutral;
  try {
    const data = await getJSON("/movie/" + encodeURIComponent(id), { append_to_response: "videos" });
    if (data) {
      const vids = (data.videos && Array.isArray(data.videos.results)) ? data.videos.results : [];
      const yt = vids.filter(function (v) { return v && v.site === "YouTube" && v.key; });
      let pick = yt.find(function (v) { return v.type === "Trailer"; });
      if (!pick) pick = yt.find(function (v) { return v.type === "Teaser"; });
      result = {
        key: pick ? pick.key : null,
        overview: data.overview || "",
        genres: Array.isArray(data.genres) ? data.genres.map(function (g) { return g.name; }) : [],
        runtime: data.runtime || 0
      };
    }
  } catch (err) {
    result = neutral;
  }
  trailerCache.set(cacheKey, result);
  return result;
}

/** Search movies. Mapped like getRows items (posterless removed). Never throws. */
export async function searchTmdb(query) {
  if (!tmdbEnabled || !query) return [];
  try {
    return mapList(await getJSON("/search/movie", { query: query, include_adult: "false" }));
  } catch (err) {
    return [];
  }
}
