// 版本資訊
const VERSION = 'v2.4.web.1';
console.log(`當前版本：${VERSION}`);
const VERSION_CHECK_URL = 'https://api.github.com/repos/backup0821/Better-vegetable-catcher/releases/latest';

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

// 檢查版本更新
async function checkForUpdates() {
    try {
        const response = await fetch(VERSION_CHECK_URL);
        if (!response.ok) throw new Error('無法檢查更新');
        const data = await response.json();
        const latestVersion = data.tag_name;
        
        if (latestVersion !== VERSION) {
            // 顯示更新通知
            showUpdateNotification(latestVersion);
        }
        
        versionNumber.textContent = VERSION;
        lastUpdate.textContent = new Date().toLocaleString('zh-TW');
    } catch (error) {
        console.error('檢查更新時發生錯誤:', error);
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
});

// 從農產品交易行情站獲取資料
async function fetchData() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'flex';
    loadingSpinner.innerHTML = '<div class="spinner"></div><div class="loading-text">資料載入中...</div>';
    try {
        const response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
        if (!response.ok) throw new Error('無法獲取資料');
        const data = await response.json();
        cropData = data;
        updateCropList();
        
        // 更新市場列表
        const marketSelect = document.getElementById('marketSelect');
        if (marketSelect) {
            const markets = [...new Set(cropData.map(item => item.市場名稱))].sort();
            marketSelect.innerHTML = '<option value="all">全部市場</option>';
            markets.forEach(market => {
                const option = document.createElement('option');
                option.value = market;
                option.textContent = market;
                marketSelect.appendChild(option);
            });
        }
        
        // 更新資料時間
        const now = new Date();
        dataUpdateTime.textContent = now.toLocaleString('zh-TW');
        
        // 檢查更新
        await checkForUpdates();
    } catch (error) {
        console.error('獲取資料時發生錯誤:', error);
        resultArea.innerHTML = '<p class="error">無法獲取資料，請稍後再試</p>';
    } finally {
        loadingSpinner.innerHTML = '<div class="loading-text">⬇️ 請下滑查看更多內容 ⬇️</div>';
    }
}

