// 電視看板特定功能
let currentDisplayMode = 'price'; // 'price' 或 'chart'
let displayInterval;
const DISPLAY_DURATION = 30000; // 30秒切換一次顯示模式
let currentCropIndex = 0;
let crops = [];
let marketName = localStorage.getItem('marketName') || '';
let marketCrops = [];
let cropNames = [];

// 主要常數
const MARKET_API = 'https://backup0821.github.io/API/Better-vegetable-catcher/marketTV-drvice.json';
const PRICE_API = 'https://data.moa.gov.tw/api/v1/AgriProductsTransType/';
const CROP_INTERVAL = 5000; // 5秒輪播

// 本地存儲相關常數
const STORAGE_KEYS = {
    PRICE_DATA: 'price_data',
    LAST_FETCH_DATE: 'last_fetch_date',
    MARKET_NAME: 'marketName'
};

// 市場名稱對應表
const MARKET_NAME_MAP = {
    '台北一': '台北第一果菜批發市場',
    '台北二': '台北第二果菜批發市場',
    '三重': '三重果菜批發市場',
    '桃園': '桃園果菜批發市場',
    '台中': '台中果菜批發市場',
    '彰化': '彰化果菜批發市場',
    '嘉義': '嘉義果菜批發市場',
    '台南': '台南果菜批發市場',
    '高雄': '高雄果菜批發市場',
    '宜蘭': '宜蘭果菜批發市場',
    '花蓮': '花蓮果菜批發市場',
    '台東': '台東果菜批發市場'
};

// 開發者模式相關功能
const DevMode = {
    isEnabled: false,
    triggerCount: 0,
    lastTriggerTime: 0,
    TRIGGER_THRESHOLD: 5,
    TRIGGER_TIMEOUT: 3000,
    brightness: 100,
    testPattern: null,
    overlay: null,
    panel: null,

    // 初始化開發者模式
    init() {
        // 不再用點擊觸發
        this.loadSettings();
    },

    // 載入設定
    loadSettings() {
        const savedBrightness = localStorage.getItem('devModeBrightness');
        if (savedBrightness) {
            this.brightness = parseInt(savedBrightness);
            this.applyBrightness();
        }
    },

    // 儲存設定
    saveSettings() {
        localStorage.setItem('devModeBrightness', this.brightness.toString());
    },

    // 套用亮度設定
    applyBrightness() {
        document.body.style.filter = `brightness(${this.brightness}%)`;
        this.saveSettings();
    },

    // 開始測試圖案
    startTestPattern() {
        if (this.testPattern) return;
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
        let currentColor = 0;
        document.body.classList.add('test-pattern-active');
        this.testPattern = setInterval(() => {
            document.body.style.backgroundColor = colors[currentColor];
            currentColor = (currentColor + 1) % colors.length;
        }, 1000);
    },

    // 停止測試圖案
    stopTestPattern() {
        if (this.testPattern) {
            clearInterval(this.testPattern);
            this.testPattern = null;
            document.body.style.backgroundColor = '';
            document.body.classList.remove('test-pattern-active');
        }
    },

    // 更新系統資訊
    updateSystemInfo(container) {
        const info = {
            '瀏覽器': navigator.userAgent,
            '螢幕解析度': `${window.screen.width}x${window.screen.height}`,
            '裝置識別碼': localStorage.getItem('deviceId') || '未設定',
            '最後更新': new Date().toLocaleString('zh-TW'),
            '記憶體使用': navigator.deviceMemory ? `${navigator.deviceMemory}GB` : '未知',
            '網路狀態': navigator.onLine ? '在線' : '離線',
            '全螢幕模式': document.fullscreenElement ? '是' : '否'
        };
        container.innerHTML = Object.entries(info)
            .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
            .join('');
    }
};

// 初始化開發者模式
DevMode.init();

// 更新市場資訊
function updateMarketInfo() {
    document.getElementById('marketName').textContent = marketName;
}

// 顯示錯誤訊息
function showError(message) {
    const notificationList = document.getElementById('notificationList');
    const notification = document.createElement('div');
    notification.className = 'notification-item error';
    notification.textContent = message;
    notificationList.insertBefore(notification, notificationList.firstChild);
    setTimeout(() => notification.remove(), 5000);
}

