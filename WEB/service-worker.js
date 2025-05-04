const CACHE_NAME = 'vegetable-catcher-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 背景通知檢查間隔（每5分鐘檢查一次）
const BACKGROUND_CHECK_INTERVAL = 5 * 60 * 1000;

// 推送通知的 VAPID 公鑰
const VAPID_PUBLIC_KEY = 'BFYqvIzvnaOJRZGbzp9PGcwZ-MJkpLV1mTFU95cT4qITH7as3TMqzaYQTvVQq2FgzQ3F_A_J3xfy_sKfjBPTWPE';

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 啟用 Service Worker
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

// 處理 fetch 請求
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

// 處理推送通知
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: '開啟應用程式'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// 處理訂閱變更
self.addEventListener('pushsubscriptionchange', (event) => {
  const subscription = event.newSubscription || event.oldSubscription;
  if (subscription) {
    event.waitUntil(
      fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      })
    );
  }
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
    console.log('開始背景通知檢查...');
    
    // 檢查市場休市通知
    try {
      const marketRestResponse = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
      if (!marketRestResponse.ok) {
        throw new Error(`市場休市 API 請求失敗: ${marketRestResponse.status}`);
      }
      const marketRestData = await marketRestResponse.json();
      
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // 檢查今天和明天的日期
      const datesToCheck = [now, tomorrow];
      
      datesToCheck.forEach(date => {
        const yearMonth = date.getFullYear().toString().slice(-2) + 
                         (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        marketRestData.forEach(market => {
          if (market.YearMonth === yearMonth) {
            const restDays = market.ClosedDate.split('、');
            if (restDays.includes(day)) {
              const isTomorrow = date.getDate() === tomorrow.getDate();
              self.registration.showNotification('市場休市通知', {
                body: `${market.MarketName} ${market.MarketType}市場${isTomorrow ? '明天' : '今天'}休市`,
                icon: './icon-192.png',
                badge: './icon-192.png',
                vibrate: [200, 100, 200],
                tag: `market-rest-${market.MarketNo}-${market.MarketType}-${isTomorrow ? 'tomorrow' : 'today'}`,
                requireInteraction: true
              });
            }
          }
        });
      });
    } catch (error) {
      console.error('市場休市通知檢查失敗:', error);
    }

    // 檢查一般通知
    let allNotifications = [];
    
    // 從本地檔案讀取通知
    try {
      const localResponse = await fetch('./notfiy.json', {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (localResponse.ok) {
        const localNotifications = await localResponse.json();
        allNotifications = allNotifications.concat(localNotifications);
      }
    } catch (error) {
      console.error('讀取本地通知檔案失敗:', error);
    }
    
    // 從 API 讀取通知
    try {
      const apiResponse = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notfiy.json', {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (apiResponse.ok) {
        const apiNotifications = await apiResponse.json();
        allNotifications = allNotifications.concat(apiNotifications);
      }
    } catch (error) {
      console.error('讀取 API 通知失敗:', error);
    }
    
    allNotifications.forEach(notification => {
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
          icon: './icon-192.png',
          badge: './icon-192.png',
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
    Promise.all([
      // 註冊定期同步
      self.registration.periodicSync.register('check-notifications-periodic', {
        minInterval: BACKGROUND_CHECK_INTERVAL
      }),
      // 立即執行一次檢查
      checkBackgroundNotifications()
    ])
  );
});

// 設置定期檢查
setInterval(checkBackgroundNotifications, BACKGROUND_CHECK_INTERVAL);