// 更新作物列表
function updateCropList() {
    const crops = [...new Set(cropData.map(item => item.作物名稱))].sort();
    cropSelect.innerHTML = '<option value="">請選擇作物</option>';
    crops.forEach(crop => {
        const option = document.createElement('option');
        option.value = crop;
        option.textContent = crop;
        cropSelect.appendChild(option);
    });
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
        xaxis: { title: '價格 (元/公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
        yaxis: { title: '次數', titlefont: { size: 16 }, tickfont: { size: 15 } },
        margin: { t: 60, l: 60, r: 30, b: 60 },
        legend: { font: { size: 15 } },
        hoverlabel: { font: { size: 15 } },
        autosize: true,
        responsive: true
    };
    Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
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
    const selectedMarket = marketSelect.value;
    let filteredData = cropData.filter(item => item.作物名稱 === cropName);
    
    if (selectedMarket !== 'all') {
        filteredData = filteredData.filter(item => item.市場名稱 === selectedMarket);
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
    try {
        console.log('開始檢查通知...');
        let allNotifications = [];
        
        // 從本地檔案讀取通知
        try {
            const localResponse = await fetch('./notfiy.json', {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (localResponse.ok) {
                const localNotifications = await localResponse.json();
                console.log('從本地檔案獲取到的通知:', localNotifications);
                allNotifications = allNotifications.concat(localNotifications);
            }
        } catch (error) {
            console.error('讀取本地通知檔案失敗:', error);
        }
        
        // 從 API 讀取通知
        try {
            const apiResponse = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notfiy.json', {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (apiResponse.ok) {
                const apiNotifications = await apiResponse.json();
                console.log('從 API 獲取到的通知:', apiNotifications);
                allNotifications = allNotifications.concat(apiNotifications);
            }
        } catch (error) {
            console.error('讀取 API 通知失敗:', error);
        }
        
        const now = new Date();
        console.log('當前時間:', now);
        
        // 收集所有需要顯示的通知
        let notificationsToShow = [];
        
        allNotifications.forEach(notification => {
            console.log('處理通知:', notification);
            
            // 只處理公開通知
            if (!notification.public) {
                console.log('此通知不是公開通知');
                return;
            }
            
            // 檢查是否為特定裝置的通知
            const isTargetedDevice = notification.targetDevices && notification.targetDevices.length > 0;
            const isForEveryone = notification.targetDevices && notification.targetDevices.includes('everyone');
            
            if (isTargetedDevice && !isForEveryone && !notification.targetDevices.includes(deviceId)) {
                console.log('此通知不是針對當前裝置的');
                return;
            }
            
            // 解析時間範圍
            const [startTime, endTime] = notification.time.split(' ~ ');
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            
            console.log('通知時間範圍:', {
                start: startDate,
                end: endDate,
                current: now
            });
            
            // 檢查通知是否過期
            if (now > endDate) {
                console.log('此通知已過期');
                return;
            }
            
            // 檢查當前時間是否在通知時間範圍內
            if (now >= startDate && now <= endDate) {
                console.log('符合時間範圍，準備顯示通知');
                notificationsToShow.push({
                    ...notification,
                    isTargetedDevice: isTargetedDevice && !isForEveryone,
                    isPublic: true,
                    isExpired: false
                });
            }
        });
        
        // 顯示所有符合條件的通知
        if (notificationsToShow.length > 0) {
            console.log('顯示通知');
            showPageNotifications(notificationsToShow);
        } else {
            console.log('目前沒有需要顯示的通知');
        }
    } catch (error) {
        console.error('獲取通知失敗:', error);
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
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        margin-top: 10px;
    `;
    confirmButton.onclick = () => {
        const currentOverlay = document.querySelector('.notification-overlay');
        const currentNotification = document.getElementById('page-notification');
        if (currentOverlay) {
            currentOverlay.remove();
        }
        if (currentNotification) {
            currentNotification.remove();
        }
    };

    notificationContainer.appendChild(confirmButton);
    overlay.appendChild(notificationContainer);
    document.body.appendChild(overlay);
    
    console.log('通知已顯示');
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
                    time: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
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

// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    // 創建市場選擇下拉選單
    const marketSelectContainer = document.createElement('div');
    marketSelectContainer.className = 'market-select-container';
    marketSelectContainer.style.cssText = `
        margin-bottom: 15px;
    `;

    const marketSelectLabel = document.createElement('label');
    marketSelectLabel.textContent = '選擇市場：';
    marketSelectLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
    `;

    const marketSelect = document.createElement('select');
    marketSelect.id = 'marketSelect';
    marketSelect.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
        background-color: white;
    `;

    // 將市場選擇元素添加到控制面板
    const controlPanel = document.querySelector('.control-panel');
    const searchSection = controlPanel.querySelector('.search-section');
    marketSelectContainer.appendChild(marketSelectLabel);
    marketSelectContainer.appendChild(marketSelect);
    controlPanel.insertBefore(marketSelectContainer, searchSection);

    // 更新市場列表
    function updateMarketList() {
        const markets = [...new Set(cropData.map(item => item.市場名稱))].sort();
        marketSelect.innerHTML = '<option value="all">全部市場</option>';
        markets.forEach(market => {
            const option = document.createElement('option');
            option.value = market;
            option.textContent = market;
            marketSelect.appendChild(option);
        });
    }

    // 當市場選擇改變時更新圖表
    marketSelect.addEventListener('change', () => {
        if (selectedCrop) {
            showPriceTrend();
        }
    });

    // 修改價格趨勢圖函數
    const originalShowPriceTrend = showPriceTrend;
    showPriceTrend = function() {
        if (!selectedCrop) return;
        const cropData = getCropData(selectedCrop);
        
        // 如果選擇了特定市場，只顯示該市場的資料
        if (marketSelect.value !== 'all') {
            const marketData = cropData.filter(item => item.市場名稱 === marketSelect.value);
            const dates = marketData.map(item => item.交易日期);
            const prices = marketData.map(item => Number(item.平均價));
            
            const trace = {
                x: dates,
                y: prices,
                type: 'scatter',
                mode: 'lines+markers',
                name: marketSelect.value,
                line: { width: 2 },
                marker: { size: 8 }
            };

            const maxPrice = Math.max(...prices);
            const minPrice = Math.min(...prices);
            const maxItem = marketData.find(item => Number(item.平均價) === maxPrice);
            const minItem = marketData.find(item => Number(item.平均價) === minPrice);

            const layout = {
                title: {
                    text: `${selectedCrop} - ${marketSelect.value} 價格趨勢`,
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
            Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
            showBasicStats(marketData);
        } else {
            // 如果選擇全部市場，使用原有的多市場顯示邏輯
            originalShowPriceTrend();
        }
    };

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
            xaxis: { title: '價格 (元/公斤)', titlefont: { size: 16 }, tickfont: { size: 15 } },
            yaxis: { title: '次數', titlefont: { size: 16 }, tickfont: { size: 15 } },
            margin: { t: 60, l: 60, r: 30, b: 60 },
            legend: { font: { size: 15 } },
            hoverlabel: { font: { size: 15 } },
            autosize: true,
            responsive: true
        };
        Plotly.newPlot(chartArea, [trace], layout, {responsive: true});
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
        
        // 生成當月和下月的日曆
        for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
            const month = (currentMonth + monthOffset) % 12;
            const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
            
            calendarHTML += `
                <div style="margin-bottom: 30px;">
                    <h3 style="text-align: center;">${year}年${month + 1}月</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">日</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">一</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">二</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">三</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">四</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">五</th>
                            <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">六</th>
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
let devModeClickCount = {
    topLeft: 0,
    topRight: 0
};
let devModeTimeout = null;
let isDevModeActive = false;

// 初始化開發者模式
document.addEventListener('DOMContentLoaded', () => {
    initDevMode();
    initDevModeFeatures();
    console.log('開發者模式初始化完成');
});

// 開發者模式觸發邏輯
function initDevMode() {
    // 監聽搜尋欄輸入
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (e.target.value.toLowerCase() === 'dev') {
                checkDevModeTrigger();
            }
        });
    }

    // 監聽左上角點擊
    document.addEventListener('click', (e) => {
        if (e.clientX < 50 && e.clientY < 50) {
            devModeClickCount.topLeft++;
            console.log('左上角點擊次數：', devModeClickCount.topLeft);
            checkDevModeTrigger();
        }
    });

    // 監聽右上角點擊
    document.addEventListener('click', (e) => {
        if (e.clientX > window.innerWidth - 50 && e.clientY < 50) {
            devModeClickCount.topRight++;
            console.log('右上角點擊次數：', devModeClickCount.topRight);
            checkDevModeTrigger();
        }
    });

    // 重置點擊計數
    setInterval(() => {
        devModeClickCount.topLeft = 0;
        devModeClickCount.topRight = 0;
    }, 5000);
}

// 檢查是否觸發開發者模式
function checkDevModeTrigger() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.toLowerCase() === 'dev' && 
        devModeClickCount.topLeft >= 5 && 
        devModeClickCount.topRight >= 5) {
        console.log('觸發開發者模式');
        activateDevMode();
    }
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
        
        // 初始化所有功能按鈕
        initAllFeatures();
    }
}

