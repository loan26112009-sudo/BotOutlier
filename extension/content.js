// Injecté sur youtube.com. Ajoute un petit cœur sur chaque miniature vue en
// naviguant (accueil, recherche, recommandations...) et sur la page de
// lecture. Un clic envoie la vidéo dans la liste d'outliers (stockée dans
// l'extension).
//
// Note : YouTube est une SPA avec un DOM interne qui change régulièrement, et
// a migré une bonne partie de ses cartes vidéo vers de nouveaux composants
// (yt-lockup-view-model) qui coexistent avec l'ancienne structure
// (ytd-video-renderer). Les sélecteurs ci-dessous couvrent les deux, avec du
// repli défensif — mais peuvent nécessiter une mise à jour si YouTube change
// encore sa structure. Tout est protégé par des try/catch : une exception
// ponctuelle ne doit jamais faire disparaître le cœur pour le reste de la
// session.
(function () {
  const PROCESSED_ATTR = "data-of-processed";
  const favoritedIds = new Set();

  const CARD_SELECTOR =
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, " +
    "ytd-grid-video-renderer, ytd-playlist-video-renderer, yt-lockup-view-model, " +
    "ytd-reel-item-renderer, ytm-shorts-lockup-view-model, ytd-shorts-lockup-view-model-v2";

  // Cartes représentant une PLAYLIST entière (pas une vidéo précise) : on ne
  // sait pas quelle vidéo ajouter, donc pas de cœur dessus.
  const PLAYLIST_CARD_SELECTOR =
    "ytd-playlist-renderer, ytd-compact-playlist-renderer, ytd-grid-playlist-renderer, " +
    "ytd-radio-renderer, ytd-playlist-panel-renderer";

  function thumbUrl(videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function extractIdFromHref(href) {
    try {
      const u = new URL(href, location.href);
      const fromQuery = u.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const m = u.pathname.match(/\/shorts\/([\w-]{6,})/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  // Repère le nom de chaîne en scannant tous les liens de la carte plutôt
  // qu'en ciblant une classe précise (fragile) : on cherche un lien qui
  // ressemble à une URL de chaîne (@handle, /channel/UC..., /c/..., /user/...)
  // et qui n'est pas le lien vers la vidéo elle-même.
  function extractChannelFromCard(card, videoHref) {
    const anchors = card.querySelectorAll("a[href]");
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      if (!href || href === videoHref) continue;
      if (/\/(@[\w.-]+|channel\/UC[\w-]{10,}|c\/[\w.-]+|user\/[\w.-]+)(\/|$|\?)/.test(href)) {
        const text = a.textContent.trim();
        if (text) return text;
      }
    }
    const legacy = card.querySelector(
      "ytd-channel-name a, #channel-name a, #channel-name yt-formatted-string, #text.ytd-channel-name"
    );
    return legacy ? legacy.textContent.trim() : null;
  }

  function extractMetaFromCard(card, videoId, sourcePage, videoHref) {
    const titleEl = card.querySelector("#video-title");
    const title = titleEl ? titleEl.textContent.trim() : null;
    return {
      youtube_video_id: videoId,
      title,
      channel_title: extractChannelFromCard(card, videoHref),
      thumbnail_url: thumbUrl(videoId),
      url: videoUrl(videoId),
      source_page: sourcePage,
    };
  }

  // Choisit où accrocher le cœur : la miniature si on peut la cibler
  // précisément, sinon la carte entière en repli.
  function pickHeartAnchor(card, fallbackLink) {
    return (
      card.querySelector('a#thumbnail[href*="/watch"], a#thumbnail[href*="/shorts/"]') ||
      card.querySelector("yt-thumbnail-view-model") ||
      fallbackLink
    );
  }

  function sendToggle(willFavorite, meta, onDone) {
    chrome.runtime.sendMessage({ type: "TOGGLE_FAVORITE", favorited: willFavorite, payload: meta }, (resp) => {
      onDone(resp && resp.ok ? resp : null);
    });
  }

  function checkFavorites(ids, onDone) {
    if (!ids.length) return onDone([]);
    chrome.runtime.sendMessage({ type: "CHECK_FAVORITES", ids }, (resp) => {
      onDone(resp && resp.ok ? resp.favorited : []);
    });
  }

  // "Mode recherche" (cœur sur les miniatures) et "mode spectateur" (cœur
  // flottant sur la page de lecture) sont activables indépendamment depuis
  // les réglages avancés de l'extension.
  async function getModeSettings() {
    try {
      const data = await chrome.storage.local.get("of_db_v1");
      const settings = (data.of_db_v1 && data.of_db_v1.settings) || {};
      return {
        searchMode: settings.heartSearchMode !== false,
        viewerMode: settings.heartViewerMode !== false,
      };
    } catch (e) {
      return { searchMode: true, viewerMode: true };
    }
  }

  // --- Cœurs sur les miniatures (grilles, recherche, recommandations) ---

  function makeHeartButton(videoId, meta) {
    const btn = document.createElement("button");
    btn.className = "of-heart-btn";
    btn.type = "button";
    btn.title = "Ajouter à la liste d'outliers";
    btn.dataset.videoId = videoId;
    btn.textContent = "♡";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willFavorite = !btn.classList.contains("of-active");
      btn.classList.toggle("of-active", willFavorite);
      btn.textContent = willFavorite ? "♥" : "♡";
      btn.classList.add("of-loading");
      sendToggle(willFavorite, meta, (resp) => {
        btn.classList.remove("of-loading");
        if (!resp) {
          btn.classList.toggle("of-active", !willFavorite);
          btn.textContent = !willFavorite ? "♥" : "♡";
          return;
        }
        if (willFavorite) favoritedIds.add(videoId);
        else favoritedIds.delete(videoId);
      });
    });

    return btn;
  }

  // On ne s'appuie plus sur des id précis (#thumbnail, #video-title) : ce sont
  // exactement le genre de détails que YouTube change en premier lors d'une
  // refonte, et ça suffit à faire disparaître le cœur partout d'un coup. On
  // prend TOUS les liens vers une vidéo (ou un Short), et on filtre ceux qui
  // ressemblent à une carte (miniature ou titre), pas un lien perdu dans une
  // description, et jamais une playlist entière (on ne sait pas quelle vidéo
  // ajouter).
  function looksLikeVideoCard(link) {
    if (link.id === "thumbnail" || link.id === "video-title") return true;
    if (link.querySelector("img, yt-image, yt-thumbnail-view-model, yt-img-shadow")) return true;
    return !!link.closest(CARD_SELECTOR);
  }

  function isPlaylistTile(link, href) {
    if (link.closest(PLAYLIST_CARD_SELECTOR)) return true;
    // Une "Mix" (playlist auto-générée par YouTube) utilise list=RD... même
    // sur un lien /watch? classique.
    if (/[?&]list=RD/.test(href)) return true;
    return false;
  }

  async function scanCards() {
    try {
      const { searchMode } = await getModeSettings();
      if (!searchMode) return;

      const anchors = document.querySelectorAll('a[href*="/watch?v="], a[href*="/shorts/"]');
      if (!anchors.length) return;

      const newIds = [];
      const seenCards = new Set();

      anchors.forEach((link) => {
        try {
          if (link.hasAttribute(PROCESSED_ATTR)) return;
          link.setAttribute(PROCESSED_ATTR, "1");

          const href = link.getAttribute("href");
          if (isPlaylistTile(link, href)) return;
          if (!looksLikeVideoCard(link)) return;

          const videoId = extractIdFromHref(href);
          if (!videoId) return;

          const card = link.closest(CARD_SELECTOR) || link;
          if (seenCards.has(card)) return;
          seenCards.add(card);

          const meta = extractMetaFromCard(card, videoId, "grid", href);
          const target = pickHeartAnchor(card, link);
          if (getComputedStyle(target).position === "static") {
            target.style.position = "relative";
          }
          target.appendChild(makeHeartButton(videoId, meta));
          newIds.push(videoId);
        } catch (err) {
          // une carte cassée ne doit jamais empêcher les suivantes
        }
      });

      checkFavorites(newIds, (ids) => {
        ids.forEach((id) => favoritedIds.add(id));
        document.querySelectorAll(".of-heart-btn").forEach((btn) => {
          if (favoritedIds.has(btn.dataset.videoId)) {
            btn.classList.add("of-active");
            btn.textContent = "♥";
          }
        });
      });
    } catch (err) {
      // ne jamais casser la navigation YouTube pour ça
    }
  }

  // --- Cœur flottant sur la page de lecture ---

  let floatingBtn = null;

  function removeFloatingHeart() {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  }

  async function injectWatchHeart() {
    try {
      removeFloatingHeart();
      if (!location.pathname.startsWith("/watch") && !location.pathname.startsWith("/shorts/")) return;

      const { viewerMode } = await getModeSettings();
      if (!viewerMode) return;

      const videoId = new URLSearchParams(location.search).get("v") || extractIdFromHref(location.pathname);
      if (!videoId) return;

      const meta = {
        youtube_video_id: videoId,
        title: document.title.replace(/ - YouTube$/, "") || null,
        channel_title: null,
        thumbnail_url: thumbUrl(videoId),
        url: videoUrl(videoId),
        source_page: "watch",
      };

      function refreshWatchMeta() {
        const titleEl = document.querySelector(
          "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, h1.ytd-watch-metadata"
        );
        if (titleEl && titleEl.textContent.trim()) meta.title = titleEl.textContent.trim();
        const channelEl = document.querySelector(
          "ytd-channel-name#channel-name a, #owner ytd-channel-name a, #channel-name a"
        );
        if (channelEl && channelEl.textContent.trim()) meta.channel_title = channelEl.textContent.trim();
      }
      refreshWatchMeta();
      setTimeout(refreshWatchMeta, 1000);

      floatingBtn = document.createElement("button");
      floatingBtn.className = "of-floating-heart";
      floatingBtn.type = "button";
      floatingBtn.title = "Ajouter cette vidéo à la liste d'outliers";
      floatingBtn.textContent = "♡";

      checkFavorites([videoId], (ids) => {
        if (ids.includes(videoId)) {
          floatingBtn.classList.add("of-active");
          floatingBtn.textContent = "♥";
        }
      });

      floatingBtn.addEventListener("click", () => {
        const willFavorite = !floatingBtn.classList.contains("of-active");
        floatingBtn.classList.toggle("of-active", willFavorite);
        floatingBtn.textContent = willFavorite ? "♥" : "♡";
        floatingBtn.classList.add("of-loading");
        sendToggle(willFavorite, meta, (resp) => {
          floatingBtn.classList.remove("of-loading");
          if (!resp) {
            floatingBtn.classList.toggle("of-active", !willFavorite);
            floatingBtn.textContent = !willFavorite ? "♥" : "♡";
          }
        });
      });

      document.body.appendChild(floatingBtn);
    } catch (err) {
      // idem : ne jamais casser la navigation YouTube pour ça
    }
  }

  // --- Boucle d'observation ---

  let scanTimeout = null;
  function scheduleScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      scanCards();
    }, 400);
  }

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube ne recharge pas la page en navigation interne (SPA) : cet événement
  // maison signale une navigation terminée.
  document.addEventListener("yt-navigate-finish", () => {
    injectWatchHeart();
    scheduleScan();
  });

  injectWatchHeart();
  scheduleScan();
})();
