// 監看的端點列表
const endpoints = [
    {
        name: '資料 API',
        url: '../api/Better-vegetable-catcher/data',
        description: '主要資料 API'
    },
    {
        name: '版本 API',
        url: '../api/Better-vegetable-catcher/version',
        description: '版本檢查 API'
    },
    {
        name: '通知 API',
        url: '../api/Better-vegetable-catcher/notifications',
        description: '系統通知 API'
    },
    {
        name: '農業部資料',
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
        description: '農業部開放資料'
    },
    {
        name: 'TV 驗證系統',
        url: '../API/Better-vegetable-catcher/TV-drvice.json',
        description: 'TV 版本驗證系統'
    }
];

// 檢查間隔（毫秒）
const CHECK_INTERVAL = 60000; // 1分鐘

// 歷史記錄最大條數
const MAX_HISTORY = 100;

// 音效控制
let errorSoundEnabled = true;
let countdownInterval = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initMonitor();
    initControls();
    startMonitoring();
    startClock();
});

// 初始化監看介面
function initMonitor() {
    const grid = document.getElementById('endpointGrid');
    endpoints.forEach(endpoint => {
        const card = createEndpointCard(endpoint);
        grid.appendChild(card);
    });
    updateStatusInfo();
}

// 創建端點卡片
function createEndpointCard(endpoint) {
    const card = document.createElement('div');
    card.className = 'endpoint-card';
    card.id = `card-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}`;
    
    card.innerHTML = `
        <div class="endpoint-header">
            <div class="endpoint-title">${endpoint.name}</div>
            <div class="endpoint-status status-error">檢查中...</div>
        </div>
        <div class="endpoint-details">
            <p><strong>URL：</strong>${endpoint.url}</p>
            <p><strong>描述：</strong>${endpoint.description}</p>
            <p><strong>ETag：</strong><span class="etag-value">--</span></p>
            <p><strong>最後修改：</strong><span class="modified-value">--</span></p>
        </div>
        <div class="last-check">
            最後檢查：<span class="check-time">--:--:--</span>
        </div>
    `;
    
    return card;
}

// 初始化控制按鈕
function initControls() {
    document.getElementById('checkNow').addEventListener('click', checkAllEndpoints);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
    
    // 音效控制
    const soundCheckbox = document.getElementById('enableSound');
    soundCheckbox.addEventListener('change', (e) => {
        errorSoundEnabled = e.target.checked;
    });
}

// 開始時鐘
function startClock() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
}

// 更新現在時間
function updateCurrentTime() {
    const currentTimeElement = document.getElementById('currentTime');
    const now = new Date();
    currentTimeElement.textContent = now.toLocaleTimeString();
}

// 開始監看
function startMonitoring() {
    checkAllEndpoints();
    startCountdown();
}

// 開始倒數計時
function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// 更新倒數計時
function updateCountdown() {
    const nextCheckElement = document.getElementById('nextCheck');
    const now = new Date();
    const nextCheck = new Date(now.getTime() + CHECK_INTERVAL);
    const timeLeft = nextCheck - now;
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    nextCheckElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
        checkAllEndpoints();
    }
}

// 播放錯誤音效
function playErrorSound() {
    if (errorSoundEnabled) {
        const errorSound = document.getElementById('errorSound');
        errorSound.currentTime = 0;
        errorSound.play().catch(error => {
            console.error('播放音效失敗:', error);
        });
    }
}

// 檢查所有端點
async function checkAllEndpoints() {
    const timestamp = new Date();
    updateCurrentTime();
    startCountdown();
    
    let hasError = false;
    
    for (const endpoint of endpoints) {
        try {
            const result = await checkEndpoint(endpoint);
            updateEndpointCard(endpoint, result);
            addToHistory(endpoint, result, timestamp);
            
            if (result.status === 'error') {
                hasError = true;
            }
        } catch (error) {
            console.error(`檢查 ${endpoint.name} 失敗:`, error);
            updateEndpointCard(endpoint, {
                status: 'error',
                error: error.message
            });
            addToHistory(endpoint, {
                status: 'error',
                error: error.message
            }, timestamp);
            hasError = true;
        }
    }
    
    if (hasError) {
        playErrorSound();
    }
}

