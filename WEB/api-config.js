console.log('API JS loaded!');
// API 配置文件
const API_CONFIG = {
    // 主要資料 API
    DATA_API: {
        primaryUrl: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',  // 主資料 API
        backupUrl: 'https://bvc-api.deno.dev',  // 備用資料 API
        currentUrl: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',  // 當前使用的 URL
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 2000, // 2 秒
        timeout: 10000,   // 10 秒（主API）
        // 資料格式處理函數
        processData: (data) => {
            // 主API與備用API格式一致
            if (data && Array.isArray(data.Data)) {
                return data.Data.map(item => ({
                    交易日期: item.TransDate,
                    作物名稱: item.CropName,
                    市場名稱: item.MarketName,
                    平均價: Number(item.Avg_Price),
                    交易量: Number(item.Trans_Quantity)
                }));
            }
            // 其他情況
            console.error('API 回傳格式錯誤', data);
            return [];
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

    // 如果是 DATA_API，使用重試機制
    if (apiName === 'DATA_API') {
        return await fetchWithRetry(apiConfig, options);
    }

    // 其他 API 使用原有的請求方式
    return await fetchWithoutRetry(apiConfig, options);
}

// 帶重試機制的請求函數
async function fetchWithRetry(apiConfig, options = {}) {
    const controller = new AbortController();
    // 根據目前 URL 決定 timeout
    const timeoutValue = (apiConfig.currentUrl === apiConfig.backupUrl) ? 20000 : apiConfig.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutValue);

    try {
        const fetchOptions = {
            method: apiConfig.method,
            headers: {
                ...apiConfig.headers,
                ...options.headers
            },
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
            ...options
        };

        debugLog(`嘗試請求 API (嘗試 ${apiConfig.retryCount + 1}/${apiConfig.maxRetries})`, {
            url: apiConfig.currentUrl,
            method: apiConfig.method
        });

        const response = await fetch(apiConfig.currentUrl, fetchOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // 檢查資料是否有效
        if (!data || !Array.isArray(data.Data)) {
            throw new Error('無效的資料格式');
        }

        debugLog('解析回應資料成功', { dataLength: data.Data.length });

        // 重置重試計數
        apiConfig.retryCount = 0;
        
        // 如果當前使用的是備用 API，檢查主要 API 是否恢復
        if (apiConfig.currentUrl === apiConfig.backupUrl) {
            checkPrimaryApi(apiConfig);
        }

        return apiConfig.processData ? apiConfig.processData(data) : data;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            debugLog('請求超時');
        } else {
            debugLog('API 請求失敗', {
                error: error.message,
                stack: error.stack
            });
        }

        // 如果還有重試次數，等待後重試
        if (apiConfig.retryCount < apiConfig.maxRetries - 1) {
            apiConfig.retryCount++;
            debugLog(`等待 ${apiConfig.retryDelay}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, apiConfig.retryDelay));
            return fetchWithRetry(apiConfig, options);
        }

        // 如果已經用完重試次數，切換到備用 API
        if (apiConfig.currentUrl === apiConfig.primaryUrl) {
            debugLog('切換到備用 API');
            apiConfig.currentUrl = apiConfig.backupUrl;
            apiConfig.retryCount = 0;
            showApiSwitchNotification('已切換至備用資料來源');
            return fetchWithRetry(apiConfig, options);
        }

        // 如果已經在使用備用 API 但仍然失敗，拋出錯誤
        throw error;
    }
}

// 檢查主要 API 是否恢復
async function checkPrimaryApi(apiConfig) {
    try {
        const response = await fetch(apiConfig.primaryUrl, {
            method: apiConfig.method,
            headers: apiConfig.headers,
            mode: 'cors',
            credentials: 'omit',
            signal: AbortSignal.timeout(5000) // 5 秒超時
        });

        if (response.ok) {
            debugLog('主要 API 已恢復');
            apiConfig.currentUrl = apiConfig.primaryUrl;
            showApiSwitchNotification('已恢復使用主要資料來源');
        }
    } catch (error) {
        debugLog('主要 API 尚未恢復', { error: error.message });
    }
}

// 顯示 API 切換通知
function showApiSwitchNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'api-switch-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // 5 秒後自動移除通知
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// 一般請求函數（不帶重試機制）
async function fetchWithoutRetry(apiConfig, options = {}) {
    const fetchOptions = {
        method: apiConfig.method,
        headers: {
            ...apiConfig.headers,
            ...options.headers
        },
        mode: 'cors',
        credentials: 'omit',
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