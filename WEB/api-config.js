// API 配置文件
const API_CONFIG = {
    // 主要資料 API
    DATA_API: {
        url: 'https://bvc-api.deno.dev/proxy/moa',  // 使用代理伺服器
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        // 資料格式處理函數
        processData: (data) => {
            return data.Data.map(item => ({
                交易日期: item.TransDate,
                作物名稱: item.CropName,
                市場名稱: item.MarketName,
                平均價: Number(item.Avg_Price),
                交易量: Number(item.Trans_Quantity)
            }));
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
        url: 'https://bvc-api.deno.dev/proxy/moa',  // 使用代理伺服器
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