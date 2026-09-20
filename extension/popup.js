const listEl = document.getElementById("list");
const statusBar = document.getElementById("statusBar");
const nicheSelect = document.getElementById("nicheSelect");
const minScoreSelect = document.getElementById("minScoreSelect");
const refreshBtn = document.getElementById("refreshBtn");
const settingsBtn = document.getElementById("settingsBtn");

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
settingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

async function loadStatus() {
  try {
    const s = await api.getStatus();
    if (!s.youtube_api_key_configured) {
      statusBar.textContent = "⚠️ Clé YOUTUBE_API_KEY manquante côté serveur (voir Réglages)";
      return;
    }
    const parts = [`${s.tracked_channels} chaînes suivies`, `${s.tracked_niches} niches`];
    if (s.refresh_in_progress) {
      parts.push("rafraîchissement en cours…");
    } else if (s.last_refresh_finished_at) {
      const d = new Date(s.last_refresh_finished_at + "Z");
      parts.push(`maj ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
    }
    statusBar.textContent = parts.join(" · ");
  } catch (e) {
    statusBar.textContent = "Backend injoignable — vérifie l'URL dans les réglages";
  }
}

async function loadNiches() {
  try {
    const niches = await api.getNiches();
    const { lastNiche } = await chrome.storage.local.get("lastNiche");
    nicheSelect.innerHTML = '<option value="">Toutes les niches</option>';
    for (const n of niches) {
      const opt = document.createElement("option");
      opt.value = n.name;
      opt.textContent = `${n.name} (${n.channel_count})`;
      nicheSelect.appendChild(opt);
    }
    if (lastNiche) nicheSelect.value = lastNiche;
  } catch (e) {
    // le backend n'est peut-être pas encore lancé
  }
}

async function loadOutliers() {
  listEl.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const params = {};
    if (nicheSelect.value) params.niche = nicheSelect.value;
    if (minScoreSelect.value) params.min_score = minScoreSelect.value;

    const outliers = await api.getOutliers(params);
    if (!outliers.length) {
      listEl.innerHTML = '<p class="empty">Aucun outlier détecté pour l\'instant.<br>Ajoute des chaînes dans les réglages, puis attends le prochain rafraîchissement.</p>';
      return;
    }
    listEl.innerHTML = "";
    for (const o of outliers) {
      const a = document.createElement("a");
      a.className = "card";
      a.href = `https://www.youtube.com/watch?v=${o.video.youtube_video_id}`;
      a.target = "_blank";

      const img = document.createElement("img");
      img.src = o.video.thumbnail_url || "";
      img.loading = "lazy";

      const body = document.createElement("div");
      body.className = "card-body";

      const title = document.createElement("p");
      title.className = "card-title";
      title.textContent = o.video.title || "(sans titre)";

      const meta = document.createElement("div");
      meta.className = "card-meta";
      meta.innerHTML = `
        <span class="score">x${o.video.outlier_score.toFixed(1)}</span>
        <span>${formatViews(o.video.view_count)} vues</span>
        <span class="niche-tag">${o.niche}</span>
        ${o.is_new ? '<span class="badge-new">NOUVEAU</span>' : ""}
      `;

      const channelLine = document.createElement("div");
      channelLine.className = "card-meta";
      channelLine.textContent = `${o.channel_title || "?"} · ${formatDate(o.video.published_at)}`;

      body.appendChild(title);
      body.appendChild(channelLine);
      body.appendChild(meta);
      a.appendChild(img);
      a.appendChild(body);
      listEl.appendChild(a);
    }
  } catch (e) {
    listEl.innerHTML = `<p class="empty">Impossible de charger les outliers.<br>${e.message}</p>`;
  }
}

nicheSelect.addEventListener("change", () => {
  chrome.storage.local.set({ lastNiche: nicheSelect.value });
  loadOutliers();
});
minScoreSelect.addEventListener("change", loadOutliers);

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "…";
  try {
    await api.runRefresh();
    statusBar.textContent = "Rafraîchissement lancé, ça peut prendre quelques dizaines de secondes…";
    setTimeout(() => {
      loadStatus();
      loadOutliers();
    }, 8000);
  } catch (e) {
    statusBar.textContent = `Erreur: ${e.message}`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "↻";
  }
});

(async function init() {
  await loadNiches();
  await loadStatus();
  await loadOutliers();
})();