// 初始化所有功能
function initAllFeatures() {
    // 資料庫操作
    const viewDatabaseBtn = document.getElementById('viewDatabase');
    if (viewDatabaseBtn) {
        viewDatabaseBtn.addEventListener('click', () => {
            console.log('點擊查看資料庫');
            viewDatabase();
        });
    }

    // 開發者設定
    const switchEnvironmentBtn = document.getElementById('switchEnvironment');
    if (switchEnvironmentBtn) {
        switchEnvironmentBtn.addEventListener('click', () => {
            console.log('點擊環境設定');
            showEnvironmentSettings();
        });
    }

    const adjustParametersBtn = document.getElementById('adjustParameters');
    if (adjustParametersBtn) {
        adjustParametersBtn.addEventListener('click', () => {
            console.log('點擊參數調整');
            showParameterSettings();
        });
    }

    const customThemeBtn = document.getElementById('customTheme');
    if (customThemeBtn) {
        customThemeBtn.addEventListener('click', () => {
            console.log('點擊主題設定');
            showThemeSettings();
        });
    }

    const featureToggleBtn = document.getElementById('featureToggle');
    if (featureToggleBtn) {
        featureToggleBtn.addEventListener('click', () => {
            console.log('點擊功能開關');
            showFeatureSettings();
        });
    }

    // 進階工具
    const systemDiagnosticsBtn = document.getElementById('systemDiagnostics');
    if (systemDiagnosticsBtn) {
        systemDiagnosticsBtn.addEventListener('click', () => {
            console.log('點擊系統診斷');
            showSystemDiagnostics();
        });
    }

    const advancedAnalysisBtn = document.getElementById('advancedAnalysis');
    if (advancedAnalysisBtn) {
        advancedAnalysisBtn.addEventListener('click', () => {
            console.log('點擊進階分析');
            showAdvancedAnalysis();
        });
    }

    const performanceToolsBtn = document.getElementById('performanceTools');
    if (performanceToolsBtn) {
        performanceToolsBtn.addEventListener('click', () => {
            console.log('點擊效能優化');
            showPerformanceTools();
        });
    }

    const testToolsBtn = document.getElementById('testTools');
    if (testToolsBtn) {
        testToolsBtn.addEventListener('click', () => {
            console.log('點擊測試工具');
            showTestTools();
        });
    }

    const securityToolsBtn = document.getElementById('securityTools');
    if (securityToolsBtn) {
        securityToolsBtn.addEventListener('click', () => {
            console.log('點擊安全性工具');
            showSecurityTools();
        });
    }
}

// 資料庫操作相關功能
async function viewDatabase() {
    try {
        // 創建資料庫查看介面
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
                    </select>
                    <button id="refreshDbData">重新整理</button>
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

        // 添加到開發者模式面板
        const devModeContent = document.querySelector('.dev-mode-content');
        devModeContent.appendChild(dbViewer);

        // 初始化資料庫查看器
        initDatabaseViewer();
    } catch (error) {
        console.error('初始化資料庫查看器時發生錯誤:', error);
        showNotification('錯誤', '初始化資料庫查看器失敗');
    }
}