// 更新時間戳
function updateTimestamp() {
    const now = new Date();
    document.getElementById('currentTime').textContent = 
        now.toLocaleTimeString('zh-TW', { 
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    document.getElementById('currentDate').textContent = 
        now.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
}

// 初始化顯示
function initDisplay() {
    updateTimestamp();
    setInterval(updateTimestamp, 1000);
    
    // 禁用所有觸控事件
    document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    
    // 開始自動切換顯示模式
    startDisplayRotation();
    
    // 從原始專案獲取數據
    fetchData().then(() => {
        // 獲取所有作物列表
        crops = [...new Set(cropData.map(item => item.作物名稱))].sort();
        // 開始輪播作物
        startCropRotation();
        // 更新市場資訊
        updateMarketStats();
        // 更新交易排行
        updateRankingList();
        // 更新市場公告
        updateAnnouncementList();
    });
}

// 更新市場統計資訊
function updateMarketStats() {
    const todayData = cropData.filter(item => 
        item.交易日期 === getLatestDate() && 
        item.市場名稱 === marketName
    );
    
    const totalVolume = todayData.reduce((sum, item) => sum + Number(item.交易量), 0);
    const avgPrice = todayData.reduce((sum, item) => sum + Number(item.平均價), 0) / todayData.length;
    
    document.getElementById('todayVolume').textContent = `${totalVolume.toLocaleString()} 公斤`;
    document.getElementById('avgPrice').textContent = `${avgPrice.toFixed(2)} 元/公斤`;
}

// 更新交易排行
function updateRankingList() {
    const rankingList = document.getElementById('rankingList');
    const todayData = cropData.filter(item => 
        item.交易日期 === getLatestDate() && 
        item.市場名稱 === marketName
    ).sort((a, b) => Number(b.交易量) - Number(a.交易量));
    
    rankingList.innerHTML = '';
    todayData.slice(0, 10).forEach((item, index) => {
        const rankItem = document.createElement('div');
        rankItem.className = 'ranking-item';
        rankItem.innerHTML = `
            <span class="rank-number">${index + 1}</span>
            <span class="crop-name">${item.作物名稱}</span>
            <span class="trade-volume">${Number(item.交易量).toLocaleString()} 公斤</span>
        `;
        rankingList.appendChild(rankItem);
    });
}

// 更新市場公告
function updateAnnouncementList() {
    const announcementList = document.getElementById('announcementList');
    // 這裡可以從 API 獲取公告，目前使用模擬數據
    const announcements = [
        { type: 'info', message: '今日市場交易正常' },
        { type: 'warning', message: '部分蔬菜價格波動較大' },
        { type: 'success', message: '市場交易量較昨日增加' }
    ];
    
    announcementList.innerHTML = '';
    announcements.forEach(announcement => {
        const announcementItem = document.createElement('div');
        announcementItem.className = `announcement-item ${announcement.type}`;
        announcementItem.textContent = announcement.message;
        announcementList.appendChild(announcementItem);
    });
}

// 開始顯示輪換
function startDisplayRotation() {
    displayInterval = setInterval(() => {
        currentDisplayMode = currentDisplayMode === 'price' ? 'chart' : 'price';
        updateDisplay();
    }, DISPLAY_DURATION);
}

// 開始作物輪播
async function startCropRotation() {
    try {
        // 獲取所有作物資料
        const response = await fetch(PRICE_API);
        const data = await response.json();
        
        // 過濾出當前市場的資料
        const marketData = data.Data.filter(item => item.MarketName === marketName);
        
        // 取得所有作物名稱（去重）
        cropNames = [...new Set(marketData.map(item => item.CropName))].filter(Boolean);
        
        if (cropNames.length === 0) {
            showError('無法獲取作物資料');
            return;
        }
        
        // 儲存市場作物資料
        marketCrops = marketData;
        
        // 開始輪播
        let cropIndex = 0;
        showCropInfo(cropNames[cropIndex]);
        
        // 每5秒切換一次作物
        if (cropTimer) clearInterval(cropTimer);
        cropTimer = setInterval(() => {
            cropIndex = (cropIndex + 1) % cropNames.length;
            showCropInfo(cropNames[cropIndex]);
        }, CROP_INTERVAL);
        
    } catch (error) {
        console.error('作物輪播初始化失敗:', error);
        showError('無法獲取作物資料，請檢查網路連線');
    }
}

// 顯示作物資訊
function showCropInfo(cropName) {
    // 過濾出該作物的資料
    const cropData = marketCrops.filter(item => item.CropName === cropName);
    if (cropData.length === 0) return;
    
    // 取得最新一筆資料
    const latestData = cropData[cropData.length - 1];
    
    // 更新作物基本資訊
    document.getElementById('cropName').textContent = cropName;
    document.getElementById('tradeVolume').textContent = `${Number(latestData.Trans_Quantity).toLocaleString()} 公斤`;
    document.getElementById('avgPrice').textContent = `${Number(latestData.Avg_Price).toFixed(2)} 元/公斤`;
    
    // 更新價格資訊
    document.getElementById('priceHigh').textContent = `${Number(latestData.High_Price).toFixed(2)} 元/公斤`;
    document.getElementById('priceLow').textContent = `${Number(latestData.Low_Price).toFixed(2)} 元/公斤`;
    
    // 計算價格變化
    const prices = cropData.map(item => Number(item.Avg_Price));
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2);
    
    // 更新圖表
    updateChart(cropData);
    
    // 如果價格變化超過5%，顯示通知
    if (Math.abs(priceChange) > 5) {
        const direction = priceChange > 0 ? '上漲' : '下跌';
        addNotification(`${cropName}價格${direction}${Math.abs(priceChange)}%`);
    }
}

// 更新圖表
function updateChart(cropData) {
    const dates = cropData.map(item => item.交易日期);
    const prices = cropData.map(item => Number(item.Avg_Price));
    const volumes = cropData.map(item => Number(item.Trans_Quantity));
    
    const trace1 = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '價格',
        line: { color: '#1a237e', width: 3 },
        marker: { size: 8, color: '#1a237e' }
    };
    
    const trace2 = {
        x: dates,
        y: volumes,
        type: 'bar',
        name: '交易量',
        yaxis: 'y2',
        marker: { color: '#4caf50', opacity: 0.7 }
    };
    
    const layout = {
        title: `${cropData[0].作物名稱} 價格趨勢`,
        xaxis: { 
            title: '日期',
            gridcolor: 'rgba(255,255,255,0.1)'
        },
        yaxis: { 
            title: '價格 (元/公斤)',
            gridcolor: 'rgba(255,255,255,0.1)'
        },
        yaxis2: {
            title: '交易量 (公斤)',
            overlaying: 'y',
            side: 'right',
            gridcolor: 'rgba(255,255,255,0.1)'
        },
        showlegend: true,
        legend: { x: 1, y: 1 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            color: '#ffffff'
        },
        margin: {
            l: 50,
            r: 50,
            t: 50,
            b: 50
        }
    };
    
    Plotly.newPlot('mainDisplay', [trace1, trace2], layout);
}

