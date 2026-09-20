// Injecté sur youtube.com. Ajoute :
//  - un petit cœur sur chaque miniature vue en naviguant (accueil, recherche,
//    recommandations...) et sur la page de lecture ;
//  - un item "Ajouter à la liste d'outliers" dans le menu ⋮ natif de YouTube.
// Un clic envoie la vidéo dans la liste d'outliers (stockée dans l'extension).
//
// Note : YouTube est une SPA avec un DOM interne qui change régulièrement, et
// a migré une bonne partie de ses cartes vidéo vers de nouveaux composants
// (yt-lockup-view-model) qui coexistent avec l'ancienne structure
// (ytd-video-renderer). Les sélecteurs ci-dessous couvrent les deux, avec du
// repli défensif — mais peuvent nécessiter une mise à jour si YouTube change
// encore sa structure.
(function () {
  const PROCESSED_ATTR = "data-of-processed";
  const favoritedIds = new Set();

  const CARD_SELECTOR =
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, " +
    "ytd-grid-video-renderer, ytd-playlist-video-renderer, yt-lockup-view-model";

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
      card.querySelector('a#thumbnail[href*="/watch"]') ||
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
  // prend TOUS les liens vers une vidéo, et on filtre ceux qui ressemblent à
  // une carte (miniature ou titre), pas un lien perdu dans une description.
  function looksLikeVideoCard(link) {
    if (link.id === "thumbnail" || link.id === "video-title") return true;
    if (link.querySelector("img, yt-image, yt-thumbnail-view-model, yt-img-shadow")) return true;
    return !!link.closest(CARD_SELECTOR);
  }

  function scanCards() {
    const anchors = document.querySelectorAll('a[href*="/watch?v="]');
    if (!anchors.length) return;

    const newIds = [];
    const seenCards = new Set();

    anchors.forEach((link) => {
      if (link.hasAttribute(PROCESSED_ATTR)) return;
      link.setAttribute(PROCESSED_ATTR, "1");

      if (!looksLikeVideoCard(link)) return;

      const href = link.getAttribute("href");
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
  }

  // --- Item "Ajouter à la liste d'outliers" dans le menu ⋮ natif ---
  // Expérimental : le popup de menu de YouTube est l'une des parties les
  // plus instables de son DOM. Le tout est protégé par des try/catch pour
  // qu'une éventuelle casse ne perturbe jamais le reste (cœurs compris).

  let pendingMenuContext = null;

  function captureMenuContext(e) {
    try {
      const trigger = e.target.closest(
        "ytd-menu-renderer button, ytd-menu-renderer yt-icon-button, " +
          "yt-icon-button.dropdown-trigger, tp-yt-paper-icon-button"
      );
      if (!trigger) return;

      const label = (trigger.getAttribute("aria-label") || trigger.getAttribute("title") || "").toLowerCase();
      const withinMenuRenderer = !!trigger.closest("ytd-menu-renderer");
      const looksLikeMoreMenu =
        withinMenuRenderer ||
        label.includes("plus d'options") ||
        label.includes("more actions") ||
        label.includes("more options");
      if (!looksLikeMoreMenu) return;

      const card =
        trigger.closest(CARD_SELECTOR) ||
        (location.pathname.startsWith("/watch") ? document.querySelector("ytd-watch-metadata") : null);
      if (!card) return;

      let videoId;
      let meta;
      if (card.tagName === "YTD-WATCH-METADATA") {
        videoId = new URLSearchParams(location.search).get("v");
        meta = {
          youtube_video_id: videoId,
          title: document.title.replace(/ - YouTube$/, "") || null,
          channel_title: extractChannelFromCard(document.body, null),
          thumbnail_url: videoId ? thumbUrl(videoId) : null,
          url: videoId ? videoUrl(videoId) : null,
          source_page: "menu",
        };
      } else {
        const link = card.querySelector('a#thumbnail[href*="/watch"], a#video-title[href*="/watch"]');
        const href = link ? link.getAttribute("href") : null;
        videoId = href ? extractIdFromHref(href) : null;
        meta = videoId ? extractMetaFromCard(card, videoId, "menu", href) : null;
      }
      if (!videoId || !meta) return;

      pendingMenuContext = { videoId, meta, ts: Date.now() };
    } catch (err) {
      // silencieux : on ne casse jamais la navigation YouTube pour ça
    }
  }
  document.addEventListener("pointerdown", captureMenuContext, true);

  function buildOutlierMenuItem(template, ctx) {
    const item = template.cloneNode(true);
    item.removeAttribute(PROCESSED_ATTR);
    item.classList.add("of-menu-item");

    const label = item.querySelector("yt-formatted-string, .yt-simple-endpoint-text, span");
    const icon = item.querySelector("yt-icon");
    if (icon) {
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3-4.8-4.3 6.4-.6z"/></svg>';
    }

    let active = false;
    const updateLabel = () => {
      if (label) label.textContent = active ? "Retirer de la liste d'outliers" : "Ajouter à la liste d'outliers";
    };
    updateLabel();
    checkFavorites([ctx.videoId], (ids) => {
      active = ids.includes(ctx.videoId);
      updateLabel();
    });

    item.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        active = !active;
        updateLabel();
        sendToggle(active, ctx.meta, (resp) => {
          if (!resp) {
            active = !active;
            updateLabel();
          }
        });
      },
      true
    );

    return item;
  }

  function tryInjectMenuItem(popup) {
    try {
      if (!pendingMenuContext || Date.now() - pendingMenuContext.ts > 4000) return;
      if (popup.querySelector(".of-menu-item")) return;

      const items = popup.querySelectorAll("ytd-menu-service-item-renderer, tp-yt-paper-item");
      if (!items.length) return;

      const template = items[items.length - 1];
      const custom = buildOutlierMenuItem(template, pendingMenuContext);
      template.parentElement.appendChild(custom);
    } catch (err) {
      // idem : ne jamais faire remonter d'erreur depuis ce code expérimental
    }
  }

  // --- Boucle d'observation ---

  let scanTimeout = null;
  function scheduleScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scanCards, 400);
  }

  const observer = new MutationObserver((mutations) => {
    scheduleScan();
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        const popup =
          node.matches && node.matches("tp-yt-iron-dropdown, ytd-menu-popup-renderer")
            ? node
            : node.querySelector && node.querySelector("tp-yt-iron-dropdown, ytd-menu-popup-renderer");
        if (popup) setTimeout(() => tryInjectMenuItem(popup), 50);
      });
    }
  });
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
