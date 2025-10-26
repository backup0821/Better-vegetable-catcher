// 常數定義
const API_BASE_URL = 'https://api.example.com'; // 請替換為實際的 API 網址
const UPDATE_INTERVAL = 60000; // 1分鐘更新一次
const NOTIFICATION_INTERVAL = 30000; // 30秒更新一次通知

// 全域變數
let currentDeviceId = localStorage.getItem('deviceId');
let currentMarket = null;
let priceData = [];
let notifications = [];

// DOM 元素
const priceDisplay = document.querySelector('.price-display');
const notificationArea = document.querySelector('.notification');
const timestampElement = document.querySelector('.timestamp');

// 初始化
async function initialize() {
    if (!currentDeviceId) {
        showDeviceSetupDialog();
    } else {
        await fetchMarketInfo();
        startUpdates();
    }
    updateTimestamp();
    setInterval(updateTimestamp, 1000);
}

// 顯示裝置設定對話框
function showDeviceSetupDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'device-setup-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h2>裝置設定</h2>
            <p>請輸入您的裝置 ID 以開始使用</p>
            <input type="text" id="deviceIdInput" placeholder="請輸入裝置 ID">
            <div class="dialog-buttons">
                <button onclick="saveDeviceId()">確認</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
}

// 儲存裝置 ID
async function saveDeviceId() {
    const deviceIdInput = document.getElementById('deviceIdInput');
    const deviceId = deviceIdInput.value.trim();
    
    if (!deviceId) {
        showError('請輸入有效的裝置 ID');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/verify`);
        if (!response.ok) {
            throw new Error('無效的裝置 ID');
        }

        localStorage.setItem('deviceId', deviceId);
        currentDeviceId = deviceId;
        document.querySelector('.device-setup-dialog').remove();
        await fetchMarketInfo();
        startUpdates();
    } catch (error) {
        showError(error.message);
    }
}

// 顯示錯誤訊息
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 3000);
}

// 獲取市場資訊
async function fetchMarketInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/devices/${currentDeviceId}/market`);
        if (!response.ok) {
            throw new Error('無法獲取市場資訊');
        }
        currentMarket = await response.json();
        document.querySelector('header h1').textContent = currentMarket.name;
        document.querySelector('header p').textContent = currentMarket.description;
    } catch (error) {
        showError(error.message);
    }
}

// 獲取價格資料
async function fetchPriceData() {
    try {
        const response = await fetch(`${API_BASE_URL}/markets/${currentMarket.id}/prices`);
        if (!response.ok) {
            throw new Error('無法獲取價格資料');
        }
        priceData = await response.json();
        updatePriceDisplay();
    } catch (error) {
        showError(error.message);
    }
}

// 獲取通知
async function fetchNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/markets/${currentMarket.id}/notifications`);
        if (!response.ok) {
            throw new Error('無法獲取通知');
        }
        notifications = await response.json();
        updateNotificationDisplay();
    } catch (error) {
        showError(error.message);
    }
}

// 更新價格顯示
function updatePriceDisplay() {
    priceDisplay.innerHTML = priceData.map(item => `
        <div class="price-card">
            <h3>${item.name}</h3>
            <div class="price-value">${item.price}</div>
            <div class="market">${item.market}</div>
        </div>
    `).join('');
}

// 更新通知顯示
function updateNotificationDisplay() {
    if (notifications.length > 0) {
        notificationArea.textContent = notifications[0].message;
    }
}

// 更新時間戳
function updateTimestamp() {
    const now = new Date();
    timestampElement.textContent = now.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// 開始定期更新
function startUpdates() {
    fetchPriceData();
    fetchNotifications();
    setInterval(fetchPriceData, UPDATE_INTERVAL);
    setInterval(fetchNotifications, NOTIFICATION_INTERVAL);
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', initialize); 