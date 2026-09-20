# Outlier Finder — Bot de détection d'outliers YouTube

Détecte automatiquement les vidéos YouTube qui **surperforment** par rapport
aux habitudes de leur propre chaîne (les "outliers"), triées par niche
(Divertissement, Gaming, GTA, Fortnite, Cinéma, Mac, ou toute niche que tu
crées). Le tout consultable depuis une **extension Chrome**.

> 👉 Pressé de t'en servir ? Va droit au [**tuto d'utilisation pas à pas**](./TUTORIAL.md)
> (installation → premiers outliers → usage quotidien, ~15 min). Ce README-ci
> est la référence technique.

**© 2026 Loan — Tous droits réservés.** Projet non affilié, non sponsorisé
et non approuvé par YouTube ou Google LLC. Utilise exclusivement l'API
officielle YouTube Data v3 avec ta propre clé API. Voir [`LICENSE`](./LICENSE),
[`LEGAL.md`](./LEGAL.md) (conformité API YouTube) et [`PRIVACY.md`](./PRIVACY.md)
(données collectées).

## Comment ça marche

```
┌─────────────────────┐        toutes les 2h        ┌──────────────────┐
│   YouTube Data API   │◄─────────────────────────────│  Backend Python   │
│  (chaînes, vidéos)    │────────────────────────────► │  FastAPI + SQLite │
└─────────────────────┘        stats des vidéos       └─────────┬────────┘
                                                                  │ API REST
                                                                  ▼
                                                        ┌──────────────────┐
                                                        │ Extension Chrome  │
                                                        │ (popup + options)  │
                                                        └──────────────────┘
```

- **Le backend** (`backend/`) tourne en continu. Toutes les `REFRESH_INTERVAL_HOURS`
  (2h par défaut), il repasse sur chaque chaîne suivie, récupère ses vidéos
  récentes et calcule pour chacune un **score d'outlier** :
  `score = vues de la vidéo / médiane des vues des autres vidéos récentes de la chaîne`.
  Une vidéo est marquée outlier si `score >= OUTLIER_MULTIPLIER` (x3 par défaut)
  et si elle dépasse un plancher de vues absolu (`MIN_VIEWS_FLOOR`, pour ignorer
  le bruit sur les micro-chaînes).
- **L'extension Chrome** (`extension/`) parle à ce backend en local : elle
  affiche les outliers par niche, permet d'ajouter des chaînes (par URL, @handle
  ou nom), de créer des niches, et de **découvrir** des chaînes similaires à une
  chaîne donnée ou par mot-clé de niche.
- Un badge + une notification Chrome préviennent quand un **nouvel outlier**
  vient d'être détecté.
- En te baladant sur YouTube, un **petit cœur ♡** apparaît sur chaque miniature
  (et sur la page de lecture) : un clic l'ajoute à l'onglet **"Liste d'outliers"** de
  l'extension, sauvegardé en base côté backend (persistant, pas juste dans le
  navigateur).

## 1. Lancer le backend

Prérequis : Python 3.11+.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows : venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
```

Ouvre `backend/.env` et renseigne `YOUTUBE_API_KEY` (voir section suivante).
Tu peux aussi ajuster `OUTLIER_MULTIPLIER`, `MIN_VIEWS_FLOOR`,
`REFRESH_INTERVAL_HOURS`, etc.

```bash
uvicorn app.main:app --reload
```

Le serveur tourne sur `http://127.0.0.1:8000`. Au démarrage, il crée
automatiquement 6 niches par défaut : *Divertissement, Gaming, GTA, Fortnite,
Cinéma, Mac*. Documentation interactive de l'API : `http://127.0.0.1:8000/docs`.

### Obtenir une clé YouTube Data API v3 (gratuite)

1. Va sur [console.cloud.google.com](https://console.cloud.google.com/), crée
   un projet (ou réutilise un existant).
2. Dans "API et services" → "Bibliothèque", active **YouTube Data API v3**.
3. Dans "API et services" → "Identifiants", crée une **clé API**.
4. Colle-la dans `backend/.env` (`YOUTUBE_API_KEY=...`).

Le quota gratuit est de 10 000 unités/jour. Le rafraîchissement automatique
n'utilise que des appels à 1 unité (très large marge même avec des centaines
de chaînes suivies). Seules les fonctions de **découverte** de chaînes
(recherche par mot-clé ou par chaîne similaire) coûtent 100 unités/appel —
utilise-les ponctuellement, pas en boucle.

## 2. Installer l'extension dans Chrome

### Option A — Mode développeur (le plus rapide, pour un usage perso)

