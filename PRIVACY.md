# Politique de confidentialité

Cette politique décrit ce que fait — et ne fait pas — Outlier Finder avec
les données, pour rester transparent et conforme aux
[Developer Policies de l'API YouTube](https://developers.google.com/youtube/terms/developer-policies).

## 1. Où vivent les données

Par défaut, **tout reste en local, sur ta machine** :

- Le backend écrit dans un fichier SQLite local (`backend/outliers.db`).
- Ta clé `YOUTUBE_API_KEY` reste dans `backend/.env`, sur ta machine — elle
  n'est jamais envoyée ailleurs qu'à l'API officielle Google
  (`googleapis.com`).
- L'extension Chrome ne parle qu'à ce backend local (`http://127.0.0.1:8000`
  par défaut) et à l'API YouTube (via le backend).
- Une seule exception : les chaînes que tu épingles en haut de tes
  abonnements (l'étoile dans le menu latéral de YouTube) sont une préférence
  d'affichage stockée par Chrome lui-même (`chrome.storage.local`), sur ta
  machine uniquement — elle ne transite jamais par le backend.

Si tu déploies le backend sur un serveur distant, ces données y sont
stockées à la place — c'est alors à toi de sécuriser cet accès (voir
[`LEGAL.md`](./LEGAL.md) si tu ouvres l'usage à d'autres personnes).

## 2. Ce qui est collecté et pourquoi

| Donnée | Source | Pourquoi |
|---|---|---|
| ID, titre, miniature, nombre d'abonnés d'une chaîne YouTube | API YouTube Data v3 (donnée publique) | Afficher la chaîne et calculer les outliers |
| ID, titre, miniature, vues/likes/commentaires d'une vidéo | API YouTube Data v3 (donnée publique) | Calculer le score d'outlier |
| Vidéos que tu "likes" (♡) en te baladant sur YouTube | Lue dans la page YouTube que **tu regardes déjà**, dans ton propre navigateur | Construire ta liste "Liste d'outliers" |
| Niches que tu crées | Saisies par toi dans l'extension | Organiser/filtrer les outliers |

Rien de tout cela n'est une donnée personnelle sensible : ce sont des
métadonnées publiques de vidéos/chaînes YouTube, plus tes propres choix
d'organisation (niches, favoris).

## 3. Ce qui n'est jamais collecté

- Pas de compte YouTube/Google requis, pas d'OAuth, pas de mot de passe.
- Pas d'historique de navigation en dehors des vidéos que tu mets
  explicitement en favori en cliquant sur le cœur.
- Aucune vidéo n'est téléchargée ou hébergée : les miniatures affichées sont
  de simples liens vers les serveurs de YouTube (`i.ytimg.com`), jamais des
  copies stockées par ce projet.
- Aucune donnée n'est vendue, partagée avec un tiers, ou utilisée à des fins
  publicitaires.

## 4. Durée de conservation

- Les statistiques vidéo (vues, etc.) sont rafraîchies automatiquement
  toutes les 2h — jamais figées plus de 30 jours sans mise à jour.
- L'historique brut des compteurs de vues (`VideoSnapshot`) est
  **automatiquement purgé au-delà de 30 jours**.
- Tes favoris ("Liste d'outliers") et les chaînes que tu suis restent tant que tu
  ne les supprimes pas toi-même.

## 5. Contrôle et suppression

Tu contrôles tout depuis l'extension, sans délai :

- **Retirer une chaîne** : bouton ✕ dans les réglages → suppression
  immédiate, ainsi que ses vidéos associées.
- **Retirer un favori** : bouton ✕ dans l'onglet "Liste d'outliers" → suppression
  immédiate.
- **Tout effacer** : arrête le backend et supprime le fichier
  `backend/outliers.db`.

## 6. Contact

Ce projet est maintenu par Loan. Pour toute question sur les données ou
cette politique, passe par le dépôt GitHub du projet.
