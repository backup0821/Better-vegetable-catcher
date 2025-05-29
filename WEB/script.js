// 版本資訊
const VERSION = 'v2.4.web.2';
console.log(`當前版本：${VERSION}`);
const VERSION_CHECK_URL = 'https://api.github.com/repos/backup0821/Better-vegetable-catcher/releases/latest';
const MAINTENANCE_CHECK_URL = 'https://backup0821.github.io/API/Better-vegetable-catcher/notify.json';

// 版本常數
const VERSION_CHECK_INTERVAL = 1000 * 60 * 60; // 每小時檢查一次

// 裝置識別碼
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
}
console.log(`裝置識別碼：${deviceId}`);

// DOM 元素
const searchInput = document.getElementById('searchInput');
const cropSelect = document.getElementById('cropSelect');
const chartArea = document.getElementById('chartArea');
const resultArea = document.getElementById('resultArea');
const showPriceTrendBtn = document.getElementById('showPriceTrend');
const showVolumeDistBtn = document.getElementById('showVolumeDist');
const showPriceDistBtn = document.getElementById('showPriceDist');
const showSeasonalBtn = document.getElementById('showSeasonal');
const versionNumber = document.getElementById('versionNumber');
const lastUpdate = document.getElementById('lastUpdate');
const dataUpdateTime = document.getElementById('dataUpdateTime');

// 資料相關變數
let cropData = [];
let selectedCrop = '';

// 通知相關功能
let notificationCheckInterval;

// 市場休市通知功能
let marketRestData = [];
let marketRestCheckInterval;

// 測試通知功能
let testNotificationTimeout;

// 認證代碼列表
const VERIFICATION_CODES = [
    'dev-test1',
    'admin',
    'GUEST',
    'dev',
    'tester'
];

// 推送通知相關功能
let pushSubscription = null;
const VAPID_PUBLIC_KEY = 'BFYqvIzvnaOJRZGbzp9PGcwZ-MJkpLV1mTFU95cT4qITH7as3TMqzaYQTvVQq2FgzQ3F_A_J3xfy_sKfjBPTWPE';

// === 初始化環境設定 ===
if (!window.ENV_DEFAULT_CONFIGS) {
    window.ENV_DEFAULT_CONFIGS = { environment: 'production' };
}
const savedEnv = localStorage.getItem('environment');
if (savedEnv) {
    window.ENV_DEFAULT_CONFIGS.environment = savedEnv;
}

// ETag 相關函數
async function checkETag(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        const etag = response.headers.get('ETag');
        const lastETag = localStorage.getItem(`etag_${url}`);
        
        if (etag && etag !== lastETag) {
            localStorage.setItem(`etag_${url}`, etag);
            return true; // 需要重新載入
        }
        return false; // 不需要重新載入
    } catch (error) {
        console.error('ETag 檢查失敗:', error);
        return true; // 發生錯誤時，預設重新載入
    }
}

async function fetchWithETag(url, options = {}) {
    const needsReload = await checkETag(url);
    if (needsReload) {
        // 強制重新載入
        const timestamp = new Date().getTime();
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}_t=${timestamp}`;
    }
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Cache-Control': 'no-cache',
            'If-None-Match': localStorage.getItem(`etag_${url}`) || ''
        }
    });
}

// 檢查版本更新
async function checkForUpdates() {
    try {
        const response = await fetchWithETag('/api/version');
        if (!response.ok) {
            throw new Error('版本檢查失敗');
        }
        
        const data = await response.json();
        const etag = response.headers.get('ETag');
        if (etag) {
            localStorage.setItem('etag_version', etag);
        }
        
        return data;
    } catch (error) {
        console.error('版本檢查錯誤:', error);
        throw error;
    }
}

// 顯示更新通知
function showUpdateNotification(latestVersion) {
    // 檢查是否已經顯示過更新通知
    const lastUpdateNotification = localStorage.getItem('lastUpdateNotification');
    if (lastUpdateNotification === latestVersion) {
        return;
    }

    // 創建更新通知
    const notification = {
        id: 'update-notification',
        title: '系統更新通知',
        messenge: `發現新版本 ${latestVersion}！\n目前版本：${VERSION}\n請更新以獲得最新功能。`,
        time: `${new Date().toISOString()} ~ ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`,
        public: true,
        targetDevices: ['everyone']
    };

    // 顯示通知
    showPageNotifications([notification]);
    
    // 記錄已顯示的更新通知版本
    localStorage.setItem('lastUpdateNotification', latestVersion);
}

// 初始化更新檢查
function initUpdateCheck() {
    // 每小時檢查一次更新
    setInterval(checkForUpdates, 60 * 60 * 1000);
    // 立即執行一次檢查
    checkForUpdates();
}

// 在頁面載入時初始化更新檢查
document.addEventListener('DOMContentLoaded', () => {
    initUpdateCheck();
    
    // 檢查維護狀態
    checkMaintenanceStatus();
    // 每5分鐘檢查一次維護狀態
    setInterval(checkMaintenanceStatus, 5 * 60 * 1000);
    
    // 檢查環境設定並顯示農業氣象影片
    showAgriculturalWeatherVideo();

    // 新增市場選擇的事件監聽器
    const marketSelect = document.getElementById('marketSelect');
    if (marketSelect) {
        // 處理地區群組選擇
        marketSelect.addEventListener('click', (event) => {
            const target = event.target;
            if (target.tagName === 'OPTGROUP') {
                // 獲取該群組下的所有選項
                const options = Array.from(target.children);
                // 檢查是否所有選項都已選中
                const allSelected = options.every(option => option.selected);
                
                // 如果全部已選中，則取消選中；否則全部選中
                options.forEach(option => {
                    option.selected = !allSelected;
                });
                
                // 觸發 change 事件以更新圖表
                marketSelect.dispatchEvent(new Event('change'));
            }
        });

        // 處理市場選擇變更
        marketSelect.addEventListener('change', () => {
            if (selectedCrop) {
                // 根據當前選擇的分析功能自動更新
                if (showPriceTrendBtn.classList.contains('active')) {
                    showPriceTrend();
                } else if (showVolumeDistBtn.classList.contains('active')) {
                    showVolumeDistribution();
                } else if (showPriceDistBtn.classList.contains('active')) {
                    showPriceDistribution();
                } else if (showSeasonalBtn.classList.contains('active')) {
                    showSeasonalAnalysis();
                }
            }
        });
    }
});

// 從農產品交易行情站獲取資料
async function fetchData(retryCount = 3) {
    try {
        const lastFetchDate = localStorage.getItem('last_fetch_date');
        const today = new Date().toDateString();
        
        if (lastFetchDate !== today) {
            console.log('開始獲取新資料...');
            
            // 使用新的 API URL，加入查詢參數
            const apiUrl = 'https://data.moa.gov.tw/api/v1/AgriProductsTransType/?$format=json&$top=1000';
            console.log('API URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                console.error('API 回應狀態:', response.status, response.statusText);
                throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('API 回應內容類型:', contentType);
                throw new Error('API 回應不是 JSON 格式');
            }
            
            const data = await response.json();
            console.log('API 回應資料:', data);
            
            // 檢查資料結構
            if (!data || typeof data !== 'object') {
                console.error('API 回應格式不正確:', data);
                throw new Error('API 回應格式不正確');
            }
            
            // 檢查是否有 Data 屬性
            if (!data.Data) {
                console.error('API 回應缺少 Data 屬性:', data);
                throw new Error('API 回應缺少 Data 屬性');
            }
            
            // 檢查 Data 是否為陣列
            if (!Array.isArray(data.Data)) {
                console.error('API 回應 Data 不是陣列:', data.Data);
                throw new Error('API 回應 Data 不是陣列');
            }
            
            if (data.Data.length === 0) {
                console.error('API 回應資料為空');
                throw new Error('API 回應為空');
            }
            
            // 處理資料格式
            const processedData = data.Data.map(item => {
                try {
                    return {
                        交易日期: item.TransDate,
                        作物名稱: item.CropName,
                        市場名稱: item.MarketName,
                        平均價: Number(item.Avg_Price),
                        交易量: Number(item.Trans_Quantity)
                    };
                } catch (error) {
                    console.error('資料處理錯誤:', error, '原始資料:', item);
                    return null;
                }
            }).filter(item => item !== null);
            
            if (processedData.length === 0) {
                throw new Error('資料處理後為空');
            }
            
            // 儲存資料
            localStorage.setItem('crop_data', JSON.stringify(processedData));
            localStorage.setItem('last_fetch_date', today);
            
            return processedData;
        } else {
            console.log('使用快取資料');
            const cachedData = localStorage.getItem('crop_data');
            return cachedData ? JSON.parse(cachedData) : [];
        }
    } catch (error) {
        console.error('資料獲取錯誤:', error);
        if (retryCount > 0) {
            console.log(`重試中... 剩餘次數: ${retryCount - 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchData(retryCount - 1);
        }
        throw error;
    }
}

// 強制更新資料
async function forceUpdateData() {
    try {
        showNotification('系統訊息', '開始更新資料...');
        
        // 清除本地快取
        localStorage.removeItem('last_fetch_date');
        localStorage.removeItem('crop_data');
        
        // 重新獲取資料
        const data = await fetchData();
        showNotification('系統訊息', '資料已成功更新');
        return data;
    } catch (error) {
        console.error('強制更新資料失敗:', error);
        showNotification('錯誤', `更新資料失敗: ${error.message}`);
        throw error;
    }
}

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', () => {
    // ... 其他初始化程式碼 ...
    
    // 添加強制更新按鈕事件
    const forceUpdateBtn = document.createElement('button');
    forceUpdateBtn.textContent = '強制更新資料';
    forceUpdateBtn.className = 'force-update-btn';
    forceUpdateBtn.addEventListener('click', forceUpdateData);
    
    // 將按鈕添加到控制面板
    const controlPanel = document.querySelector('.control-panel');
    if (controlPanel) {
        controlPanel.appendChild(forceUpdateBtn);
    }
    
    // 初始化資料載入
    fetchData();
});

// 顯示通知函數
function showNotification(title, message) {
    const notificationArea = document.getElementById('notificationArea');
    if (notificationArea) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
        `;
        notificationArea.appendChild(notification);
        
        // 5秒後自動移除通知
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// 更新作物列表
function updateCropList() {
    const cropSelect = document.getElementById('cropSelect');
    if (!cropSelect) return;
    
    // 清空現有選項
    cropSelect.innerHTML = '<option value="">請選擇作物</option>';
    
    // 從本地儲存獲取資料
    const localData = localStorage.getItem('crop_data');
    if (localData) {
        const data = JSON.parse(localData);
        
        // 使用 Set 來去除重複的作物名稱
        const cropSet = new Set(data.map(item => item.作物名稱));
        
        // 將作物名稱轉換為陣列並排序
        const sortedCrops = Array.from(cropSet).sort();
        
        // 添加作物選項
        sortedCrops.forEach(crop => {
            const option = document.createElement('option');
            option.value = crop;
            option.textContent = crop;
            cropSelect.appendChild(option);
        });
    }
}

// 搜尋作物
function filterCrops() {
    const searchText = searchInput.value.toLowerCase();
    const options = cropSelect.options;
    
    for (let i = 1; i < options.length; i++) {
        const option = options[i];
        const cropName = option.value.toLowerCase();
        option.style.display = cropName.includes(searchText) ? '' : 'none';
    }
}

// 顯示價格趨勢圖
function showPriceTrend() {
    if (!selectedCrop) return;
    const cropData = getCropData(selectedCrop);
    
    // 按市場分組資料
    const markets = [...new Set(cropData.map(item => item.市場名稱))];
    const traces = markets.map(market => {
        const marketData = cropData.filter(item => item.市場名稱 === market);
        const dates = marketData.map(item => item.交易日期);
        const prices = marketData.map(item => Number(item.平均價));
        
        return {
            x: dates,
            y: prices,
            type: 'scatter',
            mode: 'lines+markers',
            name: market,
            line: { width: 2 },
            marker: { size: 8 }
        };
    });

    // 找最大/最小價及其日期
    const allPrices = cropData.map(item => Number(item.平均價));
    const maxPrice = Math.max(...allPrices);
    const minPrice = Math.min(...allPrices);
    const maxItem = cropData.find(item => Number(item.平均價) === maxPrice);
    const minItem = cropData.find(item => Number(item.平均價) === minPrice);

    const layout = {
        title: {
            text: `${selectedCrop} 價格趨勢`,
            font: { size: 22, color: '#1a73e8', family: 'Microsoft JhengHei, Arial' }
        },
        xaxis: { 
            title: '日期',
            titlefont: { size: 18 },
            tickfont: { size: 16 }
        },
        yaxis: { 
            title: '價格 (元/公斤)',
            titlefont: { size: 18 },
            tickfont: { size: 16 }
        },
        margin: { t: 60, l: 60, r: 30, b: 60 },
        legend: { font: { size: 16 } },
        hoverlabel: { font: { size: 16 } },
        autosize: true,
        responsive: true,
        annotations: [
            {
                x: maxItem.交易日期,
                y: maxPrice,
                xref: 'x',
                yref: 'y',
                text: `最高 ${maxPrice}`,
                showarrow: true,
                arrowhead: 7,
                ax: 0,
                ay: -40,
                font: { color: '#ea4335', size: 16 }
            },
            {
                x: minItem.交易日期,
                y: minPrice,
                xref: 'x',
                yref: 'y',
                text: `最低 ${minPrice}`,
                showarrow: true,
                arrowhead: 7,
                ax: 0,
                ay: 40,
                font: { color: '#34a853', size: 16 }
            }
        ]
    };
    Plotly.newPlot(chartArea, traces, layout, {responsive: true});
    showBasicStats(cropData);
}

// 顯示交易量分布
function showVolumeDistribution() {
    if (!selectedCrop) return;
    const cropData = getCropData(selectedCrop);
    const markets = [...new Set(cropData.map(item => item.市場名稱))];
    const volumes = markets.map(market => {
        const marketData = cropData.filter(item => item.市場名稱 === market);
        return marketData.reduce((sum, item) => sum + Number(item.交易量), 0);
    });
    const trace = {
        x: markets,
        y: volumes,
        type: 'bar',
        name: '交易量',
        marker: { color: '#34a853' }
    };
    const layout = {
        title: {
            text: `${selectedCrop} 各市場交易量分布`,
            font: { size: 20, color: '#34a853', family: 'Microsoft JhengHei, Arial' }
        },
        xaxis: { title: '市場', titlefont: { size: 16 }, tickfont: { size: 15 } },
        yaxis: { title: '交易量 (公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
        margin: { t: 60, l: 60, r: 30, b: 60 },
        legend: { font: { size: 15 } },
        hoverlabel: { font: { size: 15 } },
        autosize: true,
        responsive: true
    };
    Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
    showBasicStats(cropData);
}

// 顯示價格分布
function showPriceDistribution() {
    if (!selectedCrop) return;
    const cropData = getCropData(selectedCrop);
    const prices = cropData.map(item => Number(item.平均價));
    
    // 檢查是否在測試版環境
    const isTestingEnv = window.ENV_DEFAULT_CONFIGS.environment === 'testing';
    
    if (isTestingEnv) {
        // 測試版環境：顯示價格分布和交易量
        const volumes = cropData.map(item => Number(item.交易量));
        const traces = [{
            x: prices,
            type: 'histogram',
            name: '價格分布',
            marker: { color: '#ea4335' }
        }, {
            x: prices,
            y: volumes,
            type: 'scatter',
            mode: 'markers',
            name: '交易量',
            yaxis: 'y2',
            marker: {
                color: '#34a853',
                size: 8,
                opacity: 0.7
            }
        }];

        const layout = {
            title: {
                text: `${selectedCrop} 價格分布與交易量`,
                font: { size: 20, color: '#ea4335', family: 'Microsoft JhengHei, Arial' }
            },
            xaxis: { 
                title: '價格 (元/公斤)', 
                titlefont: { size: 16 }, 
                tickfont: { size: 15 } 
            },
            yaxis: { 
                title: '次數', 
                titlefont: { size: 16 }, 
                tickfont: { size: 15 } 
            },
            yaxis2: {
                title: '交易量 (公斤)',
                titlefont: { size: 16, color: '#34a853' },
                tickfont: { size: 15, color: '#34a853' },
                overlaying: 'y',
                side: 'right'
            },
            margin: { t: 60, l: 60, r: 60, b: 60 },
            legend: { font: { size: 15 } },
            hoverlabel: { font: { size: 15 } },
            autosize: true,
            responsive: true
        };

        Plotly.newPlot(chartArea, traces, layout, {responsive: true});
    } else {
        // 正式版環境：使用原本的價格分布功能
        const trace = {
            x: prices,
            type: 'histogram',
            name: '價格分布',
            marker: { color: '#ea4335' }
        };

        const layout = {
            title: {
                text: `${selectedCrop} 價格分布`,
                font: { size: 20, color: '#ea4335', family: 'Microsoft JhengHei, Arial' }
            },
            xaxis: { 
                title: '價格 (元/公斤)', 
                titlefont: { size: 16 }, 
                tickfont: { size: 15 } 
            },
            yaxis: { 
                title: '次數', 
                titlefont: { size: 16 }, 
                tickfont: { size: 15 } 
            },
            margin: { t: 60, l: 60, r: 30, b: 60 },
            legend: { font: { size: 15 } },
            hoverlabel: { font: { size: 15 } },
            autosize: true,
            responsive: true
        };

        Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
    }
    
    showBasicStats(cropData);
}

// 顯示季節性分析
function showSeasonalAnalysis() {
    if (!selectedCrop) return;
    const cropData = getCropData(selectedCrop);
    const months = Array.from({length: 12}, (_, i) => i + 1);
    const monthlyPrices = months.map(month => {
        const monthData = cropData.filter(item => {
            const date = new Date(item.交易日期);
            return date.getMonth() + 1 === month;
        });
        const prices = monthData.map(item => Number(item.平均價));
        return prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : 0;
    });
    const trace = {
        x: months,
        y: monthlyPrices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '月均價',
        line: { color: '#fbbc05', width: 4 },
        marker: { size: 10, color: '#fbbc05' }
    };
    const layout = {
        title: {
            text: `${selectedCrop} 季節性分析`,
            font: { size: 20, color: '#fbbc05', family: 'Microsoft JhengHei, Arial' }
        },
        xaxis: { 
            title: '月份',
            tickmode: 'array',
            tickvals: months,
            ticktext: months.map(m => `${m}月`),
            titlefont: { size: 16 },
            tickfont: { size: 15 }
        },
        yaxis: { title: '平均價格 (元/公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
        margin: { t: 60, l: 60, r: 30, b: 60 },
        legend: { font: { size: 15 } },
        hoverlabel: { font: { size: 15 } },
        autosize: true,
        responsive: true
    };
    Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
    showBasicStats(cropData);
}

// 進階分析功能
function showPricePrediction() {
    if (!selectedCrop) return;
    const cropData = getCropData(selectedCrop);
    const prices = cropData.map(item => Number(item.平均價));
    const last7 = prices.slice(-7);
    const ma7 = last7.reduce((a, b) => a + b, 0) / last7.length;

    // 預測未來7天
    const futureDates = Array.from({length: 7}, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
    });

    let html = `
        <div class="prediction-formula" style="margin-top:18px;">
            <b>預測方法：</b><br>
            以最近7天平均價格作為未來7天預測價格<br>
            <span style="color:#1a73e8;">預測價格 = ${ma7.toFixed(2)} 元/公斤</span>
            <div style="margin-top:8px;color:#666;">
                本預測僅供參考，實際價格可能受天氣、政策等多種因素影響。
            </div>
        </div>
        <div style="margin-top:18px;">
            <b>未來7天預測價格：</b>
            <table style="width:100%;margin-top:6px;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th style="padding:4px 8px;border:1px solid #eee;">日期</th>
                        <th style="padding:4px 8px;border:1px solid #eee;">預測價格 (元/公斤)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    for (let i = 0; i < futureDates.length; i++) {
        html += `
            <tr>
                <td style="padding:4px 8px;border:1px solid #eee;">${futureDates[i].toLocaleDateString('zh-TW')}</td>
                <td style="padding:4px 8px;border:1px solid #eee;">${ma7.toFixed(2)}</td>
            </tr>
        `;
    }
    html += `
                </tbody>
            </table>
        </div>
    `;
    resultArea.innerHTML = html;
}