C'est la méthode normale pour une extension "maison" non publiée — gratuite,
immédiate, et c'est ce que font la plupart des devs pour leurs propres outils.

1. Ouvre `chrome://extensions`.
2. Active le **mode développeur** (interrupteur en haut à droite).
3. Clique **"Charger l'extension non empaquetée"** et sélectionne le dossier
   `extension/`.
4. L'icône Outlier Finder apparaît dans la barre d'extensions (épingle-la avec
   le 📌 pour la garder visible).
5. Clique dessus → l'engrenage ⚙ (ou clic droit sur l'icône → Options) pour
   ouvrir la page de réglages.
6. Vérifie l'URL du backend (`http://127.0.0.1:8000` par défaut) et clique
   "Enregistrer" — le badge doit passer sur "connecté ✓".

> ⚠️ En mode développeur, Chrome désactive parfois l'extension après un
> redémarrage du navigateur ("mode développeur activé" en bandeau) — c'est
> normal et sans danger, il suffit de la réactiver sur `chrome://extensions`.

L'extension est configurée pour parler à `localhost`/`127.0.0.1` : elle ne
fonctionne que **sur la machine où tourne le backend**. Si tu déploies le
backend ailleurs (serveur distant, Docker sur un autre host), ajoute son
origine dans `host_permissions` de `extension/manifest.json` et dans
`CORS_ORIGINS` de `backend/.env`, puis recharge l'extension.

### Option B — Publier sur le Chrome Web Store (pour la partager avec d'autres)

Si tu veux que d'autres personnes l'installent en un clic (sans "mode
développeur"), il faut la publier sur le Web Store :

1. Crée un compte développeur sur le
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (frais unique de 5 $).
2. Zippe le contenu du dossier `extension/` (le zip doit contenir `manifest.json`
   à sa racine, pas un sous-dossier).
3. Dans le Dashboard, "Nouvel article" → upload le zip.
4. Renseigne la fiche (description, catégorie, captures d'écran, **politique de
   confidentialité** — obligatoire car l'extension fait des requêtes réseau
   vers ton backend).
5. Soumets pour revue (Google met généralement quelques jours).

**Point important avant de publier publiquement** : par défaut, l'extension
parle à un backend `localhost` — donc seul toi (qui fais tourner le backend en
local) peux réellement l'utiliser, même si quelqu'un d'autre l'installe. Pour
que d'autres personnes en profitent sans rien installer côté serveur, il faut
d'abord **déployer le backend sur un serveur accessible publiquement** (le
`Dockerfile` fourni dans `backend/` est un bon point de départ — Railway,
Fly.io, un VPS...), puis mettre son URL en dur (ou par défaut) dans
`extension/api.js` et l'ajouter à `host_permissions`.

## 3. Utiliser le bot

Dans la page **Réglages** de l'extension :

- **Niches** : crée tes catégories (les 6 par défaut existent déjà côté serveur).
- **Ajouter une chaîne** : colle une URL YouTube (`/@handle`, `/channel/UC...`,
  `/c/...`) ou un nom, choisis la niche, "Ajouter".
- **Découvrir des chaînes similaires** : donne une chaîne "modèle" — l'outil
  cherche des chaînes au vocabulaire proche (titre/description), tu coches
  celles à suivre puis "Ajouter la sélection".
- **Découvrir par niche/mot-clé** : tape un mot-clé ("gaming fr", "GTA RP",
  "cinéma critique"...), coche les chaînes pertinentes, ajoute-les en masse.

