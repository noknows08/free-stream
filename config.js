// Supabase project values — enables accounts + watchlist.
// (The anon key is public by design; row-level security protects user data.)
window.SUPABASE_URL = "https://ypmwaaeqztxadlfxuebk.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbXdhYWVxenR4YWRsZnh1ZWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODU3NDAsImV4cCI6MjA5ODY2MTc0MH0.tl7LC9VCNwYN66SIEK2Q_IUrZSOR5yVd5vKRn4isSuM";

// TMDB v3 API key — powers the optional "latest movies" discovery layer
// (metadata + official trailers). This is a public, client-usable key.
// Leave blank to turn discovery off; the site still shows the free
// public-domain full films exactly as it does today.
window.TMDB_KEY = "";