// 匯出資料功能
function exportData(format) {
    if (!selectedCrop || !cropData.length) return;
    
    const cropData = getCropData(selectedCrop);
    let content = '';
    let filename = `${selectedCrop}_交易資料`;
    
    if (format === 'excel') {
        // 轉換為 Excel 格式
        content = convertToExcel(cropData);
        filename += '.xlsx';
    } else {
        // 轉換為 CSV 格式
        content = convertToCSV(cropData);
        filename += '.csv';
    }
    
    // 建立下載連結
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function convertToCSV(data) {
    const headers = ['交易日期', '市場名稱', '作物名稱', '平均價', '交易量'];
    const rows = data.map(item => [
        item.交易日期,
        item.市場名稱,
        item.作物名稱,
        item.平均價,
        item.交易量
    ]);
    
    return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
}

function convertToExcel(data) {
    // 這裡需要引入額外的 Excel 處理庫
    // 暫時返回 CSV 格式
    return convertToCSV(data);
}

// 獲取特定作物的資料
function getCropData(cropName) {
    const marketSelect = document.getElementById('marketSelect');
    let filteredData = cropData.filter(item => item.作物名稱 === cropName);
    if (marketSelect) {
        const selectedOptions = Array.from(marketSelect.selectedOptions).map(opt => opt.value);
        if (!selectedOptions.includes('all')) {
            filteredData = filteredData.filter(item => selectedOptions.includes(item.市場名稱));
        }
    }
    return filteredData;
}

// 顯示基本統計資訊
function showBasicStats(data) {
    const prices = data.map(item => Number(item.平均價));
    const volumes = data.map(item => Number(item.交易量));
    
    const stats = {
        avgPrice: prices.reduce((a, b) => a + b) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        totalVolume: volumes.reduce((a, b) => a + b)
    };
    
    // 更新卡片內容
    document.getElementById('avgPrice').textContent = stats.avgPrice.toFixed(2);
    document.getElementById('minPrice').textContent = stats.minPrice.toFixed(2);
    document.getElementById('maxPrice').textContent = stats.maxPrice.toFixed(2);
    document.getElementById('totalVolume').textContent = stats.totalVolume.toLocaleString();

    // 詳細資料表格
    const tbody = document.getElementById('detailTableBody');
    tbody.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.交易日期}</td>
            <td>${item.市場名稱}</td>
            <td>${item.平均價}</td>
            <td>${item.交易量}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 基本統計資訊卡片點擊事件
function showMinPriceInfo() {
    if (!selectedCrop) return;
    const crop = getCropData(selectedCrop);
    const min = Math.min(...crop.map(i => Number(i.平均價)));
    const minItem = crop.find(i => Number(i.平均價) === min);
    resultArea.innerHTML = `<p>最低價格：${min} 元/公斤<br>日期：${minItem.交易日期}<br>市場：${minItem.市場名稱}</p>`;
}
function showMaxPriceInfo() {
    if (!selectedCrop) return;
    const crop = getCropData(selectedCrop);
    const max = Math.max(...crop.map(i => Number(i.平均價)));
    const maxItem = crop.find(i => Number(i.平均價) === max);
    resultArea.innerHTML = `<p>最高價格：${max} 元/公斤<br>日期：${maxItem.交易日期}<br>市場：${maxItem.市場名稱}</p>`;
}
function showMaxVolumeInfo() {
    if (!selectedCrop) return;
    const crop = getCropData(selectedCrop);
    const max = Math.max(...crop.map(i => Number(i.交易量)));
    const maxItem = crop.find(i => Number(i.交易量) === max);
    resultArea.innerHTML = `<p>最大交易量：${max} 公斤<br>日期：${maxItem.交易日期}<br>市場：${maxItem.市場名稱}</p>`;
}

// 綁定卡片點擊事件
setTimeout(() => {
    document.getElementById('avgPriceCard').onclick = () => showPriceTrend();
    document.getElementById('minPriceCard').onclick = () => showMinPriceInfo();
    document.getElementById('maxPriceCard').onclick = () => showMaxPriceInfo();
    document.getElementById('totalVolumeCard').onclick = () => showMaxVolumeInfo();
}, 0);

// 事件監聽器
searchInput.addEventListener('input', filterCrops);
cropSelect.addEventListener('change', (e) => {
    selectedCrop = e.target.value;
    if (selectedCrop) {
        showPriceTrend();
    }
});


  
showPriceTrendBtn.addEventListener('click', showPriceTrend);
showVolumeDistBtn.addEventListener('click', showVolumeDistribution);
showPriceDistBtn.addEventListener('click', showPriceDistribution);
showSeasonalBtn.addEventListener('click', showSeasonalAnalysis);

// 新增按鈕事件監聽器
document.getElementById('showPricePrediction').addEventListener('click', showPricePrediction);
document.getElementById('exportExcel').addEventListener('click', () => exportData('excel'));
document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));

// 通知相關功能
async function checkNotifications() {
    console.log('開始檢查通知...');
    try {
        const response = await fetch(MAINTENANCE_CHECK_URL);
        console.log('通知 API 回應:', response.status);
        const data = await response.json();
        console.log('收到的通知:', data);
        
        if (data.notifications && data.notifications.length > 0) {
            console.log('顯示通知');
            showPageNotifications(data.notifications);
        } else {
            console.log('目前沒有通知');
        }
    } catch (error) {
        console.error('檢查通知失敗:', error);
    }
}

// 監聽 Service Worker 訊息
if ('serviceWorker' in navigator) {
    // 通知 Service Worker 客戶端已準備就緒
    navigator.serviceWorker.ready.then(registration => {
        registration.active.postMessage({ type: 'client-ready' });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('收到 Service Worker 訊息:', event.data);
        if (event.data.type === 'showNotifications') {
            console.log('準備顯示通知:', event.data.notifications);
            showPageNotifications(event.data.notifications);
        }
    });
}

// 顯示網頁通知
function showPageNotifications(notifications) {
    console.log('開始顯示通知:', notifications);
    
    try {
        // 移除現有的通知（如果有的話）
        const existingNotification = document.getElementById('page-notification');
        const existingOverlay = document.querySelector('.notification-overlay');
        if (existingNotification) {
            existingNotification.remove();
        }
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // 創建遮罩層
        const overlay = document.createElement('div');
        overlay.className = 'notification-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(overlay);

        // 創建通知容器
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'page-notification';
        notificationContainer.className = 'notification-window';
        notificationContainer.style.cssText = `
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            max-width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        `;

        // 通知標題
        const title = document.createElement('div');
        title.className = 'notification-title';
        title.textContent = '系統通知';
        title.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
        `;
        notificationContainer.appendChild(title);

        // 通知列表
        const notificationList = document.createElement('div');
        notificationList.className = 'notification-list';
        notificationList.style.cssText = `
            margin-bottom: 20px;
        `;

        notifications.forEach((notification, index) => {
            console.log('處理通知項目:', notification);
            const notificationItem = document.createElement('div');
            notificationItem.className = 'notification-item';
            notificationItem.style.cssText = `
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 5px;
                background-color: ${notification.isMarketRest ? '#fff3cd' : '#f8f9fa'};
                border: 1px solid ${notification.isMarketRest ? '#ffeeba' : '#e9ecef'};
            `;
            
            // 如果是市場休市通知，添加特殊樣式
            if (notification.isMarketRest) {
                notificationItem.classList.add('market-rest-notification');
            }

            // 計算剩餘時間
            const [startTime, endTime] = notification.time.split(' ~ ');
            const endDate = new Date(endTime);
            const now = new Date();
            const timeLeft = endDate - now;
            const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            let timeLeftText = '';
            if (daysLeft > 0) {
                timeLeftText = `剩餘 ${daysLeft} 天`;
            } else if (hoursLeft > 0) {
                timeLeftText = `剩餘 ${hoursLeft} 小時`;
            } else {
                timeLeftText = '即將過期';
            }

            notificationItem.innerHTML = `
                <div class="notification-icon" style="font-size: 24px; margin-right: 10px; float: left;">
                    ${notification.isMarketRest ? '🏪' : '📢'}
                </div>
                <div class="notification-content" style="margin-left: 40px;">
                    <div class="notification-title" style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                        ${notification.title}
                    </div>
                    <div class="notification-message" style="margin-bottom: 5px;">
                        ${notification.messenge}
                    </div>
                    <div class="notification-time" style="color: #666; font-size: 14px; margin-bottom: 5px;">
                        通知時間：${new Date(startTime).toLocaleString('zh-TW')}
                    </div>
                    <div class="notification-time-left" style="color: #666; font-size: 14px;">
                        ${timeLeftText}
                    </div>
                    <div class="notification-tag" style="margin-top: 5px;">
                        ${notification.isMarketRest ? 
                            '<span style="background-color: #ffeeba; padding: 2px 8px; border-radius: 3px; font-size: 12px;">🏪 市場休市通知</span>' : 
                            '<span style="background-color: #e9ecef; padding: 2px 8px; border-radius: 3px; font-size: 12px;">📢 公開通知</span>'
                        }
                    </div>
                </div>
                <div style="clear: both;"></div>
            `;
            notificationList.appendChild(notificationItem);
        });

        notificationContainer.appendChild(notificationList);

        // 確認按鈕
        const confirmButton = document.createElement('button');
        confirmButton.className = 'notification-button';
        confirmButton.textContent = '確定';
        confirmButton.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 15px;
        `;
        confirmButton.addEventListener('click', () => {
            overlay.remove();
            notificationContainer.remove();
        });
        notificationContainer.appendChild(confirmButton);

        // 將通知容器添加到遮罩層
        overlay.appendChild(notificationContainer);
        console.log('通知已添加到頁面');
    } catch (error) {
        console.error('顯示通知時發生錯誤:', error);
    }
}

// 初始化通知檢查
function initNotificationCheck() {
    console.log('初始化通知檢查');
    // 每5分鐘檢查一次
    notificationCheckInterval = setInterval(checkNotifications, 5 * 60 * 1000);
    // 立即執行一次檢查
    checkNotifications();
}

// 在頁面載入時初始化通知檢查
document.addEventListener('DOMContentLoaded', () => {
    console.log('頁面載入完成，開始初始化通知檢查');
    initNotificationCheck();
    // 立即檢查通知
    checkNotifications();
});

// 市場休市通知功能
async function fetchMarketRestData() {
    try {
        const response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
        if (!response.ok) throw new Error('無法獲取市場休市資料');
        marketRestData = await response.json();
    } catch (error) {
        console.error('獲取市場休市資料失敗:', error);
    }
}

function showMarketRestBanner(market) {
    const banner = document.createElement('div');
    banner.className = 'market-rest-banner';
    banner.innerHTML = `
        <div class="banner-content">
            <span class="banner-icon">⚠️</span>
            <span class="banner-text">${market.MarketName} ${market.MarketType}市場今日休市</span>
        </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
}

async function checkMarketRest() {
    const now = new Date();
    const currentYearMonth = now.getFullYear().toString().slice(-2) + 
                            (now.getMonth() + 1).toString().padStart(2, '0');
    const currentDay = now.getDate().toString().padStart(2, '0');

    marketRestData.forEach(market => {
        if (market.YearMonth === currentYearMonth) {
            const restDays = market.ClosedDate.split('、');
            if (restDays.includes(currentDay)) {
                showMarketRestBanner(market);
                showPageNotification({
                    title: '市場休市通知',
                    messenge: `${market.MarketName} ${market.MarketType}市場今日休市`,
                    time: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`,
                    isMarketRest: true,
                    marketInfo: market
                });
            }
        }
    });
}

// 初始化市場休市檢查
async function initMarketRestCheck() {
    await fetchMarketRestData();
    // 每天檢查一次
    marketRestCheckInterval = setInterval(async () => {
        await fetchMarketRestData();
        checkMarketRest();
    }, 24 * 60 * 60 * 1000);
    // 立即執行一次檢查
    checkMarketRest();
}

// 在頁面載入時初始化市場休市檢查
document.addEventListener('DOMContentLoaded', () => {
    initMarketRestCheck();
});

// 測試通知功能
async function handleTestNotification() {
    const code = prompt('請輸入驗證代碼：');
    if (!VERIFICATION_CODES.includes(code)) {
        alert('驗證代碼錯誤！');
        return;
    }

    console.log('開始測試通知...');

    // 請求背景執行權限
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // 檢查通知權限
            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert('需要通知權限才能進行測試！\n請在瀏覽器設定中允許通知權限。');
                    return;
                }
            }

            // 模擬今天的休市通知
            registration.showNotification('市場休市通知', {
                body: '台北第一果菜批發市場 今天休市',
                icon: './icon-192.png',
                badge: './icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'test-market-rest-today',
                requireInteraction: true,
                actions: [
                    {
                        action: 'open',
                        title: '開啟應用程式'
                    }
                ]
            }).then(() => {
                console.log('今天休市通知已發送');
            }).catch(error => {
                console.error('今天休市通知發送失敗:', error);
            });

            // 模擬明天的休市通知
            registration.showNotification('市場休市通知', {
                body: '台北第一果菜批發市場 明天休市',
                icon: './icon-192.png',
                badge: './icon-192.png',
                vibrate: [200, 100, 200],
                tag: 'test-market-rest-tomorrow',
                requireInteraction: true,
                actions: [
                    {
                        action: 'open',
                        title: '開啟應用程式'
                    }
                ]
            }).then(() => {
                console.log('明天休市通知已發送');
            }).catch(error => {
                console.error('明天休市通知發送失敗:', error);
            });

            alert('測試通知已發送！\n您應該會收到兩個通知：\n1. 今天休市通知\n2. 明天休市通知\n\n請確保：\n1. 已授予通知權限\n2. 未開啟省電模式\n3. 允許背景執行');
        } catch (error) {
            console.error('測試通知設置失敗:', error);
            alert('測試通知設置失敗，請確保：\n1. 已授予通知權限\n2. 未開啟省電模式\n3. 允許背景執行');
        }
    } else {
        alert('您的瀏覽器不支援 Service Worker！\n請使用最新版本的 Chrome 或 Safari。');
    }
}

// 綁定測試通知按鈕事件
document.addEventListener('DOMContentLoaded', () => {
    const testNotificationBtn = document.getElementById('testNotificationBtn');
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', handleTestNotification);
    }
});

// 請求背景同步權限
async function requestBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('check-notifications');
            console.log('背景同步已註冊');
            
            // 請求定期同步權限
            if ('periodicSync' in registration) {
                try {
                    await registration.periodicSync.register('check-notifications-periodic', {
                        minInterval: 5 * 60 * 1000 // 每5分鐘檢查一次
                    });
                    console.log('定期同步已註冊');
                } catch (error) {
                    console.error('定期同步註冊失敗:', error);
                }
            }
        } catch (error) {
            console.error('背景同步註冊失敗:', error);
        }
    }
}

// 請求通知權限
async function requestNotificationPermission() {
    if ('Notification' in window) {
        try {
            const permission = await Notification.requestPermission();
            console.log('通知權限狀態:', permission);
            
            if (permission === 'granted') {
                // 如果通知權限被授予，請求背景同步權限
                await requestBackgroundSync();
                // 移除權限提示（如果存在）
                removePermissionPrompt();
                
                // 立即執行一次通知檢查
                await checkNotifications();
            } else if (permission === 'denied') {
                // 如果權限被拒絕，顯示提示
                showPermissionPrompt();
            }
        } catch (error) {
            console.error('請求通知權限失敗:', error);
            showPermissionPrompt();
        }
    }
}

