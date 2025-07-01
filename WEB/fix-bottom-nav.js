// 底部導航修復腳本
console.log('🔧 開始修復底部導航...');

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 DOM 載入完成，開始初始化底部導航...');
    
    // 確保底部導航存在
    const bottomNav = document.querySelector('.bottom-nav');
    if (!bottomNav) {
        console.error('❌ 找不到底部導航元素');
        return;
    }
    
    console.log('✅ 找到底部導航元素');
    
    // 確保 z-index 正確
    bottomNav.style.zIndex = '9999';
    bottomNav.style.position = 'fixed';
    bottomNav.style.bottom = '0';
    bottomNav.style.left = '0';
    bottomNav.style.right = '0';
    
    // 獲取導航項目
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    console.log(`📊 找到 ${navItems.length} 個導航項目`);
    console.log(`📄 找到 ${contentSections.length} 個內容區塊`);
    
    // 為每個導航項目添加點擊事件
    navItems.forEach((item, index) => {
        console.log(`🔗 綁定導航項目 ${index + 1}: ${item.getAttribute('data-section')}`);
        
        // 移除舊的事件監聽器
        item.replaceWith(item.cloneNode(true));
        
        // 重新獲取元素
        const newItem = document.querySelectorAll('.nav-item')[index];
        
        // 添加新的事件監聽器
        newItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const targetSection = newItem.getAttribute('data-section');
            console.log(`🖱️ 點擊導航項目: ${targetSection}`);
            
            // 移除所有活動狀態
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            
            // 添加活動狀態到當前項目
            newItem.classList.add('active');
            
            // 顯示對應的內容區塊
            const targetElement = document.getElementById(`${targetSection}-section`);
            if (targetElement) {
                targetElement.classList.add('active');
                console.log(`✅ 切換到區塊: ${targetSection}`);
            } else {
                console.error(`❌ 找不到目標區塊: ${targetSection}-section`);
            }
            
            // 儲存當前頁面狀態
            localStorage.setItem('currentSection', targetSection);
            
            // 觸發自定義事件
            const event = new CustomEvent('sectionChanged', {
                detail: { section: targetSection }
            });
            document.dispatchEvent(event);
        });
        
        // 添加觸摸事件支援
        newItem.addEventListener('touchstart', (e) => {
            e.preventDefault();
            newItem.style.transform = 'scale(0.95)';
        });
        
        newItem.addEventListener('touchend', (e) => {
            e.preventDefault();
            newItem.style.transform = '';
            newItem.click();
        });
    });
    
    // 載入上次選擇的頁面
    const lastSection = localStorage.getItem('currentSection') || 'main';
    console.log(`📂 載入上次選擇的頁面: ${lastSection}`);
    
    const lastNavItem = document.querySelector(`[data-section="${lastSection}"]`);
    if (lastNavItem) {
        lastNavItem.click();
    } else {
        console.log('⚠️ 找不到上次選擇的頁面，使用預設頁面: main');
        const mainNavItem = document.querySelector('[data-section="main"]');
        if (mainNavItem) {
            mainNavItem.click();
        }
    }
    
    // 添加調試資訊
    const debugInfo = document.createElement('div');
    debugInfo.id = 'nav-debug-info';
    debugInfo.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        z-index: 10000;
        font-family: monospace;
    `;
    debugInfo.innerHTML = `
        底部導航修復狀態<br>
        導航項目: ${navItems.length}<br>
        內容區塊: ${contentSections.length}<br>
        當前區塊: ${lastSection}<br>
        時間: ${new Date().toLocaleTimeString()}
    `;
    document.body.appendChild(debugInfo);
    
    // 每秒更新調試資訊
    setInterval(() => {
        const activeSection = document.querySelector('.content-section.active');
        const activeNav = document.querySelector('.nav-item.active');
        debugInfo.innerHTML = `
            底部導航修復狀態<br>
            導航項目: ${navItems.length}<br>
            內容區塊: ${contentSections.length}<br>
            當前區塊: ${activeSection ? activeSection.id : '無'}<br>
            當前導航: ${activeNav ? activeNav.getAttribute('data-section') : '無'}<br>
            時間: ${new Date().toLocaleTimeString()}
        `;
    }, 1000);
    
    console.log('✅ 底部導航修復完成');
});

// 導出函數供其他腳本使用
window.fixBottomNavigation = function() {
    console.log('🔄 手動觸發底部導航修復');
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
};

// 添加全域錯誤處理
window.addEventListener('error', (e) => {
    console.error('❌ 全域錯誤:', e.error);
});

// 添加未處理的 Promise 錯誤處理
window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ 未處理的 Promise 錯誤:', e.reason);
}); 