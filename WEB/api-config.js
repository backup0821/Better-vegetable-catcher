// API 配置文件
const API_CONFIG = {
    // 主要資料 API
    DATA_API: {
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    },

    // 版本檢查 API
    VERSION_API: {
        url: './version.json',
        method: 'GET'
    },

    // 通知 API
    NOTIFICATION_API: {
        url: './notifications.json',
        method: 'GET'
    },

    // 農業部資料 API
    MOA_API: {
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
        method: 'GET'
    },

    // TV 驗證系統 API
    TV_API: {
        url: './tv-verify.json',
        method: 'GET'
    }
};

// API 更新函數
function updateApiEndpoint(apiName, newUrl) {
    if (API_CONFIG[apiName]) {
        API_CONFIG[apiName].url = newUrl;
        console.log(`已更新 ${apiName} API 端點為: ${newUrl}`);
        return true;
    }
    console.error(`找不到 API: ${apiName}`);
    return false;
}

// 獲取 API 設定
function getApiConfig(apiName) {
    return API_CONFIG[apiName] || null;
}

// 獲取所有 API 設定
function getAllApiConfigs() {
    return API_CONFIG;
}

// 匯出設定
export {
    API_CONFIG,
    updateApiEndpoint,
    getApiConfig,
    getAllApiConfigs
}; 