// 修改主程式
async function main() {
    try {
        // 啟動時鐘
        startClock();

        // 檢查市場設定
        if (!marketName) {
            console.log('未設定市場，顯示選擇對話框');
            showMarketSelectionDialog();
            return;
        }

        console.log('已設定市場:', marketName);
        document.getElementById('marketName').textContent = marketName;

        // 開始作物輪播
        await startCropRotation();

        // 顯示通知
        showNotifications([
            '系統已成功啟動',
            '資料每5分鐘自動更新一次',
            '如需協助請聯繫系統管理員'
        ]);

    } catch (error) {
        console.error('系統初始化失敗:', error);
        showError('系統初始化失敗，請重新整理頁面');
    }
}

// 修改頁面載入事件
document.addEventListener('DOMContentLoaded', () => {
    console.log('頁面載入完成');
    // 清除舊的市場設定（測試用，之後可以移除）
    // localStorage.removeItem(STORAGE_KEYS.MARKET_NAME);
    
    // 獲取市場設定
    marketName = localStorage.getItem(STORAGE_KEYS.MARKET_NAME);
    console.log('從本地儲存讀取的市場:', marketName);
    
    // 啟動主程式
    main();
    addDevModeTriggerArea();
});

// ===== 通知動態產生（橘色卡片） =====
function showNotifications(notifications) {
    const list = document.getElementById('notificationList');
    list.innerHTML = '';
    notifications.forEach(msg => {
        const item = document.createElement('div');
        item.className = 'tv-notify-item';
        item.textContent = msg;
        list.appendChild(item);
    });
}

