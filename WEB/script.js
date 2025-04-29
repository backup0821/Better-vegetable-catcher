// DOM 元素
const searchInput = document.getElementById('searchInput');
const cropSelect = document.getElementById('cropSelect');
const chartArea = document.getElementById('chartArea');
const resultArea = document.getElementById('resultArea');
const showPriceTrendBtn = document.getElementById('showPriceTrend');
const showVolumeDistBtn = document.getElementById('showVolumeDist');
const showPriceDistBtn = document.getElementById('showPriceDist');
const showSeasonalBtn = document.getElementById('showSeasonal');

// 資料相關變數
let cropData = [];
let selectedCrop = '';

// 從農產品交易行情站獲取資料
async function fetchData() {
    try {
        const response = await fetch('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
        if (!response.ok) throw new Error('無法獲取資料');
        const data = await response.json();
        cropData = data;
        updateCropList();
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

showPriceTrendBtn.addEventListener('click', showPriceTrend);
showVolumeDistBtn.addEventListener('click', showVolumeDistribution);
showPriceDistBtn.addEventListener('click', showPriceDistribution);
showSeasonalBtn.addEventListener('click', showSeasonalAnalysis);

// 初始化
fetchData(); 