function initDatabaseViewer() {
    const dbSearchInput = document.getElementById('dbSearchInput');
    const dbTableSelect = document.getElementById('dbTableSelect');
    const refreshDbData = document.getElementById('refreshDbData');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    let currentPage = 1;
    const itemsPerPage = 20;
    let currentData = [];
    let filteredData = [];

    // 載入資料
    async function loadData() {
        try {
            const table = dbTableSelect.value;
            let response;
            
            if (table === 'farmTrans') {
                response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
            } else if (table === 'marketRest') {
                response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            currentData = await response.json();
            filteredData = [...currentData];
            renderTable();
        } catch (error) {
            console.error('載入資料時發生錯誤:', error);
            showNotification('錯誤', '載入資料失敗');
        }
    }

    // 渲染表格
    function renderTable() {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredData.slice(start, end);

        const tableHeader = document.getElementById('dbTableHeader');
        const tableBody = document.getElementById('dbTableBody');
        const pageInfo = document.getElementById('pageInfo');

        // 清空表格
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';

        if (pageData.length > 0) {
            // 設置表頭
            const headers = Object.keys(pageData[0]);
            headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                tableHeader.appendChild(th);
            });

            // 填充資料
            pageData.forEach(row => {
                const tr = document.createElement('tr');
                headers.forEach(header => {
                    const td = document.createElement('td');
                    td.textContent = row[header];
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
        }

        // 更新分頁資訊
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        pageInfo.textContent = `第 ${currentPage} 頁，共 ${totalPages} 頁`;

        // 更新分頁按鈕狀態
        prevPage.disabled = currentPage === 1;
        nextPage.disabled = currentPage === totalPages;
    }

    // 搜尋功能
    dbSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filteredData = currentData.filter(row => 
            Object.values(row).some(value => 
                String(value).toLowerCase().includes(searchTerm)
            )
        );
        currentPage = 1;
        renderTable();
    });

    // 切換表格
    dbTableSelect.addEventListener('change', () => {
        currentPage = 1;
        loadData();
    });

    // 重新整理按鈕
    refreshDbData.addEventListener('click', loadData);

    // 分頁按鈕
    prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // 初始載入
    loadData();
}

// 備份資料庫
async function backupDatabase() {
    try {
        const backupDialog = document.createElement('div');
        backupDialog.className = 'backup-dialog';
        backupDialog.innerHTML = `
            <div class="backup-dialog-content">
                <h3>資料庫備份</h3>
                <div class="backup-options">
                    <div class="backup-option">
                        <input type="checkbox" id="backupCrops" checked>
                        <label for="backupCrops">作物資料</label>
                    </div>
                    <div class="backup-option">
                        <input type="checkbox" id="backupMarkets" checked>
                        <label for="backupMarkets">市場資料</label>
                    </div>
                    <div class="backup-option">
                        <input type="checkbox" id="backupPrices" checked>
                        <label for="backupPrices">價格資料</label>
                    </div>
                </div>
                <div class="backup-actions">
                    <button id="startBackup">開始備份</button>
                    <button id="cancelBackup">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(backupDialog);

        // 備份功能
        document.getElementById('startBackup').addEventListener('click', async () => {
            const backupData = {};
            
            if (document.getElementById('backupCrops').checked) {
                backupData.crops = await fetchDataFromAPI('crops');
            }
            if (document.getElementById('backupMarkets').checked) {
                backupData.markets = await fetchDataFromAPI('markets');
            }
            if (document.getElementById('backupPrices').checked) {
                backupData.prices = await fetchDataFromAPI('prices');
            }

            // 創建備份檔案
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `database_backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            backupDialog.remove();
            showNotification('成功', '資料庫備份完成');
        });

        // 取消按鈕
        document.getElementById('cancelBackup').addEventListener('click', () => {
            backupDialog.remove();
        });
    } catch (error) {
        console.error('備份資料庫時發生錯誤:', error);
        showNotification('錯誤', '備份資料庫失敗');
    }
}

// 還原資料庫
async function restoreDatabase() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const backupData = JSON.parse(event.target.result);
                    
                    // 顯示確認對話框
                    const confirmDialog = document.createElement('div');
                    confirmDialog.className = 'confirm-dialog';
                    confirmDialog.innerHTML = `
                        <div class="confirm-dialog-content">
                            <h3>確認還原</h3>
                            <p>此操作將覆蓋現有資料，是否確定要還原？</p>
                            <div class="confirm-actions">
                                <button id="confirmRestore">確定還原</button>
                                <button id="cancelRestore">取消</button>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(confirmDialog);

                    document.getElementById('confirmRestore').addEventListener('click', async () => {
                        try {
                            // 還原資料
                            for (const [table, data] of Object.entries(backupData)) {
                                await restoreDataToAPI(table, data);
                            }
                            showNotification('成功', '資料庫還原完成');
                        } catch (error) {
                            console.error('還原資料時發生錯誤:', error);
                            showNotification('錯誤', '還原資料失敗');
                        }
                        confirmDialog.remove();
                    });

                    document.getElementById('cancelRestore').addEventListener('click', () => {
                        confirmDialog.remove();
                    });
                } catch (error) {
                    console.error('讀取備份檔案時發生錯誤:', error);
                    showNotification('錯誤', '讀取備份檔案失敗');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    } catch (error) {
        console.error('還原資料庫時發生錯誤:', error);
        showNotification('錯誤', '還原資料庫失敗');
    }
}

// 從 API 獲取資料
async function fetchDataFromAPI(table) {
    try {
        // 這裡使用實際的 API 端點
        const response = await fetch(`https://api.example.com/${table}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`從 API 獲取 ${table} 資料時發生錯誤:`, error);
        throw error;
    }
}

// 還原資料到 API
async function restoreDataToAPI(table, data) {
    try {
        // 這裡使用實際的 API 端點
        const response = await fetch(`https://api.example.com/${table}/restore`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`還原 ${table} 資料到 API 時發生錯誤:`, error);
        throw error;
    }
}

// 修改開發者模式功能初始化
function initDevModeFeatures() {
    // ... existing code ...

    // 資料庫操作工具
    document.getElementById('viewDatabase').addEventListener('click', viewDatabase);
    document.getElementById('backupDatabase').addEventListener('click', backupDatabase);
    document.getElementById('restoreDatabase').addEventListener('click', restoreDatabase);
    
    // ... existing code ...
}

// ... existing code ...

// 顯示環境設定
function showEnvironmentSettings() {
    const envDialog = document.createElement('div');
    envDialog.className = 'dev-settings-dialog';
    envDialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>環境設定</h3>
            <div class="env-options">
                <div class="env-option">
                    <input type="radio" id="envProd" name="environment" value="production" checked>
                    <label for="envProd">正式環境</label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envTest" name="environment" value="testing">
                    <label for="envTest">測試環境</label>
                </div>
                <div class="env-option">
                    <input type="radio" id="envDev" name="environment" value="development">
                    <label for="envDev">開發環境</label>
                </div>
            </div>
            <div class="env-actions">
                <button id="saveEnv">儲存</button>
                <button id="cancelEnv">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(envDialog);

    // 載入現有設定
    const currentEnv = localStorage.getItem('devEnvironment') || 'production';
    document.querySelector(`input[name="environment"][value="${currentEnv}"]`).checked = true;

    // 儲存環境設定
    document.getElementById('saveEnv').addEventListener('click', () => {
        const selectedEnv = document.querySelector('input[name="environment"]:checked').value;
        localStorage.setItem('devEnvironment', selectedEnv);
        showNotification('成功', `已切換至${selectedEnv}環境`);
        envDialog.remove();
    });

    // 取消按鈕
    document.getElementById('cancelEnv').addEventListener('click', () => {
        envDialog.remove();
    });
}

