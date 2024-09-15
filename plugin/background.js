let socket;
let isReconnecting = false;

function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8888/websocket');

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const url = data.url;
        const futureId = data.future_id;

        // Open a new tab to fetch the HTML
        chrome.tabs.create({ url: url }, function(tab) {
            const tabId = tab.id;

            // Set a timeout for the fetch operation
            const fetchTimeout = setTimeout(() => {
                chrome.tabs.remove(tabId);
                sendResponse(futureId, null);
            }, 5000);

            // Listen for the tab to finish loading
            chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    clearTimeout(fetchTimeout);

                    // Get the HTML content of the tab
                    chrome.tabs.executeScript(tabId, { code: 'document.documentElement.outerHTML' }, function(result) {
                        const html = result[0];
                        chrome.tabs.remove(tabId);
                        sendResponse(futureId, html);
                    });
                }
            });
        });
    };

    socket.onclose = function(event) {
        if (!isReconnecting) {
            isReconnecting = true;
            console.log('WebSocket closed. Reconnecting in 5 seconds...');
            setTimeout(connectWebSocket, 5000);
        }
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function sendResponse(futureId, html) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ future_id: futureId, html: html }));
    } else {
        console.error('WebSocket is not open. Cannot send response.');
    }
}

connectWebSocket();
