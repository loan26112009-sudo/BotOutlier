// Service worker : orchestre tout (remplace l'ancien backend FastAPI).
// Toutes les données vivent dans chrome.storage.local (voir lib/store.js).
// Deux alarmes : un rafraîchissement complet toutes les X heures, et un poll
// plus léger toutes les 15 min pour repérer les nouveaux outliers et notifier.
importScripts("lib/outliers.js", "lib/youtube.js", "lib/store.js");

const store = Store.makeStore(chrome.storage.local, { YouTube, OutlierEngine });

const REFRESH_ALARM = "refresh-outliers";
const POLL_ALARM = "poll-outliers";

async function scheduleRefreshAlarm() {
  const settings = await store.getSettings();
  const periodInMinutes = Math.max(1, Math.round((settings.refreshIntervalHours || 2) * 60));
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes, when: Date.now() + 1000 });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleRefreshAlarm();
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRefreshAlarm();
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    store.refreshAllChannels().catch(() => {});
  } else if (alarm.name === POLL_ALARM) {
    pollNewOutliers();
  }
});

async function pollNewOutliers() {
  try {
    const newOutliers = await store.listOutliers({ onlyNew: true, newSinceMinutes: 20, limit: 20 });

    await chrome.action.setBadgeBackgroundColor({ color: "#8b5cf6" });
    await chrome.action.setBadgeText({ text: newOutliers.length ? String(Math.min(newOutliers.length, 99)) : "" });

    const { notifiedIds = [] } = await chrome.storage.local.get("notifiedIds");
    const notifiedSet = new Set(notifiedIds);
    const fresh = newOutliers.filter((o) => !notifiedSet.has(o.video.youtubeVideoId));

    if (fresh.length > 0) {
      const top = fresh[0];
      chrome.notifications.create(`outlier-${top.video.youtubeVideoId}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: fresh.length === 1 ? "Nouvel outlier détecté 🚀" : `${fresh.length} nouveaux outliers 🚀`,
        message:
          fresh.length === 1
            ? `${top.channelTitle}: "${top.video.title}" fait x${top.video.outlierScore.toFixed(1)} (${top.niche})`
            : `Dont "${top.video.title}" (${top.channelTitle}, x${top.video.outlierScore.toFixed(1)})`,
      });

      const updated = [...notifiedSet, ...fresh.map((o) => o.video.youtubeVideoId)].slice(-500);
      await chrome.storage.local.set({ notifiedIds: updated });
    }
  } catch (e) {
    // pas de bruit si ça échoue (ex: pas encore de clé API configurée)
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const videoId = notificationId.replace("outlier-", "");
  chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
});

// ---- Appels API depuis le popup/les réglages (relayés par api.js) ----

const METHODS = {
  getNiches: () => store.listNiches(),
  createNiche: (name) => store.createNiche(name),
  deleteNiche: (id) => store.deleteNiche(id),

  getChannels: (niche) => store.listChannels(niche),
  addChannel: (channel, niche) => store.addChannel(channel, niche),
  deleteChannel: (id) => store.deleteChannel(id),
  previewChannel: (channel) => store.previewChannel(channel),
  createFlow: (ownChannel, niche, similarLinksText) => store.createFlow(ownChannel, niche, similarLinksText),

  getOutliers: (params) => store.listOutliers(params),

  discoverSimilar: (channel, limit) => store.discoverSimilar(channel, limit),
  discoverByQuery: (query, limit) => store.discoverByQuery(query, limit),
  addBulk: (niche, channelIds) => store.addBulk(niche, channelIds),

  runRefresh: () => store.refreshAllChannels(),
  getStatus: () => store.getStatus(),

  getSettings: () => store.getSettings(),
  updateSettings: async (patch) => {
    const settings = await store.updateSettings(patch);
    if (patch && "refreshIntervalHours" in patch) await scheduleRefreshAlarm();
    return settings;
  },

  getFavorites: (niche) => store.listFavorites(niche),
  addFavorite: (payload) => store.addFavorite(payload),
  removeFavorite: (videoId) => store.removeFavorite(videoId),
  updateFavorite: (videoId, niche) => store.updateFavorite(videoId, niche),
  checkFavorites: (ids) => store.checkFavorites(ids),
};

// Popup/réglages continuent de penser en snake_case (même contrat que
// l'ancien backend) : on convertit systématiquement les arguments entrants
// en camelCase avant d'appeler le store, symétrique à la conversion inverse
// faite côté api.js pour les réponses. Ne touche que les clés d'objets —
// jamais les chaînes de caractères (URLs de chaînes, ids...).
function toCamelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}
function deepCamelCase(value) {
  if (Array.isArray(value)) return value.map(deepCamelCase);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[toCamelKey(k)] = deepCamelCase(v);
    return out;
  }
  return value;
}

function normalizeFavoritePayload(payload) {
  return deepCamelCase(payload);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "API_CALL") {
    const fn = METHODS[message.method];
    if (!fn) {
      sendResponse({ ok: false, error: `Méthode inconnue: ${message.method}` });
      return false;
    }
    (async () => {
      try {
        const args = (message.args || []).map(deepCamelCase);
        const result = await fn(...args);
        sendResponse({ ok: true, result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // réponse asynchrone
  }

  // Contrat utilisé par content.js / subscriptions.js sur youtube.com : on le
  // garde identique (payload en snake_case, comme avant), seule
  // l'implémentation change (store local au lieu d'un relais réseau).
  if (message?.type === "TOGGLE_FAVORITE") {
    (async () => {
      try {
        if (message.favorited) {
          const favorite = await store.addFavorite(normalizeFavoritePayload(message.payload));
          sendResponse({ ok: true, favorited: true, favorite });
        } else {
          await store.removeFavorite(message.payload.youtube_video_id);
          sendResponse({ ok: true, favorited: false });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message?.type === "CHECK_FAVORITES") {
    (async () => {
      try {
        const favorited = await store.checkFavorites(message.ids || []);
        sendResponse({ ok: true, favorited });
      } catch (e) {
        sendResponse({ ok: false, error: e.message, favorited: [] });
      }
    })();
    return true;
  }

  return false;
});
