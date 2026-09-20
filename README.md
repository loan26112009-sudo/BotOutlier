# Outlier Finder — Bot de détection d'outliers YouTube

Détecte automatiquement les vidéos YouTube qui **surperforment** par rapport
aux habitudes de leur propre chaîne (les "outliers"), triées par niche
(Divertissement, Gaming, GTA, Fortnite, Cinéma, Mac, ou toute niche que tu
crées). Le tout consultable depuis une **extension Chrome**.

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

## 2. Installer l'extension Chrome

1. Ouvre `chrome://extensions`.
2. Active le **mode développeur** (en haut à droite).
3. Clique **"Charger l'extension non empaquetée"** et sélectionne le dossier
   `extension/`.
4. Clique sur l'icône de l'extension → l'engrenage ⚙ (ou clic droit → Options)
   pour ouvrir la page de réglages.
5. Vérifie l'URL du backend (`http://127.0.0.1:8000` par défaut) et clique
   "Enregistrer" — le badge doit passer sur "connecté ✓".

> L'extension est configurée pour parler à `localhost`/`127.0.0.1`. Si tu
> déploies le backend ailleurs (serveur distant, Docker sur un autre host),
> ajoute son origine dans `host_permissions` de `extension/manifest.json`
> et dans `CORS_ORIGINS` de `backend/.env`, puis recharge l'extension.

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
  `/discover/*`, `/refresh/run`, `/status`).

### Extension (`extension/`)

- `manifest.json` — Manifest V3, permissions minimales (`storage`, `alarms`,
  `notifications`).
- `api.js` — client fetch partagé vers le backend.
- `popup.html/js/css` — liste des outliers, filtres, refresh manuel.
- `options.html/js/css` — gestion niches/chaînes/découverte.
- `background.js` — service worker, poll toutes les 15 min pour les
  notifications de nouveaux outliers.

### Aller plus loin (pistes non implémentées)

- Détection par **vélocité** (vitesse de croissance des vues) grâce aux
  `VideoSnapshot` déjà enregistrés à chaque cycle — actuellement stockés mais
  pas encore exploités dans le score.
- Comparaison **inter-chaînes** au sein d'une niche (pas seulement outlier par
  rapport à sa propre chaîne).
- Déploiement du backend sur un serveur distant pour un accès multi-utilisateurs
  (le `Dockerfile` fourni dans `backend/` est un bon point de départ).
