let socket;
let isReconnecting = false;
let pingInterval;

/**
 * Initializes the WebSocket connection.
 */
function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8888/websocket');
    socket.onmessage = handleWebSocketMessage;
    socket.onclose = handleWebSocketClose;
    socket.onerror = handleWebSocketError;
    startPingInterval();
}

/**
 * Handles incoming WebSocket messages.
 * @param {MessageEvent} event - The WebSocket message event.
 */
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    const url = data.url;
    const futureId = data.future_id;

    chrome.tabs.create({ url: url }, function(tab) {
        const tabId = tab.id;

        const fetchTimeout = setTimeout(() => {
            chrome.tabs.remove(tabId);
            sendResponse(futureId, null);
        }, 5000);

        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(fetchTimeout);

                chrome.tabs.executeScript(tabId, { code: 'document.documentElement.outerHTML' }, function(result) {
                    const html = result[0];
                    chrome.tabs.remove(tabId);
                    sendResponse(futureId, html);
                });
            }
        });
    });
}

/**
 * Handles WebSocket closure.
 * @param {CloseEvent} event - The WebSocket close event.
 */
function handleWebSocketClose(event) {
    if (!isReconnecting) {
        isReconnecting = true;
        console.log('WebSocket closed. Reconnecting in 5 seconds...');
        clearInterval(pingInterval);
        setTimeout(initializeWebSocket, 5000);
    }
}

/**
 * Handles WebSocket errors.
 * @param {Event} error - The WebSocket error event.
 */
function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    if (!isReconnecting) {
        isReconnecting = true;
        console.log('WebSocket error detected. Reconnecting in 5 seconds...');
        clearInterval(pingInterval);
        setTimeout(initializeWebSocket, 5000);
    }
}

/**
 * Starts the ping interval to detect errors.
 */
function startPingInterval() {
    pingInterval = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket is not open. Reconnecting...');
            clearInterval(pingInterval);
            initializeWebSocket();
        } else {
            socket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 3000);
}

/**
 * Sends the response back to the server via WebSocket.
 * @param {string} futureId - The unique ID of the future.
 * @param {string} html - The HTML content to send.
 */
function sendResponse(futureId, html) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ future_id: futureId, html: html }));
    } else {
        console.error('WebSocket is not open. Cannot send response.');
    }
}

initializeWebSocket();
