// Injecté sur youtube.com, indépendant de content.js (favoris/outliers) :
// ajoute une étoile sur chaque chaîne abonnée dans le menu latéral, pour
// l'épingler en haut de la liste. Purement local (chrome.storage.local),
// aucun appel réseau — c'est une préférence d'affichage, pas une donnée
// d'outlier.
//
// Expérimental : le menu latéral de YouTube est une des zones les plus
// retravaillées de son DOM. Tout est protégé par des try/catch pour ne
// jamais casser la navigation si les sélecteurs deviennent obsolètes.
(function () {
  const STORAGE_KEY = "favoriteSubscriptions";
  const PROCESSED_ATTR = "data-of-sub-processed";
  const ENTRY_SELECTOR = "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer";

  function extractChannelKey(href) {
    const m = href.match(/\/channel\/(UC[\w-]+)/) || href.match(/(\/@[\w.-]+)/);
    return m ? m[1] : href;
  }

  async function getFavorites() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return new Set(data[STORAGE_KEY] || []);
    } catch (e) {
      return new Set();
    }
  }

  async function setFavorites(set) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: [...set] });
    } catch (e) {
      // silencieux
    }
  }

  function isChannelEntry(entry) {
    const link = entry.querySelector("a[href]");
    if (!link) return false;
    const href = link.getAttribute("href") || "";
    const hasAvatar = !!entry.querySelector(
      "yt-img-shadow img, #avatar img, img.yt-img-shadow, yt-icon-shape img"
    );
    return hasAvatar && /\/(channel\/UC[\w-]{10,}|@[\w.-]+)(\/|$|\?)/.test(href);
  }

  const trackedEntries = []; // { el, key }

  function makeStarButton(key, isFavorite) {
    const btn = document.createElement("button");
    btn.className = "of-sub-star" + (isFavorite ? " of-active" : "");
    btn.type = "button";
    btn.title = "Épingler en haut de mes abonnements";
    btn.textContent = isFavorite ? "★" : "☆";

    btn.addEventListener(
      "click",
      async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const favorites = await getFavorites();
        const nowFavorite = !favorites.has(key);
        if (nowFavorite) favorites.add(key);
        else favorites.delete(key);
        await setFavorites(favorites);
        btn.classList.toggle("of-active", nowFavorite);
        btn.textContent = nowFavorite ? "★" : "☆";
        reorder(favorites);
      },
      true
    );

    return btn;
  }

  async function scan() {
    try {
      const nodes = document.querySelectorAll(`${ENTRY_SELECTOR}:not([${PROCESSED_ATTR}])`);
      if (!nodes.length) return;

      const favorites = await getFavorites();
      nodes.forEach((entry) => {
        entry.setAttribute(PROCESSED_ATTR, "1");
        if (!isChannelEntry(entry)) return;

        const link = entry.querySelector("a[href]");
        const key = extractChannelKey(link.getAttribute("href"));

        if (getComputedStyle(entry).position === "static") {
          entry.style.position = "relative";
        }
        entry.appendChild(makeStarButton(key, favorites.has(key)));
        trackedEntries.push({ el: entry, key });
      });

      reorder(favorites);
    } catch (e) {
      // silencieux : cette fonctionnalité ne doit jamais bloquer la navigation
    }
  }

  function reorder(favorites) {
    try {
      const favEntries = trackedEntries.filter((e) => e.el.isConnected && favorites.has(e.key));
      // prepend() place toujours en position 0 : on parcourt à l'envers pour
      // que l'ordre relatif des favoris entre eux reste stable une fois en haut.
      for (let i = favEntries.length - 1; i >= 0; i--) {
        const { el } = favEntries[i];
        const parent = el.parentElement;
        if (parent) parent.prepend(el);
      }
    } catch (e) {
      // silencieux
    }
  }

  let scanTimeout = null;
  function scheduleScan() {
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scan, 500);
  }

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleScan();
})();
