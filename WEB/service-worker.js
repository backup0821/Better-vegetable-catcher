const CACHE_NAME = 'vegetable-market-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 背景通知檢查間隔（每小時檢查一次）
const BACKGROUND_CHECK_INTERVAL = 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 處理通知點擊事件
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // 點擊通知時聚焦到應用程式
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// 背景同步事件處理
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-notifications') {
        event.waitUntil(checkBackgroundNotifications());
    }
});

// 定期檢查通知
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications-periodic') {
        event.waitUntil(checkBackgroundNotifications());
    }
});

// 背景通知檢查函數
async function checkBackgroundNotifications() {
    try {
        // 檢查市場休市通知
        const marketRestResponse = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
        const marketRestData = await marketRestResponse.json();
        
        const now = new Date();
        const currentYearMonth = now.getFullYear().toString().slice(-2) + 
                                (now.getMonth() + 1).toString().padStart(2, '0');
        const currentDay = now.getDate().toString().padStart(2, '0');

        marketRestData.forEach(market => {
            if (market.YearMonth === currentYearMonth) {
                const restDays = market.ClosedDate.split('、');
                if (restDays.includes(currentDay)) {
                    self.registration.showNotification('市場休市通知', {
                        body: `${market.MarketName} ${market.MarketType}市場今日休市`,
                        icon: './image/icon-192.png',
                        badge: './image/icon-192.png',
                        vibrate: [200, 100, 200],
                        tag: `market-rest-${market.MarketNo}-${market.MarketType}`
                    });
                }
            }
        });

        // 檢查一般通知
        const notificationResponse = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notfiy.json');
        const notifications = await notificationResponse.json();
        
        notifications.forEach(notification => {
            // 只處理公開通知
            if (!notification.public) {
                return;
            }
            
            // 檢查是否為特定裝置的通知
            const isTargetedDevice = notification.targetDevices && notification.targetDevices.length > 0;
            const isForEveryone = notification.targetDevices && notification.targetDevices.includes('everyone');
            
            if (isTargetedDevice && !isForEveryone && !notification.targetDevices.includes(deviceId)) {
                return;
            }
            
            // 解析時間範圍
            const [startTime, endTime] = notification.time.split(' ~ ');
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            
            // 檢查通知是否過期
            if (now > endDate) {
                return;
            }
            
            // 檢查當前時間是否在通知時間範圍內
            if (now >= startDate && now <= endDate) {
                // 計算剩餘時間
                const timeLeft = endDate - now;
                const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                let timeLeftText = '';
                if (daysLeft > 0) {
                    timeLeftText = `剩餘 ${daysLeft} 天`;
                } else if (hoursLeft > 0) {
                    timeLeftText = `剩餘 ${hoursLeft} 小時`;
                } else {
                    timeLeftText = '即將過期';
                }
                
                // 發送 Service Worker 通知
                self.registration.showNotification(notification.title, {
                    body: `${notification.messenge}\n${timeLeftText}`,
                    icon: './image/icon-192.png',
                    badge: './image/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: notification.id,
                    requireInteraction: true,
                    data: {
                        isPublic: true,
                        isTargetedDevice: isTargetedDevice && !isForEveryone,
                        message: notification.messenge,
                        timeLeft: timeLeftText
                    }
                });
            }
        });
    } catch (error) {
        console.error('背景通知檢查失敗:', error);
    }
}

// 註冊定期同步
self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.registration.periodicSync.register('check-notifications-periodic', {
            minInterval: BACKGROUND_CHECK_INTERVAL
        })
    );
});