const CACHE_NAME = 'vegetable-catcher-v2';
const ICON_CACHE_NAME = 'icon-cache-v2';
const ASSETS_TO_CACHE = [
    '/Better-vegetable-catcher/WEB/',
    '/Better-vegetable-catcher/WEB/index.html',
    '/Better-vegetable-catcher/WEB/assets/styles.min.css',
    '/Better-vegetable-catcher/WEB/assets/style.min.css',
    '/Better-vegetable-catcher/WEB/assets/script.min.js',
    '/Better-vegetable-catcher/WEB/assets/notification.min.js',
    '/Better-vegetable-catcher/WEB/assets/notification-checker.min.js',
    '/Better-vegetable-catcher/WEB/manifest.json',
    '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
    '/Better-vegetable-catcher/WEB/image/png/icon2-192.png',
    '/Better-vegetable-catcher/WEB/image/png/icon-512.png',
    '/Better-vegetable-catcher/WEB/image/png/favicon.ico'
];

// 背景通知檢查間隔（每5分鐘檢查一次）
const BACKGROUND_CHECK_INTERVAL = 5 * 60 * 1000;

// 推送通知的 VAPID 公鑰
const VAPID_PUBLIC_KEY = 'BFYqvIzvnaOJRZGbzp9PGcwZ-MJkpLV1mTFU95cT4qITH7as3TMqzaYQTvVQq2FgzQ3F_A_J3xfy_sKfjBPTWPE';

// Firebase Cloud Messaging 設定
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 初始化 Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBu7K1CL3UC2Gtd36Snj7bxJoMLD43-J9o",
  authDomain: "pwa-notice.firebaseapp.com",
  projectId: "pwa-notice",
  storageBucket: "pwa-notice.firebasestorage.app",
  messagingSenderId: "347013597846",
  appId: "1:347013597846:web:4c20ebcbdc5c7da68010b7",
  measurementId: "G-3B9FBQ2WZ6"
});

const messaging = firebase.messaging();

// 獲取當前圖標
async function getCurrentIcon() {
  try {
    // Service Worker 無法直接存取 localStorage，使用預設圖標
    // 實際圖標會通過主線程傳遞
    return '/Better-vegetable-catcher/WEB/image/png/icon-192.png';
  } catch (error) {
    console.error('獲取圖標失敗:', error);
    return '/Better-vegetable-catcher/WEB/image/png/icon-192.png';
  }
}

// 當前圖標快取
let currentIconPath = '/Better-vegetable-catcher/WEB/image/png/icon-192.png';

// 更新當前圖標
function updateCurrentIcon(iconKey) {
  const iconMap = {
    icon1: '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
    icon2: '/Better-vegetable-catcher/WEB/image/png/icon2-192.png',
    icon3: '/Better-vegetable-catcher/WEB/image/png/icon-512.png'
  };
  currentIconPath = iconMap[iconKey] || iconMap.icon1;
  console.log('✅ Service Worker 圖標已更新為:', currentIconPath);
}

// 安裝 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME)
                .then((cache) => {
                    console.log('快取已開啟');
                    return cache.addAll(ASSETS_TO_CACHE);
                }),
            caches.open(ICON_CACHE_NAME)
                .then((cache) => {
                    console.log('圖標快取已開啟');
                    return cache.addAll([
                        '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
                        '/Better-vegetable-catcher/WEB/image/png/icon2-192.png',
                        '/Better-vegetable-catcher/WEB/image/png/icon-512.png'
                    ]);
                })
        ])
    );
});

// 啟動 Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== ICON_CACHE_NAME) {
                            console.log('刪除舊快取：', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // 立即更新圖標快取
            updateIconCache()
        ])
    );
});

// 更新圖標快取
async function updateIconCache() {
    try {
        const iconCache = await caches.open(ICON_CACHE_NAME);
        const iconUrls = [
            '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
            '/Better-vegetable-catcher/WEB/image/png/icon2-192.png',
            '/Better-vegetable-catcher/WEB/image/png/icon-512.png'
        ];
        
        for (const url of iconUrls) {
            try {
                await iconCache.add(url);
            } catch (error) {
                console.warn('圖標快取失敗:', url, error);
            }
        }
        
        console.log('✅ 圖標快取已更新');
    } catch (error) {
        console.error('❌ 更新圖標快取失敗:', error);
    }
}

// ETag 處理
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Use cache-first for same-origin static assets
    const isStaticAsset = requestUrl.origin === location.origin && (
        requestUrl.pathname.startsWith('/Better-vegetable-catcher/WEB/assets/') ||
        requestUrl.pathname.endsWith('.css') ||
        requestUrl.pathname.endsWith('.js') ||
        requestUrl.pathname.endsWith('.ico') ||
        requestUrl.pathname.includes('/image/png/') ||
        requestUrl.pathname.endsWith('.html')
    );

    if (isStaticAsset) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    return response;
                }).catch(() => caches.match('/Better-vegetable-catcher/WEB/index.html'));
            })
        );
        return;
    }

    // Network-first for external APIs and other requests
    event.respondWith(
        fetch(event.request).then((response) => {
            return response;
        }).catch(() => caches.match(event.request))
    );
});

