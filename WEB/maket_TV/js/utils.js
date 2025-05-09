// 工具函數
const Utils = {
    // 日期時間格式化
    formatDateTime(date) {
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    },

    // 格式化數字（添加千分位）
    formatNumber(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    // 格式化價格
    formatPrice(price) {
        return `NT$ ${this.formatNumber(price)}`;
    },

    // 格式化交易量
    formatVolume(volume) {
        return `${this.formatNumber(volume)} 公斤`;
    },

    // 獲取最新日期
    getLatestDate(data) {
        if (!data || data.length === 0) return null;
        return new Date(Math.max(...data.map(item => new Date(item.交易日期))));
    },

    // 過濾市場數據
    filterMarketData(data, marketName) {
        if (!data || !marketName) return [];
        return data.filter(item => item.市場名稱 === marketName);
    },

    // 排序價格數據
    sortPriceData(data) {
        if (!data) return [];
        return [...data].sort((a, b) => Number(b.平均價) - Number(a.平均價));
    },

    // 顯示錯誤訊息
    showError(message, duration = 3000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), duration);
    },

    // 顯示通知
    showNotification(message, type = 'info') {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        notification.textContent = message;

        notificationList.appendChild(notification);
        
        // 限制通知數量
        while (notificationList.children.length > CONFIG.DISPLAY.MAX_NOTIFICATIONS) {
            notificationList.removeChild(notificationList.firstChild);
        }

        // 自動移除通知
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 500);
        }, CONFIG.DISPLAY.NOTIFICATION_DURATION);
    },

    // 本地存儲操作
    storage: {
        get(key) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : null;
            } catch (error) {
                console.error('讀取本地存儲失敗:', error);
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('寫入本地存儲失敗:', error);
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('刪除本地存儲失敗:', error);
                return false;
            }
        }
    },

    // 防抖函數
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 節流函數
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}; 