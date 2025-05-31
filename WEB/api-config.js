console.log('API JS loaded!');
// API 配置文件
const API_CONFIG = {
    // 主要資料 API
    DATA_API: {
        url: 'https://bvc-api.deno.dev/proxy/moa',  // 主資料 API
        method: 'GET',
        headers: {
            'Accept': 'application/json',
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
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',  // 主資料 API
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    },

    // TV 驗證系統 API
    TV_API: {
        url: './tv-verify.json',
        method: 'GET'
    }
};

// CORS 代理設定
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// 修改 API 請求函數
async function fetchWithCorsProxy(url, options = {}) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    try {
        const response = await fetch(proxyUrl, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('CORS 代理請求失敗:', error);
        throw error;
    }
}

// 除錯函數
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
}

// 統一的 API 請求函數
async function fetchApi(apiName, options = {}) {
    const apiConfig = API_CONFIG[apiName];
    if (!apiConfig) {
        throw new Error(`找不到 API 配置: ${apiName}`);
    }

    debugLog(`開始請求 API: ${apiName}`, {
        url: apiConfig.url,
        method: apiConfig.method,
        headers: apiConfig.headers
    });

    try {
        // 添加 CORS 模式
        const fetchOptions = {
            method: apiConfig.method,
            headers: {
                ...apiConfig.headers,
                ...options.headers
            },
            mode: 'cors',  // 明確指定 CORS 模式
            credentials: 'omit',  // 不發送認證資訊
            ...options
        };

        debugLog('發送請求', fetchOptions);

        const response = await fetch(apiConfig.url, fetchOptions);
        
        debugLog('收到回應', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        debugLog('解析回應資料成功', { dataLength: data?.Data?.length || 0 });

        return apiConfig.processData ? apiConfig.processData(data) : data;
    } catch (error) {
        debugLog('API 請求失敗', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// API 更新函數
function updateApiEndpoint(apiName, newUrl) {
    if (API_CONFIG[apiName]) {
        API_CONFIG[apiName].url = newUrl;
        debugLog(`已更新 ${apiName} API 端點`, { newUrl });
        return true;
    }
    debugLog(`找不到 API: ${apiName}`);
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
    getAllApiConfigs,
    fetchApi
}; 