// 顯示權限提示
function showPermissionPrompt() {
    // 檢查是否已經顯示過提示
    if (document.getElementById('permission-prompt')) {
        return;
    }

    const permissionPrompt = document.createElement('div');
    permissionPrompt.id = 'permission-prompt';
    permissionPrompt.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: #fff3cd;
        color: #856404;
        padding: 15px;
        box-shadow: 0 -2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
        text-align: center;
    `;
    permissionPrompt.innerHTML = `
        <p style="margin-bottom: 10px;">⚠️ 通知權限被拒絕</p>
        <p style="margin-bottom: 10px;">請允許通知權限以接收重要訊息</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button onclick="requestNotificationPermission()" style="
                padding: 8px 16px;
                background-color: #856404;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            ">重新請求權限</button>
            <button onclick="removePermissionPrompt()" style="
                padding: 8px 16px;
                background-color: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
            ">稍後再說</button>
        </div>
    `;
    document.body.appendChild(permissionPrompt);
}

// 移除權限提示
function removePermissionPrompt() {
    const prompt = document.getElementById('permission-prompt');
    if (prompt) {
        prompt.remove();
    }
}

// 檢查瀏覽器相容性
function checkBrowserCompatibility() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isChromeIOS = /CriOS/.test(navigator.userAgent);
    const supportsServiceWorker = 'serviceWorker' in navigator;
    
    if (isIOS && isChromeIOS) {
        // 在 iOS 的 Chrome 上顯示提示
        const compatibilityAlert = document.createElement('div');
        compatibilityAlert.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            text-align: center;
            max-width: 90%;
        `;
        compatibilityAlert.innerHTML = `
            <p>⚠️ 通知功能在 iOS 版 Chrome 上可能無法正常運作</p>
            <p>建議使用 Safari 瀏覽器以獲得完整功能</p>
            <button onclick="this.parentElement.remove()" style="
                margin-top: 10px;
                padding: 5px 10px;
                background-color: #856404;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
            ">我知道了</button>
        `;
        document.body.appendChild(compatibilityAlert);
    }
}

// 在頁面載入時檢查相容性
document.addEventListener('DOMContentLoaded', () => {
    checkBrowserCompatibility();
    // 立即請求通知權限
    requestNotificationPermission();
});

// 裝置識別碼相關功能
function showVerificationDialog() {
    // 創建遮罩層
    const overlay = document.createElement('div');
    overlay.className = 'verification-overlay';
    
    // 創建對話框
    const dialog = document.createElement('div');
    dialog.className = 'verification-dialog';
    dialog.innerHTML = `
        <h3>設定裝置識別碼</h3>
        <p>請輸入驗證代碼：</p>
        <input type="password" id="verificationCode" placeholder="請輸入驗證代碼">
        <p>請輸入裝置識別碼：</p>
        <input type="text" id="newDeviceId" placeholder="請輸入裝置識別碼">
        <div style="margin-top: 15px; text-align: right;">
            <button class="cancel-btn" onclick="closeVerificationDialog()">取消</button>
            <button onclick="verifyAndSetDeviceId()">確定</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

function closeVerificationDialog() {
    const overlay = document.querySelector('.verification-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function verifyAndSetDeviceId() {
    const verificationCode = document.getElementById('verificationCode').value;
    const newDeviceId = document.getElementById('newDeviceId').value;
    
    // 驗證代碼
    if (!VERIFICATION_CODES.includes(verificationCode)) {
        alert('驗證代碼錯誤！');
        return;
    }
    
    if (!newDeviceId) {
        alert('請輸入裝置識別碼！');
        return;
    }
    
    // 儲存新的裝置識別碼
    localStorage.setItem('deviceId', newDeviceId);
    deviceId = newDeviceId;
    
    alert('裝置識別碼已更新！');
    closeVerificationDialog();
}

// 綁定裝置識別碼按鈕事件
document.addEventListener('DOMContentLoaded', () => {
    const deviceIdBtn = document.getElementById('deviceIdBtn');
    if (deviceIdBtn) {
        deviceIdBtn.addEventListener('click', showVerificationDialog);
    }
});

// 重設裝置識別碼
function resetDeviceId() {
    if (confirm('確定要重設裝置識別碼嗎？此操作將無法復原。')) {
        // 生成新的隨機裝置識別碼
        const newDeviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', newDeviceId);
        deviceId = newDeviceId;
        alert('裝置識別碼已重設！\n新的識別碼：' + newDeviceId);
    }
}

// 綁定重設裝置識別碼按鈕事件
document.addEventListener('DOMContentLoaded', () => {
    const resetDeviceIdBtn = document.getElementById('resetDeviceIdBtn');
    if (resetDeviceIdBtn) {
        resetDeviceIdBtn.addEventListener('click', resetDeviceId);
    }
});

// 綁定檢查更新按鈕事件
document.addEventListener('DOMContentLoaded', () => {
    const checkUpdateBtn = document.getElementById('checkUpdateBtn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', async () => {
            // 顯示載入中狀態
            checkUpdateBtn.textContent = '檢查中...';
            checkUpdateBtn.disabled = true;
            
            try {
                await checkForUpdates();
                // 更新按鈕狀態
                checkUpdateBtn.textContent = '已檢查';
                setTimeout(() => {
                    checkUpdateBtn.textContent = '檢查更新';
                    checkUpdateBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('檢查更新失敗:', error);
                checkUpdateBtn.textContent = '檢查失敗';
                setTimeout(() => {
                    checkUpdateBtn.textContent = '檢查更新';
                    checkUpdateBtn.disabled = false;
                }, 2000);
            }
        });
    }
});

// 更新通知功能
async function checkUpdateNotifications() {
    try {
        const response = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/updates.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const updates = await response.json();
        
        const now = new Date();
        let updatesToShow = [];
        
        updates.forEach(update => {
            // 檢查是否為公開通知
            if (!update.public) {
                return;
            }
            
            // 檢查是否為特定裝置的通知
            const isTargetedDevice = update.targetDevices && update.targetDevices.length > 0;
            const isForEveryone = update.targetDevices && update.targetDevices.includes('everyone');
            
            if (isTargetedDevice && !isForEveryone && !update.targetDevices.includes(deviceId)) {
                return;
            }
            
            // 解析時間範圍
            const [startTime, endTime] = update.time.split(' ~ ');
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            
            // 檢查通知是否過期
            if (now > endDate) {
                return;
            }
            
            // 檢查當前時間是否在通知時間範圍內
            if (now >= startDate && now <= endDate) {
                updatesToShow.push({
                    ...update,
                    isTargetedDevice: isTargetedDevice && !isForEveryone,
                    isPublic: true,
                    isExpired: false
                });
            }
        });
        
        // 顯示所有符合條件的更新通知
        if (updatesToShow.length > 0) {
            showPageNotifications(updatesToShow);
        }
    } catch (error) {
        console.error('獲取更新通知失敗:', error);
    }
}

// 初始化更新通知檢查
function initUpdateNotificationCheck() {
    // 每小時檢查一次更新通知
    setInterval(checkUpdateNotifications, 60 * 60 * 1000);
    // 立即執行一次檢查
    checkUpdateNotifications();
}

// 綁定檢查更新通知按鈕事件
document.addEventListener('DOMContentLoaded', () => {
    const checkUpdateBtn = document.getElementById('checkUpdateBtn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', async () => {
            // 顯示載入中狀態
            checkUpdateBtn.textContent = '檢查中...';
            checkUpdateBtn.disabled = true;
            
            try {
                await checkUpdateNotifications();
                // 更新按鈕狀態
                checkUpdateBtn.textContent = '已檢查';
                setTimeout(() => {
                    checkUpdateBtn.textContent = '檢查更新通知';
                    checkUpdateBtn.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('檢查更新通知失敗:', error);
                checkUpdateBtn.textContent = '檢查失敗';
                setTimeout(() => {
                    checkUpdateBtn.textContent = '檢查更新通知';
                    checkUpdateBtn.disabled = false;
                }, 2000);
            }
        });
    }
    
    // 初始化更新通知檢查
    initUpdateNotificationCheck();
});

// 初始化推送通知
async function initPushNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // 檢查是否已經訂閱
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                pushSubscription = subscription;
                console.log('已訂閱推送通知:', subscription);
                // 儲存訂閱資訊
                await saveSubscription(subscription);
                return;
            }
            
            // 請求通知權限
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('通知權限被拒絕');
                return;
            }
            
            // 訂閱推送通知
            pushSubscription = await subscribePush();
            if (pushSubscription) {
                console.log('成功訂閱推送通知:', pushSubscription);
                // 儲存訂閱資訊
                await saveSubscription(pushSubscription);
            }
        } catch (error) {
            console.error('初始化推送通知失敗:', error);
        }
    } else {
        console.log('瀏覽器不支援推送通知');
    }
}

// 儲存訂閱資訊
async function saveSubscription(subscription) {
    try {
        // 將訂閱資訊儲存到本地檔案
        const subscriptionData = {
            deviceId: deviceId,
            subscription: subscription.toJSON()
        };
        
        // 儲存到本地檔案
        const response = await fetch('/save-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscriptionData)
        });
        
        if (!response.ok) {
            throw new Error('儲存訂閱資訊失敗');
        }
        
        console.log('訂閱資訊已儲存');
    } catch (error) {
        console.error('儲存訂閱資訊失敗:', error);
    }
}

// 訂閱推送通知
async function subscribePush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        return subscription;
    } catch (error) {
        console.error('訂閱推送通知失敗:', error);
        return null;
    }
}

// 取消訂閱推送通知
async function unsubscribePush() {
    if (pushSubscription) {
        try {
            await pushSubscription.unsubscribe();
            pushSubscription = null;
            console.log('已取消訂閱推送通知');
            // 通知伺服器取消訂閱
            await sendUnsubscriptionToServer();
        } catch (error) {
            console.error('取消訂閱推送通知失敗:', error);
        }
    }
}

// 通知伺服器取消訂閱
async function sendUnsubscriptionToServer() {
    try {
        const response = await fetch('/api/push-subscription', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceId: deviceId
            })
        });
        
        if (!response.ok) {
            throw new Error('通知伺服器取消訂閱失敗');
        }
        
        console.log('已通知伺服器取消訂閱');
    } catch (error) {
        console.error('通知伺服器取消訂閱失敗:', error);
    }
}

// 將 Base64 字串轉換為 Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// 在頁面載入時初始化推送通知
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化裝置識別碼
    initDeviceId();
    
    // 檢查瀏覽器相容性
    checkBrowserCompatibility();
    
    // 請求通知權限
    await requestNotificationPermission();
    
    // 初始化通知檢查
    initNotificationCheck();
    
    // 檢查更新通知
    checkUpdateNotifications();
    
    // 初始化推送通知
    await initPushNotifications();
    
    // 註冊 Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker 註冊成功:', registration);
            
            // 監聽 Service Worker 更新
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // 顯示更新通知
                        showUpdateNotification(VERSION);
                    }
                });
            });
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }

    // 在頁面載入時初始化
    initMarketRestCheck();
});

// 初始化
fetchData();

// 在 service-worker.js 中
self.addEventListener('pushsubscriptionchange', (event) => {
    const subscription = event.newSubscription || event.oldSubscription;
    if (subscription) {
        // 將訂閱資訊發送到伺服器
        fetch('/save-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: subscription.toJSON().keys
            })
        });
    }
});


    // 修改其他分析函數
    const originalShowVolumeDistribution = showVolumeDistribution;
    showVolumeDistribution = function() {
        if (!selectedCrop) return;
        const cropData = getCropData(selectedCrop);
        const markets = [...new Set(cropData.map(item => item.市場名稱))];
        const volumes = markets.map(market => {
            const marketData = cropData.filter(item => item.市場名稱 === market);
            return marketData.reduce((sum, item) => sum + Number(item.交易量), 0);
        });
        const trace = {
            x: markets,
            y: volumes,
            type: 'bar',
            name: '交易量',
            marker: { color: '#34a853' }
        };
        const layout = {
            title: {
                text: `${selectedCrop} 各市場交易量分布`,
                font: { size: 20, color: '#34a853', family: 'Microsoft JhengHei, Arial' }
            },
            xaxis: { title: '市場', titlefont: { size: 16 }, tickfont: { size: 15 } },
            yaxis: { title: '交易量 (公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
            margin: { t: 60, l: 60, r: 30, b: 60 },
            legend: { font: { size: 15 } },
            hoverlabel: { font: { size: 15 } },
            autosize: true,
            responsive: true
        };
        Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
        showBasicStats(cropData);
    };

    // 修改價格分布函數
    const originalShowPriceDistribution = showPriceDistribution;
    showPriceDistribution = function() {
        if (!selectedCrop) return;
        const cropData = getCropData(selectedCrop);
        const prices = cropData.map(item => Number(item.平均價));
        const envConfig = window.ENV_DEFAULT_CONFIGS || { environment: 'production' };
        const isTestingEnv = envConfig.environment === 'testing';
        if (isTestingEnv) {
            // 依市場分組
            const markets = [...new Set(cropData.map(item => item.市場名稱))];
            // 色盲友善色盤（不含紅、綠）
            const colorPalette = [
                '#0072B2', // 藍
                '#E69F00', // 橘
                '#56B4E9', // 淺藍
                '#F0E442', // 黃
                '#CC79A7', // 紫
                '#D55E00', // 棕
                '#999999', // 灰
                '#000000', // 黑
                '#009E73', // 青
                '#9467bd'  // 深紫
            ];
            // 直方圖分隔線計算
            const binCount = 10;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const binWidth = (maxPrice - minPrice) / binCount;
            const binEdges = Array.from({length: binCount+1}, (_, i) => minPrice + i * binWidth);
            // 產生分隔線
            const shapes = binEdges.slice(1, -1).map(x => ({
                type: 'line',
                x0: x, x1: x,
                y0: 0, y1: 1,
                yref: 'paper',
                line: { color: '#b0b0b0', width: 1, dash: 'dot' }
            }));
            const traces = [{
                x: prices,
                type: 'histogram',
                name: '價格分布',
                marker: { color: '#0072B2', opacity: 0.35 }, // 藍色、透明
                opacity: 0.35,
                hoverlabel: { font: { size: 16 } },
                xbins: { start: minPrice, end: maxPrice, size: binWidth }
            }];
            markets.forEach((market, idx) => {
                const marketData = cropData.filter(item => item.市場名稱 === market);
                const x = marketData.map(item => Number(item.平均價));
                const y = marketData.map(item => Number(item.交易量));
                traces.push({
                    x,
                    y,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: `${market} 交易量`,
                    yaxis: 'y2',
                    marker: {
                        color: colorPalette[idx % colorPalette.length],
                        size: 12,
                        line: { width: 2, color: '#fff' }
                    },
                    line: {
                        color: colorPalette[idx % colorPalette.length],
                        width: 4
                    },
                    hovertemplate: `市場: ${market}<br>價格: %{x} 元/公斤<br>交易量: %{y} 公斤<extra></extra>`
                });
            });
            const layout = {
                title: {
                    text: `${selectedCrop} 價格分布與各市場交易量`,
                    font: { size: 22, color: '#0072B2', family: 'Microsoft JhengHei, Arial' }
                },
                xaxis: { 
                    title: '價格 (元/公斤)', 
                    titlefont: { size: 18 }, 
                    tickfont: { size: 16 },
                    showgrid: true,
                    gridcolor: '#e0e0e0'
                },
                yaxis: { 
                    title: '次數', 
                    titlefont: { size: 18 }, 
                    tickfont: { size: 16 },
                    showgrid: true,
                    gridcolor: '#e0e0e0'
                },
                yaxis2: {
                    title: '交易量 (公斤)',
                    titlefont: { size: 18, color: '#0072B2' },
                    tickfont: { size: 16, color: '#0072B2' },
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false
                },
                margin: { t: 70, l: 70, r: 70, b: 70 },
                legend: { font: { size: 18 }, orientation: 'h', x: 0, y: -0.2 },
                hoverlabel: { font: { size: 16 } },
                shapes,
                autosize: true,
                responsive: true
            };
            Plotly.newPlot(chartArea, traces, layout, {responsive: true});
        } else {
            const trace = {
                x: prices,
                type: 'histogram',
                name: '價格分布',
                marker: { color: '#0072B2' }
            };
            const layout = {
                title: {
                    text: `${selectedCrop} 價格分布`,
                    font: { size: 20, color: '#0072B2', family: 'Microsoft JhengHei, Arial' }
                },
                xaxis: { 
                    title: '價格 (元/公斤)', 
                    titlefont: { size: 16 }, 
                    tickfont: { size: 15 } 
                },
                yaxis: { 
                    title: '次數', 
                    titlefont: { size: 16 }, 
                    tickfont: { size: 15 } 
                },
                margin: { t: 60, l: 60, r: 30, b: 60 },
                legend: { font: { size: 15 } },
                hoverlabel: { font: { size: 15 } },
                autosize: true,
                responsive: true
            };
            Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
        }
        showBasicStats(cropData);
    };

    // 修改季節性分析函數
    const originalShowSeasonalAnalysis = showSeasonalAnalysis;
    showSeasonalAnalysis = function() {
        if (!selectedCrop) return;
        const cropData = getCropData(selectedCrop);
        const months = Array.from({length: 12}, (_, i) => i + 1);
        const monthlyPrices = months.map(month => {
            const monthData = cropData.filter(item => {
                const date = new Date(item.交易日期);
                return date.getMonth() + 1 === month;
            });
            const prices = monthData.map(item => Number(item.平均價));
            return prices.length > 0 ? prices.reduce((a, b) => a + b) / prices.length : 0;
        });
        const trace = {
            x: months,
            y: monthlyPrices,
            type: 'scatter',
            mode: 'lines+markers',
            name: '月均價',
            line: { color: '#fbbc05', width: 4 },
            marker: { size: 10, color: '#fbbc05' }
        };
        const layout = {
            title: {
                text: `${selectedCrop} 季節性分析`,
                font: { size: 20, color: '#fbbc05', family: 'Microsoft JhengHei, Arial' }
            },
            xaxis: { 
                title: '月份',
                tickmode: 'array',
                tickvals: months,
                ticktext: months.map(m => `${m}月`),
                titlefont: { size: 16 },
                tickfont: { size: 15 }
            },
            yaxis: { title: '平均價格 (元/公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
            margin: { t: 60, l: 60, r: 30, b: 60 },
            legend: { font: { size: 15 } },
            hoverlabel: { font: { size: 15 } },
            autosize: true,
            responsive: true
        };
        Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
        showBasicStats(cropData);
    };

    // 在頁面載入時初始化
    document.addEventListener('DOMContentLoaded', () => {
        // 綁定休市檢查按鈕點擊事件
        const checkRestButton = document.getElementById('checkRestButton');
        const calendarContainer = document.getElementById('calendarContainer');
        const calendarOverlay = document.getElementById('calendarOverlay');

        if (checkRestButton) {
            checkRestButton.addEventListener('click', async () => {
                try {
                    const response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
                    if (!response.ok) throw new Error('無法獲取市場休市資料');
                    const restData = await response.json();
                    
                    // 生成日曆
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();
                    
                    let calendarHTML = `
                        <div style="text-align: right;">
                            <button onclick="document.getElementById('calendarContainer').style.display='none'; document.getElementById('calendarOverlay').style.display='none';" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
                        </div>
                        <h2 style="text-align: center; margin-bottom: 20px;">市場休市日曆</h2>
                    `;
                    
                    // 生成當月和下月的日曆
                    for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
                        const month = (currentMonth + monthOffset) % 12;
                        const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
                        
                        calendarHTML += `
                            <div style="margin-bottom: 30px;">
                                <h3 style="text-align: center;">${year}年${month + 1}月</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <th style="padding: 8px; border: 1px solid #ddd;">日</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">一</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">二</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">三</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">四</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">五</th>
                                        <th style="padding: 8px; border: 1px solid #ddd;">六</th>
                                    </tr>
                        `;
                        
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        let day = 1;
                        
                        for (let i = 0; i < 6; i++) {
                            calendarHTML += '<tr>';
                            for (let j = 0; j < 7; j++) {
                                if (i === 0 && j < firstDay.getDay()) {
                                    calendarHTML += '<td style="padding: 8px; border: 1px solid #ddd;"></td>';
                                } else if (day > lastDay.getDate()) {
                                    calendarHTML += '<td style="padding: 8px; border: 1px solid #ddd;"></td>';
                                } else {
                                    const isRestDay = restData.some(market => {
                                        const yearMonth = year.toString().slice(-2) + (month + 1).toString().padStart(2, '0');
                                        return market.YearMonth === yearMonth && 
                                               market.ClosedDate.split('、').includes(day.toString().padStart(2, '0'));
                                    });
                                    const isMonday = new Date(year, month, day).getDay() === 1;
                                    
                                    let cellStyle = 'padding: 8px; border: 1px solid #ddd;';
                                    let cellContent = day;
                                    
                                    if (isRestDay) {
                                        cellStyle += 'background-color: #ffcdd2;';
                                        cellContent += '<br><small style="color: #d32f2f;">休市</small>';
                                    } else if (isMonday) {
                                        cellStyle += 'background-color: #fff9c4;';
                                        cellContent += '<br><small style="color: #f57f17;">通常休市</small>';
                                    }
                                    
                                    calendarHTML += `<td style="${cellStyle}">${cellContent}</td>`;
                                    day++;
                                }
                            }
                            calendarHTML += '</tr>';
                            if (day > lastDay.getDate()) break;
                        }
                        
                        calendarHTML += `
                                </table>
                                <div style="margin-top: 10px; font-size: 14px;">
                                    <span style="display: inline-block; margin-right: 15px;">
                                        <span style="display: inline-block; width: 15px; height: 15px; background-color: #ffcdd2; margin-right: 5px;"></span>
                                        休市日
                                    </span>
                                    <span style="display: inline-block;">
                                        <span style="display: inline-block; width: 15px; height: 15px; background-color: #fff9c4; margin-right: 5px;"></span>
                                        通常休市（週一）
                                    </span>
                                </div>
                            </div>
                        `;
                    }
                    
                    calendarContainer.innerHTML = calendarHTML;
                    calendarContainer.style.display = 'block';
                    calendarOverlay.style.display = 'block';
                } catch (error) {
                    console.error('獲取市場休市資料失敗:', error);
                    alert('無法獲取市場休市資料，請稍後再試');
                }
            });
        }

        // 點擊遮罩層關閉日曆
        if (calendarOverlay) {
            calendarOverlay.addEventListener('click', () => {
                calendarContainer.style.display = 'none';
                calendarOverlay.style.display = 'none';
            });
        }
    });

// 休市日曆功能
async function showMarketRestCalendar() {
    try {
        const response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
        if (!response.ok) throw new Error('無法獲取市場休市資料');
        const restData = await response.json();
        
        // 生成日曆
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // 獲取所有市場列表
        const markets = [...new Set(restData.map(item => item.MarketName))].sort();
        
        let calendarHTML = `
            <div style="text-align: right; margin-bottom: 15px;">
                <button onclick="document.getElementById('calendarContainer').style.display='none'; document.getElementById('calendarOverlay').style.display='none';" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
            </div>
            <h2 style="text-align: center; margin-bottom: 20px;">市場休市日曆</h2>
            <div style="margin-bottom: 20px;">
                <label for="marketFilter" style="display: block; margin-bottom: 5px; font-weight: bold;">選擇市場：</label>
                <select id="marketFilter" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
                    <option value="all">全部市場</option>
                    ${markets.map(market => `<option value="${market}">${market}</option>`).join('')}
                </select>
            </div>
        `;

        for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
            const month = (currentMonth + monthOffset) % 12;
            const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let day = 1;

            calendarHTML += `
                <div style="margin-bottom: 30px;">
                    <h3 style="text-align: center; margin-bottom: 15px;">${year}年${month + 1}月</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">日</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">一</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">二</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">三</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">四</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">五</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">六</th>
                        </tr>
            `;

            for (let i = 0; i < 6; i++) {
                calendarHTML += '<tr>';
                for (let j = 0; j < 7; j++) {
                    if (i === 0 && j < firstDay.getDay()) {
                        calendarHTML += '<td style="padding: 8px; border: 1px solid #ddd;"></td>';
                    } else if (day > lastDay.getDate()) {
                        calendarHTML += '<td style="padding: 8px; border: 1px solid #ddd;"></td>';
                    } else {
                        const date = new Date(year, month, day);
                        const isMonday = date.getDay() === 1;
                        const yearMonth = year.toString().slice(-2) + (month + 1).toString().padStart(2, '0');
                        const dayStr = day.toString().padStart(2, '0');
                        
                        // 獲取當天休市的市場
                        const restMarkets = restData.filter(market => 
                            market.YearMonth === yearMonth && 
                            market.ClosedDate.split('、').includes(dayStr)
                        );
                        
                        let cellStyle = 'padding: 8px; border: 1px solid #ddd;';
                        let cellContent = day;
                        let tooltipContent = '';
                        
                        if (restMarkets.length > 0) {
                            cellStyle += 'background-color: #ffcdd2;';
                            tooltipContent = restMarkets.map(market => 
                                `${market.MarketName} ${market.MarketType}市場`
                            ).join('<br>');
                            cellContent += `<br><small style="color: #d32f2f;">休市</small>`;
                        } else if (isMonday) {
                            cellStyle += 'background-color: #fff9c4;';
                            cellContent += '<br><small style="color: #f57f17;">通常休市</small>';
                        }
                        
                        // 添加 tooltip
                        if (tooltipContent) {
                            cellStyle += 'position: relative;';
                            cellContent += `
                                <div style="display: none; position: absolute; background: white; border: 1px solid #ddd; padding: 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 1000; min-width: 150px; left: 100%; top: 0;">
                                    ${tooltipContent}
                                </div>
                            `;
                        }
                        
                        calendarHTML += `<td style="${cellStyle}" onmouseover="this.querySelector('div')?.style.display='block'" onmouseout="this.querySelector('div')?.style.display='none'">${cellContent}</td>`;
                        day++;
                    }
                }
                calendarHTML += '</tr>';
                if (day > lastDay.getDate()) break;
            }
            
            calendarHTML += `
                    </table>
                    <div style="margin-top: 10px; font-size: 14px;">
                        <span style="display: inline-block; margin-right: 15px;">
                            <span style="display: inline-block; width: 15px; height: 15px; background-color: #ffcdd2; margin-right: 5px;"></span>
                            休市日
                        </span>
                        <span style="display: inline-block;">
                            <span style="display: inline-block; width: 15px; height: 15px; background-color: #fff9c4; margin-right: 5px;"></span>
                            通常休市（週一）
                        </span>
                    </div>
                </div>
            `;
        }
        
        // 添加市場過濾功能
        calendarHTML += `
            <script>
                document.getElementById('marketFilter').addEventListener('change', function() {
                    const selectedMarket = this.value;
                    const cells = document.querySelectorAll('#calendarContainer td');
                    cells.forEach(cell => {
                        if (selectedMarket === 'all') {
                            cell.style.display = '';
                        } else {
                            const tooltip = cell.querySelector('div');
                            if (tooltip) {
                                cell.style.display = tooltip.textContent.includes(selectedMarket) ? '' : 'none';
                            }
                        }
                    });
                });
            </script>
        `;
        
        const calendarContainer = document.getElementById('calendarContainer');
        calendarContainer.innerHTML = calendarHTML;
        calendarContainer.style.display = 'block';
        document.getElementById('calendarOverlay').style.display = 'block';
    } catch (error) {
        console.error('獲取市場休市資料失敗:', error);
        alert('無法獲取市場休市資料，請稍後再試');
    }
}

// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    
    // 綁定休市日曆按鈕點擊事件
    const checkRestButton = document.getElementById('checkRestButton');
    if (checkRestButton) {
        checkRestButton.addEventListener('click', showMarketRestCalendar);
    }
    
    // 點擊遮罩層關閉日曆
    const calendarOverlay = document.getElementById('calendarOverlay');
    if (calendarOverlay) {
        calendarOverlay.addEventListener('click', () => {
            document.getElementById('calendarContainer').style.display = 'none';
            calendarOverlay.style.display = 'none';
        });
    }
    
    // ... existing code ...
});

// 開發者模式相關變數
let devModeClickCount = 0;
let lastClickTime = 0;
let isDevModeActive = false;
const CLICK_THRESHOLD = 5; // 需要點擊的次數
const CLICK_TIMEOUT = 2000; // 點擊超時時間（毫秒）

// 初始化開發者模式
function initDevMode() {
    // 創建開發者模式按鈕
    const devModeBtn = document.createElement('button');
    devModeBtn.textContent = '開發者模式';
    devModeBtn.className = 'dev-mode-btn';
    devModeBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s;
    `;
    
    // 滑鼠懸停效果
    devModeBtn.addEventListener('mouseover', () => {
        devModeBtn.style.opacity = '1';
    });
    devModeBtn.addEventListener('mouseout', () => {
        devModeBtn.style.opacity = '0.7';
    });
    
    // 點擊事件
    devModeBtn.addEventListener('click', () => {
        const devModePanel = document.getElementById('devModePanel');
        if (devModePanel) {
            devModePanel.style.display = devModePanel.style.display === 'none' ? 'block' : 'none';
        } else {
            createDevModePanel();
        }
    });
    
    document.body.appendChild(devModeBtn);
}

