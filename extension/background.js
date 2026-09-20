importScripts("api.js");

const POLL_ALARM = "poll-outliers";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollNewOutliers();
  }
});

async function pollNewOutliers() {
  try {
    const newOutliers = await api.getOutliers({ only_new: "true", new_since_minutes: "20", limit: "20" });

    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    if (newOutliers.length > 0) {
      await chrome.action.setBadgeText({ text: String(Math.min(newOutliers.length, 99)) });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }

    const { notifiedIds = [] } = await chrome.storage.local.get("notifiedIds");
    const notifiedSet = new Set(notifiedIds);
    const fresh = newOutliers.filter((o) => !notifiedSet.has(o.video.youtube_video_id));

    if (fresh.length > 0) {
      const top = fresh[0];
      chrome.notifications.create(`outlier-${top.video.youtube_video_id}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: fresh.length === 1 ? "Nouvel outlier détecté 🚀" : `${fresh.length} nouveaux outliers 🚀`,
        message:
          fresh.length === 1
            ? `${top.channel_title}: "${top.video.title}" fait x${top.video.outlier_score.toFixed(1)} (${top.niche})`
            : `Dont "${top.video.title}" (${top.channel_title}, x${top.video.outlier_score.toFixed(1)})`,
      });

      const updated = [...notifiedSet, ...fresh.map((o) => o.video.youtube_video_id)].slice(-500);
      await chrome.storage.local.set({ notifiedIds: updated });
    }
  } catch (e) {
    // backend probablement injoignable (pas lancé, ou URL mal configurée) : on ne bruite pas l'utilisateur
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const videoId = notificationId.replace("outlier-", "");
  chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
});
