# Outlier Finder — Bot de détection d'outliers YouTube

Détecte automatiquement les vidéos YouTube (longues et Shorts) qui
**surperforment** par rapport aux habitudes de leur propre chaîne (les
"outliers"), triées par niche — aucune niche pré-remplie, uniquement celles
que tu crées toi-même. Tout tourne dans une **extension Chrome** — pas de
serveur à installer ni à lancer.

> 👉 Pressé de t'en servir ? Va droit au [**tuto d'utilisation pas à pas**](./TUTORIAL.md)
> (installation → premiers outliers → usage quotidien, ~10 min). Ce README-ci
> est la référence technique.

**© 2026 Loan — Tous droits réservés.** Projet non affilié, non sponsorisé
et non approuvé par YouTube ou Google LLC. Utilise exclusivement l'API
officielle YouTube Data v3 avec ta propre clé API. Voir [`LICENSE`](./LICENSE),
[`LEGAL.md`](./LEGAL.md) (conformité API YouTube) et [`PRIVACY.md`](./PRIVACY.md)
(données collectées).

## Comment ça marche

```
┌──────────────────────┐   toutes les 2h (alarme Chrome)   ┌────────────────────────┐
│   YouTube Data API    │◄──────────────────────────────────│  Extension Chrome        │
│  (chaînes, vidéos)     │────────────────────────────────► │  (service worker +       │
└──────────────────────┘        stats des vidéos            │   chrome.storage.local)  │
                                                              └───────────┬────────────┘
                                                                          │
                                                                          ▼
                                                              ┌────────────────────────┐
                                                              │ Popup + réglages         │
                                                              │ + cœur sur youtube.com   │
                                                              └────────────────────────┘
```

- **Le service worker de l'extension** (`background.js`) tourne en tâche de
  fond dans Chrome. Toutes les `refreshIntervalHours` (2h par défaut, réglable),
  une alarme le réveille : il repasse sur chaque chaîne suivie, récupère ses
  vidéos récentes et calcule pour chacune un **score d'outlier** :
  `score = vues de la vidéo / médiane des vues des autres vidéos récentes de la chaîne`.
  Une vidéo est marquée outlier si le score dépasse le seuil (x3 par défaut)
  et un plancher de vues absolu (pour ignorer le bruit sur les micro-chaînes).
- **Tout est stocké dans `chrome.storage.local`** — le stockage propre à
  l'extension, dans ton profil Chrome. Aucun serveur, aucune base de données
  à héberger, rien à lancer dans un terminal.
- **Le popup** affiche les outliers par niche, séparés en deux sections
  **🎬 Vidéos longues** et **📱 Shorts** (les playlists ne sont jamais
  analysées). Décrire une niche suffit : la création d'un flux lance une
  **découverte automatique** de chaînes correspondantes (recherche
  ponctuelle, pas de bouclage automatique pour préserver le quota API), en
  plus des chaînes que tu ajoutes toi-même par URL, @handle ou nom.
- Un badge + une notification Chrome préviennent quand un **nouvel outlier**
  vient d'être détecté (vérification toutes les 15 min).
- En te baladant sur YouTube, un **petit cœur ♡** apparaît sur chaque
  miniature de vidéo longue ou de Short (jamais sur les playlists), plus un
  cœur flottant sur la page de lecture. Ces deux comportements sont
  pilotables indépendamment via deux interrupteurs **"Mode recherche"** /
  **"Mode spectateur"** dans les réglages avancés. Un clic ajoute la vidéo à
  l'onglet **"⭐ Ma liste"** du popup, sauvegardé dans `chrome.storage.local`
  (persistant, survit à la fermeture du navigateur).
- **Bonus** : une étoile apparaît au survol de chaque chaîne dans ton menu
  latéral d'abonnements YouTube — cliquer dessus l'épingle en haut de la
  liste (préférence locale, indépendante du reste).

## 1. Installer l'extension dans Chrome

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

> ⚠️ En mode développeur, Chrome désactive parfois l'extension après un
> redémarrage du navigateur ("mode développeur activé" en bandeau) — c'est
> normal et sans danger, il suffit de la réactiver sur `chrome://extensions`.

### Option B — Publier sur le Chrome Web Store (pour la partager avec d'autres)

