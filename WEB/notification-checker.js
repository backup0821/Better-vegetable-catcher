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

// 建立並啟動通知檢查器
const checker = new NotificationChecker();
checker.init(); 