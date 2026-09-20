// Stockage local (remplace l'ancienne base SQLite servie par un backend
// séparé). Tout vit dans chrome.storage.local, sur la machine de la personne,
// dans son profil Chrome — aucun serveur à lancer.
(function (root) {
  const DB_KEY = "of_db_v1";
  const SNAPSHOT_RETENTION_DAYS = 30;
  // Une vidéo de moins de 3 min est traitée comme un Short (seuil officiel
  // YouTube depuis 2024, plus large que l'ancienne limite de 60s).
  const SHORT_MAX_SECONDS = 180;

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyDb() {
    return {
      settings: {
        youtubeApiKey: "",
        outlierMultiplier: 3,
        minViewsFloor: 3000,
        minHistoryVideos: 5,
        maxVideosPerChannel: 30,
        refreshIntervalHours: 2,
        // "Mode recherche" (cœur sur les miniatures en naviguant) et "mode
        // spectateur" (cœur flottant sur la page de lecture), activables
        // indépendamment depuis les réglages.
        heartSearchMode: true,
        heartViewerMode: true,
      },
      niches: [],
      channels: [],
      videos: [],
      favorites: [],
      snapshots: [],
      refreshState: { inProgress: false, lastStartedAt: null, lastFinishedAt: null },
      seq: { niches: 1, channels: 1, videos: 1, favorites: 1 },
    };
  }

  // storageArea : un objet avec get(key) -> Promise<{[key]: value}> et
  // set(obj) -> Promise<void>, compatible chrome.storage.local ou un mock.
  // deps : { YouTube, OutlierEngine } — injectés pour rester testable sans Chrome.
  function makeStore(storageArea, deps) {
    const { YouTube, OutlierEngine } = deps;
    const client = YouTube.makeClient();

    async function read() {
      const data = await storageArea.get(DB_KEY);
      let db = data[DB_KEY];
      if (!db) {
        // Pas de niches pré-créées : la liste ne contient que ce que la
        // personne crée elle-même, pour éviter la confusion "j'ai 6 niches
        // alors que je n'ai rien fait".
        db = emptyDb();
        await storageArea.set({ [DB_KEY]: db });
      }
      return db;
    }

    async function write(db) {
      await storageArea.set({ [DB_KEY]: db });
    }

    function findNiche(db, name) {
      return db.niches.find((n) => n.name.toLowerCase() === name.trim().toLowerCase());
    }

    function getOrCreateNiche(db, name) {
      name = name.trim();
      let niche = findNiche(db, name);
      if (!niche) {
        niche = { id: db.seq.niches++, name, createdAt: nowIso() };
        db.niches.push(niche);
      }
      return niche;
    }

    // ---------------- niches ----------------

    async function listNiches() {
      const db = await read();
      return db.niches.map((n) => ({
        ...n,
        channelCount: db.channels.filter((c) => c.nicheId === n.id).length,
      }));
    }

    async function createNiche(name) {
      name = (name || "").trim();
      if (!name) throw new Error("Nom de niche vide");
      const db = await read();
      const existing = findNiche(db, name);
      if (existing) return { ...existing, channelCount: db.channels.filter((c) => c.nicheId === existing.id).length };
      const niche = getOrCreateNiche(db, name);
      await write(db);
      return { ...niche, channelCount: 0 };
    }

    async function deleteNiche(id) {
      const db = await read();
      const channelIds = db.channels.filter((c) => c.nicheId === id).map((c) => c.id);
      db.videos = db.videos.filter((v) => !channelIds.includes(v.channelId));
      db.channels = db.channels.filter((c) => c.nicheId !== id);
      db.niches = db.niches.filter((n) => n.id !== id);
      await write(db);
      return { ok: true };
    }

    // ---------------- chaînes ----------------

    async function listChannels(nicheName) {
      const db = await read();
      let channels = db.channels;
      if (nicheName) {
        const niche = findNiche(db, nicheName);
        channels = niche ? channels.filter((c) => c.nicheId === niche.id) : [];
      }
      return [...channels].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    function upsertChannel(db, resolved, nicheId) {
      let channel = db.channels.find((c) => c.youtubeChannelId === resolved.youtubeChannelId);
      if (channel) {
        Object.assign(channel, {
          title: resolved.title,
          handle: resolved.handle,
          uploadsPlaylistId: resolved.uploadsPlaylistId,
          thumbnailUrl: resolved.thumbnailUrl,
          subscriberCount: resolved.subscriberCount,
          nicheId,
        });
      } else {
        channel = {
          id: db.seq.channels++,
          youtubeChannelId: resolved.youtubeChannelId,
          title: resolved.title,
          handle: resolved.handle,
          uploadsPlaylistId: resolved.uploadsPlaylistId,
          thumbnailUrl: resolved.thumbnailUrl,
          subscriberCount: resolved.subscriberCount,
          nicheId,
          createdAt: nowIso(),
          lastRefreshedAt: null,
          lastError: null,
        };
        db.channels.push(channel);
      }
      return channel;
    }

    async function addChannel(channelRef, nicheName) {
      if (!(channelRef || "").trim()) throw new Error("Lien de chaîne vide");
      if (!(nicheName || "").trim()) throw new Error("Niche manquante");

      const apiKey = (await read()).settings.youtubeApiKey;
      if (!apiKey) throw new Error("Ajoute ta clé API YouTube dans les réglages avancés avant d'ajouter une chaîne.");

      const resolved = await client.resolveChannel(apiKey, channelRef);
      if (!resolved) throw new Error(`Impossible de trouver la chaîne YouTube pour "${channelRef}".`);

      const db = await read();
      const niche = getOrCreateNiche(db, nicheName);
      const channel = upsertChannel(db, resolved, niche.id);
      await write(db);
      return channel;
    }

    async function deleteChannel(id) {
      const db = await read();
      db.videos = db.videos.filter((v) => v.channelId !== id);
      db.channels = db.channels.filter((c) => c.id !== id);
      await write(db);
      return { ok: true };
    }

    // ---------------- outliers ----------------

    async function listOutliers(opts = {}) {
      const { niche, minScore, onlyNew, newSinceMinutes = 180, limit = 100 } = opts;
      const db = await read();
      const nicheById = Object.fromEntries(db.niches.map((n) => [n.id, n]));
      const channelById = Object.fromEntries(db.channels.map((c) => [c.id, c]));

      let videos = db.videos.filter((v) => v.isOutlier);
      if (niche) {
        videos = videos.filter((v) => {
          const c = channelById[v.channelId];
          const n = c && nicheById[c.nicheId];
          return n && n.name.toLowerCase() === niche.toLowerCase();
        });
      }
      if (minScore != null && minScore !== "") {
        const min = Number(minScore);
        videos = videos.filter((v) => (v.outlierScore || 0) >= min);
      }

      const cutoff = Date.now() - newSinceMinutes * 60000;
      if (onlyNew) {
        videos = videos.filter((v) => v.firstDetectedOutlierAt && new Date(v.firstDetectedOutlierAt).getTime() >= cutoff);
      }

      videos = [...videos].sort((a, b) => (b.outlierScore || 0) - (a.outlierScore || 0)).slice(0, limit);

      return videos.map((v) => {
        const c = channelById[v.channelId] || {};
        const n = nicheById[c.nicheId] || {};
        return {
          video: v,
          channelTitle: c.title || null,
          channelId: c.youtubeChannelId || "",
          niche: n.name || "",
          isNew: !!(v.firstDetectedOutlierAt && new Date(v.firstDetectedOutlierAt).getTime() >= cutoff),
        };
      });
    }

    // ---------------- favoris ("liste d'outliers" manuelle) ----------------

    async function listFavorites(nicheName) {
      const db = await read();
      let favs = db.favorites;
      if (nicheName) {
        const niche = findNiche(db, nicheName);
        favs = niche ? favs.filter((f) => f.nicheId === niche.id) : [];
      }
      return [...favs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async function addFavorite(payload) {
      const db = await read();
      const existing = db.favorites.find((f) => f.youtubeVideoId === payload.youtubeVideoId);
      if (existing) return existing;

      let nicheId = null;
      if (payload.niche) nicheId = getOrCreateNiche(db, payload.niche).id;

      const fav = {
        id: db.seq.favorites++,
        youtubeVideoId: payload.youtubeVideoId,
        title: payload.title || null,
        channelTitle: payload.channelTitle || null,
        channelYoutubeId: payload.channelYoutubeId || null,
        thumbnailUrl: payload.thumbnailUrl || null,
        url: payload.url || null,
        nicheId,
        sourcePage: payload.sourcePage || null,
        createdAt: nowIso(),
      };
      db.favorites.push(fav);
      await write(db);
      return fav;
    }

    async function removeFavorite(videoId) {
      const db = await read();
      const before = db.favorites.length;
      db.favorites = db.favorites.filter((f) => f.youtubeVideoId !== videoId);
      if (db.favorites.length === before) throw new Error("Favori introuvable");
      await write(db);
      return { ok: true };
    }

    async function updateFavorite(videoId, nicheName) {
      const db = await read();
      const fav = db.favorites.find((f) => f.youtubeVideoId === videoId);
      if (!fav) throw new Error("Favori introuvable");
      fav.nicheId = nicheName ? getOrCreateNiche(db, nicheName).id : null;
      await write(db);
      return fav;
    }

    async function checkFavorites(ids) {
      if (!ids || !ids.length) return [];
      const db = await read();
      const set = new Set(ids);
      return db.favorites.filter((f) => set.has(f.youtubeVideoId)).map((f) => f.youtubeVideoId);
    }

    // ---------------- découverte ----------------

    const STOPWORDS = new Set([
      "the", "and", "for", "with", "from", "this", "that", "your", "you", "our",
      "les", "des", "une", "un", "la", "le", "de", "du", "et", "pour", "sur",
      "official", "channel", "chaine", "chaîne", "youtube", "com",
    ]);

    function extractKeywords(text, limit = 5) {
      const words = (text.toLowerCase().match(/[a-zà-öø-ÿ0-9']{3,}/gi) || []);
      const seen = [];
      for (const w of words) {
        if (STOPWORDS.has(w) || seen.includes(w)) continue;
        seen.push(w);
        if (seen.length >= limit) break;
      }
      return seen;
    }

    function toDiscovered(db, channels) {
      const tracked = new Set(db.channels.map((c) => c.youtubeChannelId));
      return channels.map((c) => ({
        youtubeChannelId: c.youtubeChannelId,
        title: c.title,
        description: (c.description || "").slice(0, 200),
        thumbnailUrl: c.thumbnailUrl,
        subscriberCount: c.subscriberCount,
        alreadyTracked: tracked.has(c.youtubeChannelId),
      }));
    }

    function requireApiKey(db) {
      if (!db.settings.youtubeApiKey) {
        throw new Error("Ajoute ta clé API YouTube dans les réglages avancés.");
      }
      return db.settings.youtubeApiKey;
    }

    async function discoverSimilar(channelRef, limit = 15) {
      const db = await read();
      const apiKey = requireApiKey(db);

      const resolved = await client.resolveChannel(apiKey, channelRef);
      if (!resolved) return [];

      const text = [resolved.title, (resolved.description || "").slice(0, 300)].filter(Boolean).join(" ");
      const keywords = extractKeywords(text);
      const query = keywords.length ? keywords.join(" ") : resolved.title || "";
      if (!query) return [];

      const ids = (await client.searchChannels(apiKey, query, limit + 1))
        .filter((id) => id !== resolved.youtubeChannelId)
        .slice(0, limit);
      return toDiscovered(db, await client.getChannels(apiKey, ids));
    }

    async function discoverByQuery(query, limit = 15) {
      const db = await read();
      const apiKey = requireApiKey(db);
      const ids = await client.searchChannels(apiKey, query, limit);
      return toDiscovered(db, await client.getChannels(apiKey, ids));
    }

    // Aperçu d'une chaîne sans rien enregistrer : permet d'afficher "c'est
    // bien cette chaîne-là ?" avant de l'ajouter pour de vrai, pour éviter
    // les ajouts hasardeux quand la personne tape juste un nom approximatif.
    async function previewChannel(channelRef) {
      if (!(channelRef || "").trim()) return null;
      const db = await read();
      const apiKey = requireApiKey(db);
      const resolved = await client.resolveChannel(apiKey, channelRef);
      if (!resolved) return null;
      return {
        youtubeChannelId: resolved.youtubeChannelId,
        title: resolved.title,
        thumbnailUrl: resolved.thumbnailUrl,
        subscriberCount: resolved.subscriberCount,
      };
    }

    // Flux "1 clic" : ajoute la chaîne perso (si donnée) et les liens
    // similaires (si donnés), puis complète TOUJOURS avec une découverte
    // automatique basée sur la description de niche — la personne n'a donc
    // besoin de décrire que sa niche pour obtenir un flux garni.
    async function createFlow(ownChannelRef, nicheName, similarLinksText) {
      nicheName = (nicheName || "").trim();
      if (!nicheName) throw new Error("Décris ta niche pour commencer.");

      const db0 = await read();
      const apiKey = requireApiKey(db0);

      const added = [];
      const errors = [];

      if ((ownChannelRef || "").trim()) {
        try {
          const channel = await addChannel(ownChannelRef, nicheName);
          added.push(channel.youtubeChannelId);
        } catch (e) {
          errors.push(`ta chaîne : ${e.message}`);
        }
      }

      const links = (similarLinksText || "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const link of links) {
        try {
          const channel = await addChannel(link, nicheName);
          added.push(channel.youtubeChannelId);
        } catch (e) {
          errors.push(`${link} : ${e.message}`);
        }
      }

      let discoveredCount = 0;
      try {
        const results = await discoverByQuery(nicheName, 10);
        const toAdd = results.filter((r) => !r.alreadyTracked && !added.includes(r.youtubeChannelId)).slice(0, 8);
        if (toAdd.length) {
          const resolvedList = await client.getChannels(apiKey, toAdd.map((r) => r.youtubeChannelId));
          const db = await read();
          const niche = getOrCreateNiche(db, nicheName);
          for (const resolved of resolvedList) {
            upsertChannel(db, resolved, niche.id);
            added.push(resolved.youtubeChannelId);
            discoveredCount++;
          }
          await write(db);
        }
      } catch (e) {
        errors.push(`découverte automatique : ${e.message}`);
      }

      return { added: [...new Set(added)], errors, discoveredCount, niche: nicheName };
    }

    async function addBulk(nicheName, channelIds) {
      const db0 = await read();
      const apiKey = requireApiKey(db0);
      const resolvedList = await client.getChannels(apiKey, channelIds);

      const db = await read();
      const niche = getOrCreateNiche(db, nicheName);
      const added = [];
      for (const resolved of resolvedList) {
        const channel = upsertChannel(db, resolved, niche.id);
        added.push(channel.youtubeChannelId);
      }
      await write(db);
      return { added, niche: niche.name };
    }

    // ---------------- statut ----------------

    async function getStatus() {
      const db = await read();
      return {
        trackedChannels: db.channels.length,
        trackedNiches: db.niches.length,
        lastRefreshStartedAt: db.refreshState.lastStartedAt,
        lastRefreshFinishedAt: db.refreshState.lastFinishedAt,
        refreshIntervalHours: db.settings.refreshIntervalHours,
        youtubeApiKeyConfigured: !!db.settings.youtubeApiKey,
        refreshInProgress: db.refreshState.inProgress,
      };
    }

    // ---------------- réglages ----------------

    async function getSettings() {
      const db = await read();
      return db.settings;
    }

    async function updateSettings(patch) {
      const db = await read();
      Object.assign(db.settings, patch);
      await write(db);
      return db.settings;
    }

    // ---------------- cycle de rafraîchissement ----------------

    async function refreshOneChannel(db, apiKey, channel) {
      if (!channel.uploadsPlaylistId) {
        channel.lastError = "Pas de playlist de mises en ligne pour cette chaîne";
        return;
      }

      const videoIds = await client.getPlaylistVideoIds(apiKey, channel.uploadsPlaylistId, db.settings.maxVideosPerChannel);
      if (!videoIds.length) {
        channel.lastError = null;
        channel.lastRefreshedAt = nowIso();
        return;
      }

      let videosData = await client.getVideos(apiKey, videoIds);
      videosData = OutlierEngine.computeOutliers(videosData, {
        multiplier: db.settings.outlierMultiplier,
        minViewsFloor: db.settings.minViewsFloor,
        minHistory: db.settings.minHistoryVideos,
      });

      const now = nowIso();
      const existingByYtId = Object.fromEntries(
        db.videos.filter((v) => v.channelId === channel.id).map((v) => [v.youtubeVideoId, v])
      );

      for (const data of videosData) {
        let video = existingByYtId[data.youtubeVideoId];
        const wasOutlier = video ? video.isOutlier : false;
        if (!video) {
          video = { id: db.seq.videos++, youtubeVideoId: data.youtubeVideoId, channelId: channel.id };
          db.videos.push(video);
        }
        Object.assign(video, {
          title: data.title,
          thumbnailUrl: data.thumbnailUrl,
          publishedAt: data.publishedAt,
          viewCount: data.viewCount,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          durationSeconds: data.durationSeconds,
          isShort: data.durationSeconds != null && data.durationSeconds <= SHORT_MAX_SECONDS,
          baselineViews: data.baselineViews,
          outlierScore: data.outlierScore,
          isOutlier: data.isOutlier,
          lastCheckedAt: now,
        });
        if (video.isOutlier && !wasOutlier) video.firstDetectedOutlierAt = now;
        if (!video.isOutlier) video.firstDetectedOutlierAt = null;

        db.snapshots.push({ youtubeVideoId: data.youtubeVideoId, viewCount: data.viewCount, capturedAt: now });
      }

      channel.lastRefreshedAt = now;
      channel.lastError = null;
    }

    async function refreshAllChannels() {
      let db = await read();
      if (db.refreshState.inProgress) return;

      db.refreshState.inProgress = true;
      db.refreshState.lastStartedAt = nowIso();
      await write(db);

      try {
        db = await read();
        const apiKey = db.settings.youtubeApiKey;
        if (!apiKey || !db.channels.length) return;

        // Rafraîchit les métadonnées de toutes les chaînes en un minimum
        // d'appels, pour ne jamais laisser un nombre d'abonnés figé.
        try {
          const resolvedList = await client.getChannels(apiKey, db.channels.map((c) => c.youtubeChannelId));
          const byId = Object.fromEntries(resolvedList.map((r) => [r.youtubeChannelId, r]));
          for (const c of db.channels) {
            const r = byId[c.youtubeChannelId];
            if (!r) {
              c.lastError = "Chaîne introuvable sur YouTube (a-t-elle été supprimée ?)";
              continue;
            }
            Object.assign(c, {
              title: r.title,
              handle: r.handle,
              thumbnailUrl: r.thumbnailUrl,
              subscriberCount: r.subscriberCount,
              uploadsPlaylistId: r.uploadsPlaylistId,
            });
          }
          await write(db);
        } catch (e) {
          // on continue quand même avec les vidéos des chaînes déjà connues
        }

        for (const channel of db.channels) {
          try {
            db = await read();
            const freshChannel = db.channels.find((c) => c.id === channel.id);
            if (!freshChannel) continue;
            await refreshOneChannel(db, apiKey, freshChannel);
            await write(db);
          } catch (e) {
            db = await read();
            const freshChannel = db.channels.find((c) => c.id === channel.id);
            if (freshChannel) freshChannel.lastError = e.message;
            await write(db);
          }
        }

        // Conformité "pas de donnée non authentifiée conservée sans
        // rafraîchissement" : purge de l'historique de vues au-delà de 30 jours.
        db = await read();
        const cutoff = Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 3600 * 1000;
        db.snapshots = db.snapshots.filter((s) => new Date(s.capturedAt).getTime() >= cutoff);
        await write(db);
      } finally {
        db = await read();
        db.refreshState.inProgress = false;
        db.refreshState.lastFinishedAt = nowIso();
        await write(db);
      }
    }

    return {
      listNiches, createNiche, deleteNiche,
      listChannels, addChannel, deleteChannel, previewChannel, createFlow,
      listOutliers,
      listFavorites, addFavorite, removeFavorite, updateFavorite, checkFavorites,
      discoverSimilar, discoverByQuery, addBulk,
      getStatus, getSettings, updateSettings,
      refreshAllChannels,
      _read: read, _write: write,
    };
  }

  const Store = { makeStore, emptyDb, SNAPSHOT_RETENTION_DAYS };
  if (typeof module !== "undefined" && module.exports) module.exports = Store;
  else root.Store = Store;
})(typeof self !== "undefined" ? self : this);
