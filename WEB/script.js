// 版本資訊
const VERSION = 'v1.0';
const VERSION_CHECK_URL = 'https://api.github.com/repos/your-repo/Better-vegetable-catcher/releases/latest';

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

// 檢查版本更新
async function checkForUpdates() {
    try {
        const response = await fetch(VERSION_CHECK_URL);
        if (!response.ok) throw new Error('無法檢查更新');
        const data = await response.json();
        const latestVersion = data.tag_name;
        
        if (latestVersion !== VERSION) {
            const updateMessage = `發現新版本 ${latestVersion}！目前版本：${VERSION}`;
            resultArea.innerHTML = `<p class="update-notice">${updateMessage}</p>`;
        }
        
        versionNumber.textContent = VERSION;
        lastUpdate.textContent = new Date().toLocaleString('zh-TW');
    } catch (error) {
        console.error('檢查更新時發生錯誤:', error);
    }
}

// 從農產品交易行情站獲取資料
async function fetchData() {
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
    const prices = cropData.map(item => item.平均價);
    
    const trace = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '價格',
        line: { color: '#1a73e8' }
    };
    
    const layout = {
        title: `${selectedCrop} 價格趨勢`,
        xaxis: { title: '日期' },
        yaxis: { title: '價格 (元/公斤)' }
    };
    
    Plotly.newPlot(chartArea, [trace], layout);
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
        title: `${selectedCrop} 各市場交易量分布`,
        xaxis: { title: '市場' },
        yaxis: { title: '交易量 (公斤)' }
    };
    
    Plotly.newPlot(chartArea, [trace], layout);
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
        title: `${selectedCrop} 價格分布`,
        xaxis: { title: '價格 (元/公斤)' },
        yaxis: { title: '次數' }
    };
    
    Plotly.newPlot(chartArea, [trace], layout);
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
        line: { color: '#fbbc05' }
    };
    
    const layout = {
        title: `${selectedCrop} 季節性分析`,
        xaxis: { 
            title: '月份',
            tickmode: 'array',
            tickvals: months,
            ticktext: months.map(m => `${m}月`)
        },
        yaxis: { title: '平均價格 (元/公斤)' }
    };
    
    Plotly.newPlot(chartArea, [trace], layout);
    showBasicStats(cropData);
}

// 進階分析功能
function showPricePrediction() {
    if (!selectedCrop) return;
    
    const cropData = getCropData(selectedCrop);
    const dates = cropData.map(item => new Date(item.交易日期));
    const prices = cropData.map(item => Number(item.平均價));
    
    // 使用簡單的線性回歸進行預測
    const xMean = dates.reduce((a, b) => a + b.getTime(), 0) / dates.length;
    const yMean = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const numerator = dates.reduce((sum, date, i) => 
        sum + (date.getTime() - xMean) * (prices[i] - yMean), 0);
    const denominator = dates.reduce((sum, date) => 
        sum + Math.pow(date.getTime() - xMean, 2), 0);
    
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    // 預測未來30天
    const futureDates = Array.from({length: 30}, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
    });
    
    const predictedPrices = futureDates.map(date => 
        slope * date.getTime() + intercept);
    
    const trace1 = {
        x: dates,
        y: prices,
        type: 'scatter',
        mode: 'lines+markers',
        name: '歷史價格',
        line: { color: '#1a73e8' }
    };
    
    const trace2 = {
        x: futureDates,
        y: predictedPrices,
        type: 'scatter',
        mode: 'lines',
        name: '預測價格',
        line: { 
            color: '#ea4335',
            dash: 'dash'
        }
    };
    
    const layout = {
        title: `${selectedCrop} 價格預測`,
        xaxis: { title: '日期' },
        yaxis: { title: '價格 (元/公斤)' }
    };
    
    Plotly.newPlot(chartArea, [trace1, trace2], layout);
    showBasicStats(cropData);
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
    
    resultArea.innerHTML = `
        <h3>基本統計資訊</h3>
        <p>平均價格：${stats.avgPrice.toFixed(2)} 元/公斤</p>
        <p>最低價格：${stats.minPrice.toFixed(2)} 元/公斤</p>
        <p>最高價格：${stats.maxPrice.toFixed(2)} 元/公斤</p>
        <p>總交易量：${stats.totalVolume.toLocaleString()} 公斤</p>
    `;
}

// 事件監聽器
searchInput.addEventListener('input', filterCrops);
cropSelect.addEventListener('change', (e) => {
    selectedCrop = e.target.value;
    if (selectedCrop) {
        showPriceTrend();
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log("Service Worker 註冊成功！"))
      .catch((e) => console.error("Service Worker 註冊失敗", e));
  }

  
showPriceTrendBtn.addEventListener('click', showPriceTrend);
showVolumeDistBtn.addEventListener('click', showVolumeDistribution);
showPriceDistBtn.addEventListener('click', showPriceDistribution);
showSeasonalBtn.addEventListener('click', showSeasonalAnalysis);

// 新增按鈕事件監聽器
document.getElementById('showPricePrediction').addEventListener('click', showPricePrediction);
document.getElementById('exportExcel').addEventListener('click', () => exportData('excel'));
document.getElementById('exportCSV').addEventListener('click', () => exportData('csv'));

// 初始化
fetchData(); 