Dans le **popup** (clic sur l'icône) :

- Filtre par niche et par seuil de score (x2, x3, x5, x10...).
- Chaque carte = une vidéo outlier, avec son multiplicateur (`x4.2`), ses vues,
  sa niche, et un badge **NOUVEAU** si elle vient d'être détectée.
- Bouton **↻** pour forcer un rafraîchissement immédiat (sinon automatique
  toutes les 2h).
- Un badge rouge sur l'icône + une notification système apparaissent quand
  l'extension détecte de nouveaux outliers (vérification toutes les 15 min).

## 4. Marquer tes propres outliers en un clic (le cœur ❤️)

En plus de la détection automatique, tu peux repérer un outlier "à l'œil" en
te baladant sur YouTube :

- **Sur les miniatures** (accueil, recherche, suggestions...) : survole une
  vidéo, un petit ♡ apparaît en haut à droite de la miniature. Clique dessus
  pour l'ajouter à ta liste (il devient ♥ violet).
- **Sur la page de lecture** : un cœur flottant en bas à droite de l'écran
  fait la même chose pour la vidéo en cours.
- **Via le menu ⋮** d'une vidéo (celui avec "Regarder plus tard", "Enregistrer
  dans une playlist"...) : une option "Ajouter à la liste d'outliers" apparaît
  au même endroit que les actions natives de YouTube. *(Expérimental — le menu
  de YouTube est une des parties les plus mouvantes de son DOM.)*
- Tout est enregistré côté **backend** (pas juste dans le navigateur) : ouvre
  l'onglet **"⭐ Ma liste"** du popup pour retrouver tous tes coups de cœur,
  les classer par niche (menu déroulant sur chaque carte), ou les retirer.

Comme c'est stocké en base sur le backend, ta liste survit à un changement
d'ordinateur, une réinstallation de l'extension, un nettoyage du cache
Chrome, etc. — tant que tu pointes vers la même base de données.

**Bonus — épingler des chaînes en haut de tes abonnements** : dans le menu
latéral de YouTube, une étoile apparaît au survol de chaque chaîne abonnée ;
cliquer dessus la fait remonter en haut de la liste. C'est une préférence
locale à ton navigateur (`chrome.storage.local`), indépendante du backend.

> YouTube change régulièrement la structure de ses pages ; si le cœur ou le
> menu ⋮ n'apparaissent plus après une mise à jour de YouTube, les sélecteurs
> dans `extension/content.js` (fonctions `scanCards`, `captureMenuContext`)
> et `extension/subscriptions.js` sont l'endroit à ajuster.

## Détails techniques

### Backend (`backend/`)

- `app/models.py` — tables `Niche`, `Channel`, `Video`, `VideoSnapshot` (SQLite via SQLAlchemy).
- `app/youtube_client.py` — wrapper HTTP async pour l'API YouTube Data v3
  (résolution de chaîne quel que soit le format d'entrée, récupération batched
  des vidéos, recherche de chaînes).
- `app/outliers.py` — calcul du score outlier (médiane robuste).
- `app/refresh.py` — cycle de rafraîchissement par chaîne, détection des
  transitions "devient outlier" pour marquer les nouveautés.
- `app/discovery.py` — extraction de mots-clés + recherche de chaînes similaires.
- `app/scheduler.py` — APScheduler, job toutes les `REFRESH_INTERVAL_HOURS`
  (premier passage immédiat au démarrage).
- `app/routers/` — endpoints REST (`/niches`, `/channels`, `/outliers`,
  `/discover/*`, `/favorites/*`, `/refresh/run`, `/status`).

### Extension (`extension/`)

- `manifest.json` — Manifest V3, permissions minimales (`storage`, `alarms`,
  `notifications`) + `content_scripts` sur `youtube.com`.
- `theme.css` — design system partagé (couleurs, boutons pill, cartes) entre
  popup et réglages.
- `api.js` — client fetch partagé vers le backend.
- `popup.html/js/css` — onglets "Outliers" et "⭐ Ma liste", filtres, refresh manuel.
- `options.html/js/css` — flux d'onboarding simplifié (chaîne + niche décrite
  en texte libre + chaînes similaires) en avant, réglages techniques
  (URL backend, découverte avancée, niches) repliés dans un `<details>`.
- `background.js` — service worker : poll toutes les 15 min pour les
  notifications de nouveaux outliers, et relais réseau (`fetch`) pour les
  content scripts (qui ne font jamais d'appel réseau direct, pour rester
  simples vis-à-vis de la CSP des pages YouTube).
- `content.js` / `content.css` — injectés sur `youtube.com` : cœur sur chaque
  miniature (ancienne et nouvelle structure `yt-lockup-view-model`) + cœur
  flottant sur la page de lecture + item "Ajouter à la liste d'outliers"
  injecté dans le menu ⋮ natif ; communication avec `background.js` via
  `chrome.runtime.sendMessage`.
- `subscriptions.js` / `subscriptions.css` — étoile pour épingler des chaînes
  en haut du menu latéral d'abonnements (préférence locale, `chrome.storage.local`,
  aucun lien avec le backend).

### Aller plus loin (pistes non implémentées)

- Détection par **vélocité** (vitesse de croissance des vues) grâce aux
  `VideoSnapshot` déjà enregistrés à chaque cycle — actuellement stockés mais
  pas encore exploités dans le score.
- Comparaison **inter-chaînes** au sein d'une niche (pas seulement outlier par
  rapport à sa propre chaîne).
- Déploiement du backend sur un serveur distant pour un accès multi-utilisateurs
  (le `Dockerfile` fourni dans `backend/` est un bon point de départ).
