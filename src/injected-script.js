/**
 * Returns a Promise that resolves when an element with the given selector is
 * added to the document.
 * 
 * @param {string} selector
 * @return {Promise<HTMLElement>} 
 */
async function waitForElement(selector) {
    return new Promise(resolve => {
        let element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            element = document.querySelector(selector)
            if (element) {
                resolve(element);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

/**
 * Gets if the provided node is part of the drop-down menu (three dots) for a
 * comment. Returns the top-most node of the menu. (Because the UI is deeply
 * nested.)
 * 
 * @param {Node} node 
 * @returns {HTMLElement}
 */
function getMenuNode(node) {
    if (node instanceof HTMLElement && node.tagName === 'DIV') {

        const classes = node.classList;
        if (node.id === 'flexible-item-buttons' &&
            classes.contains('style-scope') &&
            classes.contains('ytd-menu-renderer')) {

            return node.parentElement;
        }
    }
}

/**
 * Gets if the provided node is the root-node of a comment.
 * 
 * @param {Node} node
 * @returns {boolean}
 */
function isCommentNode(node) {
    // Techincally speaking, the root node is sometimes
    // ytd-comment-thread-renderer, but this is only present on top-level
    // comments so it doesn't work.
    return node instanceof HTMLElement && node.tagName === 'YTD-COMMENT-RENDERER';
}

/**
 * Removes an entire comment node. If this is a top-level comment, it will also
 * delete the replies menu.
 *
 * @param {HTMLElement} node 
 */
function removeCommentNode(node) {
    if (node.parentElement.tagName === 'YTD-COMMENT-THREAD-RENDERER') {
        node.parentElement.remove();
    } else {
        node.remove();
    }
}

function getCommentInfo(node) {
    const authorElement = node.querySelector('#author-text');
    const channelUrl = authorElement.getAttribute('href');

    return {
        channelUrl,
        storageKey: 'blocked-' + channelUrl,
        channelName: authorElement.firstElementChild.innerText.trim(),
    };
}

/** @type {HTMLElement} */
let selectedCommentNode = null;

/** @type {Record<string, string>} */
let blockList = {};

/**
 * Called when a new Node is added to the comments section.
 * @param {Node} node 
 */
function onCommentNodeAdded(node) {
    const menuEl = getMenuNode(node);
    if (menuEl) {
        // This is the three dots menu. Add a listener to update the
        // selectedCommentNode so we know which comment to delete.
        menuEl.addEventListener('click', () => {
            selectedCommentNode = menuEl.parentElement.parentElement.parentElement;
        });
    } else if (isCommentNode(node)) {
        // This is a comment. Check if the user is blocked.
        const { channelUrl, storageKey, channelName } = getCommentInfo(node);

        chrome.storage.local.get(storageKey, result => {
            if (Object.keys(result).length !== 0) {
                blockList[channelUrl] = channelName;
                removeCommentNode(node);
            }
        });
    }
}

// Listen for changes to the comment section.
waitForElement('ytd-comments#comments').then(root => {
    new MutationObserver(mutationRecords => {
        mutationRecords.forEach(record => record.addedNodes.forEach(onCommentNodeAdded));
    }).observe(root, { childList: true, subtree: true });
});

// Wait for the drop-down menu to be created. Only need to listen once.
waitForElement('ytd-menu-service-item-renderer').then(root => {
    // Create the 'Block' button
    const button = document.createElement('p');
    button.innerHTML = '<span class="ytcb-icon">&#10006;</span> Block';
    button.classList.add('ytcb-button');

    button.onclick = () => {
        if (selectedCommentNode) {
            removeCommentNode(selectedCommentNode);

            root.parentElement.parentElement.parentElement.parentElement.style.display = 'none';

            // UI thinks the menu is still open. Spoof a click event to prevent
            // the scroll bar from locking up.
            document.body.click();

            const { channelUrl, storageKey, channelName } = getCommentInfo(selectedCommentNode);
            const data = {};

            blockList[channelUrl] = channelName;
            data[storageKey] = { name: channelName };

            chrome.storage.local.set(data);
        }
    };

    root.parentElement.appendChild(button);
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    switch (message.id) {
        case 'query-blocked':
            sendResponse({ data: blockList });
            break;

        case 'reset-block-list':
            // The background script will send this message when the URL
            // changes. Necessary because YouTube is a SPA.
            blockList = {};
            break;
    }
});
