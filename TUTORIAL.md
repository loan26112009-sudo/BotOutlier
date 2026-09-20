# Tuto — Utiliser Outlier Finder de A à Z

Ce guide t'emmène du zéro absolu jusqu'à ton premier outlier détecté, puis à
l'usage quotidien du bot. Pour la doc technique détaillée, voir le
[`README.md`](./README.md).

**Temps total la première fois : ~10 minutes**, dont l'essentiel pour la clé
API Google (étape 2 — c'est LA étape qui bloque le plus de monde, donc elle
est détaillée écran par écran ci-dessous). Après ça, c'est piloté au clic —
**pas de serveur, pas de terminal, tout tourne dans Chrome.**

---

## Étape 0 — Comprendre le principe en 30 secondes

- L'**extension Chrome** fait tout elle-même : elle va chercher les stats
  des chaînes YouTube que tu lui donnes, toutes les 2h, en tâche de fond,
  même popup fermé.
- Elle compare chaque nouvelle vidéo aux habitudes de sa propre chaîne. Si
  elle explose (x3 la médiane par défaut), c'est un **outlier**.
- Un petit **cœur ♡** apparaît directement sur YouTube (miniatures + page de
  lecture) pour que tu marques toi-même les pépites que tu repères en
  scrollant.

Le seul truc à faire avant de commencer : une clé API YouTube gratuite (voir
étape 2 — **sans elle, rien ne peut fonctionner**, le bouton de création de
flux reste volontairement grisé tant qu'elle n'est pas enregistrée).

---

## Étape 1 — Charger l'extension dans Chrome (une fois)

1. `chrome://extensions` dans la barre d'adresse.
2. Active **le mode développeur** (interrupteur en haut à droite).
3. **"Charger l'extension non empaquetée"** → sélectionne le dossier
   `extension/` du projet.
4. Épingle-la (icône 📌) pour la garder visible dans la barre d'outils.

✅ **Tu dois voir** l'icône Outlier Finder apparaître dans la barre d'outils.

---

## Étape 2 — Récupère ta clé YouTube (gratuite) — LE GUIDE COMPLET

C'est l'étape qui coince le plus souvent, donc voici vraiment **chaque
clic**, dans l'ordre, avec ce que tu dois voir à chaque écran.

### 2.1 — Crée un projet Google Cloud

1. Va sur **[console.cloud.google.com](https://console.cloud.google.com/)**.
   Connecte-toi avec n'importe quel compte Google (ton compte perso suffit,
   pas besoin de compte pro).
2. En haut de la page, à côté du logo "Google Cloud", il y a un sélecteur de
   projet (souvent écrit "Sélectionner un projet"). Clique dessus.
3. Dans la fenêtre qui s'ouvre, clique **"NOUVEAU PROJET"** (en haut à droite).
4. Donne-lui un nom (ex : `outlier-finder`, peu importe), laisse
   l'organisation par défaut, clique **"Créer"**.
