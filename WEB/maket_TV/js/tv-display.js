// 電視看板特定功能
let currentDisplayMode = 'price'; // 'price' 或 'chart'
let displayInterval;
const DISPLAY_DURATION = 30000; // 30秒切換一次顯示模式
let currentCropIndex = 0;
let crops = [];
let deviceId = localStorage.getItem('deviceId');
let marketName = '';
let marketCrops = [];
let cropNames = [];

// 主要常數
const MARKET_API = 'https://backup0821.github.io/API/Better-vegetable-catcher/marketTV-drvice.json';
const PRICE_API = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
const CROP_INTERVAL = 5000; // 5秒輪播

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
        document.addEventListener('click', this.handleClick.bind(this));
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

    // 處理點擊事件
    handleClick(event) {
        const currentTime = Date.now();
        if (currentTime - this.lastTriggerTime > this.TRIGGER_TIMEOUT) {
            this.triggerCount = 0;
        }
        this.triggerCount++;
        this.lastTriggerTime = currentTime;
        if (this.triggerCount >= this.TRIGGER_THRESHOLD) {
            this.enableDevMode();
            this.triggerCount = 0;
        }
    },

    // 啟用開發者模式
    enableDevMode() {
        this.isEnabled = true;
        this.showDevModePanel();
    },

    // 顯示開發者模式面板（含遮罩）
    showDevModePanel() {
        // 遮罩
        this.overlay = document.createElement('div');
        this.overlay.className = 'dev-mode-overlay';
        document.body.appendChild(this.overlay);
        // 面板
        this.panel = document.createElement('div');
        this.panel.className = 'dev-mode-panel';
        this.panel.innerHTML = `
            <div class="dev-mode-header">
                <h2>開發者模式</h2>
                <button class="close-button">×</button>
            </div>
            <div class="dev-mode-content">
                <div class="dev-mode-section">
                    <h3>系統操作</h3>
                    <button id="resetDeviceBtn">重設裝置識別碼</button>
                    <button id="clearCacheBtn">清除快取</button>
                    <button id="reloadDataBtn">重新載入資料</button>
                </div>
                <div class="dev-mode-section">
                    <h3>顯示設定</h3>
                    <div class="brightness-control">
                        <label for="brightnessSlider">亮度調整</label>
                        <input type="range" id="brightnessSlider" min="0" max="100" value="${this.brightness}">
                        <span id="brightnessValue">${this.brightness}%</span>
                    </div>
                    <button id="toggleFullscreenBtn">切換全螢幕</button>
                    <button id="testDisplayBtn">測試顯示</button>
                </div>
                <div class="dev-mode-section">
                    <h3>系統資訊</h3>
                    <div id="systemInfo"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.panel);
        this.bindDevModeEvents(this.panel);
    },

    // 綁定開發者模式事件
    bindDevModeEvents(panel) {
        // 關閉按鈕
        panel.querySelector('.close-button').addEventListener('click', () => {
            this.closeDevModePanel();
        });
        // 點遮罩也可關閉
        this.overlay.addEventListener('click', () => {
            this.closeDevModePanel();
        });
        // 重設裝置按鈕
        panel.querySelector('#resetDeviceBtn').addEventListener('click', () => {
            if (confirm('確定要重設裝置識別碼嗎？此操作將清除所有本地設定。')) {
                localStorage.removeItem('deviceId');
                location.reload();
            }
        });
        // 清除快取按鈕
        panel.querySelector('#clearCacheBtn').addEventListener('click', () => {
            if (confirm('確定要清除快取嗎？')) {
                localStorage.clear();
                location.reload();
            }
        });
        // 重新載入資料按鈕
        panel.querySelector('#reloadDataBtn').addEventListener('click', () => {
            location.reload();
        });
        // 切換全螢幕按鈕
        panel.querySelector('#toggleFullscreenBtn').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
            setTimeout(() => this.updateSystemInfo(panel.querySelector('#systemInfo')), 500);
        });
        // 亮度調整
        const brightnessSlider = panel.querySelector('#brightnessSlider');
        const brightnessValue = panel.querySelector('#brightnessValue');
        brightnessSlider.addEventListener('input', (e) => {
            this.brightness = parseInt(e.target.value);
            brightnessValue.textContent = `${this.brightness}%`;
            this.applyBrightness();
        });
        // 測試顯示按鈕
        panel.querySelector('#testDisplayBtn').addEventListener('click', () => {
            if (this.testPattern) {
                this.stopTestPattern();
            } else {
                this.startTestPattern();
            }
        });
        // 動態更新系統資訊
        this.updateSystemInfo(panel.querySelector('#systemInfo'));
        window.addEventListener('resize', this._sysinfoResize = () => this.updateSystemInfo(panel.querySelector('#systemInfo')));
        document.addEventListener('fullscreenchange', this._sysinfoFS = () => this.updateSystemInfo(panel.querySelector('#systemInfo')));
        window.addEventListener('online', this._sysinfoNet = () => this.updateSystemInfo(panel.querySelector('#systemInfo')));
        window.addEventListener('offline', this._sysinfoNet);
    },

    // 關閉面板與遮罩
    closeDevModePanel() {
        if (this.panel) this.panel.remove();
        if (this.overlay) this.overlay.remove();
        this.panel = null;
        this.overlay = null;
        this.isEnabled = false;
        // 移除事件監聽
        window.removeEventListener('resize', this._sysinfoResize);
        document.removeEventListener('fullscreenchange', this._sysinfoFS);
        window.removeEventListener('online', this._sysinfoNet);
        window.removeEventListener('offline', this._sysinfoNet);
        // 停止測試顯示
        this.stopTestPattern();
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

// 檢查裝置識別碼
async function checkDeviceId() {
    if (!deviceId) {
        showDeviceSetupDialog();
    } else {
        await verifyDeviceId();
    }
}

// 顯示裝置設定對話框
function showDeviceSetupDialog() {
    if (document.querySelector('.device-setup-dialog')) return;

    const overlay = document.createElement('div');
    overlay.className = 'device-setup-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'device-setup-dialog';
    dialog.innerHTML = `
        <h2>請輸入裝置識別碼</h2>
        <input type="text" id="deviceIdInput" placeholder="請輸入裝置識別碼">
        <button id="confirmDeviceId">確認</button>
        <div id="deviceError" class="error-message"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const input = dialog.querySelector('#deviceIdInput');
    const confirmBtn = dialog.querySelector('#confirmDeviceId');
    const errorDiv = dialog.querySelector('#deviceError');

    confirmBtn.addEventListener('click', async () => {
        const newDeviceId = input.value.trim();
        if (!newDeviceId) {
            errorDiv.textContent = '請輸入裝置識別碼';
            return;
        }

        deviceId = newDeviceId;
        localStorage.setItem('deviceId', deviceId);

        if (await verifyDeviceId()) {
            overlay.remove();
            dialog.remove();
            location.reload();
        } else {
            errorDiv.textContent = '無效的裝置識別碼';
        }
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    });
}

