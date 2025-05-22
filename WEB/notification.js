// 通知系統設定
const NOTIFICATION_CACHE_KEY = 'notification_cache';
const NOTIFICATION_CACHE_DURATION = 1000 * 60 * 60; // 1小時

// 通知優先級
const PRIORITY = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
};

// 獲取並顯示通知
async function fetchAndDisplayNotifications() {
    try {
        // 檢查快取
        const cachedData = getCachedNotifications();
        if (cachedData) {
            displayNotifications(cachedData);
            return;
        }

        // 從 API 獲取通知
        const response = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notify.json');
        const notifications = await response.json();
        
        // 快取通知
        cacheNotifications(notifications);
        
        // 顯示通知
        displayNotifications(notifications);
    } catch (error) {
        console.error('獲取通知時發生錯誤:', error);
        // 顯示錯誤通知
        showErrorNotification('無法載入通知，請稍後再試');
    }
}

// 快取通知
function cacheNotifications(notifications) {
    const cacheData = {
        timestamp: Date.now(),
        data: notifications
    };
    localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(cacheData));
}

// 獲取快取的通知
function getCachedNotifications() {
    const cached = localStorage.getItem(NOTIFICATION_CACHE_KEY);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > NOTIFICATION_CACHE_DURATION) {
        localStorage.removeItem(NOTIFICATION_CACHE_KEY);
        return null;
    }

    return data;
}

// 顯示通知
function displayNotifications(notifications) {
    const modal = document.getElementById('notificationModal');
    const notificationList = document.getElementById('notificationList');
    
    // 清空現有通知
    notificationList.innerHTML = '';
    
    // 獲取裝置 ID
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'DEV--' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }

    // 過濾並排序通知
    const currentTime = new Date();
    const validNotifications = notifications
        .filter(notification => {
            const startTime = new Date(notification.startTime);
            const endTime = new Date(notification.endTime);
            return currentTime >= startTime && 
                   currentTime <= endTime && 
                   (notification.public || 
                    notification.targetDevices.includes('everyone') || 
                    notification.targetDevices.includes(deviceId));
        })
        .sort((a, b) => {
            // 根據優先級排序
            const priorityA = a.priority || PRIORITY.MEDIUM;
            const priorityB = b.priority || PRIORITY.MEDIUM;
            return priorityB - priorityA;
        });

    if (validNotifications.length > 0) {
        showNotificationModal(validNotifications);
    }
}

// 顯示通知介面
function showNotificationModal(notifications) {
    const modal = document.getElementById('notificationModal');
    const notificationList = document.getElementById('notificationList');
    
    notifications.forEach(notification => {
        const endTime = new Date(notification.endTime);
        const currentTime = new Date();
        const remainingDays = Math.ceil((endTime - currentTime) / (1000 * 60 * 60 * 24));
        
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item';
        notificationItem.innerHTML = `
            <h3>${notification.title}</h3>
            <p>${notification.message}</p>
            <div class="remaining-time">有效期限：剩餘 ${remainingDays} 天</div>
        `;
        notificationList.appendChild(notificationItem);
    });
    
    modal.style.display = 'flex';
}

// 顯示錯誤通知
function showErrorNotification(message) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <h4>錯誤</h4>
        <p>${message}</p>
    `;
    notificationArea.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// 關閉通知介面
document.getElementById('closeNotificationBtn').addEventListener('click', () => {
    document.getElementById('notificationModal').style.display = 'none';
});

// 在頁面載入時獲取通知
window.addEventListener('load', () => {
    fetchAndDisplayNotifications();
});

// 推播通知相關功能
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // 獲取 FCM token
            const token = await messaging.getToken({
                vapidKey: 'YOUR_VAPID_KEY'
            });
            
            // 儲存 token
            localStorage.setItem('fcmToken', token);
            
            // 可以將 token 發送到後端
            await sendTokenToServer(token);
            
            console.log('推播通知已啟用');
            return true;
        } else {
            console.log('推播通知權限被拒絕');
            return false;
        }
    } catch (error) {
        console.error('請求推播通知權限時發生錯誤:', error);
        return false;
    }
}

// 發送 token 到後端
async function sendTokenToServer(token) {
    try {
        const response = await fetch('YOUR_BACKEND_API/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                deviceId: localStorage.getItem('deviceId')
            })
        });
        
        if (!response.ok) {
            throw new Error('發送 token 失敗');
        }
        
        console.log('Token 已成功發送到後端');
    } catch (error) {
        console.error('發送 token 到後端時發生錯誤:', error);
    }
}

// 監聽推播通知
messaging.onMessage((payload) => {
    console.log('收到推播通知:', payload);
    
    // 顯示通知
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/image/png/icon-192.png',
        badge: '/image/png/icon-192.png',
        data: payload.data
    };
    
    // 顯示網頁通知
    new Notification(notificationTitle, notificationOptions);
});

// 監聽 token 更新
messaging.onTokenRefresh(async () => {
    try {
        const newToken = await messaging.getToken();
        localStorage.setItem('fcmToken', newToken);
        await sendTokenToServer(newToken);
        console.log('Token 已更新');
    } catch (error) {
        console.error('更新 token 時發生錯誤:', error);
    }
});

// 在頁面載入時請求通知權限
window.addEventListener('load', async () => {
    // 檢查是否支援推播通知
    if ('Notification' in window && 'serviceWorker' in navigator) {
        const permission = await requestNotificationPermission();
        if (permission) {
            // 顯示已啟用通知的提示
            showNotification('推播通知已啟用', '您將收到重要的系統通知');
        }
    }
});

// 顯示通知提示
function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <h4>${title}</h4>
        <p>${message}</p>
    `;
    document.getElementById('notificationArea').appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
} 