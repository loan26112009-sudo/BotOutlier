// Couche d'accès aux données, partagée entre popup et réglages. Ne fait plus
// de requête réseau vers un serveur : tout passe par un message vers le
// service worker (background.js), qui lit/écrit chrome.storage.local.
//
// Les réponses sont converties de camelCase (naturel en JS, utilisé dans
// lib/store.js) vers snake_case, pour garder exactement le même contrat que
// l'ancien backend et ne rien changer côté popup.js / options.js.

function toSnakeKey(key) {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function deepSnakeCase(value) {
  if (Array.isArray(value)) return value.map(deepSnakeCase);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[toSnakeKey(k)] = deepSnakeCase(v);
    }
    return out;
  }
  return value;
}

function call(method, ...args) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "API_CALL", method, args }, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error("L'extension vient peut-être d'être rechargée — réouvre le popup."));
        return;
      }
      if (!resp || !resp.ok) {
        reject(new Error((resp && resp.error) || "Une erreur est survenue, réessaie dans un instant."));
        return;
      }
      resolve(deepSnakeCase(resp.result));
    });
  });
}

const api = {
  getNiches: () => call("getNiches"),
  createNiche: (name) => call("createNiche", name),
  deleteNiche: (id) => call("deleteNiche", id),

  getChannels: (niche) => call("getChannels", niche),
  addChannel: (channel, niche) => call("addChannel", channel, niche),
  deleteChannel: (id) => call("deleteChannel", id),
  previewChannel: (channel) => call("previewChannel", channel),
  createFlow: (ownChannel, niche, similarLinksText) => call("createFlow", ownChannel, niche, similarLinksText),

  getOutliers: (params = {}) => call("getOutliers", params),

  discoverSimilar: (channel, limit = 15) => call("discoverSimilar", channel, limit),
  discoverByQuery: (query, limit = 15) => call("discoverByQuery", query, limit),
  addBulk: (niche, channel_ids) => call("addBulk", niche, channel_ids),

  runRefresh: () => call("runRefresh"),
  getStatus: () => call("getStatus"),

  getSettings: () => call("getSettings"),
  updateSettings: (patch) => call("updateSettings", patch),

  getFavorites: (niche) => call("getFavorites", niche),
  addFavorite: (payload) => call("addFavorite", payload),
  removeFavorite: (videoId) => call("removeFavorite", videoId),
  updateFavorite: (videoId, niche) => call("updateFavorite", videoId, niche),
  checkFavorites: (ids) => (ids.length ? call("checkFavorites", ids).then((r) => ({ favorited: r })) : Promise.resolve({ favorited: [] })),
};
