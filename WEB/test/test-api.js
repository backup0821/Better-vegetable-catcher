// 測試農業部 API
async function testMOAApi() {
    const apis = [
        'https://bvc-api.deno.dev/data',
        'https://data.moa.gov.tw/Service/OpenData/FromM/MarketRestFarm.aspx',
        'https://data.moa.gov.tw/Service/OpenData/Agriculturalcoa_videoRss.aspx'
    ];

    console.log('網路狀態:', navigator.onLine ? '在線' : '離線');
    console.log('使用者代理:', navigator.userAgent);
    console.log('------------------------');

    for (const api of apis) {
        try {
            console.log(`測試 API: ${api}`);
            
            // 設定超時
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(api, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`狀態碼: ${response.status}`);
            console.log(`回應標頭:`, Object.fromEntries(response.headers.entries()));
            
            const contentType = response.headers.get('content-type');
            console.log(`內容類型: ${contentType}`);
            
            if (!response.ok) {
                throw new Error(`HTTP 錯誤: ${response.status} ${response.statusText}`);
            }
            
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`無效的回應格式: ${contentType}`);
            }
            
            const data = await response.json();
            console.log(`資料範例:`, data.slice(0, 2));
            console.log('------------------------');
        } catch (error) {
            console.error(`API ${api} 錯誤:`, error);
            console.log('錯誤類型:', error.name);
            console.log('錯誤訊息:', error.message);
            console.log('錯誤堆疊:', error.stack);
            console.log('------------------------');
        }
    }
}

// 執行測試
testMOAApi(); 