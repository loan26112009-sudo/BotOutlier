// Calcul du score d'outlier pour un lot de vidéos d'une même chaîne.
// Port fidèle de l'ancien backend/app/outliers.py : chaque vidéo est comparée
// à la médiane des vues des AUTRES vidéos récentes de la même chaîne (baseline
// robuste, peu sensible aux outliers déjà présents dans l'échantillon).
(function (root) {
  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function computeOutliers(videos, { multiplier, minViewsFloor, minHistory }) {
    const n = videos.length;
    if (n < minHistory) {
      for (const v of videos) {
        v.baselineViews = null;
        v.outlierScore = null;
        v.isOutlier = false;
      }
      return videos;
    }

    const allViews = videos.map((v) => v.viewCount);

    for (const v of videos) {
      const others = videos.reduce((acc, o, i) => {
        if (o !== v) acc.push(allViews[i]);
        return acc;
      }, []);

      const baseline = others.length >= Math.max(minHistory - 1, 3) ? median(others) : null;
      v.baselineViews = baseline;

      const score = baseline && baseline > 0 ? v.viewCount / baseline : null;
      v.outlierScore = score;
      v.isOutlier = score !== null && score >= multiplier && v.viewCount >= minViewsFloor;
    }

    return videos;
  }

  const OutlierEngine = { computeOutliers, median };
  if (typeof module !== "undefined" && module.exports) module.exports = OutlierEngine;
  else root.OutlierEngine = OutlierEngine;
})(typeof self !== "undefined" ? self : this);
