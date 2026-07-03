/*
 * FreeReel canonical catalog.
 * Classic (non-module) script: exposes window.CATALOG, window.ROWS and
 * window.FEATURED_IDS so the whole site works with zero backend.
 *
 * Video URL pattern:  https://archive.org/download/{id}/{file}
 * Poster URL pattern: https://archive.org/services/img/{id}
 *
 * Do not edit ids/files — every entry is a verified, playable Internet Archive item.
 */
(function () {
  "use strict";

  var DOWNLOAD = "https://archive.org/download/";
  var IMG = "https://archive.org/services/img/";

  var RAW = [
    {
      id: "The_General_Buster_Keaton",
      file: "The_General.mp4",
      title: "The General",
      year: 1926,
      runtime: "1h 18m",
      genres: ["Comedy", "Adventure"],
      desc: "Buster Keaton's silent masterpiece: a Southern railroad engineer chases his stolen locomotive — and his sweetheart — through enemy lines in one of cinema's greatest chase comedies."
    },
    {
      id: "his_girl_friday",
      file: "his_girl_friday.mp4",
      title: "His Girl Friday",
      year: 1940,
      runtime: "1h 32m",
      genres: ["Comedy"],
      desc: "Howard Hawks' whip-smart screwball comedy. Ace reporter Hildy Johnson tries to quit the newspaper business, but her editor ex-husband has other plans. Starring Cary Grant."
    },
    {
      id: "charlie_chaplin_film_fest",
      file: "charlie_chaplin_film_fest.mp4",
      title: "Charlie Chaplin Festival",
      year: 1938,
      runtime: "1h 20m",
      genres: ["Comedy"],
      desc: "A collection of the Little Tramp's beloved silent shorts, showcasing Chaplin's timeless slapstick genius and heart."
    },
    {
      id: "utopia",
      file: "Utopia.mp4",
      title: "Utopia",
      year: 1951,
      runtime: "1h 22m",
      genres: ["Comedy"],
      desc: "Laurel & Hardy's final feature. The duo inherit an island that becomes an unlikely independent nation when uranium is discovered."
    },
    {
      id: "3stooges",
      file: "3stooges_NewApants2.mp4",
      title: "The Three Stooges",
      year: 1936,
      runtime: "52m",
      genres: ["Comedy"],
      desc: "Moe, Larry, and Curly deliver classic eye-poking, pie-throwing slapstick in these vintage comedy shorts."
    },
    {
      id: "TheStranger_0",
      file: "The_Stranger.mp4",
      title: "The Stranger",
      year: 1946,
      runtime: "1h 35m",
      genres: ["Thriller", "Noir"],
      desc: "Orson Welles directs and stars as an escaped Nazi war criminal hiding in a quiet Connecticut town, hunted by a relentless investigator played by Edward G. Robinson."
    },
    {
      id: "suddenly",
      file: "suddenly.mp4",
      title: "Suddenly",
      year: 1954,
      runtime: "1h 15m",
      genres: ["Thriller", "Noir"],
      desc: "Frank Sinatra is chillingly cold as an assassin who seizes a family's home to line up a shot at the President of the United States."
    },
    {
      id: "dressed_to_kill",
      file: "dressed_to_kill.mp4",
      title: "Dressed to Kill",
      year: 1946,
      runtime: "1h 12m",
      genres: ["Mystery", "Thriller"],
      desc: "Basil Rathbone's Sherlock Holmes races to decode a deadly secret hidden in three innocent-looking music boxes."
    },
    {
      id: "JungleBook",
      file: "Jungle_Book.mp4",
      title: "Jungle Book",
      year: 1942,
      runtime: "1h 48m",
      genres: ["Adventure", "Family"],
      desc: "Zoltan Korda's lush Technicolor adaptation of Kipling. Sabu stars as Mowgli, the boy raised by wolves in the Indian jungle."
    },
    {
      id: "VoyagetothePlanetofPrehistoricWomen",
      file: "VoyagetothePlanetofPrehistoricWomen.mp4",
      title: "Voyage to the Planet of Prehistoric Women",
      year: 1967,
      runtime: "1h 18m",
      genres: ["Sci-Fi"],
      desc: "Astronauts landing on Venus encounter a mysterious race of telepathic women in this dreamy, colorful 1960s space adventure."
    },
    {
      id: "Sita_Sings_the_Blues",
      file: "SITA_SINGS_MOVIE_ONLY.mp4",
      title: "Sita Sings the Blues",
      year: 2008,
      runtime: "1h 22m",
      genres: ["Animation", "Musical"],
      desc: "Nina Paley's dazzling, award-winning animated feature weaves the ancient Ramayana with 1920s jazz vocals. Released free under a Creative Commons license."
    },
    {
      id: "reefer_madness1938",
      file: "reefer_madness1938.mp4",
      title: "Reefer Madness",
      year: 1938,
      runtime: "1h 6m",
      genres: ["Cult", "Drama"],
      desc: "The infamous anti-marijuana scare film whose over-the-top melodrama made it a beloved midnight-movie cult classic."
    },
    {
      id: "abraham_lincoln",
      file: "abraham_lincoln.mp4",
      title: "Abraham Lincoln",
      year: 1930,
      runtime: "1h 33m",
      genres: ["Drama", "History"],
      desc: "D.W. Griffith's sweeping biographical portrait of the 16th president, from log cabin to the Civil War and beyond."
    },
    {
      id: "The_Pied_Piper_of_Hamelin",
      file: "pied.mp4",
      title: "The Pied Piper of Hamelin",
      year: 1957,
      runtime: "1h 30m",
      genres: ["Family", "Musical"],
      desc: "A colorful musical fantasy based on the classic fairy tale, set to the music of Edvard Grieg."
    },
    {
      id: "tarzans_revenge",
      file: "tarzans_revenge.mp4",
      title: "Tarzan's Revenge",
      year: 1938,
      runtime: "1h 10m",
      genres: ["Adventure"],
      desc: "Olympic gold medalists Glenn Morris and Eleanor Holm star in a jungle adventure of romance and danger."
    },
    {
      id: "TheFastandtheFuriousJohnIreland1954goofyrip",
      file: "TheFastandtheFuriousJohnIreland1954goofyrip.mp4",
      title: "The Fast and the Furious",
      year: 1955,
      runtime: "1h 13m",
      genres: ["Action", "Thriller"],
      desc: "Roger Corman's original hot-rod thriller: a wrongly accused man escapes custody and hides out in a cross-border sports-car race."
    },
    {
      id: "BloodyPitOfHorror",
      file: "BloodyPitOfHorror.mp4",
      title: "Bloody Pit of Horror",
      year: 1965,
      runtime: "1h 27m",
      genres: ["Horror", "Cult"],
      desc: "A photo shoot in a spooky castle turns deadly when its owner becomes convinced he is the reincarnation of a sadistic executioner. Italian cult horror."
    }
  ];

  window.CATALOG = RAW.map(function (m) {
    return {
      id: m.id,
      title: m.title,
      year: m.year,
      runtime: m.runtime,
      genres: m.genres.slice(),
      desc: m.desc,
      video: DOWNLOAD + m.id + "/" + m.file,
      poster: IMG + m.id
    };
  });

  window.ROWS = [
    { title: "Trending Now", ids: ["The_General_Buster_Keaton", "his_girl_friday", "TheStranger_0", "Sita_Sings_the_Blues", "VoyagetothePlanetofPrehistoricWomen", "JungleBook", "suddenly", "BloodyPitOfHorror"] },
    { title: "Comedy Classics", ids: ["The_General_Buster_Keaton", "his_girl_friday", "charlie_chaplin_film_fest", "utopia", "3stooges"] },
    { title: "Thrillers & Film Noir", ids: ["TheStranger_0", "suddenly", "dressed_to_kill", "TheFastandtheFuriousJohnIreland1954goofyrip"] },
    { title: "Action & Adventure", ids: ["JungleBook", "tarzans_revenge", "The_General_Buster_Keaton", "TheFastandtheFuriousJohnIreland1954goofyrip"] },
    { title: "Sci-Fi, Horror & Cult", ids: ["VoyagetothePlanetofPrehistoricWomen", "BloodyPitOfHorror", "reefer_madness1938"] },
    { title: "Family & Animation", ids: ["Sita_Sings_the_Blues", "The_Pied_Piper_of_Hamelin", "JungleBook"] },
    { title: "Drama & History", ids: ["abraham_lincoln", "reefer_madness1938", "TheStranger_0"] }
  ];

  window.FEATURED_IDS = ["The_General_Buster_Keaton", "his_girl_friday", "Sita_Sings_the_Blues", "TheStranger_0"];
})();
