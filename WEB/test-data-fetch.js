// 測試代碼：強制重新抓取資料並顯示前10個作物種類
// 使用方法：在瀏覽器控制台中執行 testDataFetch()

// 測試函數
async function testDataFetch() {
    try {
        console.log('開始測試：強制重新抓取資料...');
        
        // 顯示開始提示
        alert('開始強制重新抓取資料，請稍候...');
        
        // 清除所有快取
        console.log('清除快取中...');
        localStorage.removeItem('crop_data');
        localStorage.removeItem('last_fetch_date');
        
        // 清除 ETag 相關快取
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('etag_') || key.startsWith('hash_') || key.startsWith('modified_')) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('快取已清除');
        
        // 強制重新獲取資料
        console.log('開始獲取新資料...');
        const data = await fetchData();
        
        console.log('資料獲取成功，總筆數：', data.length);
        
        // 提取作物種類（去重）
        const cropSet = new Set(data.map(item => item.作物名稱));
        const cropList = Array.from(cropSet).sort();
        
        console.log('作物種類總數：', cropList.length);
        
        // 獲取前10個作物種類
        const top10Crops = cropList.slice(0, 10);
        
        // 顯示結果
        const message = `資料抓取成功！\n\n總資料筆數：${data.length}\n作物種類總數：${cropList.length}\n\n前10個作物種類：\n${top10Crops.map((crop, index) => `${index + 1}. ${crop}`).join('\n')}`;
        
        alert(message);
        
        // 在控制台也顯示詳細資訊
        console.log('=== 測試結果 ===');
        console.log('總資料筆數：', data.length);
        console.log('作物種類總數：', cropList.length);
        console.log('前10個作物種類：', top10Crops);
        console.log('完整作物列表：', cropList);
        
        return {
            totalRecords: data.length,
            totalCrops: cropList.length,
            top10Crops: top10Crops,
            allCrops: cropList
        };
        
    } catch (error) {
        console.error('測試失敗：', error);
        alert(`測試失敗：${error.message}`);
        throw error;
    }
}

// 簡化版測試函數（只顯示前10個作物）
async function showTop10Crops() {
    try {
        // 獲取當前資料
        const localData = localStorage.getItem('crop_data');
        if (!localData) {
            alert('沒有找到快取資料，請先執行完整測試');
            return;
        }
        
        const data = JSON.parse(localData);
        const cropSet = new Set(data.map(item => item.作物名稱));
        const cropList = Array.from(cropSet).sort();
        const top10Crops = cropList.slice(0, 10);
        
        const message = `當前快取資料\n\n總資料筆數：${data.length}\n作物種類總數：${cropList.length}\n\n前10個作物種類：\n${top10Crops.map((crop, index) => `${index + 1}. ${crop}`).join('\n')}`;
        
        alert(message);
        
    } catch (error) {
        console.error('顯示作物失敗：', error);
        alert(`顯示失敗：${error.message}`);
    }
}

// 檢查資料狀態
function checkDataStatus() {
    const localData = localStorage.getItem('crop_data');
    const lastFetch = localStorage.getItem('last_fetch_date');
    
    if (!localData) {
        alert('沒有找到快取資料');
        return;
    }
    
    const data = JSON.parse(localData);
    const cropSet = new Set(data.map(item => item.作物名稱));
    const cropList = Array.from(cropSet).sort();
    
    const message = `資料狀態檢查\n\n最後更新時間：${lastFetch || '未知'}\n總資料筆數：${data.length}\n作物種類總數：${cropList.length}\n\n前10個作物種類：\n${cropList.slice(0, 10).map((crop, index) => `${index + 1}. ${crop}`).join('\n')}`;
    
    alert(message);
}

// 清除快取並重新抓取（簡化版）
async function forceRefreshData() {
    try {
        alert('開始強制重新抓取資料...');
        
        // 清除快取
        localStorage.removeItem('crop_data');
        localStorage.removeItem('last_fetch_date');
        
        // 重新獲取
        const data = await fetchData();
        
        // 顯示結果
        const cropSet = new Set(data.map(item => item.作物名稱));
        const cropList = Array.from(cropSet).sort();
        const top10Crops = cropList.slice(0, 10);
        
        const message = `資料重新抓取成功！\n\n總資料筆數：${data.length}\n作物種類總數：${cropList.length}\n\n前10個作物種類：\n${top10Crops.map((crop, index) => `${index + 1}. ${crop}`).join('\n')}`;
        
        alert(message);
        
    } catch (error) {
        console.error('強制重新抓取失敗：', error);
        alert(`重新抓取失敗：${error.message}`);
    }
}

// 使用說明
console.log(`
=== 測試代碼使用說明 ===

1. testDataFetch() - 完整測試：清除快取並重新抓取資料，顯示前10個作物
2. showTop10Crops() - 顯示當前快取資料的前10個作物
3. checkDataStatus() - 檢查當前資料狀態
4. forceRefreshData() - 簡化版強制重新抓取

請在瀏覽器控制台中執行以上任一函數進行測試。
`); 