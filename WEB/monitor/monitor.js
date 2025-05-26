// 監看的端點列表
const endpoints = [
    {
        name: '通知 API',
        url: 'https://backup0821.github.io/API/Better-vegetable-catcher/notify.json',
        description: '系統通知 API',
        icon: 'fa-bell',
        maintenance: false
    },
    {
        name: '農業部資料',
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx',
        description: '農業部開放資料',
        icon: 'fa-leaf',
        maintenance: false
    },
    {
        name: 'TV 驗證系統',
        url: 'https://backup0821.github.io/API/Better-vegetable-catcher/TV-drvice.json',
        description: 'TV 版本驗證系統',
        icon: 'fa-tv',
        maintenance: true
    }
];

// 檢查間隔（毫秒）
const CHECK_INTERVAL = 60000; // 1分鐘

// 歷史記錄最大條數
const MAX_HISTORY = 100;

// 系統狀態
let systemStatus = {
    lastCheck: null,
    hasError: false,
    errorCount: 0,
    outdatedCount: 0,
    maintenanceCount: 0
};

// 控制項狀態
let controls = {
    errorSoundEnabled: true,
    notificationsEnabled: true,
    isChecking: false,
    autoUpdate: true
};

// 音效控制
let errorSoundEnabled = true;
let countdownInterval = null;
let checkInterval = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initMonitor();
    initControls();
    initNotifications();
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
    updateSystemStatus();
}

// 創建端點卡片
function createEndpointCard(endpoint) {
    const card = document.createElement('div');
    card.className = 'dashboard-card endpoint-card p-4';
    card.id = `card-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}`;
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <i class="fas ${endpoint.icon} text-gray-500"></i>
                <h3 class="font-semibold text-gray-900">${endpoint.name}</h3>
            </div>
            <div class="flex items-center gap-2">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" class="maintenance-toggle" 
                           ${endpoint.maintenance ? 'checked' : ''} 
                           onchange="toggleMaintenance('${endpoint.name}', this.checked)">
                    <span class="text-sm text-gray-700">維護模式</span>
                </label>
                <div class="endpoint-status status-badge status-error">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
        <div class="space-y-2 text-sm text-gray-600">
            <p><span class="font-medium">URL：</span>${endpoint.url}</p>
            <p><span class="font-medium">描述：</span>${endpoint.description}</p>
            <p><span class="font-medium">ETag：</span><span class="etag-value">--</span></p>
            <p><span class="font-medium">最後修改：</span><span class="modified-value">--</span></p>
        </div>
        <div class="mt-4 text-xs text-gray-500 text-right">
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
        controls.errorSoundEnabled = e.target.checked;
        // 如果啟用音效，預先載入音效
        if (e.target.checked) {
            const errorSound = document.getElementById('errorSound');
            if (errorSound) {
                errorSound.load();
            }
        }
    });

    // 通知控制
    const notificationCheckbox = document.getElementById('enableNotifications');
    notificationCheckbox.addEventListener('change', (e) => {
        controls.notificationsEnabled = e.target.checked;
    });

    // 自動更新控制
    const autoUpdateCheckbox = document.getElementById('enableAutoUpdate');
    if (autoUpdateCheckbox) {
        autoUpdateCheckbox.addEventListener('change', (e) => {
            controls.autoUpdate = e.target.checked;
            if (e.target.checked) {
                startMonitoring();
            } else {
                stopMonitoring();
            }
        });
    }

    // 歷史記錄過濾
    const historyFilter = document.getElementById('historyFilter');
    historyFilter.addEventListener('change', (e) => {
        filterHistory(e.target.value);
    });
}

// 初始化通知系統
async function initNotifications() {
    if (!('Notification' in window)) {
        console.warn('此瀏覽器不支援桌面通知');
        return;
    }

    if (Notification.permission === 'granted') {
        return;
    }

    if (Notification.permission !== 'denied') {
        await Notification.requestPermission();
    }
}

// 顯示通知
function showNotification(title, message) {
    if (!controls.notificationsEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico'
        });
    }

    // 顯示頁面內通知
    const notification = document.getElementById('notification');
    const content = notification.querySelector('.notification-content');
    content.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
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
    // 立即執行一次檢查
    checkAllEndpoints();
    
    // 清除現有的計時器
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // 設置新的計時器
    checkInterval = setInterval(() => {
        if (controls.autoUpdate) {
            checkAllEndpoints();
        }
    }, CHECK_INTERVAL);
    
    startCountdown();
}

// 停止監看
function stopMonitoring() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
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
    if (!nextCheckElement) return;

    const now = new Date();
    const lastCheck = systemStatus.lastCheck || now;
    const nextCheck = new Date(lastCheck.getTime() + CHECK_INTERVAL);
    const timeLeft = nextCheck - now;
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    nextCheckElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0 && controls.autoUpdate) {
        checkAllEndpoints();
    }
}

