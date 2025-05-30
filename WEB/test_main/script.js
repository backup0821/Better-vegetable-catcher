// DOM 元素
const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const lastUpdateTime = document.getElementById('lastUpdateTime');
const apiSelect = document.getElementById('apiSelect');
const corsMode = document.getElementById('corsMode');
const errorMessage = document.getElementById('errorMessage');

// 顯示載入中
function showLoading() {
    loadingIndicator.style.display = 'block';
}

// 隱藏載入中
function hideLoading() {
    loadingIndicator.style.display = 'none';
}

// 顯示錯誤訊息
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
}

// 隱藏錯誤訊息
function hideError() {
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
}

// 更新最後更新時間
function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateTime.textContent = now.toLocaleString('zh-TW');
}

// 格式化數字
function formatNumber(num) {
    return new Intl.NumberFormat('zh-TW').format(num);
}

// 更新表格資料
function updateTable(data) {
    // 清空表格
    tableBody.innerHTML = '';

    // 添加新資料
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.交易日期}</td>
            <td>${item.作物名稱}</td>
            <td>${item.市場名稱}</td>
            <td>${formatNumber(item.平均價)}</td>
            <td>${formatNumber(item.交易量)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 處理不同 API 的資料格式
function processApiData(data, apiUrl) {
    if (apiUrl.includes('marketTV-drvice.json')) {
        // TV 版本 API 的資料格式
        return data.map(item => ({
            交易日期: item.date,
            作物名稱: item.crop,
            市場名稱: item.market,
            平均價: Number(item.price),
            交易量: Number(item.volume)
        }));
    } else {
        // 農業部 API 的資料格式
        return data.Data.map(item => ({
            交易日期: item.TransDate,
            作物名稱: item.CropName,
            市場名稱: item.MarketName,
            平均價: Number(item.Avg_Price),
            交易量: Number(item.Trans_Quantity)
        }));
    }
}

// 取得實際要 fetch 的 API URL
function getFetchUrl() {
    let url = apiSelect.value;
    if (corsMode.value === 'proxy') {
        // 使用 CORS Proxy
        url = 'https://cors-anywhere.herokuapp.com/' + url;
    }
    return url;
}

// 獲取資料
async function fetchData() {
    try {
        showLoading();
        hideError();
        
        const apiUrl = getFetchUrl();
        console.log('使用 API:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // 處理資料
        const processedData = processApiData(data, apiSelect.value);

        if (!processedData || processedData.length === 0) {
            throw new Error('沒有資料');
        }

        // 更新表格
        updateTable(processedData);
        updateLastUpdateTime();

    } catch (error) {
        console.error('獲取資料失敗:', error);
        showError('獲取資料失敗: ' + error.message + (corsMode.value === 'proxy' ? '\n如第一次使用 CORS Proxy，請先到 https://cors-anywhere.herokuapp.com/corsdemo 申請臨時權限。' : ''));
    } finally {
        hideLoading();
    }
}

// 初始化
async function init() {
    // 綁定重新整理按鈕事件
    refreshBtn.addEventListener('click', fetchData);
    
    // 綁定 API 選擇變更事件
    apiSelect.addEventListener('change', fetchData);
    corsMode.addEventListener('change', fetchData);

    // 首次載入資料
    await fetchData();
}

// 啟動應用
init(); 