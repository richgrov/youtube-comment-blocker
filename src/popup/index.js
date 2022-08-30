const BLOCKED_KEY = "blocked-";

function getActiveTabId() {
    return new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            resolve(tabs[0].id);
        });
    });
}

function createFilterEntry(channelName, channelUrl) {
    const el = document.createElement("span");
    el.innerHTML = channelName;

    el.onclick = () => {
        chrome.tabs.create({
            active: true,
            url: "https://youtube.com" + channelUrl
        });
    };

    return el;
}

function createTextEntry(message) {
    const el = document.createElement("p");
    el.style.color = "gray";
    el.style.textAlign = "center";
    el.innerHTML = message;
    return el;
}

async function onFilterPage() {
    const thisTabId = await getActiveTabId();

    const listEl = document.querySelector("#filter-list");
    listEl.replaceChildren();

    chrome.tabs.sendMessage(thisTabId, { id: "query-blocked" }, {}, response => {
        console.log(response);
        if (response === undefined || Object.keys(response.data).length === 0) {
            listEl.appendChild(
                createTextEntry("No comments have been blocked on this page yet.")
            );
        } else {
            for (const key in response.data) {
                listEl.appendChild(createFilterEntry(response.data[key], key));
            }
        }
    });
}

async function onFilterAll() {
    const listEl = document.querySelector("#filter-list");
    listEl.replaceChildren();

    chrome.storage.local.get(null, response => {
        if (response.length === 0) {
            listEl.appendChild(createTextEntry("There are no blocked users."));
        } else {
            for (const key in response) {
                if (key.startsWith(BLOCKED_KEY)) {
                    listEl.appendChild(
                        createFilterEntry(response[key].name, key.substring(BLOCKED_KEY.length))
                    );
                }
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#input-filter-page").addEventListener("change", onFilterPage);
    document.querySelector("#input-filter-all").addEventListener("change", onFilterAll);
});
