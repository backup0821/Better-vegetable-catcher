// 監控設定
const MONITOR_CONFIG = {
    checkInterval: 60 * 1000, // 1分鐘檢查一次
    endpoints: [
    {
        name: '1 通知 API',
        url: 'https://backup0821.github.io/API/Better-vegetable-catcher/notify.json',
        description: '系統通知 API',
        icon: 'fa-bell',
        maintenance: false
    },
    {
        name: '2 系統維護 API',
        url: 'https://backup0821.github.io/API/Better-vegetable-catcher/maintenance.json',
        description: '系統維護 API',
        icon: 'fa-leaf',
        maintenance: false
    },
    {
        name: '3 TV驗證系統 API',
        url: 'https://backup0821.github.io/API/Better-vegetable-catcher/TV-drvice.json',
        description: 'TV 版本驗證系統',
        icon: 'fa-tv',
        maintenance: true
    },
    {
        name: '4 主系統',
        url: 'https://backup0821.github.io/Better-vegetable-catcher/web',
        description: '農產分析 主要系統',
        icon: 'fa-analytics',
        maintenance: true
    },
    {
        name: '5 測試系統',
        url: 'https://backup0821.github.io/Better-vegetable-catcher/WEB/test',
        description: '系統備份服務',
        icon: 'fa-database',
        maintenance: false
    },
    {
        name: '6 農業部 主API',
        url: 'https://bvc-api.deno.dev',
        description: '農業部主要資料 API',
        icon: 'fa-tractor',
        maintenance: false
    },
    {
        name: '7 農業部 修市API',
        url: 'https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx',
        description: '農業部修市資料 API',
        icon: 'fa-store',
        maintenance: false
    },
    {
        name: '8 農業部 農業氣象影音API',
        url: 'https://data.moa.gov.tw/Service/OpenData/Agriculturalcoa_videoRss.aspx',
        description: '農業部氣象影音資料 API',
        icon: 'fa-cloud-sun-rain',
        maintenance: false
    }
    ]
};

// 狀態管理
let endpointStatuses = {};
let lastCheckTime = null;
let nextCheckTime = null;
let startTime = null; // 新增運行開始時間

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
        if (endpoint.maintenance) {
            endpointStatus = 'maintenance';
        } else if (status >= 400) {
            endpointStatus = 'error';
            errorMsg = `HTTP 錯誤: ${status}`;
        } else if (status === 203 || status === 202) { // 假設 203/202 代表過期
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
        } else if (endpointStatus === 'maintenance') {
            playMaintenanceSound();
            showNotification(`${endpoint.name} 維護中`);
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
        'maintenance': '維護中'
    };
    return statusMap[status] || status;
}

// 獲取狀態圖示
function getStatusIcon(status) {
    const iconMap = {
        'latest': 'fa-check-circle',
        'outdated': 'fa-exclamation-circle',
        'error': 'fa-times-circle',
        'maintenance': 'fa-tools'
    };
    return iconMap[status] || 'fa-question-circle';
}

// 檢查所有端點
async function checkAllEndpoints() {
    lastCheckTime = new Date();
    nextCheckTime = new Date(lastCheckTime.getTime() + MONITOR_CONFIG.checkInterval);
    for (let i = 0; i < MONITOR_CONFIG.endpoints.length; i++) {
        const endpoint = MONITOR_CONFIG.endpoints[i];
        if (!endpoint.maintenance) {
            await checkEndpoint(endpoint, i + 1);
        }
    }
    updateLastUpdateTime(); // 新增：更新最後更新時間
    updateMainIndicator();  // 新增：更新主監控燈
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
function initialize() {
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
        updateUptime(); // 新增：每秒更新運行時間
    }, 1000);
    // 立即執行一次檢查
    checkAllEndpoints();
    updateTime();
    updateCountdown();
    updateUptime(); // 新增：初始化時也更新一次運行時間
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
