// 配置文件
const CONFIG = {
    // API 端點
    API: {
        MARKET_DEVICE: 'https://backup0821.github.io/API/Better-vegetable-catcher/marketTV-drvice.json',
        PRICE_DATA: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx'
    },

    // 顯示設定
    DISPLAY: {
        MODE_SWITCH_INTERVAL: 30000, // 30秒切換一次顯示模式
        CROP_ROTATION_INTERVAL: 5000, // 5秒輪播一次作物
        NOTIFICATION_DURATION: 5000, // 通知顯示時間
        MAX_NOTIFICATIONS: 5, // 最大通知數量
        PRICE_CARDS_PER_PAGE: 12 // 每頁顯示的價格卡片數量
    },

    // 圖表設定
    CHART: {
        HEIGHT: '100%',
        WIDTH: '100%',
        MARGIN: {
            t: 50,
            r: 50,
            b: 50,
            l: 50
        },
        COLORS: {
            PRIMARY: '#2196F3',
            SECONDARY: '#4CAF50',
            BACKGROUND: '#FFFFFF'
        }
    },

    // 本地存儲鍵
    STORAGE_KEYS: {
        DEVICE_ID: 'tv_device_id',
        LAST_UPDATE: 'tv_last_update',
        NOTIFICATIONS: 'tv_notifications'
    },

    // 錯誤訊息
    ERROR_MESSAGES: {
        DEVICE_NOT_FOUND: '找不到裝置資訊，請確認裝置識別碼是否正確',
        NETWORK_ERROR: '網路連線錯誤，請檢查網路狀態',
        DATA_FETCH_ERROR: '無法獲取資料，請稍後再試',
        INVALID_DEVICE_ID: '無效的裝置識別碼'
    }
}; 