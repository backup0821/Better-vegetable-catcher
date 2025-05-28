// 監控設定
let MONITOR_CONFIG = null;
let endpointStatuses = {};
let lastCheckTime = null;
let nextCheckTime = null;
let startTime = null;

// 載入設定檔
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        MONITOR_CONFIG = await response.json();
        console.log('設定檔載入成功');
    } catch (error) {
        console.error('載入設定檔失敗:', error);
        // 使用預設設定
        MONITOR_CONFIG = {
            checkInterval: 60000,
            endpoints: []
        };
    }
}

// 更新時間顯示
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-TW', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// 更新倒計時
function updateCountdown() {
    const now = new Date();
    if (!nextCheckTime) {
        nextCheckTime = new Date(now.getTime() + MONITOR_CONFIG.checkInterval);
    }
    
    const timeLeft = nextCheckTime - now;
    if (timeLeft <= 0) {
        nextCheckTime = new Date(now.getTime() + MONITOR_CONFIG.checkInterval);
        checkAllEndpoints();
    }
    
    const minutes = Math.floor(timeLeft / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    
    const countdownString = `更新倒計時: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    for (let i = 1; i <= MONITOR_CONFIG.endpoints.length; i++) {
        const countdownElement = document.getElementById(`countdown${i}`);
        if (countdownElement) {
            countdownElement.textContent = countdownString;
        }
    }
}

// 更新運行時間
function updateUptime() {
    if (!startTime) return;
    const now = new Date();
    let diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    diff %= 3600;
    const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    const uptimeStr = `${hours}:${minutes}:${seconds}`;
    const uptimeElem = document.getElementById('uptime');
    if (uptimeElem) uptimeElem.textContent = uptimeStr;
}

// 更新最後更新時間
function updateLastUpdateTime() {
    const elem = document.getElementById('lastUpdateTime');
    if (elem && lastCheckTime) {
        elem.textContent = lastCheckTime.toLocaleTimeString('zh-TW', { hour12: false });
    }
}

// 更新主監控燈
function updateMainIndicator() {
    const indicator = document.getElementById('mainIndicator');
    if (!indicator) return;
    // 收集所有 endpoint 狀態
    const statuses = [];
    for (let i = 1; i <= MONITOR_CONFIG.endpoints.length; i++) {
        const contentElement = document.getElementById(`monitorContent${i}`);
        if (!contentElement) continue;
        const card = contentElement.querySelector('.endpoint-card');
        if (!card) continue;
        if (card.classList.contains('error')) {
            statuses.push('error');
        } else if (card.classList.contains('maintenance')) {
            statuses.push('maintenance');
        } else if (card.classList.contains('outdated')) {
            statuses.push('outdated');
        } else if (card.classList.contains('latest')) {
            statuses.push('latest');
        }
    }
    // 決定主燈狀態
    let mainStatus = 'normal';
    if (statuses.includes('error')) {
        mainStatus = 'error';
    } else if (statuses.includes('maintenance')) {
        mainStatus = 'maintenance';
    } else if (statuses.includes('outdated')) {
        mainStatus = 'warning';
    } else {
        mainStatus = 'normal';
    }
    indicator.className = `main-indicator ${mainStatus}`;
}

// 播放錯誤音效
function playErrorSound() {
    const audio = document.getElementById('errorSound');
    if (audio) {
        audio.play().catch(error => console.log('無法播放音效:', error));
    }
}

// 播放維護音效
function playMaintenanceSound() {
    const audio = document.getElementById('maintenanceSound');
    if (audio) {
        audio.play().catch(error => console.log('無法播放音效:', error));
    }
}

// 播放過期音效
function playOutdatedSound() {
    const audio = document.getElementById('outdatedSound');
    if (audio) {
        audio.play().catch(error => console.log('無法播放音效:', error));
    }
}

// 檢查單個端點
async function checkEndpoint(endpoint, index) {
    try {
        // 檢查是否強制狀態
        if (endpoint.forceStatus !== 'auto') {
            const forcedStatus = {
                '503': 'maintenance',
                '404': 'error',
                '410': 'removed',
                '200': 'latest'
            }[endpoint.forceStatus] || 'auto';
            
            if (forcedStatus !== 'auto') {
                updateEndpointStatus(index, {
                    status: forcedStatus,
                    etag: 'N/A',
                    statusCode: endpoint.forceStatus,
                    responseTime: 'N/A',
                    lastUpdate: new Date().toLocaleString('zh-TW'),
                    error: null
                });
                
                // 播放對應音效
                if (forcedStatus === 'error') {
                    playErrorSound();
                    showNotification(`${endpoint.name} 發生錯誤: HTTP ${endpoint.forceStatus}`);
                } else if (forcedStatus === 'maintenance') {
                    playMaintenanceSound();
                    showNotification(`${endpoint.name} 維護中`);
                } else if (forcedStatus === 'removed') {
                    playErrorSound();
                    showNotification(`${endpoint.name} 檔案已移除`);
                }
                
                return forcedStatus === 'latest';
            }
        }
        
        // 自動檢查狀態
        const response = await fetch(endpoint.url, {
            method: 'HEAD',
            cache: 'no-cache'
        });
        
        const etag = response.headers.get('etag');
        const status = response.status;
        const responseTime = response.headers.get('x-response-time') || '0';
        
        // 狀態判斷
        let endpointStatus = 'latest';
        let errorMsg = null;
        
        if (status >= 400) {
            endpointStatus = 'error';
            errorMsg = `HTTP 錯誤: ${status}`;
        } else if (status === 203 || status === 202) {
            endpointStatus = 'outdated';
        }
        
        updateEndpointStatus(index, {
            status: endpointStatus,
            etag,
            statusCode: status,
            responseTime,
            lastUpdate: new Date().toLocaleString('zh-TW'),
            error: errorMsg
        });
        
        // 播放音效
        if (endpointStatus === 'error') {
            playErrorSound();
            showNotification(`${endpoint.name} 發生錯誤: HTTP ${status}`);
        } else if (endpointStatus === 'outdated') {
            playOutdatedSound();
            showNotification(`${endpoint.name} 資料過期`);
        }
        
        return endpointStatus === 'latest';
    } catch (error) {
        updateEndpointStatus(index, {
            status: 'error',
            error: error.message,
            lastUpdate: new Date().toLocaleString('zh-TW')
        });
        playErrorSound();
        showNotification(`${endpoint.name} 發生錯誤: ${error.message}`);
        return false;
    }
}

// 更新端點狀態顯示
function updateEndpointStatus(index, status) {
    const endpoint = MONITOR_CONFIG.endpoints[index - 1];
    const contentElement = document.getElementById(`monitorContent${index}`);
    const headerElement = contentElement.previousElementSibling;
    const statusBadge = headerElement.querySelector('.status-badge');
    
    // 更新狀態標籤
    statusBadge.className = `status-badge status-${status.status}`;
    statusBadge.textContent = getStatusText(status.status);
    
    // 更新內容卡片
    const card = contentElement.querySelector('.endpoint-card');
    card.className = `endpoint-card ${status.status}`;
    
    // 更新詳細資訊
    const details = card.querySelector('.endpoint-details');
    
    if (status.statusCode && status.statusCode !== '200') {
        // 非 200 狀態時的顯示
        details.innerHTML = `
            <div class="error-details">
                <div class="status-code">${status.statusCode}</div>
                <div class="last-update">${status.lastUpdate}</div>
                <div class="endpoint-url">${endpoint.url}</div>
            </div>
        `;
    } else {
        // 200 狀態時的顯示（保持原樣）
        details.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">ETag</span>
                <span class="detail-value">${status.etag || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">最後更新</span>
                <span class="detail-value">${status.lastUpdate}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">回應時間</span>
                <span class="detail-value">${status.responseTime || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">狀態碼</span>
                <span class="detail-value">${status.statusCode || 'N/A'}</span>
            </div>
        `;
    }
    
    // 更新狀態指示器
    const statusIndicator = card.querySelector('.status-indicator');
    statusIndicator.className = `status-indicator ${status.status}`;
    statusIndicator.innerHTML = `
        <i class="fas ${getStatusIcon(status.status)}"></i>
        ${getStatusText(status.status)}
    `;
}