// 播放錯誤音效
function playErrorSound() {
    if (!controls.errorSoundEnabled) return;

    const errorSound = document.getElementById('errorSound');
    if (!errorSound) return;

    // 嘗試播放音效
    const playPromise = errorSound.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            if (error.name === 'NotAllowedError') {
                console.log('音效播放被阻止，等待使用者互動');
                // 將音效播放加入待播放佇列
                document.addEventListener('click', function playOnClick() {
                    errorSound.play().catch(console.error);
                    document.removeEventListener('click', playOnClick);
                }, { once: true });
            } else {
                console.error('播放音效失敗:', error);
            }
        });
    }
}

// 檢查所有端點
async function checkAllEndpoints() {
    if (controls.isChecking) return;
    controls.isChecking = true;

    const timestamp = new Date();
    systemStatus.lastCheck = timestamp;
    
    const checkButton = document.getElementById('checkNow');
    const originalText = checkButton.innerHTML;
    checkButton.innerHTML = '<div class="loading-spinner"></div>';
    checkButton.disabled = true;
    
    try {
        for (const endpoint of endpoints) {
            try {
                const result = await checkEndpoint(endpoint);
                updateEndpointCard(endpoint, result);
                addToHistory(endpoint, result, timestamp);
                
                if (result.status === 'error') {
                    systemStatus.hasError = true;
                    systemStatus.errorCount++;
                } else if (result.status === 'outdated') {
                    systemStatus.outdatedCount++;
                } else if (result.status === 'maintenance') {
                    systemStatus.maintenanceCount++;
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
                systemStatus.hasError = true;
                systemStatus.errorCount++;
            }
        }
        
        if (systemStatus.hasError) {
            playErrorSound();
            showNotification('監看系統警告', `發現 ${systemStatus.errorCount} 個錯誤`);
        } else if (systemStatus.outdatedCount > 0) {
            showNotification('監看系統通知', `發現 ${systemStatus.outdatedCount} 個過期端點`);
        } else if (systemStatus.maintenanceCount > 0) {
            showNotification('監看系統通知', `有 ${systemStatus.maintenanceCount} 個端點正在維護中`);
        }
    } finally {
        controls.isChecking = false;
        checkButton.innerHTML = originalText;
        checkButton.disabled = false;
        updateSystemStatus();
        updateCurrentTime();
    }
}

// 檢查單個端點
async function checkEndpoint(endpoint) {
    try {
        console.log(`正在檢查端點: ${endpoint.name} (${endpoint.url})`);
        
        // 檢查是否處於維護狀態
        if (endpoint.maintenance) {
            return {
                status: 'maintenance',
                etag: '維護中',
                lastModified: '維護中',
                hash: 'maintenance',
                maintenanceInfo: {
                    startTime: new Date().toISOString(),
                    endTime: null,
                    reason: '系統維護中'
                }
            };
        }
        
        const response = await fetch(endpoint.url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            // 檢查是否為維護狀態
            if (response.status === 503) {
                return {
                    status: 'maintenance',
                    etag: '維護中',
                    lastModified: '維護中',
                    hash: 'maintenance',
                    maintenanceInfo: {
                        startTime: new Date().toISOString(),
                        endTime: null,
                        reason: '服務暫時不可用'
                    }
                };
            }
            throw new Error(`HTTP 錯誤: ${response.status}`);
        }
        
        const etag = response.headers.get('ETag');
        const lastModified = response.headers.get('Last-Modified');
        const contentType = response.headers.get('Content-Type');
        
        let content;
        if (contentType && contentType.includes('application/json')) {
            content = await response.json();
            // 檢查回應內容是否包含維護資訊
            if (content.maintenance === true) {
                return {
                    status: 'maintenance',
                    etag: '維護中',
                    lastModified: '維護中',
                    hash: 'maintenance',
                    maintenanceInfo: {
                        startTime: content.maintenanceStartTime || new Date().toISOString(),
                        endTime: content.maintenanceEndTime || null,
                        reason: content.maintenanceReason || '系統維護中'
                    }
                };
            }
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
    if (!card) return;

    const statusElement = card.querySelector('.endpoint-status');
    const etagElement = card.querySelector('.etag-value');
    const modifiedElement = card.querySelector('.modified-value');
    const checkTimeElement = card.querySelector('.check-time');

    // 更新狀態
    card.className = `dashboard-card endpoint-card p-4 ${result.status}`;
    statusElement.className = `endpoint-status status-badge status-${result.status}`;
    statusElement.textContent = getStatusText(result.status);

    // 更新資訊
    if (result.status === 'maintenance' && result.maintenanceInfo) {
        const startTime = new Date(result.maintenanceInfo.startTime);
        const endTime = result.maintenanceInfo.endTime ? new Date(result.maintenanceInfo.endTime) : null;
        
        etagElement.textContent = result.maintenanceInfo.reason;
        modifiedElement.innerHTML = `
            <div>開始：${startTime.toLocaleString()}</div>
            ${endTime ? `<div>預計結束：${endTime.toLocaleString()}</div>` : ''}
        `;
    } else {
        etagElement.textContent = result.etag;
        modifiedElement.textContent = result.lastModified;
    }
    checkTimeElement.textContent = new Date().toLocaleTimeString();
}

// 更新系統狀態
function updateSystemStatus() {
    const statusElement = document.getElementById('systemStatus');
    if (!statusElement) return;

    // 重新計算狀態
    systemStatus.hasError = false;
    systemStatus.errorCount = 0;
    systemStatus.outdatedCount = 0;
    systemStatus.maintenanceCount = 0;

    // 檢查所有端點狀態
    endpoints.forEach(endpoint => {
        const card = document.getElementById(`card-${endpoint.name.replace(/\s+/g, '-').toLowerCase()}`);
        if (card) {
            const statusBadge = card.querySelector('.endpoint-status');
            if (statusBadge) {
                if (statusBadge.classList.contains('status-error')) {
                    systemStatus.hasError = true;
                    systemStatus.errorCount++;
                } else if (statusBadge.classList.contains('status-outdated')) {
                    systemStatus.outdatedCount++;
                } else if (statusBadge.classList.contains('status-maintenance')) {
                    systemStatus.maintenanceCount++;
                }
            }
        }
    });

    // 更新狀態顯示
    if (systemStatus.hasError) {
        statusElement.className = 'status-badge status-error';
        statusElement.textContent = `錯誤 (${systemStatus.errorCount})`;
    } else if (systemStatus.outdatedCount > 0) {
        statusElement.className = 'status-badge status-outdated';
        statusElement.textContent = `過期 (${systemStatus.outdatedCount})`;
    } else if (systemStatus.maintenanceCount > 0) {
        statusElement.className = 'status-badge status-maintenance';
        statusElement.textContent = `維護中 (${systemStatus.maintenanceCount})`;
    } else {
        statusElement.className = 'status-badge status-latest';
        statusElement.textContent = '正常';
    }
}

// 新增歷史記錄
function addToHistory(endpoint, result, timestamp) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = `history-item ${result.status}`;
    
    let statusText = getStatusText(result.status);
    if (result.status === 'maintenance' && result.maintenanceInfo) {
        statusText += ` (${result.maintenanceInfo.reason})`;
    }
    
    tr.innerHTML = `
        <td class="px-4 py-3">${timestamp.toLocaleString()}</td>
        <td class="px-4 py-3">${endpoint.name}</td>
        <td class="px-4 py-3">
            <span class="status-badge status-${result.status}">${statusText}</span>
        </td>
        <td class="px-4 py-3">${result.etag}</td>
        <td class="px-4 py-3">
            ${result.status === 'maintenance' && result.maintenanceInfo 
                ? `<div>開始：${new Date(result.maintenanceInfo.startTime).toLocaleString()}</div>
                   ${result.maintenanceInfo.endTime 
                       ? `<div>預計結束：${new Date(result.maintenanceInfo.endTime).toLocaleString()}</div>` 
                       : ''}`
                : result.lastModified}
        </td>
        <td class="px-4 py-3">
            <button class="text-primary-600 hover:text-primary-800" onclick="recheckEndpoint('${endpoint.name}')">
                <i class="fas fa-sync-alt"></i>
            </button>
        </td>
    `;
    
    tbody.insertBefore(tr, tbody.firstChild);
    
    // 限制歷史記錄數量
    while (tbody.children.length > MAX_HISTORY) {
        tbody.removeChild(tbody.lastChild);
    }
}

// 過濾歷史記錄
function filterHistory(filter) {
    const items = document.querySelectorAll('.history-item');
    items.forEach(item => {
        if (filter === 'all' || item.classList.contains(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// 清除歷史記錄
function clearHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (tbody) {
        tbody.innerHTML = '';
    }
}

// 重新檢查特定端點
async function recheckEndpoint(endpointName) {
    const endpoint = endpoints.find(e => e.name === endpointName);
    if (!endpoint) return;

    try {
        const result = await checkEndpoint(endpoint);
        updateEndpointCard(endpoint, result);
        addToHistory(endpoint, result, new Date());
    } catch (error) {
        console.error(`重新檢查 ${endpointName} 失敗:`, error);
        updateEndpointCard(endpoint, {
            status: 'error',
            error: error.message
        });
        addToHistory(endpoint, {
            status: 'error',
            error: error.message
        }, new Date());
    }
}

// 計算內容雜湊值
async function calculateHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 取得狀態文字
function getStatusText(status) {
    switch (status) {
        case 'latest':
            return '最新';
        case 'outdated':
            return '過期';
        case 'error':
            return '錯誤';
        case 'maintenance':
            return '維護中';
        default:
            return '未知';
    }
}

// 切換維護狀態
function toggleMaintenance(endpointName, isMaintenance) {
    const endpoint = endpoints.find(e => e.name === endpointName);
    if (endpoint) {
        endpoint.maintenance = isMaintenance;
        // 立即檢查端點狀態
        checkEndpoint(endpoint).then(result => {
            updateEndpointCard(endpoint, result);
            addToHistory(endpoint, result, new Date());
            // 更新系統狀態
            updateSystemStatus();
            // 如果啟用了自動更新，重新開始監控
            if (controls.autoUpdate) {
                startMonitoring();
            }
        }).catch(error => {
            console.error(`切換維護狀態後檢查失敗:`, error);
        });
    }
} 