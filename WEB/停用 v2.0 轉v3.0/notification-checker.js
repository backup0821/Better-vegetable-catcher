// 通知檢查器
class NotificationChecker {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 每5分鐘檢查一次
        this.subscribers = [];
        this.notifications = [];
        this.lastCheck = null;
    }

    // 初始化
    async init() {
        try {
            // 載入訂閱者資訊
            const subscribersResponse = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/subscribe.json');
            const subscribersData = await subscribersResponse.json();
            this.subscribers = subscribersData.subscribers;

            // 載入通知資訊
            const notificationsResponse = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notifications.json');
            const notificationsData = await notificationsResponse.json();
            this.notifications = notificationsData.notifications;

            // 開始定期檢查
            this.startChecking();
        } catch (error) {
            console.error('初始化通知檢查器時發生錯誤:', error);
        }
    }

    // 開始定期檢查
    startChecking() {
        setInterval(() => this.checkNotifications(), this.checkInterval);
        this.checkNotifications(); // 立即執行一次檢查
    }

    // 檢查通知
    async checkNotifications() {
        try {
            const now = new Date();
            const validNotifications = this.notifications.filter(notification => {
                const startTime = new Date(notification.startTime);
                const endTime = new Date(notification.endTime);
                return now >= startTime && now <= endTime;
            });

            if (validNotifications.length > 0) {
                await this.sendNotifications(validNotifications);
            }

            this.lastCheck = now;
        } catch (error) {
            console.error('檢查通知時發生錯誤:', error);
        }
    }

    // 發送通知
    async sendNotifications(notifications) {
        for (const subscriber of this.subscribers) {
            for (const notification of notifications) {
                if (this.shouldSendToDevice(notification, subscriber.deviceId)) {
                    try {
                        await this.sendNotification(subscriber.subscription, notification);
                    } catch (error) {
                        console.error('發送通知時發生錯誤:', error);
                    }
                }
            }
        }
    }

    // 判斷是否應該發送給特定裝置
    shouldSendToDevice(notification, deviceId) {
        return notification.public || 
               notification.targetDevices.includes('everyone') || 
               notification.targetDevices.includes(deviceId);
    }

    // 發送單個通知
    async sendNotification(subscription, notification) {
        const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=YOUR_SERVER_KEY'
            },
            body: JSON.stringify({
                title: notification.title,
                body: notification.message,
                icon: '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
                data: {
                    url: '/Better-vegetable-catcher/WEB/',
                    notificationId: notification.id
                }
            })
        });

        if (!response.ok) {
            throw new Error('發送通知失敗');
        }
    }
}

// 測試功能
class NotificationTester {
    constructor() {
        this.checker = new NotificationChecker();
    }

    // 測試訂閱
    async testSubscription() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ 通知權限已授予');
                
                // 註冊 Service Worker
                const registration = await navigator.serviceWorker.register('/Better-vegetable-catcher/WEB/service-worker.js');
                console.log('✅ Service Worker 已註冊');
                
                // 獲取推播訂閱
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array('BO-QjkYMehAHI8suojRy1dBmOsrn0dwtgwt7rL4gWz_SbUqtN84VxcNiUn44xWRUAi7gmC-b9_MsbZfolV6UKuw')
                });
                console.log('✅ 推播訂閱成功');
                
                // 儲存訂閱資訊
                localStorage.setItem('pushSubscription', JSON.stringify(subscription));
                console.log('✅ 訂閱資訊已儲存');
                
                // 發送測試通知
                await this.sendTestNotification(subscription);
                
                return true;
            } else {
                console.log('❌ 通知權限被拒絕');
                return false;
            }
        } catch (error) {
            console.error('❌ 測試訂閱時發生錯誤:', error);
            return false;
        }
    }

    // 發送測試通知
    async sendTestNotification(subscription) {
        try {
            const response = await fetch(subscription.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'key=YOUR_SERVER_KEY'
                },
                body: JSON.stringify({
                    title: '測試通知',
                    body: '這是一則測試通知，用於驗證推播功能是否正常運作',
                    icon: '/Better-vegetable-catcher/WEB/image/png/icon-192.png',
                    data: {
                        url: '/Better-vegetable-catcher/WEB/',
                        notificationId: 'test-notification'
                    }
                })
            });

            if (response.ok) {
                console.log('✅ 測試通知已發送');
            } else {
                throw new Error('發送測試通知失敗');
            }
        } catch (error) {
            console.error('❌ 發送測試通知時發生錯誤:', error);
        }
    }

    // 測試通知檢查
    async testNotificationCheck() {
        try {
            await this.checker.init();
            console.log('✅ 通知檢查器已初始化');
            
            // 立即執行一次檢查
            await this.checker.checkNotifications();
            console.log('✅ 通知檢查已完成');
            
            return true;
        } catch (error) {
            console.error('❌ 測試通知檢查時發生錯誤:', error);
            return false;
        }
    }
}

// 建立測試器實例
const tester = new NotificationTester();

// 在頁面載入時執行測試
window.addEventListener('load', async () => {
    console.log('開始測試推播通知系統...');
    
    // 測試訂閱
    const subscriptionResult = await tester.testSubscription();
    console.log('訂閱測試結果:', subscriptionResult ? '成功' : '失敗');
    
    // 測試通知檢查
    const checkResult = await tester.testNotificationCheck();
    console.log('通知檢查測試結果:', checkResult ? '成功' : '失敗');
});

// 建立並啟動通知檢查器
const checker = new NotificationChecker();
checker.init(); 