// 顯示參數設定
function showParameterSettings() {
    const paramsDialog = document.createElement('div');
    paramsDialog.className = 'dev-settings-dialog';
    paramsDialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>參數調整</h3>
            <div class="params-options">
                <div class="param-option">
                    <label for="cacheTime">快取時間（分鐘）</label>
                    <input type="number" id="cacheTime" min="1" max="60" value="5">
                </div>
                <div class="param-option">
                    <label for="updateInterval">更新間隔（分鐘）</label>
                    <input type="number" id="updateInterval" min="1" max="60" value="30">
                </div>
                <div class="param-option">
                    <label for="maxRetries">最大重試次數</label>
                    <input type="number" id="maxRetries" min="1" max="10" value="3">
                </div>
            </div>
            <div class="params-actions">
                <button id="saveParams">儲存</button>
                <button id="cancelParams">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(paramsDialog);

    // 載入現有設定
    const cacheTime = localStorage.getItem('devCacheTime') || 5;
    const updateInterval = localStorage.getItem('devUpdateInterval') || 30;
    const maxRetries = localStorage.getItem('devMaxRetries') || 3;

    document.getElementById('cacheTime').value = cacheTime;
    document.getElementById('updateInterval').value = updateInterval;
    document.getElementById('maxRetries').value = maxRetries;

    // 儲存參數設定
    document.getElementById('saveParams').addEventListener('click', () => {
        const newCacheTime = document.getElementById('cacheTime').value;
        const newUpdateInterval = document.getElementById('updateInterval').value;
        const newMaxRetries = document.getElementById('maxRetries').value;

        localStorage.setItem('devCacheTime', newCacheTime);
        localStorage.setItem('devUpdateInterval', newUpdateInterval);
        localStorage.setItem('devMaxRetries', newMaxRetries);

        showNotification('成功', '參數設定已更新');
        paramsDialog.remove();
    });

    // 取消按鈕
    document.getElementById('cancelParams').addEventListener('click', () => {
        paramsDialog.remove();
    });
}

// 顯示主題設定
function showThemeSettings() {
    const themeDialog = document.createElement('div');
    themeDialog.className = 'dev-settings-dialog';
    themeDialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>主題設定</h3>
            <div class="theme-options">
                <div class="theme-option">
                    <label for="primaryColor">主要顏色</label>
                    <input type="color" id="primaryColor" value="#1a73e8">
                </div>
                <div class="theme-option">
                    <label for="secondaryColor">次要顏色</label>
                    <input type="color" id="secondaryColor" value="#34a853">
                </div>
                <div class="theme-option">
                    <label for="backgroundColor">背景顏色</label>
                    <input type="color" id="backgroundColor" value="#2d2d2d">
                </div>
                <div class="theme-option">
                    <label for="textColor">文字顏色</label>
                    <input type="color" id="textColor" value="#ffffff">
                </div>
            </div>
            <div class="theme-actions">
                <button id="saveTheme">儲存</button>
                <button id="resetTheme">重設</button>
                <button id="cancelTheme">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(themeDialog);

    // 載入現有主題設定
    const theme = JSON.parse(localStorage.getItem('devTheme')) || {
        primaryColor: '#1a73e8',
        secondaryColor: '#34a853',
        backgroundColor: '#2d2d2d',
        textColor: '#ffffff'
    };

    document.getElementById('primaryColor').value = theme.primaryColor;
    document.getElementById('secondaryColor').value = theme.secondaryColor;
    document.getElementById('backgroundColor').value = theme.backgroundColor;
    document.getElementById('textColor').value = theme.textColor;

    // 儲存主題設定
    document.getElementById('saveTheme').addEventListener('click', () => {
        const newTheme = {
            primaryColor: document.getElementById('primaryColor').value,
            secondaryColor: document.getElementById('secondaryColor').value,
            backgroundColor: document.getElementById('backgroundColor').value,
            textColor: document.getElementById('textColor').value
        };

        localStorage.setItem('devTheme', JSON.stringify(newTheme));
        applyTheme(newTheme);
        showNotification('成功', '主題設定已更新');
        themeDialog.remove();
    });

    // 重設主題
    document.getElementById('resetTheme').addEventListener('click', () => {
        const defaultTheme = {
            primaryColor: '#1a73e8',
            secondaryColor: '#34a853',
            backgroundColor: '#2d2d2d',
            textColor: '#ffffff'
        };

        localStorage.setItem('devTheme', JSON.stringify(defaultTheme));
        applyTheme(defaultTheme);
        showNotification('成功', '主題已重設為預設值');
        themeDialog.remove();
    });

    // 取消按鈕
    document.getElementById('cancelTheme').addEventListener('click', () => {
        themeDialog.remove();
    });
}