// 創建開發者模式面板
function createDevModePanel() {
    const panel = document.createElement('div');
    panel.id = 'devModePanel';
    panel.className = 'dev-mode-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
        z-index: 1001;
        width: 80%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    panel.innerHTML = `
        <div class="panel-header">
            <h3>開發者模式</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="action-buttons">
            <button class="action-btn" style="background-color: #4CAF50;">查看 API 資料</button>
            <button class="action-btn" style="background-color: #2196F3;">查看資料庫</button>
            <button class="action-btn" style="background-color: #FF9800;">功能設定</button>
            <button class="action-btn" style="background-color: #9C27B0;">主題設定</button>
        </div>
    `;
    
    // 添加樣式
    const style = document.createElement('style');
    style.textContent = `
        .dev-mode-panel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .dev-mode-panel .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }
        
        .dev-mode-panel .action-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
        }
        
        .dev-mode-panel .action-btn {
            padding: 10px;
            border: none;
            border-radius: 5px;
            color: white;
            cursor: pointer;
            transition: opacity 0.3s;
        }
        
        .dev-mode-panel .action-btn:hover {
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);
    
    // 關閉按鈕事件
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });
    
    // 按鈕事件
    const buttons = panel.querySelectorAll('.action-btn');
    buttons[0].addEventListener('click', showApiData);
    buttons[1].addEventListener('click', viewDatabase);
    buttons[2].addEventListener('click', showFeatureSettings);
    buttons[3].addEventListener('click', showThemeSettings);
    
    document.body.appendChild(panel);
}

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', () => {
    // ... 其他初始化程式碼 ...
    
    // 初始化開發者模式
    initDevMode();
});

// 初始化環境設定
function initEnvironmentSettings() {
    const environmentRadios = document.querySelectorAll('input[name="environment"]');
    
    // 載入已儲存的環境設定
    const savedEnv = localStorage.getItem('environment') || 'production';
    document.querySelector(`#env-${savedEnv}`).checked = true;
    
    // 監聽環境變更
    environmentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedEnv = e.target.value;
            localStorage.setItem('environment', selectedEnv);
            document.title = `農產品交易資料分析系統 - ${selectedEnv}`;
            console.log(`環境已切換至：${selectedEnv}`);
            
            // 更新抓取更多資料按鈕的顯示狀態
            const fetchMoreDataBtn = document.getElementById('fetchMoreData');
            if (fetchMoreDataBtn) {
                fetchMoreDataBtn.style.display = selectedEnv === 'development' ? 'inline-block' : 'none';
            }
        });
    });
}

// 初始化開發者模式功能
function initDevModeFeatures() {
    // 添加查看 API 資料按鈕
    const devModePanel = document.getElementById('devModePanel');
    if (devModePanel) {
        const apiViewerBtn = document.createElement('button');
        apiViewerBtn.textContent = '查看 API 資料';
        apiViewerBtn.className = 'action-btn';
        apiViewerBtn.style.backgroundColor = '#9C27B0';
        apiViewerBtn.addEventListener('click', showApiData);
        
        // 將按鈕添加到操作按鈕組
        const actionButtons = devModePanel.querySelector('.action-buttons');
        if (actionButtons) {
            actionButtons.appendChild(apiViewerBtn);
        }
    }
}

// 顯示 API 資料
async function showApiData() {
    try {
        // 創建對話框
        const dialog = document.createElement('div');
        dialog.className = 'api-data-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>API 資料查看器</h3>
                    <button class="close-btn">×</button>
                </div>
                <div class="dialog-body">
                    <div class="loading">載入中...</div>
                    <div class="api-data-content" style="display: none;">
                        <div class="api-info">
                            <h4>API 資訊</h4>
                            <p>URL: <span class="api-url"></span></p>
                            <p>狀態: <span class="api-status"></span></p>
                            <p>資料筆數: <span class="data-count"></span></p>
                            <p>錯誤訊息: <span class="error-message"></span></p>
                        </div>
                        <div class="data-preview">
                            <h4>資料預覽</h4>
                            <pre class="json-preview"></pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到頁面
        document.body.appendChild(dialog);
        
        // 關閉按鈕事件
        const closeBtn = dialog.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => dialog.remove());
        
        // 獲取 API 資料
        const apiUrl = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
        console.log('正在請求 API:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        console.log('API 回應狀態:', response.status, response.statusText);
        
        // 更新 API 資訊
        const apiUrlElement = dialog.querySelector('.api-url');
        const apiStatusElement = dialog.querySelector('.api-status');
        const dataCountElement = dialog.querySelector('.data-count');
        const jsonPreviewElement = dialog.querySelector('.json-preview');
        const errorMessageElement = dialog.querySelector('.error-message');
        
        apiUrlElement.textContent = apiUrl;
        apiStatusElement.textContent = response.ok ? '成功' : '失敗';
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            console.log('回應內容類型:', contentType);
            
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log('獲取到的資料:', data);
                
                if (Array.isArray(data)) {
                    dataCountElement.textContent = data.length;
                    jsonPreviewElement.textContent = JSON.stringify(data.slice(0, 5), null, 2);
                } else {
                    dataCountElement.textContent = '非陣列格式';
                    jsonPreviewElement.textContent = JSON.stringify(data, null, 2);
                }
            } else {
                const text = await response.text();
                console.log('非 JSON 回應:', text);
                errorMessageElement.textContent = '回應不是 JSON 格式';
                jsonPreviewElement.textContent = text;
            }
        } else {
            const errorText = await response.text();
            console.error('API 錯誤:', errorText);
            errorMessageElement.textContent = `錯誤 ${response.status}: ${response.statusText}`;
            jsonPreviewElement.textContent = errorText;
        }
        
        // 顯示資料內容
        dialog.querySelector('.loading').style.display = 'none';
        dialog.querySelector('.api-data-content').style.display = 'block';
        
    } catch (error) {
        console.error('顯示 API 資料時發生錯誤:', error);
        showNotification('錯誤', `無法顯示 API 資料: ${error.message}`);
    }
}

// 添加樣式
const style = document.createElement('style');
style.textContent = `
    .api-data-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .api-data-dialog .dialog-content {
        background: white;
        padding: 20px;
        border-radius: 10px;
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
    }
    
    .api-data-dialog .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .api-data-dialog .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .api-data-dialog .api-info {
        margin-bottom: 20px;
        padding: 15px;
        background: #f5f5f5;
        border-radius: 5px;
    }
    
    .api-data-dialog .error-message {
        color: #d32f2f;
        font-weight: bold;
    }
    
    .api-data-dialog .data-preview {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
    }
    
    .api-data-dialog .json-preview {
        margin: 0;
        white-space: pre-wrap;
        font-family: monospace;
    }
    
    .api-data-dialog .loading {
        text-align: center;
        padding: 20px;
        color: #666;
    }
`;
document.head.appendChild(style);

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', () => {
    // ... 其他初始化程式碼 ...
    
    // 初始化開發者模式功能
    initDevModeFeatures();
});

// 初始化抓取更多資料按鈕
function initFetchMoreDataButton() {
    const fetchMoreDataBtn = document.getElementById('fetchMoreData');
    if (fetchMoreDataBtn) {
        // 只在開發環境中顯示按鈕
        const currentEnv = localStorage.getItem('environment') || 'production';
        if (currentEnv === 'development') {
            fetchMoreDataBtn.style.display = 'inline-block';
            fetchMoreDataBtn.addEventListener('click', fetchMoreData);
        } else {
            fetchMoreDataBtn.style.display = 'none';
        }
    }
}