// 驗證裝置識別碼
async function verifyDeviceId() {
    try {
        const response = await safeFetch(MARKET_API);
        if (!response) return false;

        const device = response.find(d => d.deviceId === deviceId);
        if (!device) {
            showError('無效的裝置識別碼');
            localStorage.removeItem('deviceId');
            return false;
        }

        marketName = device.marketName;
        document.getElementById('marketName').textContent = marketName;
        return true;
    } catch (error) {
        console.error('驗證裝置識別碼時發生錯誤:', error);
        showError('驗證裝置識別碼失敗');
        return false;
    }
}

// 更新市場資訊
function updateMarketInfo() {
    document.getElementById('marketName').textContent = marketName;
    document.getElementById('deviceId').textContent = deviceId;
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
function startCropRotation() {
    if (cropTimer) clearInterval(cropTimer);
    if (cropNames.length === 0) return;
    cropIndex = 0;
    showCropInfo(cropNames[cropIndex]);
    cropTimer = setInterval(() => {
        cropIndex = (cropIndex + 1) % cropNames.length;
        showCropInfo(cropNames[cropIndex]);
    }, CROP_INTERVAL);
}

// 更新顯示內容
function updateDisplay() {
    if (currentDisplayMode === 'price') {
        showPriceDisplay();
    } else {
        showChartDisplay();
    }
}

// 顯示價格資訊
function showPriceDisplay() {
    document.getElementById('displayMode').innerHTML = `
        <span class="mode-icon">💰</span>
        <span class="mode-text">價格資訊</span>
    `;
    document.getElementById('chartArea').style.display = 'none';
}

// 顯示圖表
function showChartDisplay() {
    document.getElementById('displayMode').innerHTML = `
        <span class="mode-icon">📊</span>
        <span class="mode-text">價格趨勢</span>
    `;
    document.getElementById('chartArea').style.display = 'block';
    
    if (selectedCrop) {
        showPriceTrend();
    }
}

// 顯示作物資訊
function showCropInfo(cropName) {
    const cropData = marketCrops.filter(item => item.作物名稱 === cropName);
    if (cropData.length === 0) return;
    
    const latestData = cropData[cropData.length - 1];
    document.getElementById('cropName').textContent = cropName;
    document.getElementById('cropCode').textContent = `代碼：${latestData.作物代號}`;
    
    // 更新價格趨勢
    const prices = cropData.map(item => Number(item.平均價));
    document.getElementById('maxPrice').textContent = `${Math.max(...prices).toFixed(2)} 元/公斤`;
    document.getElementById('minPrice').textContent = `${Math.min(...prices).toFixed(2)} 元/公斤`;
    
    const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2);
    document.getElementById('priceChange').textContent = `${priceChange}%`;
    document.getElementById('priceChange').style.color = priceChange >= 0 ? '#4caf50' : '#f44336';
    
    // 更新圖表
    if (currentDisplayMode === 'chart') {
        drawChart(cropData);
    }
}