// ===== 主區域圖表與即時資訊 =====
function showMainChartAndStats(cropName, chartData, volume, avgPrice) {
    const main = document.getElementById('mainDisplay');
    main.innerHTML = '';
    // 圖表容器
    const chartDiv = document.createElement('div');
    chartDiv.id = 'mainChart';
    chartDiv.style.width = '100%';
    chartDiv.style.height = '320px';
    main.appendChild(chartDiv);
    // 即時資訊
    const statsDiv = document.createElement('div');
    statsDiv.className = 'main-stats';
    statsDiv.style.marginTop = '18px';
    statsDiv.style.display = 'flex';
    statsDiv.style.justifyContent = 'center';
    statsDiv.style.gap = '48px';
    statsDiv.innerHTML = `
        <div><span style="color:#888;">交易量：</span><span style="color:#1a237e;font-weight:700;">${volume}</span></div>
        <div><span style="color:#888;">平均價：</span><span style="color:#1a237e;font-weight:700;">${avgPrice}</span></div>
    `;
    main.appendChild(statsDiv);
    // 畫圖表（假設 chartData = { x:[], y:[] }）
    if (window.Plotly && chartData && chartData.x && chartData.y) {
        Plotly.newPlot('mainChart', [{
            x: chartData.x,
            y: chartData.y,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#1a237e', width: 3 },
            marker: { color: '#ffa07a', size: 8 },
            name: cropName
        }], {
            margin: { t: 24, l: 48, r: 24, b: 48 },
            xaxis: { title: '日期' },
            yaxis: { title: '價格 (元/公斤)' },
            plot_bgcolor: '#fff',
            paper_bgcolor: '#fff',
            font: { family: 'Noto Sans TC, Microsoft JhengHei, sans-serif' }
        }, {responsive:true, displayModeBar:false});
    }
}

// ===== 自動輪播所有作物，每5秒切換 =====
let allCrops = [];
let cropTrendData = {};
let cropIndex = 0;
let cropTimer = null;

async function fetchAndStartCropRotation() {
    try {
        // 使用新的資料獲取方式
        const data = await checkAndUpdateLocalData();
        // 只取本市場
        const marketData = data.filter(item => item.市場名稱 === marketName);
        // 取得所有作物名稱（去重）
        allCrops = [...new Set(marketData.map(item => item.作物名稱))].filter(Boolean);
        // 整理每個作物近7日資料
        cropTrendData = {};
        allCrops.forEach(crop => {
            const cropData = marketData.filter(item => item.作物名稱 === crop)
                .sort((a, b) => new Date(a.交易日期) - new Date(b.交易日期));
            cropTrendData[crop] = cropData.slice(-7);
        });
        // 輪播
        cropIndex = 0;
        showCurrentCrop();
        if (cropTimer) clearInterval(cropTimer);
        cropTimer = setInterval(() => {
            cropIndex = (cropIndex + 1) % allCrops.length;
            showCurrentCrop();
        }, 5000);
    } catch (error) {
        console.error('作物輪播初始化失敗:', error);
        showError('無法獲取作物資料，請檢查網路連線');
    }
}