// 抓取更多資料
async function fetchMoreData() {
    try {
        // 檢查是否有選擇作物
        if (!selectedCrop) {
            showNotification('提示', '請先選擇作物');
            return;
        }

        // 顯示載入中提示
        showNotification('系統訊息', '正在檢查資料可用性...');
        
        // 顯示載入動畫
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'flex';
        }

        // 獲取當前作物的資料
        const currentData = await getCropData(selectedCrop);
        if (!currentData || currentData.length === 0) {
            showNotification('提示', '目前沒有該作物的資料');
            return;
        }

        // 分析資料可用性
        const dataAvailability = analyzeDataAvailability(currentData);
        
        // 顯示資料可用性通知
        showDataAvailabilityNotification(dataAvailability);

        // 如果沒有可用的新資料，直接返回
        if (!dataAvailability.hasNewData) {
            showNotification('提示', '目前沒有可用的新資料');
            return;
        }

        // 顯示載入中提示
        showNotification('系統訊息', '開始抓取更多資料...');

        // 模擬抓取資料的過程
        const response = await fetch('https://api.example.com/more-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                environment: localStorage.getItem('environment'),
                crop: selectedCrop,
                availableDates: dataAvailability.availableDates
            })
        });

        if (!response.ok) {
            throw new Error('抓取資料失敗');
        }

        const data = await response.json();
        
        // 更新資料庫
        await updateDatabase(data);
        
        // 更新 UI
        updateUIWithNewData(data);
        
        // 顯示成功訊息
        showNotification('系統訊息', '成功抓取更多資料！');
    } catch (error) {
        console.error('抓取資料時發生錯誤:', error);
        showNotification('錯誤', '抓取資料失敗，請稍後再試。');
    } finally {
        // 隱藏載入動畫
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

// 分析資料可用性
function analyzeDataAvailability(data) {
    // 獲取當前日期
    const today = new Date();
    const lastDate = new Date(Math.max(...data.map(item => new Date(item.date))));
    
    // 計算可用的日期範圍
    const availableDates = [];
    const currentDate = new Date(lastDate);
    currentDate.setDate(currentDate.getDate() + 1); // 從最後一筆資料的隔天開始

    while (currentDate <= today) {
        // 檢查是否為週末
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 是週日，6 是週六
            availableDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        hasNewData: availableDates.length > 0,
        availableDates: availableDates,
        lastUpdateDate: lastDate,
        totalAvailableDays: availableDates.length
    };
}

// 顯示資料可用性通知
function showDataAvailabilityNotification(availability) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = 'notification data-availability';
    
    // 格式化日期
    const formatDate = (date) => {
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    // 建立通知內容
    let content = `
        <h4>資料可用性分析</h4>
        <p>最後更新日期：${formatDate(availability.lastUpdateDate)}</p>
        <p>可抓取資料天數：${availability.totalAvailableDays} 天</p>
    `;

    if (availability.hasNewData) {
        content += `
            <p>可抓取日期範圍：</p>
            <ul>
                <li>開始：${formatDate(availability.availableDates[0])}</li>
                <li>結束：${formatDate(availability.availableDates[availability.availableDates.length - 1])}</li>
            </ul>
            <p>是否要抓取這些資料？</p>
            <div class="notification-actions">
                <button onclick="confirmFetchData()" class="confirm-btn">確認抓取</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="cancel-btn">取消</button>
            </div>
        `;
    } else {
        content += '<p>目前沒有可用的新資料</p>';
    }

    notification.innerHTML = content;
    notificationArea.appendChild(notification);

    // 5秒後自動移除通知（如果沒有新資料）
    if (!availability.hasNewData) {
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// 確認抓取資料
async function confirmFetchData() {
    // 移除通知
    const notification = document.querySelector('.data-availability');
    if (notification) {
        notification.remove();
    }
    
    // 繼續抓取資料的流程
    await fetchMoreData();
}

// 更新資料庫
async function updateDatabase(newData) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(['cropData'], 'readwrite');
        const store = transaction.objectStore('cropData');

        // 更新資料
        for (const item of newData) {
            await store.put(item);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('更新資料庫時發生錯誤:', error);
        throw error;
    }
}

// 更新 UI 顯示新資料
function updateUIWithNewData(data) {
    // 更新圖表
    if (selectedCrop) {
        const cropData = getCropData(selectedCrop);
        if (cropData) {
            showPriceTrend();
            showVolumeDistribution();
            showPriceDistribution();
            showSeasonalAnalysis();
        }
    }

    // 更新詳細資料表格
    updateDetailTable(data);
}

// 啟動開發者模式
function activateDevMode() {
    if (isDevModeActive) return;
    
    isDevModeActive = true;
    const devModePanel = document.getElementById('devModePanel');
    if (devModePanel) {
        devModePanel.style.display = 'block';
        devModePanel.classList.add('active');
        console.log('開發者模式已啟動');
        
        // 確保功能按鈕事件被綁定
        initDevModeFeatures();
    }
}

// 資料庫操作相關功能
async function viewDatabase() {
    try {
        const dbViewer = document.createElement('div');
        dbViewer.className = 'db-viewer';
        dbViewer.innerHTML = `
            <div class="db-viewer-header">
                <h3>資料庫查看器</h3>
                <div class="db-viewer-controls">
                    <input type="text" id="dbSearchInput" placeholder="搜尋資料...">
                    <select id="dbTableSelect">
                        <option value="farmTrans">農產品交易行情</option>
                        <option value="marketRest">市場休市資料</option>
                        <option value="priceAlerts">價格提醒設定</option>
                        <option value="userSettings">使用者設定</option>
                    </select>
                    <button id="refreshDbData">重新整理</button>
                    <button id="exportDbData">匯出資料</button>
                </div>
            </div>
            <div class="db-viewer-content">
                <div class="db-table-container">
                    <table id="dbDataTable">
                        <thead>
                            <tr id="dbTableHeader"></tr>
                        </thead>
                        <tbody id="dbTableBody"></tbody>
                    </table>
                </div>
                <div class="db-pagination">
                    <button id="prevPage">上一頁</button>
                    <span id="pageInfo">第 1 頁</span>
                    <button id="nextPage">下一頁</button>
                </div>
            </div>
        `;

        const devModeContent = document.querySelector('.dev-mode-content');
        devModeContent.appendChild(dbViewer);

        // 初始化資料庫查看器
        initDatabaseViewer();
    } catch (error) {
        console.error('初始化資料庫查看器時發生錯誤:', error);
        showNotification('錯誤', '初始化資料庫查看器失敗');
    }
}

async function backupDatabase() {
    try {
        const backupData = {
            farmTrans: await getIndexedDBData('farmTrans'),
            marketRest: await getIndexedDBData('marketRest'),
            priceAlerts: await getIndexedDBData('priceAlerts'),
            userSettings: await getIndexedDBData('userSettings'),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `database_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('成功', '資料庫備份已完成');
    } catch (error) {
        console.error('備份資料庫時發生錯誤:', error);
        showNotification('錯誤', '備份資料庫失敗');
    }
}

async function restoreDatabase() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const backupData = JSON.parse(event.target.result);
                        
                        // 驗證備份資料
                        if (!backupData.timestamp || !backupData.farmTrans) {
                            throw new Error('無效的備份檔案');
                        }

                        // 還原資料
                        await restoreIndexedDBData('farmTrans', backupData.farmTrans);
                        await restoreIndexedDBData('marketRest', backupData.marketRest);
                        await restoreIndexedDBData('priceAlerts', backupData.priceAlerts);
                        await restoreIndexedDBData('userSettings', backupData.userSettings);

                        showNotification('成功', '資料庫還原已完成');
                    } catch (error) {
                        console.error('還原資料庫時發生錯誤:', error);
                        showNotification('錯誤', '還原資料庫失敗');
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    } catch (error) {
        console.error('還原資料庫時發生錯誤:', error);
        showNotification('錯誤', '還原資料庫失敗');
    }
}

// IndexedDB 操作輔助函數
async function getIndexedDBData(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VegetableCatcherDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    });
}

async function restoreIndexedDBData(storeName, data) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VegetableCatcherDB', 1);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // 清除現有資料
            store.clear();
            
            // 新增備份資料
            data.forEach(item => {
                store.add(item);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
    });
}

// 修改開發者模式功能初始化
function initDevModeFeatures() {
    const devModeContent = document.querySelector('.dev-mode-content');
    
    // 新增農業氣象影片區塊
    const weatherSection = document.createElement('div');
    weatherSection.className = 'dev-mode-section';
    weatherSection.innerHTML = `
        <h3>農業氣象</h3>
        <button id="showAgriculturalWeather">今日農業氣象</button>
    `;
    devModeContent.appendChild(weatherSection);

    // 綁定農業氣象按鈕事件
    document.getElementById('showAgriculturalWeather').addEventListener('click', showAgriculturalWeatherVideo);
    
    // ... existing code ...
}

// ... existing code ...

// 環境特定的預設設定
const ENV_DEFAULT_CONFIGS = {
    production: {
        environment: 'production',
        appMode: 'normal',
        api: {
            baseUrl: 'https://api.example.com',
            version: 'v1',
            key: '',
            timeout: 30000,
            retries: 3
        },
        database: {
            type: 'indexeddb',
            version: '1.0',
            sizeLimit: 100
        },
        cache: {
            enabled: true,
            duration: 60,
            strategy: 'hybrid',
            maxSize: 200
        },
        logging: {
            level: 'error',
            outputs: {
                console: true,
                file: true,
                remote: true
            },
            retentionDays: 90
        },
        performance: {
            monitoring: true,
            samplingInterval: 10,
            optimization: true
        },
        security: {
            https: true,
            csp: true,
            xssProtection: true,
            csrfProtection: true
        },
        notifications: {
            push: true,
            priority: 'high',
            sound: true
        }
    },
    testing: {
        environment: 'testing',
        appMode: 'debug',
        api: {
            baseUrl: 'https://test-api.example.com',
            version: 'v1',
            key: '',
            timeout: 15000,
            retries: 5
        },
        database: {
            type: 'indexeddb',
            version: '1.0',
            sizeLimit: 50
        },
        cache: {
            enabled: true,
            duration: 5,
            strategy: 'memory',
            maxSize: 50
        },
        logging: {
            level: 'debug',
            outputs: {
                console: true,
                file: true,
                remote: false
            },
            retentionDays: 30
        },
        performance: {
            monitoring: true,
            samplingInterval: 5,
            optimization: false
        },
        security: {
            https: true,
            csp: true,
            xssProtection: true,
            csrfProtection: true
        },
        notifications: {
            push: true,
            priority: 'normal',
            sound: true
        }
    },
    testing2: {
        environment: 'testing2',
        appMode: 'debug',
        api: {
            baseUrl: 'https://test2-api.example.com',
            version: 'v2',
            key: '',
            timeout: 10000,
            retries: 7
        },
        database: {
            type: 'indexeddb',
            version: '2.0',
            sizeLimit: 75
        },
        cache: {
            enabled: true,
            duration: 10,
            strategy: 'hybrid',
            maxSize: 100
        },
        logging: {
            level: 'debug',
            outputs: {
                console: true,
                file: true,
                remote: true
            },
            retentionDays: 15
        },
        performance: {
            monitoring: true,
            samplingInterval: 3,
            optimization: true
        },
        security: {
            https: true,
            csp: true,
            xssProtection: true,
            csrfProtection: true
        },
        notifications: {
            push: true,
            priority: 'high',
            sound: true
        }
    },
    development: {
        environment: 'development',
        appMode: 'debug',
        api: {
            baseUrl: 'http://localhost:3000',
            version: 'dev',
            key: '',
            timeout: 5000,
            retries: 10
        },
        database: {
            type: 'indexeddb',
            version: 'dev',
            sizeLimit: 20
        },
        cache: {
            enabled: false,
            duration: 1,
            strategy: 'memory',
            maxSize: 10
        },
        logging: {
            level: 'trace',
            outputs: {
                console: true,
                file: false,
                remote: false
            },
            retentionDays: 7
        },
        performance: {
            monitoring: true,
            samplingInterval: 1,
            optimization: false
        },
        security: {
            https: false,
            csp: false,
            xssProtection: true,
            csrfProtection: false
        },
        notifications: {
            push: false,
            priority: 'low',
            sound: false
        }
    },
    staging: {
        environment: 'staging',
        appMode: 'normal',
        api: {
            baseUrl: 'https://staging-api.example.com',
            version: 'v1',
            key: '',
            timeout: 20000,
            retries: 4
        },
        database: {
            type: 'indexeddb',
            version: '1.0',
            sizeLimit: 75
        },
        cache: {
            enabled: true,
            duration: 30,
            strategy: 'hybrid',
            maxSize: 150
        },
        logging: {
            level: 'info',
            outputs: {
                console: true,
                file: true,
                remote: true
            },
            retentionDays: 60
        },
        performance: {
            monitoring: true,
            samplingInterval: 5,
            optimization: true
        },
        security: {
            https: true,
            csp: true,
            xssProtection: true,
            csrfProtection: true
        },
        notifications: {
            push: true,
            priority: 'normal',
            sound: true
        }
    }
};

// 修改 showEnvironmentSettings 函數
function showEnvironmentSettings() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>環境設定</h3>
            <div class="env-options">
                <div class="env-option">
                    <input type="radio" id="envProduction" name="environment" value="production" ${window.ENV_DEFAULT_CONFIGS.environment === 'production' ? 'checked' : ''}>
                    <label for="envProduction">
                        <div class="env-label">正式版環境</div>
                        <div class="env-desc">用於正式營運環境，具有完整的錯誤處理和日誌記錄</div>
                    </label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envTesting" name="environment" value="testing" ${window.ENV_DEFAULT_CONFIGS.environment === 'testing' ? 'checked' : ''}>
                    <label for="envTesting">
                        <div class="env-label">測試版環境</div>
                        <div class="env-desc">用於功能測試，具有詳細的除錯資訊</div>
                    </label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envTesting2" name="environment" value="testing2" ${window.ENV_DEFAULT_CONFIGS.environment === 'testing2' ? 'checked' : ''}>
                    <label for="envTesting2">
                        <div class="env-label">測試版環境 2</div>
                        <div class="env-desc">用於進階測試，具有效能監控功能</div>
                    </label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envDevelopment" name="environment" value="development" ${window.ENV_DEFAULT_CONFIGS.environment === 'development' ? 'checked' : ''}>
                    <label for="envDevelopment">開發版環境</label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envStaging" name="environment" value="staging" ${window.ENV_DEFAULT_CONFIGS.environment === 'staging' ? 'checked' : ''}>
                    <label for="envStaging">預備版環境</label>
                </div>
            </div>
            <div class="env-actions">
                <button id="saveEnv">儲存設定</button>
                <button id="closeEnvDialog">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 點擊外部區域關閉
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    });

    // ESC 鍵關閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dialog.remove();
        }
    });

    // 儲存設定
    document.getElementById('saveEnv').addEventListener('click', () => {
        const selectedEnv = document.querySelector('input[name="environment"]:checked').value;
        window.ENV_DEFAULT_CONFIGS.environment = selectedEnv;
        
        // 根據環境設定版本號
        if (selectedEnv === 'testing') {
            document.title = document.title.replace(/v\d+\.\d+\.\d+/, 'vtest');
        } else if (selectedEnv === 'testing2') {
            document.title = document.title.replace(/v\d+\.\d+\.\d+/, 'vtest2');
        } else {
            window.ENV_DEFAULT_CONFIGS.appMode = 'normal';
            // 恢復原始版本號
            const originalVersion = 'v1.0.0'; // 這裡可以根據實際情況修改
            document.title = document.title.replace(/vtest|vtest2|v\d+\.\d+\.\d+/, originalVersion);
        }
        
        localStorage.setItem('environment', selectedEnv);
        dialog.remove();
        showNotification('環境設定已更新');
    });

    // 關閉對話框
    document.getElementById('closeEnvDialog').addEventListener('click', () => {
        dialog.remove();
    });
}

function showParameterSettings() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>參數調整</h3>
            <div style="margin-bottom: 20px;">此功能尚未實作，請待後續更新。</div>
            <div class="env-actions"><button id="closeParamDialog">關閉</button></div>
        </div>
    `;
    document.body.appendChild(dialog);
    document.getElementById('closeParamDialog').onclick = () => dialog.remove();
}

function showThemeSettings() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>主題設定</h3>
            <div class="theme-categories">
                <div class="theme-category">
                    <h4>預設主題</h4>
                    <div class="theme-options">
                        <div class="theme-option">
                            <input type="radio" id="themeLight" name="theme" value="light" checked>
                            <label for="themeLight">
                                <div class="theme-preview light-theme"></div>
                                <div class="theme-info">
                                    <div class="theme-label">淺色主題</div>
                                    <div class="theme-desc">明亮的配色方案，適合日間使用</div>
                                </div>
                            </label>
                        </div>
                        <div class="theme-option">
                            <input type="radio" id="themeDark" name="theme" value="dark">
                            <label for="themeDark">
                                <div class="theme-preview dark-theme"></div>
                                <div class="theme-info">
                                    <div class="theme-label">深色主題</div>
                                    <div class="theme-desc">暗色配色方案，適合夜間使用</div>
                                </div>
                            </label>
                        </div>
                        <div class="theme-option">
                            <input type="radio" id="themeSystem" name="theme" value="system">
                            <label for="themeSystem">
                                <div class="theme-preview system-theme"></div>
                                <div class="theme-info">
                                    <div class="theme-label">跟隨系統</div>
                                    <div class="theme-desc">自動跟隨系統的主題設定</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="theme-category">
                    <h4>自訂主題</h4>
                    <div class="theme-customization">
                        <div class="color-picker">
                            <label>
                                <span>主要顏色</span>
                                <input type="color" id="primaryColor" value="#4CAF50">
                            </label>
                            <label>
                                <span>次要顏色</span>
                                <input type="color" id="secondaryColor" value="#2196F3">
                            </label>
                            <label>
                                <span>背景顏色</span>
                                <input type="color" id="backgroundColor" value="#FFFFFF">
                            </label>
                            <label>
                                <span>文字顏色</span>
                                <input type="color" id="textColor" value="#333333">
                            </label>
                        </div>
                        <div class="font-settings">
                            <label>
                                <span>字體大小</span>
                                <select id="fontSize">
                                    <option value="small">小</option>
                                    <option value="medium" selected>中</option>
                                    <option value="large">大</option>
                                </select>
                            </label>
                            <label>
                                <span>字體樣式</span>
                                <select id="fontFamily">
                                    <option value="system">系統預設</option>
                                    <option value="sans-serif">無襯線</option>
                                    <option value="serif">襯線</option>
                                    <option value="monospace">等寬</option>
                                </select>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="theme-actions">
                <button id="saveTheme" class="primary-button">儲存設定</button>
                <button id="resetTheme" class="secondary-button">重設為預設值</button>
                <button id="closeThemeDialog" class="secondary-button">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 載入已儲存的設定
    const savedTheme = JSON.parse(localStorage.getItem('themeSettings') || '{}');
    if (savedTheme.theme) {
        document.querySelector(`input[name="theme"][value="${savedTheme.theme}"]`).checked = true;
    }
    if (savedTheme.colors) {
        document.getElementById('primaryColor').value = savedTheme.colors.primary || '#4CAF50';
        document.getElementById('secondaryColor').value = savedTheme.colors.secondary || '#2196F3';
        document.getElementById('backgroundColor').value = savedTheme.colors.background || '#FFFFFF';
        document.getElementById('textColor').value = savedTheme.colors.text || '#333333';
    }
    if (savedTheme.font) {
        document.getElementById('fontSize').value = savedTheme.font.size || 'medium';
        document.getElementById('fontFamily').value = savedTheme.font.family || 'system';
    }

    // 點擊外部區域關閉
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    });

    // ESC 鍵關閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dialog.remove();
        }
    });

    // 儲存設定
    document.getElementById('saveTheme').addEventListener('click', () => {
        const themeSettings = {
            theme: document.querySelector('input[name="theme"]:checked').value,
            colors: {
                primary: document.getElementById('primaryColor').value,
                secondary: document.getElementById('secondaryColor').value,
                background: document.getElementById('backgroundColor').value,
                text: document.getElementById('textColor').value
            },
            font: {
                size: document.getElementById('fontSize').value,
                family: document.getElementById('fontFamily').value
            }
        };

        localStorage.setItem('themeSettings', JSON.stringify(themeSettings));
        applyTheme(themeSettings);
        dialog.remove();
        showNotification('主題設定已更新');
    });

    // 重設為預設值
    document.getElementById('resetTheme').addEventListener('click', () => {
        if (confirm('確定要重設所有主題設定為預設值嗎？')) {
            document.getElementById('themeLight').checked = true;
            document.getElementById('primaryColor').value = '#4CAF50';
            document.getElementById('secondaryColor').value = '#2196F3';
            document.getElementById('backgroundColor').value = '#FFFFFF';
            document.getElementById('textColor').value = '#333333';
            document.getElementById('fontSize').value = 'medium';
            document.getElementById('fontFamily').value = 'system';
        }
    });

    // 關閉對話框
    document.getElementById('closeThemeDialog').addEventListener('click', () => {
        dialog.remove();
    });
}

