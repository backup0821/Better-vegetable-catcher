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
let cropIndex = 0;
let cropTimer = null;

// 主要常數
const MARKET_API = 'https://backup0821.github.io/API/Better-vegetable-catcher/marketTV-drvice.json';
const PRICE_API = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
const CROP_INTERVAL = 5000; // 5秒輪播

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
    const dialog = document.createElement('div');
    dialog.className = 'device-setup-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h2>設定裝置識別碼</h2>
            <p>請輸入裝置識別碼以識別市場</p>
            <input type="text" id="deviceIdInput" placeholder="例如：drvice-Taipai01">
            <div class="dialog-buttons">
                <button id="confirmDeviceId">確認</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('confirmDeviceId').addEventListener('click', async () => {
        const input = document.getElementById('deviceIdInput');
        const newDeviceId = input.value.trim();
        if (newDeviceId) {
            deviceId = newDeviceId;
            localStorage.setItem('deviceId', deviceId);
            await verifyDeviceId();
            dialog.remove();
        }
    });
}

// 驗證裝置識別碼
async function verifyDeviceId() {
    try {
        const response = await fetch(MARKET_API);
        const devices = await response.json();
        const device = devices.find(d => d.devicesID === deviceId);
        
        if (device) {
            marketName = device.market_name;
            updateMarketInfo();
            initDisplay();
        } else {
            localStorage.removeItem('deviceId');
            deviceId = null;
            showDeviceSetupDialog();
        }
    } catch (error) {
        console.error('驗證裝置識別碼時發生錯誤:', error);
        showError('無法連接到伺服器，請稍後再試');
    }
}

// 更新市場資訊
function updateMarketInfo() {
    const header = document.querySelector('header p');
    header.textContent = `${marketName} - 即時價格資訊看板`;
}

// 顯示錯誤訊息
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// 更新時間戳
function updateTimestamp() {
    const now = new Date();
    document.getElementById('timestamp').textContent = 
        now.toLocaleString('zh-TW', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
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
    const priceDisplay = document.getElementById('priceDisplay');
    priceDisplay.style.display = 'grid';
    document.getElementById('chartArea').style.display = 'none';
    
    // 使用原始專案的數據更新價格顯示
    if (cropData && cropData.length > 0) {
        updatePriceCards();
    }
}

// 顯示圖表
function showChartDisplay() {
    const priceDisplay = document.getElementById('priceDisplay');
    priceDisplay.style.display = 'none';
    document.getElementById('chartArea').style.display = 'block';
    
    // 使用原始專案的圖表功能
    if (selectedCrop) {
        showPriceTrend();
    }
}

// 更新價格卡片
function updatePriceCards() {
    const priceDisplay = document.getElementById('priceDisplay');
    priceDisplay.innerHTML = '';

    // 獲取最新的價格數據，只顯示當前市場的數據
    const latestData = cropData
        .filter(item => 
            item.交易日期 === getLatestDate() && 
            item.市場名稱 === marketName
        )
        .sort((a, b) => Number(b.平均價) - Number(a.平均價));

    // 只顯示前12個價格最高的項目
    const topItems = latestData.slice(0, 12);

    topItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'price-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            <h3>${item.作物名稱}</h3>
            <div class="price-value">${item.平均價}</div>
            <div class="market">${item.市場名稱}</div>
        `;
        priceDisplay.appendChild(card);
    });
}

// 獲取最新日期
function getLatestDate() {
    return Math.max(...cropData.map(item => new Date(item.交易日期)));
}

// 更新通知
function updateNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    // 重置動畫
    notification.style.animation = 'none';
    notification.offsetHeight; // 觸發重繪
    notification.style.animation = 'scrollText 20s linear infinite';
}

// 取得市場名稱
async function fetchMarketName() {
    if (!deviceId) {
        // 請先設定裝置識別碼
        return;
    }
    const res = await fetch(MARKET_API);
    const list = await res.json();
    const found = list.find(d => d.devicesID === deviceId);
    if (found) {
        marketName = found.market_name;
        document.getElementById('marketName').textContent = marketName;
    } else {
        marketName = '';
        document.getElementById('marketName').textContent = '未知市場';
    }
}

// 取得該市場所有有成交的作物資料
async function fetchMarketCrops() {
    const res = await fetch(PRICE_API);
    const data = await res.json();
    // 只取該市場且有成交的作物
    marketCrops = data.filter(item => item.市場名稱 === marketName && Number(item.交易量) > 0);
    // 取得所有有成交的作物名稱（去重）
    cropNames = [...new Set(marketCrops.map(item => item.作物名稱))];
}

// 顯示作物資訊與圖表
function showCropInfo(cropName) {
    // 取得該作物所有資料（依日期排序）
    const cropData = marketCrops.filter(item => item.作物名稱 === cropName)
        .sort((a, b) => new Date(a.交易日期) - new Date(b.交易日期));
    // 右側資訊卡
    document.getElementById('cropNameCard').textContent = cropName;
    const latest = cropData[cropData.length-1];
    document.getElementById('tradeVolumeCard').textContent = `交易量\n${latest.交易量}`;
    document.getElementById('avgPriceCard').textContent = `平均價\n${latest.平均價}`;
    // 圖表
    drawChart(cropData);
}

// 畫圖表
function drawChart(cropData) {
    const dates = cropData.map(item => item.交易日期);
    const prices = cropData.map(item => Number(item.平均價));
    const trace = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#2196F3', width: 4 },
        marker: { size: 8 }
    };
    const layout = {
        margin: { t: 30, l: 60, r: 30, b: 60 },
        xaxis: { title: '日期', tickangle: -45 },
        yaxis: { title: '平均價', rangemode: 'tozero' },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff',
        font: { family: 'Noto Sans TC, Microsoft JhengHei, sans-serif', size: 18 }
    };
    Plotly.newPlot('chartArea', [trace], layout, {displayModeBar: false, responsive: true});
}

// 初始化
async function main() {
    await fetchMarketName();
    await fetchMarketCrops();
    startCropRotation();
}

window.addEventListener('load', main);

// 主程序
document.addEventListener('DOMContentLoaded', () => {
    // 禁用所有觸控事件
    document.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // 初始化顯示
    Display.init();

    // 監聽重設裝置按鈕
    document.getElementById('resetDevice').addEventListener('click', () => {
        if (confirm('確定要重設裝置識別碼嗎？')) {
            Utils.storage.remove(CONFIG.STORAGE_KEYS.DEVICE_ID);
            Display.showDeviceSetupDialog();
        }
    });

    // 監聽視窗大小變化
    window.addEventListener('resize', Utils.debounce(() => {
        if (Display.state.currentMode === 'chart') {
            Chart.clearChart('chartArea');
            Display.updateChartDisplay();
        }
    }, 250));

    // 監聽錯誤
    window.addEventListener('error', (event) => {
        console.error('應用程序錯誤:', event.error);
        Utils.showError('應用程序發生錯誤，請重新整理頁面');
    });

    // 監聽離線狀態
    window.addEventListener('offline', () => {
        Utils.showNotification('網路連線已中斷', 'error');
    });

    window.addEventListener('online', () => {
        Utils.showNotification('網路連線已恢復', 'success');
        Display.checkDataUpdate();
    });
}); 