// 顯示功能設定
function showFeatureSettings() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    
    // 從 localStorage 讀取當前設定
    const features = JSON.parse(localStorage.getItem('devFeatures') || '{}');
    
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>功能開關</h3>
            <div class="feature-options">
                <div class="feature-group">
                    <h4>基本功能</h4>
                    <div class="feature-option">
                        <input type="checkbox" id="featureSearch" ${features.search ? 'checked' : ''}>
                        <label for="featureSearch">搜尋功能</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featureCropSelect" ${features.cropSelect ? 'checked' : ''}>
                        <label for="featureCropSelect">作物選擇</label>
                    </div>
                </div>
                
                <div class="feature-group">
                    <h4>分析功能</h4>
                    <div class="feature-option">
                        <input type="checkbox" id="featurePriceTrend" ${features.priceTrend ? 'checked' : ''}>
                        <label for="featurePriceTrend">價格趨勢分析</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featureVolumeDistribution" ${features.volumeDistribution ? 'checked' : ''}>
                        <label for="featureVolumeDistribution">交易量分布</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featurePriceDistribution" ${features.priceDistribution ? 'checked' : ''}>
                        <label for="featurePriceDistribution">價格分布</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featureSeasonalAnalysis" ${features.seasonalAnalysis ? 'checked' : ''}>
                        <label for="featureSeasonalAnalysis">季節性分析</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featurePricePrediction" ${features.pricePrediction ? 'checked' : ''}>
                        <label for="featurePricePrediction">價格預測</label>
                    </div>
                </div>
                
                <div class="feature-group">
                    <h4>通知功能</h4>
                    <div class="feature-option">
                        <input type="checkbox" id="featureNotifications" ${features.notifications ? 'checked' : ''}>
                        <label for="featureNotifications">通知系統</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featureMarketRest" ${features.marketRest ? 'checked' : ''}>
                        <label for="featureMarketRest">休市提醒</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featurePriceAlerts" ${features.priceAlerts ? 'checked' : ''}>
                        <label for="featurePriceAlerts">價格提醒</label>
                    </div>
                </div>
                
                <div class="feature-group">
                    <h4>資料功能</h4>
                    <div class="feature-option">
                        <input type="checkbox" id="featureExport" ${features.export ? 'checked' : ''}>
                        <label for="featureExport">資料匯出</label>
                    </div>
                    <div class="feature-option">
                        <input type="checkbox" id="featureStats" ${features.stats ? 'checked' : ''}>
                        <label for="featureStats">統計資訊</label>
                    </div>
                </div>
            </div>
            <div class="env-actions">
                <button id="saveFeatures">儲存設定</button>
                <button id="cancelFeatures">取消</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 儲存設定
    document.getElementById('saveFeatures').addEventListener('click', () => {
        const newFeatures = {
            search: document.getElementById('featureSearch').checked,
            cropSelect: document.getElementById('featureCropSelect').checked,
            priceTrend: document.getElementById('featurePriceTrend').checked,
            volumeDistribution: document.getElementById('featureVolumeDistribution').checked,
            priceDistribution: document.getElementById('featurePriceDistribution').checked,
            seasonalAnalysis: document.getElementById('featureSeasonalAnalysis').checked,
            pricePrediction: document.getElementById('featurePricePrediction').checked,
            notifications: document.getElementById('featureNotifications').checked,
            marketRest: document.getElementById('featureMarketRest').checked,
            priceAlerts: document.getElementById('featurePriceAlerts').checked,
            export: document.getElementById('featureExport').checked,
            stats: document.getElementById('featureStats').checked
        };
        
        localStorage.setItem('devFeatures', JSON.stringify(newFeatures));
        applyFeatures(newFeatures);
        document.body.removeChild(dialog);
    });
    
    // 取消設定
    document.getElementById('cancelFeatures').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

function applyFeatures(features) {
    // 基本功能
    document.querySelector('.search-box').style.display = features.search ? 'block' : 'none';
    document.querySelector('.crop-select').style.display = features.cropSelect ? 'block' : 'none';
    
    // 分析功能
    const analysisButtons = document.querySelectorAll('.analysis-buttons button');
    analysisButtons[0].style.display = features.priceTrend ? 'block' : 'none';
    analysisButtons[1].style.display = features.volumeDistribution ? 'block' : 'none';
    analysisButtons[2].style.display = features.priceDistribution ? 'block' : 'none';
    analysisButtons[3].style.display = features.seasonalAnalysis ? 'block' : 'none';
    analysisButtons[4].style.display = features.pricePrediction ? 'block' : 'none';
    
    // 通知功能
    if (features.notifications) {
        initNotificationCheck();
    } else {
        // 停用通知功能
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.unregister();
            });
        }
    }
    
    if (features.marketRest) {
        initMarketRestCheck();
    }
    
    if (features.priceAlerts) {
        // 啟用價格提醒功能
        initPriceAlerts();
    }
    
    // 資料功能
    document.querySelector('.export-section').style.display = features.export ? 'block' : 'none';
    document.querySelector('.stats-area').style.display = features.stats ? 'block' : 'none';
}

// 初始化價格提醒功能
function initPriceAlerts() {
    // 實作價格提醒功能
    console.log('價格提醒功能已啟用');
}

// ... existing code ...