function applyTheme(themeSettings) {
    const root = document.documentElement;
    
    // 設定主題
    if (themeSettings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        root.setAttribute('data-theme', themeSettings.theme);
    }

    // 設定顏色
    root.style.setProperty('--primary-color', themeSettings.colors.primary);
    root.style.setProperty('--secondary-color', themeSettings.colors.secondary);
    root.style.setProperty('--background-color', themeSettings.colors.background);
    root.style.setProperty('--text-color', themeSettings.colors.text);

    // 設定字體
    root.style.setProperty('--font-size', themeSettings.font.size);
    root.style.setProperty('--font-family', themeSettings.font.family);
}

// ... existing code ...

// 關閉開發者模式
function deactivateDevMode() {
    isDevModeActive = false;
    const devModePanel = document.getElementById('devModePanel');
    if (devModePanel) {
        devModePanel.style.display = 'none';
        devModePanel.classList.remove('active');
        console.log('開發者模式已關閉');
    }
}

// ... existing code ...

// 假設有一個函數用於更新表格資料
function updateDetailTable(data) {
    const tableBody = document.getElementById('detailTableBody');
    tableBody.innerHTML = ''; // 清空現有資料

    data.forEach(item => {
        const row = document.createElement('tr');

        const dateCell = document.createElement('td');
        dateCell.textContent = item.date;
        row.appendChild(dateCell);

        const marketCell = document.createElement('td');
        marketCell.textContent = item.market;
        row.appendChild(marketCell);

        const priceCell = document.createElement('td');
        priceCell.textContent = item.price;
        // 根據價格變動設置顏色
        if (item.priceChange > 0) {
            priceCell.classList.add('price-up');
        } else if (item.priceChange < 0) {
            priceCell.classList.add('price-down');
        }
        row.appendChild(priceCell);

        const volumeCell = document.createElement('td');
        volumeCell.textContent = item.volume;
        row.appendChild(volumeCell);

        tableBody.appendChild(row);
    });
}

// ... existing code ...

// 參數調整相關功能
function showParameterSettings() {
    const paramsDialog = document.createElement('div');
    paramsDialog.className = 'dev-settings-dialog';
    paramsDialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>參數調整</h3>
            <div class="params-section">
                <h4>資料更新設定</h4>
                <div class="params-group">
                    <div class="param-item">
                        <label for="updateInterval">更新間隔（分鐘）</label>
                        <input type="number" id="updateInterval" min="1" max="1440" value="30">
                    </div>
                    <div class="param-item">
                        <label for="maxRetries">最大重試次數</label>
                        <input type="number" id="maxRetries" min="1" max="10" value="3">
                    </div>
                    <div class="param-item">
                        <label for="retryDelay">重試延遲（秒）</label>
                        <input type="number" id="retryDelay" min="1" max="60" value="5">
                    </div>
                </div>
            </div>
            <div class="params-section">
                <h4>快取設定</h4>
                <div class="params-group">
                    <div class="param-item">
                        <label for="cacheSize">快取大小（MB）</label>
                        <input type="number" id="cacheSize" min="1" max="1000" value="100">
                    </div>
                    <div class="param-item">
                        <label for="cacheExpiry">快取過期時間（小時）</label>
                        <input type="number" id="cacheExpiry" min="1" max="72" value="24">
                    </div>
                </div>
            </div>
            <div class="params-section">
                <h4>效能設定</h4>
                <div class="params-group">
                    <div class="param-item">
                        <label for="batchSize">批次處理大小</label>
                        <input type="number" id="batchSize" min="10" max="1000" value="100">
                    </div>
                    <div class="param-item">
                        <label for="maxConcurrent">最大並行請求數</label>
                        <input type="number" id="maxConcurrent" min="1" max="10" value="3">
                    </div>
                    <div class="param-item">
                        <label for="timeout">請求超時（秒）</label>
                        <input type="number" id="timeout" min="1" max="60" value="30">
                    </div>
                </div>
            </div>
            <div class="params-section">
                <h4>UI 設定</h4>
                <div class="params-group">
                    <div class="param-item">
                        <label for="animationSpeed">動畫速度（毫秒）</label>
                        <input type="number" id="animationSpeed" min="100" max="2000" value="300">
                    </div>
                    <div class="param-item">
                        <label for="notificationDuration">通知顯示時間（秒）</label>
                        <input type="number" id="notificationDuration" min="1" max="10" value="5">
                    </div>
                    <div class="param-item">
                        <label for="tablePageSize">表格每頁筆數</label>
                        <input type="number" id="tablePageSize" min="5" max="100" value="20">
                    </div>
                </div>
            </div>
            <div class="params-section">
                <h4>進階設定</h4>
                <div class="params-group">
                    <div class="param-item">
                        <label for="debugMode">除錯模式</label>
                        <input type="checkbox" id="debugMode">
                    </div>
                    <div class="param-item">
                        <label for="performanceMode">效能模式</label>
                        <input type="checkbox" id="performanceMode">
                    </div>
                    <div class="param-item">
                        <label for="offlineMode">離線模式</label>
                        <input type="checkbox" id="offlineMode">
                    </div>
                </div>
            </div>
            <div class="env-actions">
                <button id="saveParams">儲存設定</button>
                <button id="resetParams">重設為預設值</button>
                <button id="cancelParams">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(paramsDialog);

    // 載入現有設定
    const paramsConfig = JSON.parse(localStorage.getItem('paramsConfig')) || {
        update: {
            interval: 30,
            maxRetries: 3,
            retryDelay: 5
        },
        cache: {
            size: 100,
            expiry: 24
        },
        performance: {
            batchSize: 100,
            maxConcurrent: 3,
            timeout: 30
        },
        ui: {
            animationSpeed: 300,
            notificationDuration: 5,
            tablePageSize: 20
        },
        advanced: {
            debugMode: false,
            performanceMode: false,
            offlineMode: false
        }
    };

    // 設定表單值
    document.getElementById('updateInterval').value = paramsConfig.update.interval;
    document.getElementById('maxRetries').value = paramsConfig.update.maxRetries;
    document.getElementById('retryDelay').value = paramsConfig.update.retryDelay;
    document.getElementById('cacheSize').value = paramsConfig.cache.size;
    document.getElementById('cacheExpiry').value = paramsConfig.cache.expiry;
    document.getElementById('batchSize').value = paramsConfig.performance.batchSize;
    document.getElementById('maxConcurrent').value = paramsConfig.performance.maxConcurrent;
    document.getElementById('timeout').value = paramsConfig.performance.timeout;
    document.getElementById('animationSpeed').value = paramsConfig.ui.animationSpeed;
    document.getElementById('notificationDuration').value = paramsConfig.ui.notificationDuration;
    document.getElementById('tablePageSize').value = paramsConfig.ui.tablePageSize;
    document.getElementById('debugMode').checked = paramsConfig.advanced.debugMode;
    document.getElementById('performanceMode').checked = paramsConfig.advanced.performanceMode;
    document.getElementById('offlineMode').checked = paramsConfig.advanced.offlineMode;

    // 儲存設定
    document.getElementById('saveParams').addEventListener('click', () => {
        const newConfig = {
            update: {
                interval: parseInt(document.getElementById('updateInterval').value),
                maxRetries: parseInt(document.getElementById('maxRetries').value),
                retryDelay: parseInt(document.getElementById('retryDelay').value)
            },
            cache: {
                size: parseInt(document.getElementById('cacheSize').value),
                expiry: parseInt(document.getElementById('cacheExpiry').value)
            },
            performance: {
                batchSize: parseInt(document.getElementById('batchSize').value),
                maxConcurrent: parseInt(document.getElementById('maxConcurrent').value),
                timeout: parseInt(document.getElementById('timeout').value)
            },
            ui: {
                animationSpeed: parseInt(document.getElementById('animationSpeed').value),
                notificationDuration: parseInt(document.getElementById('notificationDuration').value),
                tablePageSize: parseInt(document.getElementById('tablePageSize').value)
            },
            advanced: {
                debugMode: document.getElementById('debugMode').checked,
                performanceMode: document.getElementById('performanceMode').checked,
                offlineMode: document.getElementById('offlineMode').checked
            }
        };

        localStorage.setItem('paramsConfig', JSON.stringify(newConfig));
        applyParameters(newConfig);
        paramsDialog.remove();
        showNotification('成功', '參數設定已更新');
    });

    // 重設為預設值
    document.getElementById('resetParams').addEventListener('click', () => {
        const defaultConfig = {
            update: {
                interval: 30,
                maxRetries: 3,
                retryDelay: 5
            },
            cache: {
                size: 100,
                expiry: 24
            },
            performance: {
                batchSize: 100,
                maxConcurrent: 3,
                timeout: 30
            },
            ui: {
                animationSpeed: 300,
                notificationDuration: 5,
                tablePageSize: 20
            },
            advanced: {
                debugMode: false,
                performanceMode: false,
                offlineMode: false
            }
        };

        localStorage.setItem('paramsConfig', JSON.stringify(defaultConfig));
        applyParameters(defaultConfig);
        paramsDialog.remove();
        showNotification('成功', '參數設定已重設為預設值');
    });

    // 取消按鈕
    document.getElementById('cancelParams').addEventListener('click', () => {
        paramsDialog.remove();
    });
}

// 套用參數設定
function applyParameters(config) {
    // 更新設定
    window.UPDATE_INTERVAL = config.update.interval;
    window.MAX_RETRIES = config.update.maxRetries;
    window.RETRY_DELAY = config.update.retryDelay;

    // 快取設定
    window.CACHE_SIZE = config.cache.size;
    window.CACHE_EXPIRY = config.cache.expiry;

    // 效能設定
    window.BATCH_SIZE = config.performance.batchSize;
    window.MAX_CONCURRENT = config.performance.maxConcurrent;
    window.TIMEOUT = config.performance.timeout;

    // UI 設定
    window.ANIMATION_SPEED = config.ui.animationSpeed;
    window.NOTIFICATION_DURATION = config.ui.notificationDuration;
    window.TABLE_PAGE_SIZE = config.ui.tablePageSize;

    // 進階設定
    window.DEBUG_MODE = config.advanced.debugMode;
    window.PERFORMANCE_MODE = config.advanced.performanceMode;
    window.OFFLINE_MODE = config.advanced.offlineMode;

    // 更新 UI
    updateUIWithNewParameters();
}

// 更新 UI 以反映新的參數設定
function updateUIWithNewParameters() {
    // 更新動畫速度
    document.documentElement.style.setProperty('--animation-speed', `${window.ANIMATION_SPEED}ms`);

    // 更新表格分頁
    const tables = document.querySelectorAll('.detail-table');
    tables.forEach(table => {
        if (table.dataset.pageSize !== window.TABLE_PAGE_SIZE.toString()) {
            table.dataset.pageSize = window.TABLE_PAGE_SIZE;
            // 重新渲染表格
            renderTable(table);
        }
    });

    // 更新通知持續時間
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
        notification.style.animationDuration = `${window.NOTIFICATION_DURATION}s`;
    });

    // 更新除錯模式
    if (window.DEBUG_MODE) {
        document.body.classList.add('debug-mode');
    } else {
        document.body.classList.remove('debug-mode');
    }

    // 更新效能模式
    if (window.PERFORMANCE_MODE) {
        document.body.classList.add('performance-mode');
    } else {
        document.body.classList.remove('performance-mode');
    }

    // 更新離線模式
    if (window.OFFLINE_MODE) {
        document.body.classList.add('offline-mode');
        // 啟用離線功能
        enableOfflineMode();
    } else {
        document.body.classList.remove('offline-mode');
        // 停用離線功能
        disableOfflineMode();
    }
}

// ... existing code ...