function showCurrentCrop() {
    if (!allCrops.length) return;
    const crop = allCrops[cropIndex];
    const trend = cropTrendData[crop] || [];
    const x = trend.map(item => item.交易日期);
    const y = trend.map(item => Number(item.平均價));
    const latest = trend[trend.length-1] || {};
    // 中央圖表
    showMainChartAndStats(crop, {x, y}, latest.交易量 ? `${Number(latest.交易量).toLocaleString()} 公斤` : '--', latest.平均價 ? `${Number(latest.平均價).toFixed(2)} 元/公斤` : '--');
    // 右側資訊卡
    document.getElementById('cropName').textContent = crop;
    document.getElementById('tradeVolume').textContent = latest.交易量 ? `${Number(latest.交易量).toLocaleString()} 公斤` : '--';
    document.getElementById('avgPrice').textContent = latest.平均價 ? `${Number(latest.平均價).toFixed(2)} 元/公斤` : '--';
}

// ====== 時鐘功能（修正版）======
function startClock() {
    updateClock(); // 立即更新一次
    setInterval(updateClock, 1000); // 每秒更新一次
}

function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '/');
    
    const timeStr = now.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    document.getElementById('currentDate').textContent = dateStr;
    document.getElementById('currentTime').textContent = timeStr;
}

// ====== 啟動流程修正 ======
window.addEventListener('DOMContentLoaded', async () => {
    // 啟動主程式
    main();
    addDevModeTriggerArea();
});

// 錯誤處理函數
function handleApiError(error, apiName) {
    console.error(`${apiName} 連線錯誤:`, error);
    showError(`${apiName} 連線失敗，請檢查網路連線`);
    return null;
}

// 安全的 API 呼叫函數
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        handleApiError(error, url);
        return null;
    }
}

// 全局變數
let currentMarket = '台北第一果菜批發市場';
let currentCrop = '高麗菜';
let notifications = [];
let priceData = {
    high: 0,
    low: 0,
    avg: 0,
    volume: 0
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    initializeMarketData();
    setInterval(updateMarketData, 30000); // 每30秒更新一次市場資料
});

// 更新時鐘
function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '/');
    
    const timeStr = now.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    document.getElementById('currentDate').textContent = dateStr;
    document.getElementById('currentTime').textContent = timeStr;
}

// 初始化市場資料
async function initializeMarketData() {
    try {
        const response = await fetch(PRICE_API);
        const data = await response.json();
        const marketData = data.filter(item => item.市場名稱 === marketName);
        updateDisplay(marketData);
    } catch (error) {
        console.error('無法獲取市場資料:', error);
        showError('無法獲取市場資料，請檢查網路連線');
    }
}

// 更新市場資料
async function updateMarketData() {
    try {
        const response = await fetch(PRICE_API);
        const data = await response.json();
        const marketData = data.filter(item => item.市場名稱 === marketName);
        updateDisplay(marketData);
        checkPriceChanges(marketData);
    } catch (error) {
        console.error('無法更新市場資料:', error);
        showError('無法更新市場資料，請檢查網路連線');
    }
}

// 更新顯示
function updateDisplay(data) {
    if (!data || data.length === 0) return;
    
    // 取得最新一筆資料
    const latestData = data[data.length - 1];
    
    // 更新市場名稱
    document.getElementById('marketName').textContent = marketName;
    
    // 更新價格資訊
    document.getElementById('priceHigh').textContent = `${latestData.上價} 元/公斤`;
    document.getElementById('priceLow').textContent = `${latestData.下價} 元/公斤`;
    
    // 更新底部資訊
    document.getElementById('cropName').textContent = latestData.作物名稱;
    document.getElementById('tradeVolume').textContent = `${Number(latestData.交易量).toLocaleString()} 公斤`;
    document.getElementById('avgPrice').textContent = `${latestData.平均價} 元/公斤`;
    
    // 更新圖表
    updateChart(data);
}

// 檢查價格變化並產生通知
function checkPriceChanges(newData) {
    if (!newData || newData.length < 2) return;
    
    const latestData = newData[newData.length - 1];
    const previousData = newData[newData.length - 2];
    
    const priceChange = Number(latestData.平均價) - Number(previousData.平均價);
    if (Math.abs(priceChange) > 5) {
        const direction = priceChange > 0 ? '上漲' : '下跌';
        addNotification(`${latestData.作物名稱}價格${direction}${Math.abs(priceChange)}元`);
    }
}