// 處理推播事件
self.addEventListener('push', async (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: currentIconPath,
            badge: currentIconPath,
            data: data.data || {},
            actions: [
                {
                    action: 'explore',
                    title: '查看詳情',
                    icon: currentIconPath
                },
                {
                    action: 'close',
                    title: '關閉',
                    icon: currentIconPath
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/Better-vegetable-catcher/WEB/')
        );
    }
});

// 處理背景訊息
messaging.onBackgroundMessage(async (payload) => {
  console.log('收到背景訊息:', payload);
  
  const notificationTitle = payload.notification.title;
  
  const notificationOptions = {
    body: payload.notification.body,
    icon: currentIconPath,
    badge: currentIconPath,
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 監聽來自主線程的圖標更新訊息
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_ICON') {
        console.log('收到圖標更新訊息:', event.data.iconKey);
        updateCurrentIcon(event.data.iconKey);
        updateIconCache();
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
      
      // 用於儲存下次休市日
      let nextRestDay = null;
      let nextRestMarket = null;
      
      // 收集所有需要顯示的通知
      let notificationsToShow = [];
      
      datesToCheck.forEach(date => {
        const yearMonth = date.getFullYear().toString().slice(-2) + 
                         (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        marketRestData.forEach(market => {
          if (market.YearMonth === yearMonth) {
            const restDays = market.ClosedDate.split('、');
            if (restDays.includes(day)) {
              const isTomorrow = date.getDate() === tomorrow.getDate();
              const notification = {
                title: '市場休市通知',
                messenge: `${market.MarketName} ${market.MarketType}市場${isTomorrow ? '明天' : '今天'}休市`,
                time: `${now.toISOString()} ~ ${now.toISOString()}`,
                public: true,
                targetDevices: ['everyone'],
                isMarketRest: true,
                marketInfo: market
              };
              notificationsToShow.push(notification);
            } else {
              // 尋找下次休市日
              const futureRestDays = restDays.filter(d => parseInt(d) > parseInt(day));
              if (futureRestDays.length > 0) {
                const nextDay = Math.min(...futureRestDays.map(d => parseInt(d)));
                const nextRestDate = new Date(date);
                nextRestDate.setDate(nextDay);
                
                if (!nextRestDay || nextRestDate < nextRestDay) {
                  nextRestDay = nextRestDate;
                  nextRestMarket = market;
                }
              }
            }
          }
        });
      });

      // 如果有找到下次休市日，發送通知
      if (nextRestDay && nextRestMarket) {
        const daysUntilRest = Math.ceil((nextRestDay - now) / (1000 * 60 * 60 * 24));
        const nextRestNotification = {
          title: '下次休市日通知',
          messenge: `${nextRestMarket.MarketName} ${nextRestMarket.MarketType}市場將於${daysUntilRest}天後（${nextRestDay.getMonth() + 1}月${nextRestDay.getDate()}日）休市`,
          time: `${now.toISOString()} ~ ${now.toISOString()}`,
          public: true,
          targetDevices: ['everyone'],
          isMarketRest: true,
          marketInfo: nextRestMarket
        };
        notificationsToShow.push(nextRestNotification);
      }

      // 發送網頁通知
      if (notificationsToShow.length > 0) {
        // 通知所有客戶端顯示通知
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'showNotifications',
            notifications: notificationsToShow
          });
        });
        
        // 如果沒有找到任何客戶端，嘗試在下次有客戶端時發送
        if (clients.length === 0) {
          // 儲存待發送的通知
          const pendingNotifications = await caches.open('notifications-cache');
          await pendingNotifications.put('pending', new Response(JSON.stringify(notificationsToShow)));
        }
      }
    } catch (error) {
      console.error('市場休市通知檢查失敗:', error);
    }
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
      checkBackgroundNotifications(),
      // 檢查是否有待發送的通知
      checkPendingNotifications()
    ])
  );
});

// 檢查待發送的通知
async function checkPendingNotifications() {
  try {
    const pendingNotifications = await caches.open('notifications-cache');
    const response = await pendingNotifications.match('pending');
    if (response) {
      const notifications = await response.json();
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length > 0) {
        clients.forEach(client => {
          client.postMessage({
            type: 'showNotifications',
            notifications: notifications
          });
        });
        // 清除已發送的通知
        await pendingNotifications.delete('pending');
      }
    }
  } catch (error) {
    console.error('檢查待發送通知失敗:', error);
  }
}

// 監聽客戶端連接事件
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'client-ready') {
    checkPendingNotifications();
  }
});

// 設置定期檢查
setInterval(checkBackgroundNotifications, BACKGROUND_CHECK_INTERVAL);