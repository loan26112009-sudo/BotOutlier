let nichesCache = [];
let apiKeyConfigured = false;

function setFeedback(el, message, ok) {
  el.textContent = message;
  el.className = "feedback " + (ok ? "ok" : "err");
}

// Seul vrai prérequis maintenant : une clé API YouTube (tout le reste tourne
// dans l'extension elle-même, plus de serveur à lancer). Bandeau visible tant
// qu'elle n'est pas configurée, bouton "Créer mon flux" désactivé pareil.
function setApiKeyState(configured) {
  apiKeyConfigured = configured;
  document.getElementById("apiKeyBanner").classList.toggle("hidden", configured);
  document.getElementById("createFlowBtn").disabled = !configured;
  document.getElementById("createFlowLock").classList.toggle("hidden", configured);
}

async function refreshApiKeyState() {
  const s = await api.getStatus();
  setApiKeyState(s.youtube_api_key_configured);
  return s;
}

async function initSettings() {
  const settings = await api.getSettings();
  document.getElementById("apiKeyInput").value = settings.youtube_api_key || "";
  document.getElementById("refreshHoursInput").value = settings.refresh_interval_hours || 2;
  document.getElementById("heartSearchModeToggle").checked = settings.heart_search_mode !== false;
  document.getElementById("heartViewerModeToggle").checked = settings.heart_viewer_mode !== false;
  await pingApiKey();
}

document.getElementById("heartSearchModeToggle").addEventListener("change", (e) => {
  api.updateSettings({ heart_search_mode: e.target.checked });
});
document.getElementById("heartViewerModeToggle").addEventListener("change", (e) => {
  api.updateSettings({ heart_viewer_mode: e.target.checked });
});

async function pingApiKey() {
  const pill = document.getElementById("apiKeyStatus");
  pill.textContent = "…";
  pill.className = "pill-status";
  const s = await refreshApiKeyState();
  pill.textContent = s.youtube_api_key_configured ? "configurée ✓" : "manquante";
  pill.className = "pill-status " + (s.youtube_api_key_configured ? "ok" : "err");
}

document.getElementById("saveApiKey").addEventListener("click", async () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  await api.updateSettings({ youtube_api_key: key });
  await pingApiKey();
  await refreshAll();
});

document.getElementById("saveRefreshHours").addEventListener("click", async () => {
  const hours = parseFloat(document.getElementById("refreshHoursInput").value) || 2;
  await api.updateSettings({ refresh_interval_hours: hours });
});

document.getElementById("openApiKeyField").addEventListener("click", () => {
  document.querySelector(".advanced").open = true;
  document.getElementById("apiKeyInput").focus();
});