// 新增通知
function addNotification(message) {
    const notification = {
        id: Date.now(),
        message: message,
        timestamp: new Date()
    };
    
    notifications.unshift(notification);
    if (notifications.length > 5) {
        notifications.pop();
    }
    
    updateNotificationDisplay();
}

// 更新通知顯示
function updateNotificationDisplay() {
    const notificationList = document.getElementById('notificationList');
    notificationList.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationElement = document.createElement('div');
        notificationElement.className = 'notification-item';
        notificationElement.textContent = notification.message;
        notificationList.appendChild(notificationElement);
    });
}

// 檢查並更新本地資料
async function checkAndUpdateLocalData() {
    const lastFetchDate = localStorage.getItem(STORAGE_KEYS.LAST_FETCH_DATE);
    const today = new Date().toDateString();
    
    if (lastFetchDate !== today) {
        try {
            console.log('開始獲取新資料...');
            const response = await fetch(PRICE_API);
            const data = await response.json();
            
            // 儲存新資料
            localStorage.setItem(STORAGE_KEYS.PRICE_DATA, JSON.stringify(data));
            localStorage.setItem(STORAGE_KEYS.LAST_FETCH_DATE, today);
            console.log('資料已更新並儲存');
            
            return data;
        } catch (error) {
            console.error('獲取新資料失敗:', error);
            // 如果獲取失敗，嘗試使用舊資料
            const oldData = localStorage.getItem(STORAGE_KEYS.PRICE_DATA);
            if (oldData) {
                return JSON.parse(oldData);
            }
            throw error;
        }
    } else {
        // 使用本地資料
        const localData = localStorage.getItem(STORAGE_KEYS.PRICE_DATA);
        if (localData) {
            return JSON.parse(localData);
        }
        throw new Error('本地無資料');
    }
}

// 修改市場選擇對話框函數
function showMarketSelectionDialog() {
    console.log('顯示市場選擇對話框');
    if (document.querySelector('.market-selection-dialog')) {
        console.log('對話框已存在，不重複顯示');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'market-selection-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'market-selection-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h2>請選擇市場</h2>
            <div class="market-list">
                ${Object.entries(MARKET_NAME_MAP).map(([key, value]) => `
                    <button class="market-button" data-market="${value}">${key}</button>
                `).join('')}
            </div>
            <div class="dialog-buttons">
                <button id="confirmMarket">確認</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    console.log('對話框已添加到頁面');

    // 綁定市場選擇事件
    const marketButtons = dialog.querySelectorAll('.market-button');
    marketButtons.forEach(button => {
        button.addEventListener('click', () => {
            marketButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            console.log('選擇市場:', button.dataset.market);
        });
    });

    // 確認按鈕事件
    const confirmBtn = dialog.querySelector('#confirmMarket');
    confirmBtn.addEventListener('click', () => {
        const selectedButton = dialog.querySelector('.market-button.selected');
        if (selectedButton) {
            const newMarketName = selectedButton.dataset.market;
            console.log('確認選擇市場:', newMarketName);
            marketName = newMarketName;
            localStorage.setItem(STORAGE_KEYS.MARKET_NAME, marketName);
            document.getElementById('marketName').textContent = marketName;
            overlay.remove();
            dialog.remove();
            location.reload();
        } else {
            console.log('未選擇市場');
            alert('請選擇一個市場');
        }
    });
}

// 新增右下角隱藏觸發區
function addDevModeTriggerArea() {
    const trigger = document.createElement('div');
    trigger.className = 'devmode-trigger-area';
    document.body.appendChild(trigger);
    let timer = null;
    let isTouch = false;

    function startPress() {
        timer = setTimeout(() => {
            DevMode.enableDevMode();
        }, 3000);
    }
    function cancelPress() {
        if (timer) clearTimeout(timer);
    }

    trigger.addEventListener('mousedown', startPress);
    trigger.addEventListener('mouseup', cancelPress);
    trigger.addEventListener('mouseleave', cancelPress);
    trigger.addEventListener('touchstart', (e) => {
        isTouch = true;
        startPress();
    });
    trigger.addEventListener('touchend', cancelPress);
    trigger.addEventListener('touchcancel', cancelPress);
}