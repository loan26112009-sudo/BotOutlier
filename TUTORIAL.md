# Tuto — Utiliser Outlier Finder de A à Z

Ce guide t'emmène du zéro absolu jusqu'à ton premier outlier détecté, puis à
l'usage quotidien du bot. Pour la doc technique détaillée (architecture,
fichiers, config avancée), voir le [`README.md`](./README.md).

**Temps total la première fois : ~15 minutes**, dont 10 min d'attente pour la
clé API Google. Après ça, c'est piloté au clic.

---

## Étape 0 — Comprendre le principe en 30 secondes

- Un **serveur** (le backend) tourne en tâche de fond sur ton ordi et va
  chercher les stats des chaînes YouTube que tu lui donnes, toutes les 2h.
- Il compare chaque nouvelle vidéo aux habitudes de sa propre chaîne. Si elle
  explose (x3 la médiane par défaut), c'est un **outlier**.
- Une **extension Chrome** te sert de fenêtre sur ce serveur : tu y ajoutes
  des chaînes/niches, tu y consultes les outliers, et un petit **cœur ❤️**
  apparaît directement sur YouTube pour que tu marques toi-même les pépites
  que tu repères en scrollant.

Tant que le serveur ne tourne pas, l'extension n'a rien à afficher — retiens
juste ça, c'est la cause n°1 de "ça marche pas".

---

## Étape 1 — Lancer le serveur (une fois, puis à chaque session de travail)

Ouvre un terminal :

```bash
cd backend
python3 -m venv venv                # une seule fois
source venv/bin/activate            # Windows : venv\Scripts\activate
pip install -r requirements.txt     # une seule fois
cp .env.example .env                # une seule fois
```

**Récupère ta clé YouTube Data API v3** (gratuite, ~5 min) :