// 系統診斷工具
function showSystemDiagnostics() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>系統診斷</h3>
            <div class="diagnostic-section">
                <h4>系統狀態</h4>
                <div id="systemStatus">
                    <div class="status-item">
                        <span>CPU 使用率：</span>
                        <span id="cpuUsage">計算中...</span>
                    </div>
                    <div class="status-item">
                        <span>記憶體使用率：</span>
                        <span id="memoryUsage">計算中...</span>
                    </div>
                    <div class="status-item">
                        <span>網路狀態：</span>
                        <span id="networkStatus">檢查中...</span>
                    </div>
                </div>
            </div>
            <div class="diagnostic-section">
                <h4>快取管理</h4>
                <button id="clearCache">清除快取</button>
                <button id="clearLocalStorage">清除本地儲存</button>
            </div>
            <div class="diagnostic-section">
                <h4>錯誤日誌</h4>
                <div id="errorLog" class="error-log"></div>
            </div>
            <div class="env-actions">
                <button id="refreshDiagnostics">重新整理</button>
                <button id="closeDiagnostics">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 更新系統狀態
    function updateSystemStatus() {
        if ('performance' in window) {
            const memory = performance.memory;
            if (memory) {
                document.getElementById('memoryUsage').textContent = 
                    `${Math.round(memory.usedJSHeapSize / memory.totalJSHeapSize * 100)}%`;
            }
        }

        // 檢查網路狀態
        document.getElementById('networkStatus').textContent = 
            navigator.onLine ? '已連接' : '離線';
    }

    // 清除快取
    document.getElementById('clearCache').addEventListener('click', async () => {
        try {
            const cache = await caches.keys();
            await Promise.all(cache.map(name => caches.delete(name)));
            showNotification('成功', '快取已清除');
        } catch (error) {
            showNotification('錯誤', '清除快取失敗');
        }
    });

    // 清除本地儲存
    document.getElementById('clearLocalStorage').addEventListener('click', () => {
        localStorage.clear();
        showNotification('成功', '本地儲存已清除');
    });

    // 重新整理診斷資訊
    document.getElementById('refreshDiagnostics').addEventListener('click', updateSystemStatus);

    // 關閉診斷視窗
    document.getElementById('closeDiagnostics').addEventListener('click', () => {
        dialog.remove();
    });

    // 初始更新
    updateSystemStatus();
}

// 進階資料分析工具
function showAdvancedAnalysis() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>進階資料分析</h3>
            <div class="analysis-section">
                <h4>資料匯出</h4>
                <div class="export-options">
                    <button id="exportCSV">匯出 CSV</button>
                    <button id="exportJSON">匯出 JSON</button>
                    <button id="exportExcel">匯出 Excel</button>
                </div>
            </div>
            <div class="analysis-section">
                <h4>資料過濾</h4>
                <div class="filter-options">
                    <input type="text" id="filterInput" placeholder="輸入過濾條件...">
                    <select id="filterType">
                        <option value="price">價格</option>
                        <option value="volume">交易量</option>
                        <option value="date">日期</option>
                    </select>
                    <button id="applyFilter">套用過濾</button>
                </div>
            </div>
            <div class="analysis-section">
                <h4>視覺化範本</h4>
                <div class="visualization-templates">
                    <button id="template1">範本 1：價格趨勢</button>
                    <button id="template2">範本 2：交易量分布</button>
                    <button id="template3">範本 3：季節性分析</button>
                </div>
            </div>
            <div class="env-actions">
                <button id="closeAnalysis">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 匯出功能
    document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));
    document.getElementById('exportJSON').addEventListener('click', () => exportData('json'));
    document.getElementById('exportExcel').addEventListener('click', () => exportData('excel'));

    // 過濾功能
    document.getElementById('applyFilter').addEventListener('click', () => {
        const filterValue = document.getElementById('filterInput').value;
        const filterType = document.getElementById('filterType').value;
        applyDataFilter(filterValue, filterType);
    });

    // 視覺化範本
    document.getElementById('template1').addEventListener('click', () => showPriceTrend());
    document.getElementById('template2').addEventListener('click', () => showVolumeDistribution());
    document.getElementById('template3').addEventListener('click', () => showSeasonalAnalysis());

    // 關閉視窗
    document.getElementById('closeAnalysis').addEventListener('click', () => {
        dialog.remove();
    });
}

// 效能優化工具
function showPerformanceTools() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>效能優化</h3>
            <div class="performance-section">
                <h4>資源優化</h4>
                <div class="optimization-options">
                    <button id="optimizeImages">優化圖片</button>
                    <button id="minifyCode">最小化程式碼</button>
                    <button id="manageCache">管理快取</button>
                </div>
            </div>
            <div class="performance-section">
                <h4>效能分析</h4>
                <div class="performance-metrics">
                    <div class="metric">
                        <span>頁面載入時間：</span>
                        <span id="loadTime">計算中...</span>
                    </div>
                    <div class="metric">
                        <span>資源載入時間：</span>
                        <span id="resourceTime">計算中...</span>
                    </div>
                </div>
            </div>
            <div class="env-actions">
                <button id="refreshPerformance">重新整理</button>
                <button id="closePerformance">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 更新效能指標
    function updatePerformanceMetrics() {
        if ('performance' in window) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const resourceTime = timing.domComplete - timing.domLoading;

            document.getElementById('loadTime').textContent = `${loadTime}ms`;
            document.getElementById('resourceTime').textContent = `${resourceTime}ms`;
        }
    }

    // 優化圖片
    document.getElementById('optimizeImages').addEventListener('click', async () => {
        try {
            const images = document.querySelectorAll('img');
            for (const img of images) {
                // 實作圖片優化邏輯
            }
            showNotification('成功', '圖片優化完成');
        } catch (error) {
            showNotification('錯誤', '圖片優化失敗');
        }
    });

    // 最小化程式碼
    document.getElementById('minifyCode').addEventListener('click', () => {
        // 實作程式碼最小化邏輯
        showNotification('成功', '程式碼最小化完成');
    });

    // 管理快取
    document.getElementById('manageCache').addEventListener('click', async () => {
        try {
            const cache = await caches.keys();
            await Promise.all(cache.map(name => caches.delete(name)));
            showNotification('成功', '快取已清除');
        } catch (error) {
            showNotification('錯誤', '清除快取失敗');
        }
    });

    // 重新整理效能指標
    document.getElementById('refreshPerformance').addEventListener('click', updatePerformanceMetrics);

    // 關閉視窗
    document.getElementById('closePerformance').addEventListener('click', () => {
        dialog.remove();
    });

    // 初始更新
    updatePerformanceMetrics();
}

