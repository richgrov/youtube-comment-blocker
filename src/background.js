/** @type {Record<number, string>} */
const videoIds = {};

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete' || !tab.url.startsWith('https://www.youtube.com/')) {
        return;
    }

    const videoId = new URL(tab.url).searchParams.get('v');

    if (videoIds[tabId] !== videoId) {
        chrome.tabs.sendMessage(tabId, { id: 'reset-block-list' }, {});
    }

    videoIds[tabId] = videoId;
});

chrome.tabs.onRemoved.addListener(tabId => {
    delete videoIds[tabId];
});