// 主題設定相關功能
function showThemeSettings() {
    const themeDialog = document.createElement('div');
    themeDialog.className = 'dev-settings-dialog';
    themeDialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>主題設定</h3>
            <div class="theme-section">
                <h4>顏色設定</h4>
                <div class="color-group">
                    <div class="color-item">
                        <label for="primaryColor">主要顏色</label>
                        <input type="color" id="primaryColor" value="#1a73e8">
                    </div>
                    <div class="color-item">
                        <label for="secondaryColor">次要顏色</label>
                        <input type="color" id="secondaryColor" value="#34a853">
                    </div>
                    <div class="color-item">
                        <label for="backgroundColor">背景顏色</label>
                        <input type="color" id="backgroundColor" value="#2d2d2d">
                    </div>
                    <div class="color-item">
                        <label for="textColor">文字顏色</label>
                        <input type="color" id="textColor" value="#ffffff">
                    </div>
                    <div class="color-item">
                        <label for="accentColor">強調顏色</label>
                        <input type="color" id="accentColor" value="#fbbc05">
                    </div>
                    <div class="color-item">
                        <label for="errorColor">錯誤顏色</label>
                        <input type="color" id="errorColor" value="#ea4335">
                    </div>
                </div>
            </div>
            <div class="theme-section">
                <h4>字型設定</h4>
                <div class="font-group">
                    <div class="font-item">
                        <label for="fontFamily">字型</label>
                        <select id="fontFamily">
                            <option value="'Microsoft JhengHei', sans-serif">微軟正黑體</option>
                            <option value="'Noto Sans TC', sans-serif">思源黑體</option>
                            <option value="'PingFang TC', sans-serif">蘋方</option>
                            <option value="'Microsoft YaHei', sans-serif">微軟雅黑</option>
                        </select>
                    </div>
                    <div class="font-item">
                        <label for="baseFontSize">基礎字型大小</label>
                        <input type="number" id="baseFontSize" min="12" max="20" value="16">
                    </div>
                    <div class="font-item">
                        <label for="lineHeight">行高</label>
                        <input type="number" id="lineHeight" min="1" max="2" step="0.1" value="1.5">
                    </div>
                </div>
            </div>
            <div class="theme-section">
                <h4>間距設定</h4>
                <div class="spacing-group">
                    <div class="spacing-item">
                        <label for="spacingUnit">間距單位（px）</label>
                        <input type="number" id="spacingUnit" min="4" max="16" value="8">
                    </div>
                    <div class="spacing-item">
                        <label for="borderRadius">圓角大小（px）</label>
                        <input type="number" id="borderRadius" min="0" max="20" value="4">
                    </div>
                </div>
            </div>
            <div class="theme-section">
                <h4>動畫設定</h4>
                <div class="animation-group">
                    <div class="animation-item">
                        <label for="animationDuration">動畫持續時間（毫秒）</label>
                        <input type="number" id="animationDuration" min="100" max="1000" value="300">
                    </div>
                    <div class="animation-item">
                        <label for="animationCurve">動畫曲線</label>
                        <select id="animationCurve">
                            <option value="ease">Ease</option>
                            <option value="ease-in">Ease In</option>
                            <option value="ease-out">Ease Out</option>
                            <option value="ease-in-out">Ease In Out</option>
                            <option value="linear">Linear</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="theme-section">
                <h4>預設主題</h4>
                <div class="preset-group">
                    <button id="presetLight" class="preset-btn">淺色主題</button>
                    <button id="presetDark" class="preset-btn">深色主題</button>
                    <button id="presetHighContrast" class="preset-btn">高對比主題</button>
                </div>
            </div>
            <div class="env-actions">
                <button id="saveTheme">儲存設定</button>
                <button id="resetTheme">重設為預設值</button>
                <button id="cancelTheme">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(themeDialog);

    // 載入現有設定
    const themeConfig = JSON.parse(localStorage.getItem('themeConfig')) || {
        colors: {
            primary: '#1a73e8',
            secondary: '#34a853',
            background: '#2d2d2d',
            text: '#ffffff',
            accent: '#fbbc05',
            error: '#ea4335'
        },
        typography: {
            fontFamily: "'Microsoft JhengHei', sans-serif",
            baseFontSize: 16,
            lineHeight: 1.5
        },
        spacing: {
            unit: 8,
            borderRadius: 4
        },
        animation: {
            duration: 300,
            curve: 'ease'
        }
    };

    // 設定表單值
    document.getElementById('primaryColor').value = themeConfig.colors.primary;
    document.getElementById('secondaryColor').value = themeConfig.colors.secondary;
    document.getElementById('backgroundColor').value = themeConfig.colors.background;
    document.getElementById('textColor').value = themeConfig.colors.text;
    document.getElementById('accentColor').value = themeConfig.colors.accent;
    document.getElementById('errorColor').value = themeConfig.colors.error;
    document.getElementById('fontFamily').value = themeConfig.typography.fontFamily;
    document.getElementById('baseFontSize').value = themeConfig.typography.baseFontSize;
    document.getElementById('lineHeight').value = themeConfig.typography.lineHeight;
    document.getElementById('spacingUnit').value = themeConfig.spacing.unit;
    document.getElementById('borderRadius').value = themeConfig.spacing.borderRadius;
    document.getElementById('animationDuration').value = themeConfig.animation.duration;
    document.getElementById('animationCurve').value = themeConfig.animation.curve;

    // 儲存設定
    document.getElementById('saveTheme').addEventListener('click', () => {
        const newConfig = {
            colors: {
                primary: document.getElementById('primaryColor').value,
                secondary: document.getElementById('secondaryColor').value,
                background: document.getElementById('backgroundColor').value,
                text: document.getElementById('textColor').value,
                accent: document.getElementById('accentColor').value,
                error: document.getElementById('errorColor').value
            },
            typography: {
                fontFamily: document.getElementById('fontFamily').value,
                baseFontSize: parseInt(document.getElementById('baseFontSize').value),
                lineHeight: parseFloat(document.getElementById('lineHeight').value)
            },
            spacing: {
                unit: parseInt(document.getElementById('spacingUnit').value),
                borderRadius: parseInt(document.getElementById('borderRadius').value)
            },
            animation: {
                duration: parseInt(document.getElementById('animationDuration').value),
                curve: document.getElementById('animationCurve').value
            }
        };

        localStorage.setItem('themeConfig', JSON.stringify(newConfig));
        applyTheme(newConfig);
        themeDialog.remove();
        showNotification('成功', '主題設定已更新');
    });

    // 重設為預設值
    document.getElementById('resetTheme').addEventListener('click', () => {
        const defaultConfig = {
            colors: {
                primary: '#1a73e8',
                secondary: '#34a853',
                background: '#2d2d2d',
                text: '#ffffff',
                accent: '#fbbc05',
                error: '#ea4335'
            },
            typography: {
                fontFamily: "'Microsoft JhengHei', sans-serif",
                baseFontSize: 16,
                lineHeight: 1.5
            },
            spacing: {
                unit: 8,
                borderRadius: 4
            },
            animation: {
                duration: 300,
                curve: 'ease'
            }
        };

        localStorage.setItem('themeConfig', JSON.stringify(defaultConfig));
        applyTheme(defaultConfig);
        themeDialog.remove();
        showNotification('成功', '主題已重設為預設值');
    });

    // 預設主題按鈕
    document.getElementById('presetLight').addEventListener('click', () => {
        const lightTheme = {
            colors: {
                primary: '#1a73e8',
                secondary: '#34a853',
                background: '#ffffff',
                text: '#202124',
                accent: '#fbbc05',
                error: '#ea4335'
            },
            typography: {
                fontFamily: "'Microsoft JhengHei', sans-serif",
                baseFontSize: 16,
                lineHeight: 1.5
            },
            spacing: {
                unit: 8,
                borderRadius: 4
            },
            animation: {
                duration: 300,
                curve: 'ease'
            }
        };
        applyTheme(lightTheme);
    });

    document.getElementById('presetDark').addEventListener('click', () => {
        const darkTheme = {
            colors: {
                primary: '#8ab4f8',
                secondary: '#81c995',
                background: '#202124',
                text: '#e8eaed',
                accent: '#fdd663',
                error: '#f28b82'
            },
            typography: {
                fontFamily: "'Microsoft JhengHei', sans-serif",
                baseFontSize: 16,
                lineHeight: 1.5
            },
            spacing: {
                unit: 8,
                borderRadius: 4
            },
            animation: {
                duration: 300,
                curve: 'ease'
            }
        };
        applyTheme(darkTheme);
    });

    document.getElementById('presetHighContrast').addEventListener('click', () => {
        const highContrastTheme = {
            colors: {
                primary: '#ffffff',
                secondary: '#ffff00',
                background: '#000000',
                text: '#ffffff',
                accent: '#00ff00',
                error: '#ff0000'
            },
            typography: {
                fontFamily: "'Microsoft JhengHei', sans-serif",
                baseFontSize: 18,
                lineHeight: 1.5
            },
            spacing: {
                unit: 8,
                borderRadius: 0
            },
            animation: {
                duration: 0,
                curve: 'linear'
            }
        };
        applyTheme(highContrastTheme);
    });

    // 取消按鈕
    document.getElementById('cancelTheme').addEventListener('click', () => {
        themeDialog.remove();
    });
}

// 套用主題設定
function applyTheme(config) {
    // 設定 CSS 變數
    const root = document.documentElement;
    
    // 顏色
    root.style.setProperty('--primary-color', config.colors.primary);
    root.style.setProperty('--secondary-color', config.colors.secondary);
    root.style.setProperty('--background-color', config.colors.background);
    root.style.setProperty('--text-color', config.colors.text);
    root.style.setProperty('--accent-color', config.colors.accent);
    root.style.setProperty('--error-color', config.colors.error);

    // 字型
    root.style.setProperty('--font-family', config.typography.fontFamily);
    root.style.setProperty('--base-font-size', `${config.typography.baseFontSize}px`);
    root.style.setProperty('--line-height', config.typography.lineHeight);

    // 間距
    root.style.setProperty('--spacing-unit', `${config.spacing.unit}px`);
    root.style.setProperty('--border-radius', `${config.spacing.borderRadius}px`);

    // 動畫
    root.style.setProperty('--animation-duration', `${config.animation.duration}ms`);
    root.style.setProperty('--animation-curve', config.animation.curve);

    // 更新所有使用這些變數的元素
    updateThemeElements();
}

// 更新使用主題變數的元素
function updateThemeElements() {
    // 更新按鈕樣式
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.style.transition = `all var(--animation-duration) var(--animation-curve)`;
    });

    // 更新輸入框樣式
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.style.transition = `all var(--animation-duration) var(--animation-curve)`;
    });

    // 更新卡片樣式
    const cards = document.querySelectorAll('.card, .stat-card');
    cards.forEach(card => {
        card.style.transition = `all var(--animation-duration) var(--animation-curve)`;
    });

    // 更新表格樣式
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        table.style.transition = `all var(--animation-duration) var(--animation-curve)`;
    });
}

// ... existing code ...

// 資料庫查看功能
function initDatabaseViewer() {
    const viewDatabaseBtn = document.getElementById('viewDatabase');
    if (viewDatabaseBtn) {
        viewDatabaseBtn.addEventListener('click', showDatabaseViewer);
    }
}

function showDatabaseViewer() {
    // 創建資料庫查看器對話框
    const dialog = document.createElement('div');
    dialog.className = 'db-viewer';
    dialog.innerHTML = `
        <div class="db-viewer-header">
            <h3>資料庫查看器</h3>
            <button id="closeDbViewer" class="close-button">×</button>
            <div class="db-viewer-controls">
                <input type="text" id="dbSearchInput" placeholder="搜尋...">
                <select id="dbTableSelect">
                    <option value="cropData">作物交易資料</option>
                    <option value="marketRestData">市場休市資料</option>
                </select>
            </div>
        </div>
        <div class="db-table-container">
            <table>
                <thead id="dbTableHeader">
                    <!-- 表頭將由 JS 動態產生 -->
                </thead>
                <tbody id="dbTableBody">
                    <!-- 表格內容將由 JS 動態產生 -->
                </tbody>
            </table>
        </div>
        <div class="db-pagination">
            <button id="prevPage" disabled>上一頁</button>
            <span id="pageInfo">第 1 頁</span>
            <button id="nextPage">下一頁</button>
        </div>
    `;

    // 添加到頁面
    document.body.appendChild(dialog);

    // 綁定關閉按鈕事件
    document.getElementById('closeDbViewer').addEventListener('click', () => {
        dialog.remove();
    });

    // 初始化分頁
    let currentPage = 1;
    const itemsPerPage = 20;
    let currentData = [];

    // 更新表格內容
    function updateTable(data) {
        currentData = data;
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = data.slice(start, end);

        // 更新表頭
        const header = document.getElementById('dbTableHeader');
        header.innerHTML = '';
        if (pageData.length > 0) {
            const tr = document.createElement('tr');
            Object.keys(pageData[0]).forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                tr.appendChild(th);
            });
            header.appendChild(tr);
        }

        // 更新表格內容
        const tbody = document.getElementById('dbTableBody');
        tbody.innerHTML = '';
        pageData.forEach(item => {
            const tr = document.createElement('tr');
            Object.values(item).forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // 更新分頁資訊
        const totalPages = Math.ceil(data.length / itemsPerPage);
        document.getElementById('pageInfo').textContent = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
        document.getElementById('prevPage').disabled = currentPage === 1;
        document.getElementById('nextPage').disabled = currentPage === totalPages;
    }

    // 綁定事件
    document.getElementById('dbTableSelect').addEventListener('change', function() {
        currentPage = 1;
        const selectedTable = this.value;
        let data = [];
        
        if (selectedTable === 'cropData') {
            data = cropData;
        } else if (selectedTable === 'marketRestData') {
            data = marketRestData;
        }
        
        updateTable(data);
    });

    document.getElementById('dbSearchInput').addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        const selectedTable = document.getElementById('dbTableSelect').value;
        let data = [];
        
        if (selectedTable === 'cropData') {
            data = cropData.filter(item => 
                Object.values(item).some(value => 
                    String(value).toLowerCase().includes(searchText)
                )
            );
        } else if (selectedTable === 'marketRestData') {
            data = marketRestData.filter(item => 
                Object.values(item).some(value => 
                    String(value).toLowerCase().includes(searchText)
                )
            );
        }
        
        currentPage = 1;
        updateTable(data);
    });

    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updateTable(currentData);
        }
    });

    document.getElementById('nextPage').addEventListener('click', function() {
        const totalPages = Math.ceil(currentData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateTable(currentData);
        }
    });

    // 初始顯示作物交易資料
    updateTable(cropData);
}

// 在頁面載入時初始化資料庫查看功能
document.addEventListener('DOMContentLoaded', () => {
    initDatabaseViewer();
});

// ... existing code ...

// 獲取農業氣象影片
async function fetchAgriculturalWeatherVideo() {
    try {
        const response = await fetch('https://data.moa.gov.tw/Service/OpenData/Agriculturalcoa_videoRss.aspx');
        if (!response.ok) throw new Error('無法獲取農業氣象影片資料');
        const data = await response.json();
        
        // 獲取今天的日期
        const today = new Date();
        const year = today.getFullYear() - 1911; // 轉換為民國年
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}${month}${day}`;
        
        // 尋找今天的影片
        const todayVideo = data.find(item => item.title.includes(todayStr));
        
        if (todayVideo) {
            // 從 YouTube 連結中提取影片 ID
            const videoId = todayVideo.link.split('/').pop();
            return videoId;
        }
        return null;
    } catch (error) {
        console.error('獲取農業氣象影片時發生錯誤:', error);
        return null;
    }
}

// 顯示農業氣象影片
async function showAgriculturalWeatherVideo() {
    try {
        const videoId = await fetchAgriculturalWeatherVideo();
        if (!videoId) {
            showNotification('無法獲取今日農業氣象影片');
            return;
        }

        // 在主畫面中顯示影片
        const mainContent = document.querySelector('.display-panel');
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.innerHTML = `
            <iframe 
                width="100%" 
                height="315" 
                src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
        
        // 將影片容器插入到圖表區域之前
        mainContent.insertBefore(videoContainer, document.getElementById('chartArea'));
    } catch (error) {
        console.error('顯示農業氣象影片時發生錯誤:', error);
        showNotification('無法顯示農業氣象影片');
    }
}

// 在開發者模式中新增農業氣象按鈕
function initDevModeFeatures() {
    // ... existing code ...
    
    // 新增農業氣象按鈕
    const weatherButton = document.createElement('button');
    weatherButton.id = 'showWeatherVideo';
    weatherButton.textContent = '今日農業氣象';
    weatherButton.addEventListener('click', showAgriculturalWeatherVideo);
    
    // 將按鈕加入到開發者模式介面中
    const devModeContent = document.querySelector('.dev-mode-content');
    if (devModeContent) {
        const weatherSection = document.createElement('div');
        weatherSection.className = 'dev-mode-section';
        weatherSection.innerHTML = '<h3>農業氣象</h3>';
        weatherSection.appendChild(weatherButton);
        devModeContent.appendChild(weatherSection);
    }
}

// ... existing code ...

// 檢查維護狀態
async function checkMaintenanceStatus() {
    console.log('開始檢查維護狀態...');
    
    // 檢查 URL 參數
    const urlParams = new URLSearchParams(window.location.search);
    const passMaintenance = urlParams.get('pass') === 'true';
    
    if (passMaintenance) {
        console.log('維護模式已通過');
        return;
    }
    
    try {
        const response = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/maintenance.json');
        console.log('維護狀態 API 回應:', response.status);
        const data = await response.json();
        console.log('收到的維護資訊:', data);
        
        if (data.maintenanceInfo && data.maintenanceInfo.isActive) {
            console.log('顯示維護橫幅');
            showMaintenanceBanner(data.maintenanceInfo);
            if (data.maintenanceInfo.stopService) {
                console.log('顯示維護對話框');
                showMaintenanceDialog(data.maintenanceInfo);
            }
        } else {
            console.log('目前沒有維護公告');
        }
    } catch (error) {
        console.error('檢查維護狀態失敗:', error);
    }
}

// 顯示維護橫幅
function showMaintenanceBanner(maintenanceInfo) {
    console.log('準備顯示維護橫幅:', maintenanceInfo);
    // 移除現有的維護橫幅（如果有的話）
    const existingBanner = document.querySelector('.maintenance-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.className = `maintenance-banner ${maintenanceInfo.severity || 'medium'}-severity`;
    
    const bannerContent = document.createElement('div');
    bannerContent.className = 'banner-content';
    bannerContent.onclick = () => showMaintenanceDialog(maintenanceInfo);
    
    const icon = document.createElement('span');
    icon.className = 'banner-icon';
    icon.textContent = '⚠️';
    
    const text = document.createElement('span');
    text.className = 'banner-text';
    text.textContent = maintenanceInfo.title;
    
    bannerContent.appendChild(icon);
    bannerContent.appendChild(text);
    
    // 如果不是停用服務，添加關閉按鈕
    if (!maintenanceInfo.stopService) {
        const closeButton = document.createElement('button');
        closeButton.textContent = '關閉';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            banner.style.top = '-100px';
            setTimeout(() => banner.remove(), 500);
        };
        bannerContent.appendChild(closeButton);
    }
    
    banner.appendChild(bannerContent);
    document.body.insertBefore(banner, document.body.firstChild);
    console.log('維護橫幅已顯示');
}

// 顯示維護對話框
function showMaintenanceDialog(maintenanceInfo) {
    console.log('準備顯示維護對話框:', maintenanceInfo);
    // 移除現有的維護對話框（如果有的話）
    const existingOverlay = document.querySelector('.maintenance-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // 創建遮罩層
    const overlay = document.createElement('div');
    overlay.className = 'maintenance-overlay';

    // 創建對話框
    const dialog = document.createElement('div');
    dialog.className = 'maintenance-dialog'; // 移除嚴重性等級 class

    const startTime = maintenanceInfo.startTime ? new Date(maintenanceInfo.startTime).toLocaleString('zh-TW') : '未定';
    const endTime = maintenanceInfo.endTime ? new Date(maintenanceInfo.endTime).toLocaleString('zh-TW') : '未定';

    // 如果不是停用服務，添加關閉按鈕
    if (!maintenanceInfo.stopService) {
        const closeButton = document.createElement('button');
        closeButton.textContent = '關閉';
        closeButton.onclick = () => {
            overlay.style.background = 'rgba(0, 0, 0, 0)';
            dialog.style.transform = 'scale(0.9)';
            dialog.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };
        dialog.appendChild(closeButton);
    }

    const title = document.createElement('h2');
    title.textContent = maintenanceInfo.title;
    dialog.appendChild(title);

    const description = document.createElement('p');
    description.textContent = maintenanceInfo.description || '';
    dialog.appendChild(description);

    const timeInfo = document.createElement('p');
    timeInfo.textContent = `維護時間：${startTime} ~ ${endTime}`;
    dialog.appendChild(timeInfo);

    // 不再顯示嚴重性等級
    // if (maintenanceInfo.severity) { ... }

    if (maintenanceInfo.contact) {
        const contactInfo = document.createElement('p');
        if (maintenanceInfo.contact.email) {
            const emailLink = document.createElement('a');
            emailLink.href = `mailto:${maintenanceInfo.contact.email}`;
            emailLink.textContent = maintenanceInfo.contact.email;
            contactInfo.appendChild(document.createTextNode('聯絡方式：'));
            contactInfo.appendChild(emailLink);
        } else {
            contactInfo.textContent = '聯絡方式：無';
        }
        dialog.appendChild(contactInfo);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    console.log('維護對話框已顯示');

    // 如果是停用服務，禁用所有互動元素
    if (maintenanceInfo.stopService) {
        const interactiveElements = document.querySelectorAll('button, input, select, a');
        interactiveElements.forEach(element => {
            element.style.pointerEvents = 'none';
            element.style.opacity = '0.5';
        });
    }
}

// 確保在頁面完全載入後檢查維護狀態和通知
window.addEventListener('load', () => {
    console.log('頁面已完全載入，開始檢查維護狀態和通知');
    checkMaintenanceStatus();
    checkNotifications();
});

// 每5分鐘檢查一次維護狀態和通知
setInterval(() => {
    console.log('定期檢查維護狀態和通知');
    checkMaintenanceStatus();
    checkNotifications();
}, 5 * 60 * 1000);

// ... existing code ...

// 停用服務
function disableService() {
    // 停用所有主要功能
    document.getElementById('searchInput').disabled = true;
    document.getElementById('cropSelect').disabled = true;
    document.getElementById('showPriceTrend').disabled = true;
    document.getElementById('showVolumeDist').disabled = true;
    document.getElementById('showPriceDist').disabled = true;
    document.getElementById('showSeasonal').disabled = true;
    
    // 顯示維護中訊息
    resultArea.innerHTML = `
        <div class="maintenance-message">
            <h2>${maintenanceInfo.title}</h2>
            <p>${maintenanceInfo.description}</p>
            <p>維護時間：${new Date(maintenanceInfo.startTime).toLocaleString('zh-TW')} ~ ${new Date(maintenanceInfo.endTime).toLocaleString('zh-TW')}</p>
            <p>如有任何問題，請聯繫：${maintenanceInfo.contact.email}</p>
        </div>
    `;
}

// ... existing code ...
// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('頁面載入完成，開始初始化各項功能');
    
    // 初始化更新檢查
    initUpdateCheck();
    
    // 檢查維護狀態
    checkMaintenanceStatus();
    // 每5分鐘檢查一次維護狀態
    setInterval(checkMaintenanceStatus, 5 * 60 * 1000);
    
    // 初始化通知檢查
    initNotificationCheck();
    
    // 初始化市場休市檢查
    initMarketRestCheck();
    
    // 初始化更新通知檢查
    initUpdateNotificationCheck();
    
    // 檢查環境設定並顯示農業氣象影片
    showAgriculturalWeatherVideo();
});

