// 工具函數
const Utils = {
    // 格式化日期
    formatDate(date) {
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    },

    // 格式化時間
    formatTime(date) {
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    // 格式化數字（加入千分位）
    formatNumber(number) {
        return number.toLocaleString('zh-TW');
    },

    // 格式化價格（保留兩位小數）
    formatPrice(price) {
        return Number(price).toFixed(2);
    },

    // 計算漲跌幅
    calculatePriceChange(currentPrice, previousPrice) {
        if (!previousPrice) return 0;
        return ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);
    },

    // 獲取最新日期
    getLatestDate(data) {
        return Math.max(...data.map(item => new Date(item.交易日期)));
    },

    // 過濾今日數據
    filterTodayData(data, marketName) {
        const latestDate = this.getLatestDate(data);
        return data.filter(item => 
            item.交易日期 === latestDate && 
            item.市場名稱 === marketName
        );
    },

    // 計算市場統計
    calculateMarketStats(data) {
        const totalVolume = data.reduce((sum, item) => sum + Number(item.交易量), 0);
        const avgPrice = data.reduce((sum, item) => sum + Number(item.平均價), 0) / data.length;
        
        return {
            totalVolume,
            avgPrice: this.formatPrice(avgPrice)
        };
    },

    // 生成通知項目
    createNotificationItem(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-item ${type}`;
        notification.textContent = message;
        return notification;
    },

    // 生成排行項目
    createRankingItem(rank, cropName, volume) {
        const rankItem = document.createElement('div');
        rankItem.className = 'ranking-item';
        rankItem.innerHTML = `
            <span class="rank-number">${rank}</span>
            <span class="crop-name">${cropName}</span>
            <span class="trade-volume">${this.formatNumber(volume)} 公斤</span>
        `;
        return rankItem;
    },

    // 生成公告項目
    createAnnouncementItem(message, type = 'info') {
        const announcement = document.createElement('div');
        announcement.className = `announcement-item ${type}`;
        announcement.textContent = message;
        return announcement;
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
    },

    // 檢查瀏覽器支援
    checkBrowserSupport() {
        const features = {
            flexbox: 'flex' in document.documentElement.style,
            grid: 'grid' in document.documentElement.style,
            webp: false
        };

        // 檢查 WebP 支援
        const webpImage = new Image();
        webpImage.onload = function() {
            features.webp = (webpImage.width > 0) && (webpImage.height > 0);
        };
        webpImage.onerror = function() {
            features.webp = false;
        };
        webpImage.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

        return features;
    },

    // 檢查網路狀態
    checkNetworkStatus() {
        return navigator.onLine;
    },

    // 生成唯一ID
    generateUniqueId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// 導出工具函數
export default Utils; 