// Petite couche d'accès à l'API du backend, partagée entre popup/options/background.

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.sync.get("backendUrl");
  return (backendUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

async function setBackendUrl(url) {
  await chrome.storage.sync.set({ backendUrl: url.replace(/\/+$/, "") });
}

async function apiFetch(path, options = {}) {
  const base = await getBackendUrl();
  const resp = await fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = body.detail || JSON.stringify(body);
    } catch (e) {
      // pas de corps JSON
    }
    throw new Error(`${resp.status} ${detail}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

const api = {
  getNiches: () => apiFetch("/niches"),
  createNiche: (name) => apiFetch("/niches", { method: "POST", body: JSON.stringify({ name }) }),
  deleteNiche: (id) => apiFetch(`/niches/${id}`, { method: "DELETE" }),

  getChannels: (niche) => apiFetch(`/channels${niche ? `?niche=${encodeURIComponent(niche)}` : ""}`),
  addChannel: (channel, niche) =>
    apiFetch("/channels", { method: "POST", body: JSON.stringify({ channel, niche }) }),
  deleteChannel: (id) => apiFetch(`/channels/${id}`, { method: "DELETE" }),

  getOutliers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/outliers${qs ? `?${qs}` : ""}`);
  },

  discoverSimilar: (channel, limit = 15) =>
    apiFetch("/discover/similar", { method: "POST", body: JSON.stringify({ channel, limit }) }),
  discoverByQuery: (query, limit = 15) =>
    apiFetch("/discover/query", { method: "POST", body: JSON.stringify({ query, limit }) }),
  addBulk: (niche, channel_ids) =>
    apiFetch("/discover/add-bulk", { method: "POST", body: JSON.stringify({ niche, channel_ids }) }),

  runRefresh: () => apiFetch("/refresh/run", { method: "POST" }),
  getStatus: () => apiFetch("/status"),
};
