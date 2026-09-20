# Mentions légales & conformité

> Ceci n'est pas un avis juridique professionnel. C'est un résumé pratique
> des règles à respecter pour que ce projet reste dans les clous vis-à-vis de
> YouTube/Google. En cas de doute sérieux (usage commercial, forte audience),
> consulte un·e avocat·e.

## 1. Propriété et licence

Ce projet est la propriété de **Loan**, tous droits réservés — voir
[`LICENSE`](./LICENSE). Ce n'est **pas** un projet open source libre : usage
personnel/privé autorisé, redistribution ou exploitation commerciale
soumises à autorisation écrite préalable.

## 2. Non-affiliation

Outlier Finder est un outil **indépendant**, non affilié, non sponsorisé et
non approuvé par YouTube ou Google LLC. « YouTube » est une marque déposée
de Google LLC, utilisée ici uniquement à titre descriptif pour indiquer la
source des données affichées (attribution requise, voir §4).

## 3. Comment ce projet reste conforme aux règles de l'API YouTube

Ce projet utilise **exclusivement l'API officielle YouTube Data v3**
(`googleapis.com/youtube/v3`) avec une clé API que **toi seul possèdes et
configures** — aucun scraping, aucun accès non documenté. Les règles
principales des
[YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service)
et des
[Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
et comment le code les respecte :

| Règle | Ce que dit YouTube | Comment le bot s'y conforme |
|---|---|---|
| **Accès aux données** | Uniquement via les moyens décrits dans l'accord (API officielle), pas de scraping non autorisé | Tous les appels passent par `googleapis.com/youtube/v3` (`backend/app/youtube_client.py`). Le content script sur YouTube lit uniquement le titre/la chaîne de ce que **tu es déjà en train de regarder dans ton propre navigateur** — comme le ferait n'importe quelle extension (ad-blocker, note-taking...), pas un robot d'indexation. |
| **Rétention des données non authentifiées** | Pas plus de 30 jours sans rafraîchissement (section III.E.4.d) | Les stats vidéo sont rafraîchies toutes les 2h (`REFRESH_INTERVAL_HOURS`) — largement sous la limite. L'historique de vues (`VideoSnapshot`) est purgé automatiquement au-delà de 30 jours (`purge_old_snapshots` dans `backend/app/refresh.py`). Les métadonnées de chaîne (titre, abonnés) sont elles aussi rafraîchies à chaque cycle, jamais figées. |
| **Ne pas remplacer les chiffres de l'API** | Le nombre de vues affiché doit être celui renvoyé par l'API, non substitué (section III.E.4.h) | Le popup affiche toujours `view_count` tel que renvoyé par l'API. Le "score d'outlier" (`x4.2`) est un **indicateur calculé en plus**, jamais un remplacement du vrai compteur de vues. |
| **Attribution** | Indiquer clairement que YouTube est la source des données affichées (section III.F.2.a) | Mention "Données fournies par l'API YouTube Data v3 — non affilié à YouTube/Google" en pied de page du popup et des réglages de l'extension. |
| **Politique de confidentialité** | Publier une politique claire sur la collecte/le stockage des données | Voir [`PRIVACY.md`](./PRIVACY.md). |
| **Consentement & suppression** | Consentement exprès avant chaque action, suppression sous 7 jours en cas de révocation | Chaque écriture (ajout de chaîne, clic sur le cœur) est un clic explicite de l'utilisateur ; la suppression via l'interface (✕) est **immédiate**. |

## 4. Attribution YouTube dans l'interface

Conformément aux règles d'attribution, l'extension mentionne "Données
fournies par l'API YouTube Data v3" en pied de page. Si tu publies ce projet
plus largement (Chrome Web Store, usage par des tiers), respecte en plus les
[YouTube Brand Guidelines](https://www.youtube.com/howyoutubeworks/resources/brand-resources/)
officielles pour l'usage du logo/nom YouTube.

## 5. Quotas et usage raisonnable

La clé `YOUTUBE_API_KEY` est **la tienne** : c'est toi qui es responsable de
son usage vis-à-vis de Google (quotas, conditions d'utilisation de la
Console Cloud). Le bot est conçu pour rester très en dessous du quota
gratuit (10 000 unités/jour) — voir le détail dans le `README.md`.

## 6. Si tu veux déployer ce projet pour d'autres personnes

Au-delà d'un usage strictement personnel, YouTube peut exiger un **audit de
conformité** au-delà d'un certain volume de requêtes/utilisateurs (section 6
des Terms of Service). Dans ce cas :

- Rédige/adapte une vraie politique de confidentialité publique (base de
  [`PRIVACY.md`](./PRIVACY.md) fournie).
- Vérifie les guidelines de marque YouTube pour l'attribution visuelle.
- Anticipe une demande d'audit de la part de YouTube si le volume d'appels
  API grossit significativement.
