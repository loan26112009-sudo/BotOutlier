// Injecté sur youtube.com. Ajoute un petit cœur sur chaque miniature vue en
// naviguant (accueil, recherche, recommandations...) et un cœur flottant sur
// la page de lecture. Un clic envoie la vidéo dans "Mes picks" côté backend.
//
// Note : YouTube est une SPA avec un DOM interne qui change régulièrement.
// Les sélecteurs ci-dessous sont volontairement défensifs (plusieurs
// fallbacks) mais peuvent nécessiter une mise à jour si YouTube change sa
// structure de page.
(function () {
  const PROCESSED_ATTR = "data-of-processed";
  const favoritedIds = new Set();

  function thumbUrl(videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function extractIdFromHref(href) {
    try {
      return new URL(href, location.href).searchParams.get("v");
    } catch (e) {
      return null;
    }
  }

  function extractMetaFromRenderer(renderer, videoId, sourcePage) {
    const titleEl = renderer.querySelector("#video-title");
    const title = titleEl ? titleEl.textContent.trim() : null;
    const channelEl = renderer.querySelector(
      "ytd-channel-name a, #channel-name a, #channel-name yt-formatted-string, #text.ytd-channel-name"
    );
    const channelTitle = channelEl ? channelEl.textContent.trim() : null;
    return {
      youtube_video_id: videoId,
      title,
      channel_title: channelTitle,
      thumbnail_url: thumbUrl(videoId),
      url: videoUrl(videoId),
      source_page: sourcePage,
    };
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

  // --- Cœurs sur les miniatures (grilles, recherche, recommandations) ---

  function makeHeartButton(videoId, meta) {
    const btn = document.createElement("button");
    btn.className = "of-heart-btn";
    btn.type = "button";
    btn.title = "Ajouter à mes picks outliers";
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

  function scanThumbnails() {
    const links = document.querySelectorAll(`a#thumbnail[href*="/watch?v="]:not([${PROCESSED_ATTR}])`);
    if (!links.length) return;

    const newIds = [];
    links.forEach((link) => {
      link.setAttribute(PROCESSED_ATTR, "1");
      const videoId = extractIdFromHref(link.getAttribute("href"));
      if (!videoId) return;

      const renderer = link.closest(
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer"
      );
      const meta = renderer
        ? extractMetaFromRenderer(renderer, videoId, "grid")
        : {
            youtube_video_id: videoId,
            title: null,
            channel_title: null,
            thumbnail_url: thumbUrl(videoId),
            url: videoUrl(videoId),
            source_page: "grid",
          };

      if (getComputedStyle(link).position === "static") {
        link.style.position = "relative";
      }
      link.appendChild(makeHeartButton(videoId, meta));
      newIds.push(videoId);
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
  }

  let scanTimeout = null;
  function scheduleScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanThumbnails, 400);
  }

  // --- Cœur flottant sur la page de lecture ---

  let floatingBtn = null;

  function removeFloatingHeart() {
    if (floatingBtn) {
      floatingBtn.remove();
      floatingBtn = null;
    }
  }

  function injectWatchHeart() {
    removeFloatingHeart();
    if (!location.pathname.startsWith("/watch")) return;

    const videoId = new URLSearchParams(location.search).get("v");
    if (!videoId) return;

    const meta = {
      youtube_video_id: videoId,
      title: document.title.replace(/ - YouTube$/, "") || null,
      channel_title: null,
      thumbnail_url: thumbUrl(videoId),
      url: videoUrl(videoId),
      source_page: "watch",
    };

    // Le titre/la chaîne se peaufinent une fois le DOM du lecteur chargé. On
    // tente une lecture immédiate (le DOM est parfois déjà prêt) puis on
    // retente un peu plus tard en filet de sécurité, pour qu'un clic rapide
    // sur le cœur n'enregistre pas un favori sans titre.
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
    floatingBtn.title = "Ajouter cette vidéo à mes picks outliers";
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
