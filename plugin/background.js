let socket;
let isReconnecting = false;
let pingInterval;

/**
 * 初始化 WebSocket 连接。
 */
async function initializeWebSocket() {
    socket = new WebSocket('ws://localhost:8888/websocket');
    socket.onmessage = handleWebSocketMessage;
    socket.onclose = handleWebSocketClose;
    socket.onerror = handleWebSocketError;
    startPingInterval();
}

/**
 * 处理传入的 WebSocket 消息。
 * @param {MessageEvent} event - WebSocket 消息事件。
 */
let requestList = [];

async function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    const url = data.url;
    const futureId = data.future_id;

    const tab = await new Promise((resolve) => {
        chrome.tabs.create({ url: url }, resolve);
    });

    const tabId = tab.id;

    const fetchTimeout = setTimeout(() => {
        chrome.tabs.remove(tabId);
        sendResponse(futureId, null);
    }, 5000);

    chrome.tabs.onUpdated.addListener(async function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(fetchTimeout);

            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    document.title = "由aider加载: " + document.title;
                    return document.documentElement.outerHTML;
                },
            });
            const html = result[0].result;
            chrome.tabs.remove(tabId);
            sendResponse(futureId, html);

            // Add the URL and time to the request list
            const now = new Date();
            const timeString = now.toLocaleString();
            requestList.unshift({ url, time: timeString });
            updateRequestList();
        }
    });
}

function updateRequestList() {
    const listElement = document.getElementById('request-list');
    listElement.innerHTML = '';
    requestList.forEach(request => {
        const li = document.createElement('li');
        li.textContent = `${request.time} - ${request.url}`;
        listElement.appendChild(li);
    });
}

/**
 * 处理 WebSocket 关闭。
 * @param {CloseEvent} event - WebSocket 关闭事件。
 */
async function handleWebSocketClose(event) {
    if (!isReconnecting) {
        isReconnecting = true;
        console.log('WebSocket 已关闭。5 秒后重新连接...');
        clearInterval(pingInterval);
        setTimeout(initializeWebSocket, 5000);
    }
}

/**
 * 处理 WebSocket 错误。
 * @param {Event} error - WebSocket 错误事件。
 */
async function handleWebSocketError(error) {
    console.error('WebSocket 错误:', error);
    if (!isReconnecting) {
        isReconnecting = true;
        console.log('检测到 WebSocket 错误。5 秒后重新连接...');
        clearInterval(pingInterval);
        setTimeout(initializeWebSocket, 5000);
    }
}

/**
 * 启动 ping 间隔以检测错误。
 */
function startPingInterval() {
    pingInterval = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket 未打开。重新连接...');
            clearInterval(pingInterval);
            initializeWebSocket();
        } else {
            socket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 3000);
}

/**
 * 通过 WebSocket 将响应发送回服务器。
 * @param {string} futureId - 未来的唯一 ID。
 * @param {string} html - 要发送的 HTML 内容。
 */
function sendResponse(futureId, html) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ future_id: futureId, html: html }));
    } else {
        console.error('WebSocket 未打开。无法发送响应。');
    }
}

initializeWebSocket();

// Move the content of the <script> tag from index.html to background.js
document.getElementById('clear-list').addEventListener('click', function() {
    document.getElementById('request-list').innerHTML = '';
});