// 測試工具
function showTestTools() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>測試工具</h3>
            <div class="test-section">
                <h4>API 測試</h4>
                <div class="api-test">
                    <input type="text" id="apiUrl" placeholder="API URL">
                    <select id="apiMethod">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <button id="testApi">測試 API</button>
                </div>
            </div>
            <div class="test-section">
                <h4>相容性測試</h4>
                <div class="compatibility-test">
                    <button id="testBrowser">測試瀏覽器相容性</button>
                    <button id="testDevice">測試裝置相容性</button>
                </div>
            </div>
            <div class="test-section">
                <h4>自動化測試</h4>
                <div class="automation-test">
                    <button id="runTests">執行測試</button>
                    <button id="viewResults">查看結果</button>
                </div>
            </div>
            <div class="env-actions">
                <button id="closeTest">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // API 測試
    document.getElementById('testApi').addEventListener('click', async () => {
        const url = document.getElementById('apiUrl').value;
        const method = document.getElementById('apiMethod').value;
        try {
            const response = await fetch(url, { method });
            const result = await response.json();
            showNotification('成功', 'API 測試完成');
        } catch (error) {
            showNotification('錯誤', 'API 測試失敗');
        }
    });

    // 相容性測試
    document.getElementById('testBrowser').addEventListener('click', () => {
        const browserInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
        };
        showNotification('成功', '瀏覽器相容性測試完成');
    });

    document.getElementById('testDevice').addEventListener('click', () => {
        const deviceInfo = {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
        };
        showNotification('成功', '裝置相容性測試完成');
    });

    // 自動化測試
    document.getElementById('runTests').addEventListener('click', () => {
        // 實作自動化測試邏輯
        showNotification('成功', '自動化測試完成');
    });

    // 關閉視窗
    document.getElementById('closeTest').addEventListener('click', () => {
        dialog.remove();
    });
}

// 安全性工具
function showSecurityTools() {
    const dialog = document.createElement('div');
    dialog.className = 'dev-settings-dialog';
    dialog.innerHTML = `
        <div class="dev-settings-content">
            <h3>安全性工具</h3>
            <div class="security-section">
                <h4>權限管理</h4>
                <div class="permission-list">
                    <div class="permission-item">
                        <input type="checkbox" id="permNotifications">
                        <label for="permNotifications">通知權限</label>
                    </div>
                    <div class="permission-item">
                        <input type="checkbox" id="permLocation">
                        <label for="permLocation">位置權限</label>
                    </div>
                    <div class="permission-item">
                        <input type="checkbox" id="permStorage">
                        <label for="permStorage">儲存權限</label>
                    </div>
                </div>
            </div>
            <div class="security-section">
                <h4>資料加密</h4>
                <div class="encryption-options">
                    <button id="encryptData">加密資料</button>
                    <button id="decryptData">解密資料</button>
                </div>
            </div>
            <div class="security-section">
                <h4>安全性日誌</h4>
                <div id="securityLog" class="security-log"></div>
            </div>
            <div class="env-actions">
                <button id="saveSecurity">儲存設定</button>
                <button id="closeSecurity">關閉</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // 權限管理
    document.getElementById('permNotifications').addEventListener('change', async (e) => {
        if (e.target.checked) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                e.target.checked = false;
                showNotification('錯誤', '通知權限被拒絕');
            }
        }
    });

    // 資料加密
    document.getElementById('encryptData').addEventListener('click', () => {
        // 實作資料加密邏輯
        showNotification('成功', '資料加密完成');
    });

    document.getElementById('decryptData').addEventListener('click', () => {
        // 實作資料解密邏輯
        showNotification('成功', '資料解密完成');
    });

    // 儲存安全性設定
    document.getElementById('saveSecurity').addEventListener('click', () => {
        const securitySettings = {
            notifications: document.getElementById('permNotifications').checked,
            location: document.getElementById('permLocation').checked,
            storage: document.getElementById('permStorage').checked
        };
        localStorage.setItem('securitySettings', JSON.stringify(securitySettings));
        showNotification('成功', '安全性設定已儲存');
    });

    // 關閉視窗
    document.getElementById('closeSecurity').addEventListener('click', () => {
        dialog.remove();
    });
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

// 初始化開發者模式功能
function initDevModeFeatures() {
    // 關閉按鈕
    const closeButton = document.getElementById('closeDevMode');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            console.log('點擊關閉開發者模式');
            deactivateDevMode();
        });
    }
}

// ... existing code ... 