// 繪製圖表
function drawChart(cropData) {
    const dates = cropData.map(item => item.交易日期);
    const prices = cropData.map(item => Number(item.平均價));
    const volumes = cropData.map(item => Number(item.交易量));
    
    const trace1 = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '價格',
        line: { color: '#1a237e' }
    };
    
    const trace2 = {
        x: dates,
        y: volumes,
        type: 'bar',
        name: '交易量',
        yaxis: 'y2',
        marker: { color: '#4caf50' }
    };
    
    const layout = {
        title: `${cropData[0].作物名稱} 價格趨勢`,
        xaxis: { title: '日期' },
        yaxis: { title: '價格 (元/公斤)' },
        yaxis2: {
            title: '交易量 (公斤)',
            overlaying: 'y',
            side: 'right'
        },
        showlegend: true,
        legend: { x: 1, y: 1 }
    };
    
    Plotly.newPlot('chartArea', [trace1, trace2], layout);
}

// 主程式
async function main() {
    try {
        // 啟動時鐘
        startClock();

        // 檢查裝置識別碼
        if (!deviceId) {
            showDeviceSetupDialog();
            return;
        }

        // 驗證裝置識別碼
        if (!await verifyDeviceId()) {
            showDeviceSetupDialog();
            return;
        }

        // 初始化顯示
        await initDisplay();

        // 開始輪播
        startDisplayRotation();
        startCropRotation();

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

// 頁面載入完成後啟動
document.addEventListener('DOMContentLoaded', main);

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
    if (!(await ensureDeviceIdAndMarket())) return;
    // 取得所有資料
    const res = await fetch(PRICE_API);
    const data = await res.json();
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
        
        const dateElement = document.getElementById('currentDate');
        const timeElement = document.getElementById('currentTime');
        
        if (dateElement) dateElement.textContent = dateStr;
        if (timeElement) timeElement.textContent = timeStr;
    }

    // 立即更新一次
    updateClock();
    // 每秒更新一次
    return setInterval(updateClock, 1000);
}

// ====== 啟動流程修正 ======
window.addEventListener('DOMContentLoaded', async () => {
    deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        showDeviceSetupDialog();
        return;
    }
    // 檢查 deviceId 是否有效
    try {
        const res = await fetch(MARKET_API);
        const list = await res.json();
        const found = list.find(d => d.devicesID === deviceId);
        if (!found) {
            showDeviceSetupDialog();
            return;
        }
        marketName = found.market_name;
        document.getElementById('marketName').textContent = marketName;
        startClock();
        fetchAndStartCropRotation();
    } catch (e) {
        showNotifications(['無法取得市場對照表，請檢查網路']);
    }
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