# Tuto — Utiliser Outlier Finder de A à Z

Ce guide t'emmène du zéro absolu jusqu'à ton premier outlier détecté, puis à
l'usage quotidien du bot. Pour la doc technique détaillée, voir le
[`README.md`](./README.md).

**Temps total la première fois : ~10 minutes**, dont 5 min d'attente pour la
clé API Google. Après ça, c'est piloté au clic — **pas de serveur, pas de
terminal, tout tourne dans Chrome.**

---

## Étape 0 — Comprendre le principe en 30 secondes

- L'**extension Chrome** fait tout elle-même : elle va chercher les stats
  des chaînes YouTube que tu lui donnes, toutes les 2h, en tâche de fond,
  même popup fermé.
- Elle compare chaque nouvelle vidéo aux habitudes de sa propre chaîne. Si
  elle explose (x3 la médiane par défaut), c'est un **outlier**.
- Un petit **cœur ♡** apparaît directement sur YouTube pour que tu marques
  toi-même les pépites que tu repères en scrollant.

Le seul truc à faire avant de commencer : une clé API YouTube gratuite (voir
étape 2). Sans elle, l'extension ne peut pas aller chercher de données.

---

## Étape 1 — Charger l'extension dans Chrome (une fois)

1. `chrome://extensions` dans la barre d'adresse.
2. Active **le mode développeur** (interrupteur en haut à droite).
3. **"Charger l'extension non empaquetée"** → sélectionne le dossier
   `extension/` du projet.
4. Épingle-la (icône 📌) pour la garder visible dans la barre d'outils.

✅ **Tu dois voir** l'icône Outlier Finder apparaître dans la barre d'outils.

---

## Étape 2 — Récupère ta clé YouTube (gratuite, ~5 min)

1. Clique sur l'icône de l'extension → l'engrenage ⚙ (ou clic droit sur
   l'icône → Options) pour ouvrir la page de réglages.
2. Tu verras un bandeau "🔑 Il manque juste ta clé API YouTube" — pas de
   panique, c'est normal au tout premier lancement.
3. Va sur [console.cloud.google.com](https://console.cloud.google.com/) →
   crée un projet (bouton en haut, quelques secondes).
4. Menu (☰) → "API et services" → "Bibliothèque" → cherche **YouTube Data
   API v3** → clique "Activer".
5. "API et services" → "Identifiants" → "Créer des identifiants" → **Clé
   API** → copie la clé qui apparaît.
6. Retourne sur la page de réglages de l'extension → clique "Ajouter ma clé →"
   dans le bandeau → colle la clé → "Enregistrer".

✅ **Tu dois voir** le bandeau disparaître et un badge "configurée ✓" à côté
du champ. C'est allumé, pour de bon cette fois — rien à relancer, jamais.

---

## Étape 3 — Crée ton premier flux d'outliers

Toujours sur la page de réglages, le premier bloc te demande 3 choses :

1. **Ta chaîne YouTube** (colle un lien, ex: `youtube.com/@nomdelachaine`)
   ou une chaîne que tu veux suivre.
2. **Décris ta niche** en quelques mots (ex: "Gaming FR", "GTA RP", "Cinéma").
3. **Chaînes similaires** (optionnel) — colle des liens, un par ligne, de
   chaînes qui t'inspirent dans la même niche.

Clique **"🚀 Créer mon flux d'outliers"**.

✅ **Tu dois voir** un message vert confirmant combien de chaînes ont été
ajoutées, et elles apparaissent dans la liste "Tes chaînes suivies" juste en
dessous.

**Tu ne connais pas assez de chaînes dans ta niche ?** Ouvre "⚙ Réglages
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
- Chaque carte montre : miniature, titre, chaîne, **multiplicateur** (`x4.2`),
  nombre de vues, niche, et un badge **NOUVEAU** si détecté récemment.
- Clique sur une carte → ouvre la vidéo sur YouTube dans un nouvel onglet.

Le badge sur l'icône de l'extension + une notification système t'avertissent
automatiquement dès qu'un nouvel outlier tombe, même popup fermé.

---

## Étape 6 — Marquer tes propres outliers (au fil de ton scroll)

Pas besoin d'ouvrir l'extension pour ça : va sur YouTube normalement.

- **Sur une miniature** (accueil, recherche, suggestions) : survole-la, un
  **♡** apparaît en haut à droite → clique → il devient **♥** violet.
- **Sur une vidéo que tu regardes** : un cœur flottant en bas à droite de
  l'écran fait la même chose.
- **Via le menu ⋮** d'une vidéo : option "Ajouter à la liste d'outliers", au
  même endroit que "Regarder plus tard". *(Expérimental — préviens-moi si tu
  ne le vois pas.)*

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
   qui a explosé.
2. En scrollant YouTube dans la journée, cœur ♡ sur tout ce qui te semble
   sortir du lot — même si le bot ne l'a pas encore détecté (il ne voit que
   les chaînes que tu lui as données).
3. En fin de semaine, onglet "Ma liste" → range tes trouvailles par niche →
   ça devient ta banque d'inspiration pour tes propres formats.

---

## Dépannage express

| Symptôme | Cause probable | Solution |
|---|---|---|
| Bandeau "clé API manquante" persistant | Clé pas encore collée/enregistrée | Réglages avancés → colle la clé → "Enregistrer" |
| Liste d'outliers vide | Pas assez de vidéos par chaîne, ou seuil trop haut | Baisse le seuil (x2), attends le prochain cycle, ajoute plus de chaînes |
| Le cœur n'apparaît pas sur YouTube | Extension pas rechargée après mise à jour, ou YouTube a changé son DOM | `chrome://extensions` → bouton ↻ sur l'extension ; si ça persiste, voir la note dans `README.md` sur `content.js` |
| Erreur "Quota YouTube API dépassé" | Trop d'appels de découverte (recherche par mot-clé/chaîne similaire) dans la journée | Attends le lendemain (quota remis à 0) ou limite les recherches de découverte |
| "L'extension vient peut-être d'être rechargée" | Le service worker s'est réveillé après une pause | Réouvre simplement le popup |

---

Pour aller plus loin (architecture, publication sur le Chrome Web Store),
tout est dans le [`README.md`](./README.md).
