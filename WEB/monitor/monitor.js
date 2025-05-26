// 監看的端點列表
const endpoints = [
    {
        name: '資料 API',
        url: '/api/data',
        description: '主要資料 API'
    },
    {
        name: '版本 API',
        url: '/api/version',
        description: '版本檢查 API'
    },
    {
        name: '通知 API',
        url: '/api/notifications',
        description: '系統通知 API'
    },
    {
        name: '農業部資料',
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
        description: '農業部開放資料'
    },
    {
        name: 'TV 驗證系統',
        url: 'https://baclup0821.github.io/API/Better-vegetable-catcher/TV-drvice.json',
        description: 'TV 版本驗證系統'
    }
];

// 檢查間隔（毫秒）
const CHECK_INTERVAL = 60000; // 1分鐘

// 歷史記錄最大條數
const MAX_HISTORY = 100;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initMonitor();
    initControls();
    startMonitoring();
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
}

// 開始監看
function startMonitoring() {
    checkAllEndpoints();
    setInterval(checkAllEndpoints, CHECK_INTERVAL);
}

// 檢查所有端點
async function checkAllEndpoints() {
    const timestamp = new Date();
    updateStatusInfo(timestamp);
    
    for (const endpoint of endpoints) {
        try {
            const result = await checkEndpoint(endpoint);
            updateEndpointCard(endpoint, result);
            addToHistory(endpoint, result, timestamp);
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
        }
    }
}

// 檢查單個端點
async function checkEndpoint(endpoint) {
    try {
        const response = await fetch(endpoint.url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        const etag = response.headers.get('ETag');
        const lastModified = response.headers.get('Last-Modified');
        const content = await response.text();
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
        
        return {
            status,
            etag: etag || '無',
            lastModified: lastModified || '無',
            hash
        };
    } catch (error) {
        throw new Error(`檢查失敗: ${error.message}`);
    }
}

// 更新端點卡片
function updateEndpointCard(endpoint, result) {
    const card = document.getElementById(`card-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}`);
    if (!card) return;
    
    const statusElement = card.querySelector('.endpoint-status');
    const etagElement = card.querySelector('.etag-value');
    const modifiedElement = card.querySelector('.modified-value');
    const checkTimeElement = card.querySelector('.check-time');
    
    statusElement.className = `endpoint-status status-${result.status}`;
    statusElement.textContent = getStatusText(result.status);
    
    etagElement.textContent = result.etag;
    modifiedElement.textContent = result.lastModified;
    checkTimeElement.textContent = new Date().toLocaleTimeString();
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