1. [console.cloud.google.com](https://console.cloud.google.com/) → crée un projet.
2. "API et services" → "Bibliothèque" → active **YouTube Data API v3**.
3. "API et services" → "Identifiants" → "Créer des identifiants" → **Clé API**.
4. Copie-la dans `backend/.env`, ligne `YOUTUBE_API_KEY=...`.

Puis à chaque fois que tu veux utiliser le bot :

```bash
source venv/bin/activate            # si pas déjà fait
uvicorn app.main:app --reload
```

✅ **Tu dois voir** `Application startup complete` et `Uvicorn running on
http://127.0.0.1:8000`. Laisse ce terminal ouvert — c'est le cœur qui bat.

> Tant que ce terminal tourne, le serveur récupère les données toutes les 2h
> automatiquement. Tu peux le couper (`Ctrl+C`) et le relancer plus tard, rien
> n'est perdu (tout est sauvegardé dans `backend/outliers.db`).

---

## Étape 2 — Charger l'extension dans Chrome (une fois)

1. `chrome://extensions` dans la barre d'adresse.
2. Active **le mode développeur** (interrupteur en haut à droite).
3. **"Charger l'extension non empaquetée"** → sélectionne le dossier
   `extension/` du projet.
4. Épingle-la (icône 📌) pour la garder visible dans la barre d'outils.

✅ **Tu dois voir** l'icône Outlier Finder apparaître. Clique dessus : si le
bandeau du haut dit "connecté ✓", le lien avec le serveur fonctionne.

---

## Étape 3 — Créer tes niches et ajouter tes premières chaînes

Clique sur l'icône → l'engrenage ⚙ (ou clic droit sur l'icône → Options).

1. **Niches** : les 6 par défaut existent déjà (Divertissement, Gaming, GTA,
   Fortnite, Cinéma, Mac). Ajoute les tiennes si besoin (champ + bouton "Créer").
2. **Ajouter une chaîne** : colle une URL YouTube (`youtube.com/@nomdelachaine`,
   `/channel/UC...`, `/c/...`) ou tape juste son nom, choisis la niche,
   "Ajouter".
3. Répète pour 5-10 chaînes par niche — plus tu en mets, plus le bot a de la
   matière pour repérer les écarts.

**Tu ne connais pas assez de chaînes dans une niche ?** Utilise la
**découverte** :

- *Chaînes similaires* : colle l'URL d'une chaîne que tu aimes → le bot
  propose des chaînes au vocabulaire proche → coche celles qui t'intéressent
  → "Ajouter la sélection".
- *Par mot-clé* : tape "gaming fr", "GTA RP", "cinéma critique"... → même
  principe, tu coches et tu ajoutes en masse.

✅ **Tu dois voir** tes chaînes apparaître dans la liste "Chaînes suivies" en
bas de la section 3, avec leur miniature.

---

## Étape 4 — Attendre (ou forcer) le premier passage

Le bot analyse automatiquement toutes les chaînes suivies **immédiatement au
démarrage du serveur**, puis toutes les 2h. Pour ne pas attendre :

1. Ouvre le **popup** (clic sur l'icône).
2. Clique sur **↻** en haut à droite.
3. Patiente ~10-30 secondes (le temps dépend du nombre de chaînes).

✅ **Tu dois voir** la barre de statut passer à un nombre de chaînes/niches
suivies, puis la liste se remplir avec des cartes vidéo si des outliers sont
trouvés. Si la liste reste vide, c'est probablement normal : pas de vidéo ne
dépasse encore x3 la médiane de sa chaîne (baisse le seuil dans le menu
déroulant "Seuil" pour voir plus large, ex. x2).

---

## Étape 5 — Lire et filtrer les outliers (usage quotidien)

Dans le popup, onglet **"Outliers auto"** :

- **Filtre par niche** (menu déroulant du haut) pour te concentrer sur
  "Gaming" ou "Cinéma" par exemple.
- **Filtre par seuil** : x2 (large), x3 (par défaut), x5, x10 (les vraies
  bombes).
- Chaque carte montre : miniature, titre, chaîne, **multiplicateur** (`x4.2`),
  nombre de vues, niche, et un badge **NOUVEAU** si détecté dans les 3
  dernières heures.
- Clique sur une carte → ouvre la vidéo sur YouTube dans un nouvel onglet.

Le badge rouge sur l'icône de l'extension + une notification système
t'avertissent automatiquement dès qu'un nouvel outlier tombe (vérification
toutes les 15 min), même popup fermé.

---

## Étape 6 — Marquer tes propres outliers avec le cœur (au fil de ton scroll)

Pas besoin d'ouvrir l'extension pour ça : va sur YouTube normalement.

- **Sur une miniature** (accueil, recherche, suggestions) : survole-la, un
  **♡** apparaît en haut à droite → clique → il devient **♥** rouge.
- **Sur une vidéo que tu regardes** : un cœur flottant en bas à droite de
  l'écran fait la même chose.

✅ **Tu dois voir** le cœur changer de couleur instantanément. Ça part tout
seul vers le serveur, pas besoin de rien valider ailleurs.

---

## Étape 7 — Retrouver et classer tes coups de cœur

Retourne dans le popup → onglet **"❤️ Mes picks"**.

- Tous tes cœurs cliqués s'y retrouvent, du plus récent au plus ancien.
- **Classe-les par niche** avec le menu déroulant de chaque carte (pratique
  pour trier après coup un pick fait "à chaud").
- **✕** pour en retirer un si tu t'es trompé de bouton.
- Filtre par niche en haut de l'onglet pour ne voir qu'une catégorie.

Cette liste vit dans la base du serveur, donc elle **survit** à un
redémarrage du navigateur, un nettoyage de cache, ou une réinstallation de
l'extension.

---

## Routine recommandée

1. Le matin (ou avant une session de veille) : lance le serveur
   (`uvicorn app.main:app --reload`) si ce n'est pas déjà fait.
2. Ouvre le popup, onglet "Outliers auto", filtre par niche du jour → repère
   ce qui a explosé pendant la nuit.
3. En scrollant YouTube dans la journée, cœur ♡ sur tout ce qui te semble
   sortir du lot — même si le bot ne l'a pas encore détecté (il ne voit que
   les chaînes que tu lui as données).
4. En fin de semaine, onglet "Mes picks" → range tes trouvailles par niche →
   ça devient ta banque d'inspiration pour tes propres formats.

---

## Dépannage express

| Symptôme | Cause probable | Solution |
|---|---|---|
| "Backend injoignable" dans le popup | Le serveur n'est pas lancé | Relance `uvicorn app.main:app --reload` |
| "⚠️ Clé YOUTUBE_API_KEY manquante" | `.env` pas rempli | Renseigne `YOUTUBE_API_KEY` dans `backend/.env`, relance le serveur |
| Liste d'outliers vide | Pas assez de vidéos par chaîne, ou seuil trop haut | Baisse le seuil (x2), attends le prochain cycle, ajoute plus de chaînes |
| Le cœur n'apparaît pas sur YouTube | Extension pas rechargée après mise à jour, ou YouTube a changé son DOM | `chrome://extensions` → bouton ↻ sur l'extension ; si ça persiste, voir la note dans `README.md` sur `content.js` |
| Erreur "Quota YouTube API dépassé" | Trop d'appels de découverte (recherche par mot-clé/chaîne similaire) dans la journée | Attends le lendemain (quota remis à 0) ou limite les recherches de découverte |

---

Pour aller plus loin (architecture, variables d'environnement, déploiement
sur un serveur distant, publication sur le Chrome Web Store), tout est dans
le [`README.md`](./README.md).