// ... existing code ...

// 初始化主題設定
function initThemeSettings() {
    // 檢查本地存儲中的主題設定
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // 創建主題切換按鈕
    const themeButton = document.createElement('button');
    themeButton.className = 'theme-toggle-btn';
    themeButton.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
    
    themeButton.onclick = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeButton.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        
        // 添加切換動畫
        themeButton.style.transform = 'scale(0.8)';
        setTimeout(() => {
            themeButton.style.transform = 'scale(1)';
        }, 200);
    };
    
    document.body.appendChild(themeButton);
}

// 在頁面載入時初始化主題設定
document.addEventListener('DOMContentLoaded', () => {
    initThemeSettings();
});

// ... existing code ...

// 顯示退出按鈕
function showStaffLogout() {
    document.body.classList.add('maintenance-mode');
}

// 隱藏退出按鈕
function hideStaffLogout() {
    document.body.classList.remove('maintenance-mode');
}

// 顯示退出確認對話框
function showLogoutDialog() {
    document.querySelector('.staff-logout-dialog').style.display = 'block';
}

// 隱藏退出確認對話框
function hideLogoutDialog() {
    document.querySelector('.staff-logout-dialog').style.display = 'none';
}

// 處理退出確認
function handleLogout() {
    // 在這裡添加退出邏輯
    hideLogoutDialog();
    // 其他退出相關操作
}

// 防止快取
window.addEventListener('load', function() {
    // 清除所有快取
    if ('caches' in window) {
        caches.keys().then(function(names) {
            for (let name of names) {
                caches.delete(name);
            }
        });
    }
    
    // 強制重新載入所有資源
    if (window.performance && window.performance.getEntriesByType) {
        const resources = window.performance.getEntriesByType('resource');
        resources.forEach(resource => {
            if (resource.initiatorType === 'script' || resource.initiatorType === 'link') {
                const url = new URL(resource.name);
                url.searchParams.set('t', Date.now());
                fetch(url.toString(), { cache: 'no-store' });
            }
        });
    }
});

// 版本檢查函數
async function checkVersion() {
    try {
        const response = await fetchWithETag('/api/version');
        if (!response.ok) {
            throw new Error('版本檢查失敗');
        }
        
        const data = await response.json();
        const serverVersion = data.version;
        const etag = response.headers.get('ETag');
        
        if (etag) {
            localStorage.setItem('etag_version', etag);
        }
        
        if (serverVersion !== VERSION) {
            showUpdateNotification(serverVersion);
        }
        
        // 更新顯示
        const versionNumber = document.getElementById('versionNumber');
        const lastUpdate = document.getElementById('lastUpdate');
        if (versionNumber) versionNumber.textContent = VERSION;
        if (lastUpdate) lastUpdate.textContent = new Date().toLocaleString('zh-TW');
        
    } catch (error) {
        console.error('版本檢查錯誤:', error);
    }
}

// 顯示更新通知
function showUpdateNotification(newVersion) {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <h3>發現新版本！</h3>
            <p>新版本 ${newVersion} 已發布</p>
            <p>請重新整理頁面以更新</p>
            <button onclick="window.location.reload()">立即更新</button>
        </div>
    `;
    document.body.appendChild(notification);
}

// 初始化版本檢查
function initVersionCheck() {
    // 立即檢查一次
    checkVersion();
    
    // 設定定期檢查
    setInterval(checkVersion, VERSION_CHECK_INTERVAL);
    
    // 監聽 Service Worker 更新
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
}

// 在頁面載入時初始化版本檢查
document.addEventListener('DOMContentLoaded', initVersionCheck);

// ETag 狀態檢查函數
async function checkETagStatus() {
    try {
        const urls = [
            '/api/data',
            '/api/version',
            '/api/notifications',
            'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
            'https://baclup0821.github.io/API/Better-vegetable-catcher/TV-drvice.json'
        ];
        
        const statusResults = await Promise.all(
            urls.map(async (url) => {
                try {
                    // 使用 GET 請求而不是 HEAD
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    // 檢查多種快取相關的標頭
                    const etag = response.headers.get('ETag');
                    const lastModified = response.headers.get('Last-Modified');
                    const cacheControl = response.headers.get('Cache-Control');
                    const expires = response.headers.get('Expires');
                    
                    // 獲取內容的雜湊值作為備用 ETag
                    const content = await response.text();
                    const contentHash = await calculateHash(content);
                    
                    // 使用多種方式來判斷是否為最新
                    const lastETag = localStorage.getItem(`etag_${url}`);
                    const lastHash = localStorage.getItem(`hash_${url}`);
                    const lastModifiedTime = localStorage.getItem(`modified_${url}`);
                    
                    // 判斷是否為最新
                    const isLatest = 
                        (etag && etag === lastETag) ||
                        (contentHash && contentHash === lastHash) ||
                        (lastModified && lastModified === lastModifiedTime);
                    
                    // 儲存新的值
                    if (etag) localStorage.setItem(`etag_${url}`, etag);
                    if (contentHash) localStorage.setItem(`hash_${url}`, contentHash);
                    if (lastModified) localStorage.setItem(`modified_${url}`, lastModified);
                    
                    return {
                        url,
                        etag: etag || '無',
                        contentHash: contentHash || '無',
                        lastModified: lastModified || '無',
                        cacheControl: cacheControl || '無',
                        expires: expires || '無',
                        isLatest,
                        timestamp: new Date().toISOString(),
                        status: 'success'
                    };
                } catch (error) {
                    return {
                        url,
                        error: error.message,
                        status: 'error',
                        timestamp: new Date().toISOString()
                    };
                }
            })
        );
        
        return statusResults;
    } catch (error) {
        console.error('ETag 狀態檢查失敗:', error);
        return null;
    }
}

// 計算內容雜湊值
async function calculateHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 顯示 ETag 狀態
function showETagStatus(statusResults) {
    const statusContainer = document.createElement('div');
    statusContainer.className = 'etag-status-container';
    
    const statusHTML = statusResults.map(result => {
        if (result.status === 'error') {
            return `
                <div class="etag-status-item error">
                    <div class="status-header">
                        <span class="status-icon">❌</span>
                        <span class="status-title">${result.url}</span>
                    </div>
                    <div class="status-details">
                        <p>錯誤: ${result.error}</p>
                        <p>檢查時間: ${new Date(result.timestamp).toLocaleString('zh-TW')}</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="etag-status-item ${result.isLatest ? 'latest' : 'outdated'}">
                <div class="status-header">
                    <span class="status-icon">${result.isLatest ? '✅' : '🔄'}</span>
                    <span class="status-title">${result.url}</span>
                </div>
                <div class="status-details">
                    <p>ETag: ${result.etag}</p>
                    <p>內容雜湊值: ${result.contentHash}</p>
                    <p>最後修改時間: ${result.lastModified}</p>
                    <p>快取控制: ${result.cacheControl}</p>
                    <p>過期時間: ${result.expires}</p>
                    <p>狀態: ${result.isLatest ? '已是最新' : '需要更新'}</p>
                    <p>檢查時間: ${new Date(result.timestamp).toLocaleString('zh-TW')}</p>
                </div>
            </div>
        `;
    }).join('');
    
    statusContainer.innerHTML = `
        <div class="etag-status-header">
            <h3>ETag 狀態檢查</h3>
            <div class="header-buttons">
                <button class="refresh-status-btn">重新整理</button>
                <button class="close-status-btn">關閉</button>
            </div>
        </div>
        <div class="etag-status-content">
            ${statusHTML}
        </div>
    `;
    
    // 添加重新整理按鈕事件
    const refreshBtn = statusContainer.querySelector('.refresh-status-btn');
    refreshBtn.addEventListener('click', async () => {
        const newStatus = await checkETagStatus();
        if (newStatus) {
            showETagStatus(newStatus);
        }
    });
    
    // 添加關閉按鈕事件
    const closeBtn = statusContainer.querySelector('.close-status-btn');
    closeBtn.addEventListener('click', () => {
        statusContainer.remove();
    });
    
    // 顯示狀態容器
    const existingContainer = document.querySelector('.etag-status-container');
    if (existingContainer) {
        existingContainer.replaceWith(statusContainer);
    } else {
        document.body.appendChild(statusContainer);
    }
}

// ... existing code ...

// 初始化 ETag 狀態檢查
function initETagStatusCheck() {
    // 添加 ETag 狀態按鈕
    const button = document.createElement('button');
    button.className = 'etag-status-btn';
    button.innerHTML = '📊 ETag 狀態';
    button.onclick = async () => {
        const status = await checkETagStatus();
        if (status) {
            showETagStatus(status);
        }
    };
    
    // 將按鈕添加到頁面
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'etag-status-btn-container';
    buttonContainer.appendChild(button);
    document.body.appendChild(buttonContainer);
}

// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    initVersionCheck();
    initETagStatusCheck();
});

// ... existing code ...

// ETag 開發者工具功能
function initETagDevTools() {
    const devModePanel = document.getElementById('devModePanel');
    const closeButton = document.getElementById('closeDevMode');
    const checkAllButton = document.getElementById('checkAllETags');
    const clearCacheButton = document.getElementById('clearETagCache');
    const forceRefreshButton = document.getElementById('forceRefresh');
    const resultsContainer = document.getElementById('etagResults');

    // 關閉按鈕
    closeButton.addEventListener('click', () => {
        devModePanel.style.display = 'none';
    });

    // 檢查所有 ETag
    checkAllButton.addEventListener('click', async () => {
        const selectedEndpoints = getSelectedEndpoints();
        const selectedChecks = getSelectedChecks();
        
        resultsContainer.innerHTML = '<div class="result-item">檢查中...</div>';
        
        try {
            const results = await checkSelectedETags(selectedEndpoints, selectedChecks);
            displayResults(results);
        } catch (error) {
            resultsContainer.innerHTML = `
                <div class="result-item error">
                    <p>檢查失敗: ${error.message}</p>
                </div>
            `;
        }
    });

    // 清除快取
    clearCacheButton.addEventListener('click', () => {
        clearETagCache();
        resultsContainer.innerHTML = `
            <div class="result-item success">
                <p>快取已清除</p>
            </div>
        `;
    });

    // 強制更新
    forceRefreshButton.addEventListener('click', async () => {
        const selectedEndpoints = getSelectedEndpoints();
        resultsContainer.innerHTML = '<div class="result-item">更新中...</div>';
        
        try {
            await forceRefreshEndpoints(selectedEndpoints);
            resultsContainer.innerHTML = `
                <div class="result-item success">
                    <p>已強制更新所有選定的端點</p>
                </div>
            `;
        } catch (error) {
            resultsContainer.innerHTML = `
                <div class="result-item error">
                    <p>更新失敗: ${error.message}</p>
                </div>
            `;
        }
    });
}

// 獲取選中的端點
function getSelectedEndpoints() {
    const endpoints = {
        data: document.getElementById('endpoint-data').checked,
        version: document.getElementById('endpoint-version').checked,
        notifications: document.getElementById('endpoint-notifications').checked,
        moa: document.getElementById('endpoint-moa').checked,
        tv: document.getElementById('endpoint-tv').checked
    };

    const urls = [];
    if (endpoints.data) urls.push('/api/data');
    if (endpoints.version) urls.push('/api/version');
    if (endpoints.notifications) urls.push('/api/notifications');
    if (endpoints.moa) urls.push('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
    if (endpoints.tv) urls.push('https://baclup0821.github.io/API/Better-vegetable-catcher/TV-drvice.json');

    return urls;
}

// 獲取選中的檢查選項
function getSelectedChecks() {
    return {
        etag: document.getElementById('check-etag').checked,
        hash: document.getElementById('check-hash').checked,
        modified: document.getElementById('check-modified').checked
    };
}

// 檢查選定的 ETag
async function checkSelectedETags(urls, checks) {
    const results = [];
    
    for (const url of urls) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            const result = {
                url,
                status: 'success',
                checks: {}
            };
            
            if (checks.etag) {
                result.checks.etag = response.headers.get('ETag') || '無';
            }
            
            if (checks.hash) {
                const content = await response.text();
                result.checks.hash = await calculateHash(content);
            }
            
            if (checks.modified) {
                result.checks.modified = response.headers.get('Last-Modified') || '無';
            }
            
            results.push(result);
        } catch (error) {
            results.push({
                url,
                status: 'error',
                error: error.message
            });
        }
    }
    
    return results;
}

// 顯示結果
function displayResults(results) {
    const resultsContainer = document.getElementById('etagResults');
    resultsContainer.innerHTML = results.map(result => {
        if (result.status === 'error') {
            return `
                <div class="result-item error">
                    <h4>${result.url}</h4>
                    <p>錯誤: ${result.error}</p>
                </div>
            `;
        }
        
        return `
            <div class="result-item success">
                <h4>${result.url}</h4>
                ${Object.entries(result.checks).map(([key, value]) => `
                    <p><strong>${key}:</strong> ${value}</p>
                `).join('')}
            </div>
        `;
    }).join('');
}

// 清除 ETag 快取
function clearETagCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('etag_') || key.startsWith('hash_') || key.startsWith('modified_')) {
            localStorage.removeItem(key);
        }
    });
}

// 強制更新端點
async function forceRefreshEndpoints(urls) {
    for (const url of urls) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            const content = await response.text();
            const etag = response.headers.get('ETag');
            const lastModified = response.headers.get('Last-Modified');
            
            if (etag) localStorage.setItem(`etag_${url}`, etag);
            if (lastModified) localStorage.setItem(`modified_${url}`, lastModified);
            localStorage.setItem(`hash_${url}`, await calculateHash(content));
        } catch (error) {
            console.error(`更新 ${url} 失敗:`, error);
        }
    }
}

// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    initVersionCheck();
    initETagStatusCheck();
    initETagDevTools();
});

// ... existing code ...

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', () => {
    // 初始化版本檢查
    initVersionCheck();
    
    // 初始化 ETag 狀態檢查
    initETagStatusCheck();
    
    // 初始化作物選擇事件
    const cropSelect = document.getElementById('cropSelect');
    if (cropSelect) {
        cropSelect.addEventListener('change', (event) => {
            const selectedCrop = event.target.value;
            if (selectedCrop) {
                const cropData = getCropData(selectedCrop);
                if (cropData.length > 0) {
                    // 更新基本統計資訊
                    showBasicStats(cropData);
                    // 更新詳細資料表格
                    updateDetailTable(cropData);
                } else {
                    showNotification('提示', '沒有找到該作物的資料');
                }
            }
        });
    }
    
    // 初始化市場選擇事件
    const marketSelect = document.getElementById('marketSelect');
    if (marketSelect) {
        marketSelect.addEventListener('change', () => {
            const cropSelect = document.getElementById('cropSelect');
            if (cropSelect && cropSelect.value) {
                const cropData = getCropData(cropSelect.value);
                if (cropData.length > 0) {
                    showBasicStats(cropData);
                    updateDetailTable(cropData);
                }
            }
        });
    }
    
    // 初始化搜尋功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            const cropSelect = document.getElementById('cropSelect');
            if (cropSelect) {
                const options = Array.from(cropSelect.options);
                options.forEach(option => {
                    if (option.value === '') return; // 跳過預設選項
                    const cropName = option.textContent.toLowerCase();
                    option.style.display = cropName.includes(searchTerm) ? '' : 'none';
                });
            }
        });
    }
    
    // 初始化分析按鈕事件
    document.getElementById('showPriceTrend').addEventListener('click', showPriceTrend);
    document.getElementById('showVolumeDist').addEventListener('click', showVolumeDistribution);
    document.getElementById('showPriceDist').addEventListener('click', showPriceDistribution);
    document.getElementById('showSeasonal').addEventListener('click', showSeasonalAnalysis);
    document.getElementById('showPricePrediction').addEventListener('click', showPricePrediction);
    
    // 初始化匯出按鈕事件
    document.getElementById('exportExcel').addEventListener('click', () => exportData('excel'));
    document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));
    
    // 初始化資料載入
    fetchData();
});
// ... existing code ...