async function loadNiches() {
  nichesCache = await api.getNiches();

  const chipList = document.getElementById("nicheList");
  chipList.innerHTML = "";
  for (const n of nichesCache) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${n.name} (${n.channel_count})</span>`;
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Supprimer la niche (et ses chaînes suivies)";
    del.addEventListener("click", async () => {
      if (!confirm(`Supprimer la niche "${n.name}" et toutes ses chaînes suivies ?`)) return;
      await api.deleteNiche(n.id);
      await refreshAll();
    });
    li.appendChild(del);
    chipList.appendChild(li);
  }

  for (const selectId of ["channelNiche", "filterNiche"]) {
    const select = document.getElementById(selectId);
    const current = select.value;
    const keepFirst = selectId === "filterNiche";
    select.innerHTML = keepFirst ? '<option value="">Toutes les niches</option>' : "";
    for (const n of nichesCache) {
      const opt = document.createElement("option");
      opt.value = n.name;
      opt.textContent = n.name;
      select.appendChild(opt);
    }
    if (current) select.value = current;
  }
}

document.getElementById("addNiche").addEventListener("click", async () => {
  const input = document.getElementById("newNiche");
  const name = input.value.trim();
  if (!name) return;
  await api.createNiche(name);
  input.value = "";
  await loadNiches();
});

async function loadChannels() {
  const niche = document.getElementById("filterNiche").value;
  let channels;
  try {
    channels = await api.getChannels(niche);
  } catch (e) {
    return; // pas de chaîne suivie ou clé API pas encore configurée
  }
  const ul = document.getElementById("channelList");
  ul.innerHTML = "";
  if (!channels.length) {
    ul.innerHTML = '<li class="empty-row">Aucune chaîne suivie pour l\'instant — utilise le flux ci-dessus pour commencer.</li>';
    return;
  }
  const nicheById = Object.fromEntries(nichesCache.map((n) => [n.id, n.name]));
  for (const c of channels) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = c.thumbnail_url || "";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = c.title || c.youtube_channel_id;
    const niche = document.createElement("span");
    niche.className = "niche";
    niche.textContent = nicheById[c.niche_id] || "";
    const del = document.createElement("button");
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      await api.deleteChannel(c.id);
      await loadChannels();
      await loadNiches();
    });
    li.appendChild(img);
    li.appendChild(title);
    li.appendChild(niche);
    if (c.last_error) {
      const err = document.createElement("span");
      err.className = "niche";
      err.style.color = "#fca5a5";
      err.title = c.last_error;
      err.textContent = "⚠";
      li.appendChild(err);
    }
    li.appendChild(del);
    ul.appendChild(li);
  }
}

document.getElementById("filterNiche").addEventListener("change", loadChannels);

document.getElementById("addChannel").addEventListener("click", async () => {
  const input = document.getElementById("channelInput");
  const niche = document.getElementById("channelNiche").value;
  const feedback = document.getElementById("channelAddResult");
  if (!input.value.trim()) return;
  if (!niche) {
    setFeedback(feedback, "Crée d'abord une niche.", false);
    return;
  }
  try {
    const channel = await api.addChannel(input.value.trim(), niche);
    setFeedback(feedback, `✓ "${channel.title || channel.youtube_channel_id}" ajoutée à ${niche}`, true);
    input.value = "";
    await loadChannels();
    await loadNiches();
  } catch (e) {
    setFeedback(feedback, e.message, false);
  }
});

function renderDiscoverResults(container, results, defaultNiche) {
  container.innerHTML = "";
  if (!results.length) {
    container.innerHTML = '<p class="hint">Aucun résultat.</p>';
    return;
  }

  const checkboxes = [];
  for (const r of results) {
    const row = document.createElement("div");
    row.className = "discover-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !r.already_tracked;
    cb.disabled = r.already_tracked;
    checkboxes.push({ cb, id: r.youtube_channel_id });

    const img = document.createElement("img");
    img.src = r.thumbnail_url || "";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = r.title || r.youtube_channel_id;

    const subs = document.createElement("span");
    subs.className = "subs";
    subs.textContent = r.already_tracked
      ? "déjà suivie"
      : r.subscriber_count
      ? `${r.subscriber_count.toLocaleString("fr-FR")} abonnés`
      : "";

    row.appendChild(cb);
    row.appendChild(img);
    row.appendChild(title);
    row.appendChild(subs);
    container.appendChild(row);
  }

  const footer = document.createElement("div");
  footer.className = "discover-footer";

  const nicheSelect = document.createElement("select");
  for (const n of nichesCache) {
    const opt = document.createElement("option");
    opt.value = n.name;
    opt.textContent = n.name;
    nicheSelect.appendChild(opt);
  }
  if (defaultNiche) nicheSelect.value = defaultNiche;

  const addBtn = document.createElement("button");
  addBtn.className = "ghost-btn";
  addBtn.textContent = "Ajouter la sélection";
  addBtn.addEventListener("click", async () => {
    const ids = checkboxes.filter((c) => c.cb.checked && !c.cb.disabled).map((c) => c.id);
    if (!ids.length || !nicheSelect.value) return;
    addBtn.disabled = true;
    try {
      await api.addBulk(nicheSelect.value, ids);
      await loadNiches();
      await loadChannels();
      container.innerHTML = `<p class="hint">✓ ${ids.length} chaîne(s) ajoutée(s) à ${nicheSelect.value}.</p>`;
    } finally {
      addBtn.disabled = false;
    }
  });

  footer.appendChild(nicheSelect);
  footer.appendChild(addBtn);
  container.appendChild(footer);
}

document.getElementById("findSimilar").addEventListener("click", async () => {
  const seed = document.getElementById("seedChannel").value.trim();
  const container = document.getElementById("similarResults");
  if (!seed) return;
  container.innerHTML = '<p class="hint">Recherche…</p>';
  try {
    const results = await api.discoverSimilar(seed);
    renderDiscoverResults(container, results);
  } catch (e) {
    container.innerHTML = `<p class="hint">${e.message}</p>`;
  }
});

document.getElementById("findByQuery").addEventListener("click", async () => {
  const query = document.getElementById("queryInput").value.trim();
  const container = document.getElementById("queryResults");
  if (!query) return;
  container.innerHTML = '<p class="hint">Recherche…</p>';
  try {
    const results = await api.discoverByQuery(query);
    renderDiscoverResults(container, results, query);
  } catch (e) {
    container.innerHTML = `<p class="hint">${e.message}</p>`;
  }
});

// --- Aperçu de la chaîne perso pendant la saisie (juste un nom suffit) ---
// Évite les ajouts hasardeux (taper "moi" ou un nom approximatif et se
// retrouver avec une chaîne au hasard) : on montre ce qui a été trouvé
// avant même de cliquer sur "Créer mon flux".

let previewTimeout = null;
document.getElementById("ownChannelInput").addEventListener("input", () => {
  clearTimeout(previewTimeout);
  const value = document.getElementById("ownChannelInput").value.trim();
  const preview = document.getElementById("ownChannelPreview");
  if (!value) {
    preview.className = "channel-preview hidden";
    return;
  }
  if (!apiKeyConfigured) return;
  previewTimeout = setTimeout(async () => {
    preview.className = "channel-preview";
    preview.textContent = "Recherche…";
    try {
      const result = await api.previewChannel(value);
      if (!result) {
        preview.className = "channel-preview err";
        preview.textContent = "❌ Chaîne introuvable — vérifie le nom";
        return;
      }
      preview.className = "channel-preview ok";
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.src = result.thumbnail_url || "";
      const text = document.createElement("span");
      text.textContent = `✓ ${result.title}${result.subscriber_count ? ` · ${result.subscriber_count.toLocaleString("fr-FR")} abonnés` : ""}`;
      preview.appendChild(img);
      preview.appendChild(text);
    } catch (e) {
      preview.className = "channel-preview err";
      preview.textContent = e.message;
    }
  }, 600);
});

// --- Flux simplifié : chaîne (optionnelle) + niche décrite en texte libre +
// chaînes similaires (optionnel) + découverte automatique par niche ---

document.getElementById("createFlowBtn").addEventListener("click", async () => {
  const channelInput = document.getElementById("ownChannelInput");
  const nicheInput = document.getElementById("nicheDescInput");
  const linksInput = document.getElementById("similarLinksInput");
  const feedback = document.getElementById("createFeedback");
  const btn = document.getElementById("createFlowBtn");

  const channel = channelInput.value.trim();
  const niche = nicheInput.value.trim();

  if (!niche) return setFeedback(feedback, "Décris ta niche en quelques mots pour commencer.", false);

  btn.disabled = true;
  btn.textContent = "Création en cours… (ça cherche aussi de nouvelles chaînes pour toi)";
  setFeedback(feedback, "", true);

  try {
    const result = await api.createFlow(channel, niche, linksInput.value);
    const total = result.added.length;
    if (total > 0) {
      const bits = [`✓ ${total} chaîne(s) dans "${niche}"`];
      if (result.discovered_count) bits.push(`dont ${result.discovered_count} trouvée(s) automatiquement`);
      if (result.errors.length) bits.push(`${result.errors.length} en échec`);
      setFeedback(feedback, bits.join(" — "), true);
      channelInput.value = "";
      linksInput.value = "";
      document.getElementById("ownChannelPreview").className = "channel-preview hidden";
    } else {
      setFeedback(feedback, `Rien n'a pu être ajouté : ${result.errors[0] || "essaie une niche plus courante."}`, false);
    }
  } catch (e) {
    setFeedback(feedback, e.message, false);
  }

  btn.disabled = !apiKeyConfigured;
  btn.textContent = "🚀 Créer mon flux d'outliers";
  await loadNiches();
  await loadChannels();
});

async function refreshAll() {
  await loadNiches();
  await loadChannels();
}

(async function init() {
  await initSettings();
  await refreshAll();
})();