// 檢查單個端點
async function checkEndpoint(endpoint) {
    try {
        console.log(`正在檢查端點: ${endpoint.name} (${endpoint.url})`);
        
        const response = await fetch(endpoint.url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP 錯誤: ${response.status}`);
        }
        
        const etag = response.headers.get('ETag');
        const lastModified = response.headers.get('Last-Modified');
        const contentType = response.headers.get('Content-Type');
        
        let content;
        if (contentType && contentType.includes('application/json')) {
            content = await response.json();
            content = JSON.stringify(content);
        } else {
            content = await response.text();
        }
        
        const hash = await calculateHash(content);
        
        const storedETag = localStorage.getItem(`etag_${endpoint.url}`);
        const storedHash = localStorage.getItem(`hash_${endpoint.url}`);
        
        let status = 'latest';
        if (storedETag && etag && storedETag !== etag) {
            status = 'outdated';
        } else if (storedHash && storedHash !== hash) {
            status = 'outdated';
        }
        
        // 更新存儲的值
        if (etag) localStorage.setItem(`etag_${endpoint.url}`, etag);
        localStorage.setItem(`hash_${endpoint.url}`, hash);
        if (lastModified) localStorage.setItem(`modified_${endpoint.url}`, lastModified);
        
        console.log(`端點 ${endpoint.name} 檢查完成:`, {
            status,
            etag: etag || '無',
            lastModified: lastModified || '無',
            hash
        });
        
        return {
            status,
            etag: etag || '無',
            lastModified: lastModified || '無',
            hash
        };
    } catch (error) {
        console.error(`檢查端點 ${endpoint.name} 失敗:`, error);
        throw new Error(`檢查失敗: ${error.message}`);
    }
}

// 更新端點卡片
function updateEndpointCard(endpoint, result) {
    const card = document.getElementById(`card-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}`);
    if (!card) {
        console.error(`找不到端點卡片: ${endpoint.name}`);
        return;
    }
    
    const statusElement = card.querySelector('.endpoint-status');
    const etagElement = card.querySelector('.etag-value');
    const modifiedElement = card.querySelector('.modified-value');
    const checkTimeElement = card.querySelector('.check-time');
    
    if (!statusElement || !etagElement || !modifiedElement || !checkTimeElement) {
        console.error(`找不到必要的元素: ${endpoint.name}`);
        return;
    }
    
    statusElement.className = `endpoint-status status-${result.status}`;
    statusElement.textContent = getStatusText(result.status);
    
    etagElement.textContent = result.etag;
    modifiedElement.textContent = result.lastModified;
    checkTimeElement.textContent = new Date().toLocaleTimeString();
    
    console.log(`更新端點卡片: ${endpoint.name}`, result);
}

// 更新狀態信息
function updateStatusInfo(timestamp = new Date()) {
    const lastUpdate = document.getElementById('lastUpdate');
    const nextCheck = document.getElementById('nextCheck');
    
    lastUpdate.textContent = timestamp.toLocaleTimeString();
    nextCheck.textContent = new Date(timestamp.getTime() + CHECK_INTERVAL).toLocaleTimeString();
}

// 添加到歷史記錄
function addToHistory(endpoint, result, timestamp) {
    const tbody = document.getElementById('historyTableBody');
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>${timestamp.toLocaleString()}</td>
        <td>${endpoint.name}</td>
        <td><span class="status-${result.status}">${getStatusText(result.status)}</span></td>
        <td>${result.etag || '--'}</td>
        <td>${result.lastModified || '--'}</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    
    // 限制歷史記錄數量
    while (tbody.children.length > MAX_HISTORY) {
        tbody.removeChild(tbody.lastChild);
    }
}

// 清除歷史記錄
function clearHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
}

// 計算內容雜湊
async function calculateHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 獲取狀態文本
function getStatusText(status) {
    switch (status) {
        case 'latest':
            return '最新';
        case 'outdated':
            return '已過期';
        case 'error':
            return '錯誤';
        default:
            return '未知';
    }
} 