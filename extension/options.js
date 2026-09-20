let nichesCache = [];
let backendReachable = false;

function setFeedback(el, message, ok) {
  el.textContent = message;
  el.className = "feedback " + (ok ? "ok" : "err");
}

async function initBackendUrl() {
  const url = await getBackendUrl();
  document.getElementById("backendUrl").value = url;
  await pingBackend();
  startBackendWatcher();
}

// Bandeau impossible à manquer + bouton désactivé quand le serveur ne
// répond pas, avec un check automatique en arrière-plan : dès que le
// serveur démarre, tout se débloque tout seul, pas besoin de recharger.
function setBackendReachable(reachable) {
  const wasReachable = backendReachable;
  backendReachable = reachable;
  document.getElementById("offlineBanner").classList.toggle("hidden", reachable);
  document.getElementById("createFlowBtn").disabled = !reachable;
  if (reachable && !wasReachable) {
    refreshAll();
  }
}

let watcherInterval = null;
function startBackendWatcher() {
  clearInterval(watcherInterval);
  watcherInterval = setInterval(async () => {
    try {
      await api.getStatus();
      setBackendReachable(true);
    } catch (e) {
      setBackendReachable(false);
    }
  }, 4000);
}

async function pingBackend() {
  const pill = document.getElementById("backendStatus");
  pill.textContent = "…";
  pill.className = "pill-status";
  try {
    const s = await api.getStatus();
    pill.textContent = s.youtube_api_key_configured ? "connecté ✓" : "clé API manquante";
    pill.className = "pill-status " + (s.youtube_api_key_configured ? "ok" : "err");
    setBackendReachable(true);
  } catch (e) {
    pill.textContent = "injoignable";
    pill.className = "pill-status err";
    setBackendReachable(false);
  }
}

document.getElementById("saveBackend").addEventListener("click", async () => {
  await setBackendUrl(document.getElementById("backendUrl").value.trim());
  await pingBackend();
  await refreshAll();
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
    return; // le bandeau "serveur éteint" affiche déjà le problème
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

// --- Flux simplifié : chaîne + niche décrite en texte libre + chaînes similaires ---

document.getElementById("createFlowBtn").addEventListener("click", async () => {
  const channelInput = document.getElementById("ownChannelInput");
  const nicheInput = document.getElementById("nicheDescInput");
  const linksInput = document.getElementById("similarLinksInput");
  const feedback = document.getElementById("createFeedback");
  const btn = document.getElementById("createFlowBtn");

  const channel = channelInput.value.trim();
  const niche = nicheInput.value.trim();

  if (!channel) return setFeedback(feedback, "Colle le lien de ta chaîne YouTube pour commencer.", false);
  if (!niche) return setFeedback(feedback, "Décris ta niche en quelques mots.", false);

  const similarLinks = linksInput.value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  btn.disabled = true;
  btn.textContent = "Création en cours…";
  setFeedback(feedback, "", true);

  const errors = [];
  let added = 0;

  try {
    await api.addChannel(channel, niche);
    added++;
  } catch (e) {
    errors.push(`ta chaîne : ${e.message}`);
  }

  for (const link of similarLinks) {
    try {
      await api.addChannel(link, niche);
      added++;
    } catch (e) {
      errors.push(`${link} : ${e.message}`);
    }
  }

  if (added > 0) {
    setFeedback(
      feedback,
      `✓ ${added} chaîne(s) ajoutée(s) à "${niche}".${errors.length ? ` (${errors.length} lien(s) en échec)` : ""}`,
      true
    );
    channelInput.value = "";
    linksInput.value = "";
  } else {
    setFeedback(feedback, `Rien n'a pu être ajouté : ${errors[0] || "vérifie le lien de ta chaîne."}`, false);
  }

  btn.disabled = false;
  btn.textContent = "🚀 Créer mon flux d'outliers";
  await loadNiches();
  await loadChannels();
});

async function refreshAll() {
  await loadNiches();
  await loadChannels();
}

(async function init() {
  await initBackendUrl();
})();
