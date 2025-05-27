// 使用者資料（實際應用中應該從後端獲取）
const USERS = {
    'admin': {
        password: 'admin123',
        role: 'admin'
    },
    'user': {
        password: 'user123',
        role: 'user'
    }
};

// 處理登入
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // 驗證使用者
    if (USERS[username] && USERS[username].password === password) {
        // 儲存登入狀態
        const sessionData = {
            username: username,
            role: USERS[username].role,
            loginTime: new Date().toISOString()
        };
        
        // 使用 localStorage 儲存會話資料
        localStorage.setItem('etagMonitorSession', JSON.stringify(sessionData));
        
        // 跳轉到主頁面
        window.location.href = 'index.html';
    } else {
        // 顯示錯誤訊息
        errorMessage.textContent = '使用者名稱或密碼錯誤';
        errorMessage.classList.add('show');
        
        // 3秒後隱藏錯誤訊息
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 3000);
    }
    
    return false;
}

// 檢查登入狀態
function checkLoginStatus() {
    const sessionData = localStorage.getItem('etagMonitorSession');
    
    if (!sessionData) {
        // 如果沒有登入，跳轉到登入頁面
        if (window.location.pathname !== '/login.html') {
            window.location.href = 'login.html';
        }
        return;
    }
    
    // 解析會話資料
    const session = JSON.parse(sessionData);
    
    // 檢查會話是否過期（24小時）
    const loginTime = new Date(session.loginTime);
    const now = new Date();
    const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
        // 會話過期，清除資料並跳轉到登入頁面
        localStorage.removeItem('etagMonitorSession');
        window.location.href = 'login.html';
        return;
    }
    
    // 如果已經登入且當前在登入頁面，跳轉到主頁面
    if (window.location.pathname === '/login.html') {
        window.location.href = 'index.html';
    }
}

// 登出功能
function logout() {
    localStorage.removeItem('etagMonitorSession');
    window.location.href = 'login.html';
}

// 頁面載入時檢查登入狀態
document.addEventListener('DOMContentLoaded', checkLoginStatus); 