Si tu veux que d'autres personnes l'installent en un clic (sans "mode
développeur"), il faut la publier sur le Web Store :

1. Crée un compte développeur sur le
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (frais unique de 5 $).
2. Zippe le contenu du dossier `extension/` (le zip doit contenir `manifest.json`
   à sa racine, pas un sous-dossier).
3. Dans le Dashboard, "Nouvel article" → upload le zip.
4. Renseigne la fiche avec [`STORE_LISTING.md`](./STORE_LISTING.md) (résumé,
   description, catégorie) + une **politique de confidentialité** — tu peux
   réutiliser [`PRIVACY.md`](./PRIVACY.md).
5. Soumets pour revue (Google met généralement quelques jours).

Chaque personne qui installe l'extension doit renseigner **sa propre** clé
API YouTube dans les réglages (gratuite, voir section suivante) — l'extension
n'embarque pas de clé partagée.

## 2. Récupérer une clé YouTube Data API v3 (gratuite)

1. Va sur [console.cloud.google.com](https://console.cloud.google.com/), crée
   un projet (ou réutilise un existant).
2. Dans "API et services" → "Bibliothèque", active **YouTube Data API v3**.
3. Dans "API et services" → "Identifiants", crée une **clé API**.
4. Ouvre les réglages de l'extension → "Réglages avancés" → colle la clé dans
   "Clé API YouTube" → "Enregistrer".

Le quota gratuit est de 10 000 unités/jour. Le rafraîchissement automatique
n'utilise que des appels à 1 unité (très large marge même avec des centaines
de chaînes suivies). Seules les fonctions de **découverte** de chaînes
(recherche par mot-clé ou par chaîne similaire) coûtent 100 unités/appel —
utilise-les ponctuellement, pas en boucle.

## 3. Utiliser le bot

Dans la page **Réglages** de l'extension, le premier bloc ne demande qu'une
seule chose obligatoire : **décris ta niche** (ex : "Gaming FR"). Ça suffit à
déclencher une **découverte automatique** de chaînes dans cette niche. Ta
propre chaîne YouTube et des liens de chaînes similaires sont optionnels — un
bouton "Créer mon flux d'outliers" fait le reste (grisé tant qu'aucune clé
API n'est enregistrée, avec une explication visible juste en dessous).

Besoin de séparer une chaîne principale d'une chaîne secondaire ? Crée un
flux par niche distincte (ex. "Ma chaîne principale" / "Ma chaîne
secondaire") — le filtre par niche du popup fait alors office d'onglets
séparés.

Les outils plus avancés (ajouter une chaîne dans une niche précise,
découverte par mot-clé ou par chaîne modèle, gestion fine des niches, clé
API) sont repliés dans "⚙ Réglages avancés".

Dans le **popup** (clic sur l'icône) :

- Filtre par niche et par seuil de score (x2, x3, x5, x10...).
- Deux sections séparées : **🎬 Vidéos longues** et **📱 Shorts** (les
  playlists ne sont jamais analysées ni comptées comme outliers).
- Chaque carte montre : miniature, titre, chaîne, **multiplicateur** (`x4.2`),
  nombre de vues, niche, et un badge **NOUVEAU** si détecté récemment.
- Bouton **↻** pour forcer un rafraîchissement immédiat (sinon automatique
  selon l'intervalle réglé, 2h par défaut).
- Onglet **"⭐ Ma liste"** pour retrouver les vidéos que tu as toi-même
  marquées sur YouTube.

## 4. Marquer tes propres outliers en un clic

En plus de la détection automatique, tu peux repérer un outlier "à l'œil" en
te baladant sur YouTube :

- **Sur les miniatures de vidéos longues ou de Shorts** (accueil, recherche,
  suggestions...) : survole une vidéo, un petit ♡ apparaît en haut de la
  miniature. Clique dessus pour l'ajouter à ta liste (il devient ♥ violet).
  *(Jamais sur les miniatures de playlists — volontairement retiré.)*
- **Sur la page de lecture** (vidéo classique ou Short) : un cœur flottant en
  bas à droite de l'écran fait la même chose pour la vidéo en cours.

Ces deux comportements se pilotent indépendamment dans "⚙ Réglages avancés"
→ section **"Le cœur sur YouTube"** : interrupteur **"Mode recherche"** pour
le cœur sur les miniatures, interrupteur **"Mode spectateur"** pour le cœur
flottant sur la page de lecture.

**Bonus — épingler des chaînes en haut de tes abonnements** : dans le menu
latéral de YouTube, une étoile apparaît au survol de chaque chaîne abonnée ;
cliquer dessus la fait remonter en haut de la liste. C'est une préférence
locale à ton navigateur (`chrome.storage.local`), indépendante du reste.

> YouTube change régulièrement la structure de ses pages ; si le cœur
> n'apparaît plus après une mise à jour de YouTube, les sélecteurs dans
> `extension/content.js` (fonction `scanCards`, `CARD_SELECTOR`) et
> `extension/subscriptions.js` sont l'endroit à ajuster.

## Détails techniques

### Extension (`extension/`)

- `manifest.json` — Manifest V3, permissions minimales (`storage`,
  `unlimitedStorage`, `alarms`, `notifications`) + accès à
  `googleapis.com` (API YouTube) + `content_scripts` sur `youtube.com`.
- `lib/youtube.js` — client YouTube Data API v3 (fetch), résolution de
  chaîne quel que soit le format d'entrée, récupération batched des vidéos
  (durée ISO 8601 parsée pour distinguer Shorts et vidéos longues), recherche
  de chaînes.
- `lib/outliers.js` — calcul du score outlier (médiane robuste).
- `lib/store.js` — tout le "backend" en JS pur : CRUD niches/chaînes/vidéos/
  favoris sur `chrome.storage.local`, cycle de rafraîchissement complet,
  purge de l'historique au-delà de 30 jours (conformité API YouTube).
  Testable sans navigateur (voir plus bas).
- `background.js` — service worker : orchestre tout (alarmes, notifications,
  et les appels venant du popup/des réglages via `chrome.runtime.sendMessage`).
- `api.js` — petite couche utilisée par popup/réglages : relaie les appels
  vers `background.js` par message (au lieu d'un `fetch` HTTP vers un
  serveur) et convertit les réponses en snake_case pour un contrat stable.
- `theme.css` — design system partagé (couleurs, boutons pill, cartes).
- `popup.html/js/css` — onglet "Outliers" (sections Vidéos longues / Shorts)
  et "⭐ Ma liste", filtres, refresh manuel.
- `options.html/js/css` — flux d'onboarding simplifié en avant (niche
  obligatoire, chaîne + chaînes similaires optionnelles, aperçu de chaîne en
  direct), réglages techniques (clé API, modes du cœur, découverte avancée,
  niches) repliés dans un `<details>`.
- `content.js` / `content.css` — injectés sur `youtube.com` : cœur sur chaque
  miniature de vidéo longue ou de Short (ancienne et nouvelle structure
  `yt-lockup-view-model`, jamais sur les playlists) + cœur flottant sur la
  page de lecture. Les deux sont indépendamment activables/désactivables
  (réglages `heartSearchMode` / `heartViewerMode`).
- `subscriptions.js` / `subscriptions.css` — étoile pour épingler des chaînes
  en haut du menu latéral d'abonnements.

### Tester sans navigateur

Toute la logique métier (`lib/*.js`) est écrite pour tourner aussi bien dans
un service worker Chrome que dans Node (détection `typeof self`/`module.exports`),
ce qui permet de la tester avec `chrome.storage` et `fetch` mockés — utile
pour vérifier une modification avant de recharger l'extension. Exemple :

```bash
node -e "
const Store = require('./extension/lib/store.js');
const YouTube = require('./extension/lib/youtube.js');
const OutlierEngine = require('./extension/lib/outliers.js');
// ... voir les tests d'intégration utilisés pendant le développement pour un exemple complet
"
```

### Aller plus loin (pistes non implémentées)

- Détection par **vélocité** (vitesse de croissance des vues) — les
  snapshots de vues sont déjà enregistrés à chaque cycle mais pas encore
  exploités dans le score.
- Comparaison **inter-chaînes** au sein d'une niche (pas seulement outlier
  par rapport à sa propre chaîne).
- Synchronisation multi-appareils : `chrome.storage.local` ne synchronise
  pas entre plusieurs ordinateurs. `chrome.storage.sync` existe mais son
  quota (100 Ko) est bien trop petit pour ce volume de données.