5. Attends quelques secondes (une notification 🔔 en haut à droite te
   prévient quand c'est prêt), puis **sélectionne ce projet** dans le même
   menu déroulant en haut de la page — c'est important, sinon les étapes
   suivantes se font sur le mauvais projet.

✅ **Tu dois voir** le nom de ton projet affiché en haut de la page, à côté
du logo Google Cloud.

### 2.2 — Active l'API YouTube Data v3

1. Clique sur le menu **☰** (en haut à gauche) → **"API et services"** →
   **"Bibliothèque"**. (Ou va directement sur
   [console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library).)
2. Dans la barre de recherche de cette page, tape **"YouTube Data API v3"**
   et clique sur le résultat qui porte exactement ce nom.
3. Clique sur le gros bouton bleu **"Activer"**.
4. Attends quelques secondes — tu arrives automatiquement sur le tableau de
   bord de l'API une fois activée.

✅ **Tu dois voir** un bandeau ou un statut indiquant que l'API est activée
pour ton projet (le bouton "Activer" a disparu, remplacé par des stats de
quota à 0).

### 2.3 — Crée la clé API

1. Menu **☰** → **"API et services"** → **"Identifiants"** (ou
   [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)).
2. En haut, clique **"+ Créer des identifiants"** → choisis **"Clé API"**
   dans la liste.
3. Une fenêtre affiche immédiatement ta clé (une chaîne du genre
   `AIzaSy...`). **Copie-la** (bouton de copie à côté).
4. Clique **"Fermer"**.

⚠️ **Piège classique — les restrictions d'application.** Sur cette même
fenêtre (ou en cliquant sur la clé fraîchement créée dans la liste), Google
te propose de **restreindre** la clé (par IP, par referrer HTTP, etc.). Si tu
restreins par **"Referrers HTTP"**, l'extension tourne dans une page
`chrome-extension://...` et **PAS** un vrai site web — une restriction mal
réglée bloquera silencieusement tous les appels (tu auras une erreur
"Requête refusée" ou "API key not valid"). **La solution la plus simple :
laisse "Restrictions relatives aux applications" sur "Aucune"** tant que tu
es le seul à utiliser cette clé. Si tu veux quand même restreindre par
sécurité, choisis **"Restrictions liées aux API"** → sélectionne uniquement
**"YouTube Data API v3"** (ça limite ce que la clé peut faire, sans bloquer
l'extension).

✅ **Tu dois voir**, dans la liste des identifiants, une clé API avec le
statut "Aucune restriction" (ou "Restreinte à : YouTube Data API v3" si tu as
suivi l'option sécurisée ci-dessus) — pas "Restreinte à : referrers HTTP".

### 2.4 — Colle la clé dans l'extension

1. Clique sur l'icône de l'extension → l'engrenage ⚙ (ou clic droit sur
   l'icône → Options) pour ouvrir la page de réglages.
2. Tu verras un bandeau **"🔑 Il manque juste ta clé API YouTube"** — normal
   au tout premier lancement.
3. Clique **"Ajouter ma clé →"** dans le bandeau (ça déroule directement la
   section "⚙ Réglages avancés" et place le curseur dans le bon champ) — ou
   ouvre toi-même "⚙ Réglages avancés" → champ **"Clé API YouTube"**.
4. **Colle** la clé copiée à l'étape 2.3, clique **"Enregistrer"**.

✅ **Tu dois voir** le bandeau disparaître et, à côté du champ, un badge vert
"configurée ✓". Le bouton **"🚀 Créer mon flux d'outliers"** plus haut dans
la page devient alors cliquable (il était grisé exprès jusqu'ici — voir
encadré ci-dessous). C'est allumé, pour de bon cette fois — rien à relancer,
jamais.

> 🔒 **Pourquoi le bouton "Créer mon flux d'outliers" reste grisé au début ?**
> Simplement parce qu'il ne peut rien faire sans clé API (il doit interroger
> YouTube pour trouver tes chaînes). Un message juste en dessous du bouton
> ("🔒 Ce bouton reste grisé tant que...") te le rappelle tant que la clé
> n'est pas enregistrée. Dès qu'elle l'est, il se débloque automatiquement,
> pas besoin de recharger la page.

### 2.5 — Dépannage clé API

| Symptôme | Cause probable | Solution |
|---|---|---|
| "API key not valid" / "Requête refusée" | Clé mal copiée (espace en trop, caractère manquant) OU restriction "Referrers HTTP" activée (voir 2.3) | Recopie la clé sans espace ; repasse la restriction sur "Aucune" ou "Restrictions liées aux API → YouTube Data API v3" |
| "YouTube Data API v3 has not been used in project..." | L'API n'a pas été activée sur CE projet précis (étape 2.2 sautée ou faite sur un autre projet) | Vérifie en haut de la console que le bon projet est sélectionné, refais l'étape 2.2 |
| Le bouton reste grisé après avoir collé la clé | La clé n'a pas été enregistrée (bouton "Enregistrer" pas cliqué) ou une erreur réseau a empêché la sauvegarde | Recliquer "Enregistrer" ; vérifier qu'un message de confirmation apparaît à côté du champ |
| "Quota YouTube API dépassé" | Le quota gratuit (10 000 unités/jour) est épuisé, généralement à cause d'appels de découverte répétés (100 unités chacun) | Attends le lendemain (remis à 0 à minuit Pacifique) ou limite les recherches de découverte |

---

## Étape 3 — Crée ton premier flux d'outliers

Toujours sur la page de réglages, le premier bloc te demande :

1. **Ta chaîne YouTube** *(optionnel — juste le nom suffit, ex : `MrBeast`)*.
   Tape quelques lettres : un aperçu (avatar + nom + abonnés) s'affiche
   automatiquement en dessous pour confirmer que c'est la bonne chaîne avant
   même de cliquer sur "Créer" — si tu vois "❌ Chaîne introuvable", corrige
   l'orthographe ou colle plutôt un lien complet.
2. **Décris ta niche** en quelques mots (ex : "Gaming FR", "GTA RP",
   "Cinéma") — **c'est le seul champ obligatoire**. L'extension s'en sert pour
   chercher **automatiquement** des chaînes qui correspondent à cette niche,
   tu n'as rien d'autre à faire.
3. **Chaînes similaires** *(optionnel)* — si tu as déjà des chaînes en tête,
   colle leurs noms ou liens, un par ligne. Sinon laisse vide, la découverte
   automatique s'en charge.

Clique **"🚀 Créer mon flux d'outliers"**.

✅ **Tu dois voir** un message vert confirmant combien de chaînes ont été
ajoutées (les tiennes + celles trouvées automatiquement dans la niche), et
elles apparaissent dans la liste "Tes chaînes suivies" juste en dessous.

> ℹ️ **Comment fonctionne la découverte automatique ?** Au moment où tu
> cliques sur "Créer", l'extension fait **une recherche ponctuelle** dans la
> niche que tu as décrite et ajoute jusqu'à 8 chaînes trouvées. Elle ne
> refait pas cette recherche toute seule en boucle ensuite (ça consommerait
> beaucoup de quota API pour rien) — mais rien ne t'empêche de relancer une
> découverte quand tu veux depuis "⚙ Réglages avancés" → "Découvrir des
> chaînes par mot-clé".

> ℹ️ **Chaîne principale + chaîne secondaire ?** Il n'y a pas d'onglet séparé
> par chaîne, mais le principe des **niches** fait exactement ça : crée un
> flux avec la niche "Ma chaîne principale" pour l'une, et un second flux
> avec la niche "Ma chaîne secondaire" pour l'autre. Ensuite, dans le popup,
> le filtre par niche te permet de basculer instantanément de l'une à
> l'autre — c'est l'équivalent d'onglets séparés, sans rien reconfigurer.

**Tu veux ajouter encore plus de chaînes toi-même ?** Ouvre "⚙ Réglages
avancés" → section "Découvrir des chaînes par mot-clé" ou "chaînes similaires
à une chaîne donnée" → coche celles qui t'intéressent → "Ajouter la
sélection".

---

## Étape 4 — Attendre (ou forcer) le premier scan

L'extension analyse automatiquement toutes les chaînes suivies dès que la clé
API est configurée, puis toutes les 2h. Pour ne pas attendre :

1. Ouvre le **popup** (clic sur l'icône).
2. Clique sur **↻** en haut à droite.
3. Patiente ~10-30 secondes (le temps dépend du nombre de chaînes).

✅ **Tu dois voir** la barre de statut passer à un nombre de chaînes/niches
suivies, puis la liste se remplir avec des cartes vidéo si des outliers sont
trouvés. Si la liste reste vide, c'est probablement normal : aucune vidéo ne
dépasse encore x3 la médiane de sa chaîne (baisse le seuil dans le menu
déroulant "Seuil" pour voir plus large, ex. x2).

---

## Étape 5 — Lire et filtrer les outliers (usage quotidien)

Dans le popup, onglet **"Outliers"** :

- **Filtre par niche** (menu déroulant du haut) pour te concentrer sur
  "Gaming" ou "Cinéma" par exemple.
- **Filtre par seuil** : x2 (large), x3 (par défaut), x5, x10 (les vraies
  bombes).
- La liste est séparée en deux sections : **🎬 Vidéos longues** et
  **📱 Shorts** — seules ces deux catégories sont analysées (les playlists ne
  sont jamais prises en compte).
- Chaque carte montre : miniature, titre, chaîne, **multiplicateur** (`x4.2`),
  nombre de vues, niche, et un badge **NOUVEAU** si détecté récemment.
- Clique sur une carte → ouvre la vidéo sur YouTube dans un nouvel onglet.

Le badge sur l'icône de l'extension + une notification système t'avertissent
automatiquement dès qu'un nouvel outlier tombe, même popup fermé.

---

## Étape 6 — Marquer tes propres outliers (au fil de ton scroll)

Pas besoin d'ouvrir l'extension pour ça : va sur YouTube normalement.

- **Sur une miniature de vidéo longue ou de Short** (accueil, recherche,
  suggestions) : survole-la, un **♡** apparaît en haut de la miniature →
  clique → il devient **♥** violet. *(Les miniatures de playlists n'ont pas
  de cœur, volontairement — ça n'aurait pas de sens.)*
- **Sur une vidéo que tu regardes** (page de lecture classique ou Short) : un
  cœur flottant en bas à droite de l'écran fait la même chose.

Ces deux comportements sont pilotables indépendamment dans "⚙ Réglages
avancés" → section **"Le cœur sur YouTube"** :

- **Mode recherche** : active/désactive le cœur sur les miniatures en
  naviguant (accueil, recherche, suggestions).
- **Mode spectateur** : active/désactive le cœur flottant sur la page de
  lecture.

Désactive celui que tu n'utilises pas si tu préfères une interface plus
sobre.

**Bonus — épingler tes chaînes préférées dans tes abonnements** : dans le
menu latéral de YouTube, une étoile ☆ apparaît au survol de chaque chaîne
abonnée. Clique dessus (elle devient ★) pour la faire remonter en haut de ta
liste d'abonnements.

---

## Étape 7 — Retrouver et classer tes coups de cœur

Retourne dans le popup → onglet **"⭐ Ma liste"**.

- Tous tes cœurs cliqués s'y retrouvent, du plus récent au plus ancien.
- **Classe-les par niche** avec le menu déroulant de chaque carte.
- **✕** pour en retirer un si tu t'es trompé de bouton.
- Filtre par niche en haut de l'onglet pour ne voir qu'une catégorie.

Cette liste vit dans le stockage de l'extension (`chrome.storage.local`),
donc elle **survit** à un redémarrage du navigateur ou de l'ordinateur — tant
que tu ne désinstalles pas l'extension ou ne nettoies pas les données du
profil Chrome.

---

## Routine recommandée

1. Ouvre le popup, onglet "Outliers", filtre par niche du jour → repère ce
   qui a explosé, en vidéos longues comme en Shorts.
2. En scrollant YouTube dans la journée, cœur ♡ sur tout ce qui te semble
   sortir du lot — même si le bot ne l'a pas encore détecté (il ne voit que
   les chaînes que tu lui as données).
3. En fin de semaine, onglet "Ma liste" → range tes trouvailles par niche →
   ça devient ta banque d'inspiration pour tes propres formats.

---

## Dépannage express

| Symptôme | Cause probable | Solution |
|---|---|---|
| Bandeau "clé API manquante" persistant | Clé pas encore collée/enregistrée, ou restriction "Referrers HTTP" bloquant les appels | Voir le guide complet étape 2, en particulier 2.3 et 2.5 |
| Bouton "Créer mon flux d'outliers" grisé | Clé API pas encore enregistrée | Enregistre la clé (étape 2.4) — le bouton se débloque tout seul |
| Liste d'outliers vide | Pas assez de vidéos par chaîne, ou seuil trop haut | Baisse le seuil (x2), attends le prochain cycle, ajoute plus de chaînes |
| Le cœur n'apparaît pas sur YouTube | Mode recherche/spectateur désactivé dans les réglages, extension pas rechargée après mise à jour, ou YouTube a changé son DOM | Vérifie les deux interrupteurs dans "Le cœur sur YouTube" ; `chrome://extensions` → bouton ↻ sur l'extension |
| Le cœur apparaît sur une playlist | Ne devrait plus arriver — signale-le si tu le vois encore | Recharge l'extension (`chrome://extensions` → ↻) |
| Une chaîne bizarre a été ajoutée par erreur | Un nom trop vague a été résolu vers la mauvaise chaîne | Supprime-la depuis "Tes chaînes suivies" (bouton ✕), puis réessaie en collant un lien complet plutôt qu'un nom court |
| Erreur "Quota YouTube API dépassé" | Trop d'appels de découverte (recherche par mot-clé/chaîne similaire) dans la journée | Attends le lendemain (quota remis à 0) ou limite les recherches de découverte |
| "L'extension vient peut-être d'être rechargée" | Le service worker s'est réveillé après une pause | Réouvre simplement le popup |

---

Pour aller plus loin (architecture, publication sur le Chrome Web Store),
tout est dans le [`README.md`](./README.md).
