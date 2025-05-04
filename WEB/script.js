// 版本資訊
const VERSION = 'v2.3.web.3';
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
    const dates = cropData.map(item => item.交易日期);
    const prices = cropData.map(item => Number(item.平均價));
    // 找最大/最小價及其日期
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const maxIdx = prices.indexOf(maxPrice);
    const minIdx = prices.indexOf(minPrice);
    const maxDate = dates[maxIdx];
    const minDate = dates[minIdx];
    const trace = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '價格',
        line: { color: '#1a73e8', width: 4 },
        marker: { size: 10, color: '#1a73e8' }
    };
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
                x: maxDate,
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
                x: minDate,
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
    return cropData.filter(item => item.作物名稱 === cropName);
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
        const response = await fetch('https://backup0821.github.io/API/Better-vegetable-catcher/notfiy.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const notifications = await response.json();
        console.log('獲取到的通知資料:', notifications);
        
        const now = new Date();
        console.log('當前時間:', now);
        
        // 收集所有需要顯示的通知
        let notificationsToShow = [];
        
        notifications.forEach(notification => {
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

function showPageNotifications(notifications) {
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

    // 創建通知容器
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'page-notification';
    notificationContainer.className = 'notification-window';

    // 通知標題
    const title = document.createElement('div');
    title.className = 'notification-title';
    title.textContent = '系統通知';
    notificationContainer.appendChild(title);

    // 通知列表
    const notificationList = document.createElement('div');
    notificationList.className = 'notification-list';

    notifications.forEach((notification, index) => {
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item';
        
        // 如果是針對特定裝置的通知，添加標記
        if (notification.isTargetedDevice) {
            notificationItem.classList.add('targeted-device');
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
            <div class="notification-icon">📢</div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.messenge}</div>
                <div class="notification-time">通知時間：${notification.time}</div>
                <div class="notification-time-left">${timeLeftText}</div>
                ${notification.isTargetedDevice ? '<div class="device-tag">🔒 特定裝置通知</div>' : '<div class="public-tag">📢 公開通知</div>'}
            </div>
        `;
        notificationList.appendChild(notificationItem);
    });

    notificationContainer.appendChild(notificationList);

    // 確認按鈕
    const confirmButton = document.createElement('button');
    confirmButton.className = 'notification-button';
    confirmButton.textContent = '確定';
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

    console.log('it test now');

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

            // 設置10秒後發送通知
            testNotificationTimeout = setTimeout(() => {
                // 發送 Service Worker 通知
                registration.showNotification('測試通知', {
                    body: '這是一個測試通知，用於驗證通知功能是否正常運作。',
                    icon: './image/icon-192.png',
                    badge: './image/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'test-notification',
                    requireInteraction: true,
                    actions: [
                        {
                            action: 'open',
                            title: '開啟應用程式'
                        }
                    ]
                }).then(() => {
                    console.log('Service Worker 通知已發送');
                }).catch(error => {
                    console.error('Service Worker 通知發送失敗:', error);
                });

                // 發送瀏覽器原生通知
                new Notification('測試通知', {
                    body: '這是一個瀏覽器原生通知測試',
                    icon: './image/icon-192.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true
                });
            }, 10000);

            alert('測試通知已設置，將在10秒後發送！\n請確保手機未進入省電模式。');
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
                // 將訂閱資訊發送到伺服器
                await sendSubscriptionToServer(pushSubscription);
            }
        } catch (error) {
            console.error('初始化推送通知失敗:', error);
        }
    } else {
        console.log('瀏覽器不支援推送通知');
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

// 將訂閱資訊發送到伺服器
async function sendSubscriptionToServer(subscription) {
    try {
        const response = await fetch('/api/push-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                deviceId: deviceId
            })
        });
        
        if (!response.ok) {
            throw new Error('發送訂閱資訊失敗');
        }
        
        console.log('訂閱資訊已發送到伺服器');
    } catch (error) {
        console.error('發送訂閱資訊失敗:', error);
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
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
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