// 獲取狀態文字
function getStatusText(status) {
    const statusMap = {
        'latest': '正常',
        'outdated': '過期',
        'error': '錯誤',
        'maintenance': '維護中',
        'removed': '已移除'
    };
    return statusMap[status] || status;
}

// 獲取狀態圖示
function getStatusIcon(status) {
    const iconMap = {
        'latest': 'fa-check-circle',
        'outdated': 'fa-exclamation-circle',
        'error': 'fa-times-circle',
        'maintenance': 'fa-tools',
        'removed': 'fa-trash-alt'
    };
    return iconMap[status] || 'fa-question-circle';
}

// 檢查所有端點
async function checkAllEndpoints() {
    if (!MONITOR_CONFIG) {
        console.error('設定檔尚未載入');
        return;
    }
    
    lastCheckTime = new Date();
    nextCheckTime = new Date(lastCheckTime.getTime() + MONITOR_CONFIG.checkInterval);
    
    for (let i = 0; i < MONITOR_CONFIG.endpoints.length; i++) {
        const endpoint = MONITOR_CONFIG.endpoints[i];
        await checkEndpoint(endpoint, i + 1);
    }
    
    updateLastUpdateTime();
    updateMainIndicator();
}

// 顯示通知
function showNotification(message) {
    const notification = document.getElementById('notification');
    const content = notification.querySelector('.notification-content');
    
    content.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// 初始化
async function initialize() {
    // 載入設定檔
    await loadConfig();
    
    // 請求全螢幕
    requestFullscreen();
    
    // 記錄運行開始時間
    startTime = new Date();
    
    // 註冊 Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker 註冊成功:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker 註冊失敗:', error);
            });
    }
    
    // 請求通知權限
    if ('Notification' in window) {
        Notification.requestPermission();
    }
    
    // 強制橫向顯示
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape')
            .catch(error => console.log('無法鎖定螢幕方向:', error));
    }
    
    // 開始定時更新
    setInterval(() => {
        updateTime();
        updateCountdown();
        updateUptime();
    }, 1000);
    
    // 立即執行一次檢查
    checkAllEndpoints();
    updateTime();
    updateCountdown();
    updateUptime();
}

// 請求全螢幕
function requestFullscreen() {
    const element = document.documentElement;
    
    // 檢查是否支援全螢幕
    if (!document.fullscreenElement && 
        !document.mozFullScreenElement && 
        !document.webkitFullscreenElement && 
        !document.msFullscreenElement) {
        
        // 顯示確認對話框
        if (confirm('是否要進入全螢幕模式？')) {
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        }
    }
}

// 監聽全螢幕變化
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || 
                        document.mozFullScreenElement || 
                        document.webkitFullscreenElement || 
                        document.msFullscreenElement;
    
    if (!isFullscreen) {
        // 如果退出全螢幕，再次詢問
        requestFullscreen();
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initialize); 
