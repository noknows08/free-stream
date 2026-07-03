-- ============================================================
-- FreeReel — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to run more than once (idempotent).
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.movies (
  id          text primary key,
  title       text,
  year        int,
  runtime     text,
  description text,
  genres      text[],
  video_url   text not null,
  poster_url  text,
  created_at  timestamptz default now()
);

create table if not exists public.watchlist (
  user_id    uuid references auth.users on delete cascade,
  movie_id   text references public.movies on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, movie_id)
);

-- ---------- Row Level Security ----------

alter table public.movies    enable row level security;
alter table public.watchlist enable row level security;

-- Movies: readable by everyone (anon + authenticated).
drop policy if exists "Movies are viewable by everyone" on public.movies;
create policy "Movies are viewable by everyone"
  on public.movies for select
  using (true);

-- Watchlist: each user can only see/insert/delete their own rows.
drop policy if exists "Users can view their own watchlist" on public.watchlist;
create policy "Users can view their own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add to their own watchlist" on public.watchlist;
create policy "Users can add to their own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove from their own watchlist" on public.watchlist;
create policy "Users can remove from their own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

-- ---------- Seed catalog (all 17 films) ----------

insert into public.movies (id, title, year, runtime, description, genres, video_url, poster_url) values
('The_General_Buster_Keaton', 'The General', 1926, '1h 18m', 'Buster Keaton''s silent masterpiece: a Southern railroad engineer chases his stolen locomotive — and his sweetheart — through enemy lines in one of cinema''s greatest chase comedies.', ARRAY['Comedy','Adventure'], 'https://archive.org/download/The_General_Buster_Keaton/The_General.mp4', 'https://archive.org/services/img/The_General_Buster_Keaton'),
('his_girl_friday', 'His Girl Friday', 1940, '1h 32m', 'Howard Hawks'' whip-smart screwball comedy. Ace reporter Hildy Johnson tries to quit the newspaper business, but her editor ex-husband has other plans. Starring Cary Grant.', ARRAY['Comedy'], 'https://archive.org/download/his_girl_friday/his_girl_friday.mp4', 'https://archive.org/services/img/his_girl_friday'),
('charlie_chaplin_film_fest', 'Charlie Chaplin Festival', 1938, '1h 20m', 'A collection of the Little Tramp''s beloved silent shorts, showcasing Chaplin''s timeless slapstick genius and heart.', ARRAY['Comedy'], 'https://archive.org/download/charlie_chaplin_film_fest/charlie_chaplin_film_fest.mp4', 'https://archive.org/services/img/charlie_chaplin_film_fest'),
('utopia', 'Utopia', 1951, '1h 22m', 'Laurel & Hardy''s final feature. The duo inherit an island that becomes an unlikely independent nation when uranium is discovered.', ARRAY['Comedy'], 'https://archive.org/download/utopia/Utopia.mp4', 'https://archive.org/services/img/utopia'),
('3stooges', 'The Three Stooges', 1936, '52m', 'Moe, Larry, and Curly deliver classic eye-poking, pie-throwing slapstick in these vintage comedy shorts.', ARRAY['Comedy'], 'https://archive.org/download/3stooges/3stooges_NewApants2.mp4', 'https://archive.org/services/img/3stooges'),
('TheStranger_0', 'The Stranger', 1946, '1h 35m', 'Orson Welles directs and stars as an escaped Nazi war criminal hiding in a quiet Connecticut town, hunted by a relentless investigator played by Edward G. Robinson.', ARRAY['Thriller','Noir'], 'https://archive.org/download/TheStranger_0/The_Stranger.mp4', 'https://archive.org/services/img/TheStranger_0'),
('suddenly', 'Suddenly', 1954, '1h 15m', 'Frank Sinatra is chillingly cold as an assassin who seizes a family''s home to line up a shot at the President of the United States.', ARRAY['Thriller','Noir'], 'https://archive.org/download/suddenly/suddenly.mp4', 'https://archive.org/services/img/suddenly'),
('dressed_to_kill', 'Dressed to Kill', 1946, '1h 12m', 'Basil Rathbone''s Sherlock Holmes races to decode a deadly secret hidden in three innocent-looking music boxes.', ARRAY['Mystery','Thriller'], 'https://archive.org/download/dressed_to_kill/dressed_to_kill.mp4', 'https://archive.org/services/img/dressed_to_kill'),
('JungleBook', 'Jungle Book', 1942, '1h 48m', 'Zoltan Korda''s lush Technicolor adaptation of Kipling. Sabu stars as Mowgli, the boy raised by wolves in the Indian jungle.', ARRAY['Adventure','Family'], 'https://archive.org/download/JungleBook/Jungle_Book.mp4', 'https://archive.org/services/img/JungleBook'),
('VoyagetothePlanetofPrehistoricWomen', 'Voyage to the Planet of Prehistoric Women', 1967, '1h 18m', 'Astronauts landing on Venus encounter a mysterious race of telepathic women in this dreamy, colorful 1960s space adventure.', ARRAY['Sci-Fi'], 'https://archive.org/download/VoyagetothePlanetofPrehistoricWomen/VoyagetothePlanetofPrehistoricWomen.mp4', 'https://archive.org/services/img/VoyagetothePlanetofPrehistoricWomen'),
('Sita_Sings_the_Blues', 'Sita Sings the Blues', 2008, '1h 22m', 'Nina Paley''s dazzling, award-winning animated feature weaves the ancient Ramayana with 1920s jazz vocals. Released free under a Creative Commons license.', ARRAY['Animation','Musical'], 'https://archive.org/download/Sita_Sings_the_Blues/SITA_SINGS_MOVIE_ONLY.mp4', 'https://archive.org/services/img/Sita_Sings_the_Blues'),
('reefer_madness1938', 'Reefer Madness', 1938, '1h 6m', 'The infamous anti-marijuana scare film whose over-the-top melodrama made it a beloved midnight-movie cult classic.', ARRAY['Cult','Drama'], 'https://archive.org/download/reefer_madness1938/reefer_madness1938.mp4', 'https://archive.org/services/img/reefer_madness1938'),
('abraham_lincoln', 'Abraham Lincoln', 1930, '1h 33m', 'D.W. Griffith''s sweeping biographical portrait of the 16th president, from log cabin to the Civil War and beyond.', ARRAY['Drama','History'], 'https://archive.org/download/abraham_lincoln/abraham_lincoln.mp4', 'https://archive.org/services/img/abraham_lincoln'),
('The_Pied_Piper_of_Hamelin', 'The Pied Piper of Hamelin', 1957, '1h 30m', 'A colorful musical fantasy based on the classic fairy tale, set to the music of Edvard Grieg.', ARRAY['Family','Musical'], 'https://archive.org/download/The_Pied_Piper_of_Hamelin/pied.mp4', 'https://archive.org/services/img/The_Pied_Piper_of_Hamelin'),
('tarzans_revenge', 'Tarzan''s Revenge', 1938, '1h 10m', 'Olympic gold medalists Glenn Morris and Eleanor Holm star in a jungle adventure of romance and danger.', ARRAY['Adventure'], 'https://archive.org/download/tarzans_revenge/tarzans_revenge.mp4', 'https://archive.org/services/img/tarzans_revenge'),
('TheFastandtheFuriousJohnIreland1954goofyrip', 'The Fast and the Furious', 1955, '1h 13m', 'Roger Corman''s original hot-rod thriller: a wrongly accused man escapes custody and hides out in a cross-border sports-car race.', ARRAY['Action','Thriller'], 'https://archive.org/download/TheFastandtheFuriousJohnIreland1954goofyrip/TheFastandtheFuriousJohnIreland1954goofyrip.mp4', 'https://archive.org/services/img/TheFastandtheFuriousJohnIreland1954goofyrip'),
('BloodyPitOfHorror', 'Bloody Pit of Horror', 1965, '1h 27m', 'A photo shoot in a spooky castle turns deadly when its owner becomes convinced he is the reincarnation of a sadistic executioner. Italian cult horror.', ARRAY['Horror','Cult'], 'https://archive.org/download/BloodyPitOfHorror/BloodyPitOfHorror.mp4', 'https://archive.org/services/img/BloodyPitOfHorror')
on conflict (id) do nothing;
