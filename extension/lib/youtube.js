// Client YouTube Data API v3, appelé directement depuis le service worker de
// l'extension (fetch) — plus de serveur intermédiaire.
//
// Quotas à garder en tête (quota par défaut : 10 000 unités/jour) :
// - channels.list, videos.list, playlistItems.list : 1 unité / appel (jusqu'à 50 ids)
// - search.list : 100 unités / appel (résolution par nom, découverte) — jamais
//   utilisé dans la boucle de rafraîchissement automatique.
(function (root) {
  const BASE_URL = "https://www.googleapis.com/youtube/v3";

  function parseChannelReference(raw) {
    raw = raw.trim();
    let m = raw.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/);
    if (m) return { kind: "id", value: m[1] };
    m = raw.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/);
    if (m) return { kind: "handle", value: m[1] };
    m = raw.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9_.-]+)/);
    if (m) return { kind: "legacy", value: m[1] };
    if (raw.startsWith("@")) return { kind: "handle", value: raw.slice(1) };
    if (/^UC[A-Za-z0-9_-]{22}$/.test(raw)) return { kind: "id", value: raw };
    return { kind: "query", value: raw };
  }

  function chunk(arr, size = 50) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function pickThumb(snippet) {
    const t = (snippet && snippet.thumbnails) || {};
    return (t.medium || t.default || {}).url || null;
  }

  function makeClient(fetchImpl) {
    const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!doFetch) throw new Error("Aucune implémentation fetch disponible");

    async function apiGet(path, params, apiKey) {
      if (!apiKey) throw new Error("Clé API YouTube manquante");
      const url = new URL(BASE_URL + path);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      url.searchParams.set("key", apiKey);

      const resp = await doFetch(url.toString());
      if (resp.status === 403) {
        const text = await resp.text();
        if (text.includes("quotaExceeded")) throw new Error("Quota YouTube API dépassé pour aujourd'hui");
        throw new Error("Accès refusé par l'API YouTube — vérifie ta clé API");
      }
      if (!resp.ok) throw new Error(`Erreur API YouTube (${resp.status})`);
      return resp.json();
    }

    function toResolved(item) {
      const snippet = item.snippet || {};
      const stats = item.statistics || {};
      const content = item.contentDetails || {};
      return {
        youtubeChannelId: item.id,
        title: snippet.title || null,
        handle: snippet.customUrl || null,
        thumbnailUrl: pickThumb(snippet),
        subscriberCount: stats.subscriberCount ? parseInt(stats.subscriberCount, 10) : null,
        uploadsPlaylistId: (content.relatedPlaylists || {}).uploads || null,
        description: snippet.description || null,
        viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : null,
      };
    }

    async function channelsBy(apiKey, params) {
      const data = await apiGet("/channels", { part: "snippet,statistics,contentDetails", maxResults: 50, ...params }, apiKey);
      return data.items || [];
    }

    async function searchChannelIdByQuery(apiKey, query) {
      const data = await apiGet("/search", { part: "snippet", type: "channel", q: query, maxResults: 1 }, apiKey);
      const items = data.items || [];
      if (!items.length) return null;
      return items[0].snippet.channelId || (items[0].id || {}).channelId || null;
    }

    async function resolveChannel(apiKey, raw) {
      const { kind, value } = parseChannelReference(raw);
      let items = [];
      if (kind === "id") items = await channelsBy(apiKey, { id: value });
      else if (kind === "handle") items = await channelsBy(apiKey, { forHandle: `@${value}` });
      else if (kind === "legacy") {
        items = await channelsBy(apiKey, { forUsername: value });
        if (!items.length) items = await channelsBy(apiKey, { forHandle: `@${value}` });
      }
      if (!items.length && kind !== "id") {
        const cid = await searchChannelIdByQuery(apiKey, value);
        if (cid) items = await channelsBy(apiKey, { id: cid });
      }
      if (!items.length) return null;
      return toResolved(items[0]);
    }

    async function getChannels(apiKey, ids) {
      const out = [];
      for (const batch of chunk(ids)) {
        if (!batch.length) continue;
        const items = await channelsBy(apiKey, { id: batch.join(",") });
        out.push(...items.map(toResolved));
      }
      return out;
    }

    async function getPlaylistVideoIds(apiKey, playlistId, maxResults) {
      const ids = [];
      let pageToken = null;
      while (ids.length < maxResults) {
        const params = { part: "contentDetails", playlistId, maxResults: Math.min(50, maxResults - ids.length) };
        if (pageToken) params.pageToken = pageToken;
        const data = await apiGet("/playlistItems", params, apiKey);
        for (const item of data.items || []) {
          const vid = (item.contentDetails || {}).videoId;
          if (vid) ids.push(vid);
        }
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
      return ids.slice(0, maxResults);
    }

    async function getVideos(apiKey, ids) {
      const out = [];
      for (const batch of chunk(ids)) {
        if (!batch.length) continue;
        const data = await apiGet("/videos", { part: "snippet,statistics", id: batch.join(","), maxResults: 50 }, apiKey);
        for (const item of data.items || []) {
          const snippet = item.snippet || {};
          const stats = item.statistics || {};
          out.push({
            youtubeVideoId: item.id,
            title: snippet.title || null,
            thumbnailUrl: pickThumb(snippet),
            publishedAt: snippet.publishedAt || null,
            viewCount: parseInt(stats.viewCount || "0", 10),
            likeCount: stats.likeCount ? parseInt(stats.likeCount, 10) : 0,
            commentCount: stats.commentCount ? parseInt(stats.commentCount, 10) : 0,
          });
        }
      }
      return out;
    }

    async function searchChannels(apiKey, query, limit = 15) {
      const data = await apiGet(
        "/search",
        { part: "snippet", type: "channel", q: query, maxResults: Math.min(50, limit), order: "relevance" },
        apiKey
      );
      const ids = [];
      for (const item of data.items || []) {
        const cid = (item.snippet || {}).channelId || (item.id || {}).channelId;
        if (cid) ids.push(cid);
      }
      return ids;
    }

    return { resolveChannel, getChannels, getPlaylistVideoIds, getVideos, searchChannels };
  }

  const YouTube = { makeClient, parseChannelReference };
  if (typeof module !== "undefined" && module.exports) module.exports = YouTube;
  else root.YouTube = YouTube;
})(typeof self !== "undefined" ? self : this);
