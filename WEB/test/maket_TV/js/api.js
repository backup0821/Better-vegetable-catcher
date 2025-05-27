// API 處理模組
const API = {
    // 獲取裝置資訊
    async getDeviceInfo(deviceId) {
        try {
            const response = await fetch(CONFIG.API.MARKET_DEVICE);
            if (!response.ok) throw new Error('無法獲取裝置資訊');
            
            const devices = await response.json();
            const device = devices.find(d => d.devicesID === deviceId);
            
            if (!device) {
                throw new Error(CONFIG.ERROR_MESSAGES.DEVICE_NOT_FOUND);
            }
            
            return device;
        } catch (error) {
            console.error('獲取裝置資訊失敗:', error);
            Utils.showError(error.message);
            throw error;
        }
    },

    // 獲取價格數據
    async getPriceData() {
        try {
            const response = await fetch(CONFIG.API.PRICE_DATA);
            if (!response.ok) throw new Error('無法獲取價格數據');
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('獲取價格數據失敗:', error);
            Utils.showError(CONFIG.ERROR_MESSAGES.DATA_FETCH_ERROR);
            throw error;
        }
    },

    // 獲取市場特定數據
    async getMarketData(marketName) {
        try {
            const allData = await this.getPriceData();
            return Utils.filterMarketData(allData, marketName);
        } catch (error) {
            console.error('獲取市場數據失敗:', error);
            throw error;
        }
    },

    // 獲取作物列表
    async getCropList(marketName) {
        try {
            const marketData = await this.getMarketData(marketName);
            return [...new Set(marketData.map(item => item.作物名稱))].sort();
        } catch (error) {
            console.error('獲取作物列表失敗:', error);
            throw error;
        }
    },

    // 獲取作物價格趨勢
    async getCropPriceTrend(marketName, cropName, days = 7) {
        try {
            const marketData = await this.getMarketData(marketName);
            const cropData = marketData.filter(item => item.作物名稱 === cropName);
            
            // 按日期排序
            cropData.sort((a, b) => new Date(a.交易日期) - new Date(b.交易日期));
            
            // 只取最近 n 天的數據
            const recentData = cropData.slice(-days);
            
            return recentData.map(item => ({
                date: item.交易日期,
                price: Number(item.平均價),
                volume: Number(item.交易量)
            }));
        } catch (error) {
            console.error('獲取作物價格趨勢失敗:', error);
            throw error;
        }
    },

    // 獲取最新價格
    async getLatestPrices(marketName) {
        try {
            const marketData = await this.getMarketData(marketName);
            const latestDate = Utils.getLatestDate(marketData);
            
            if (!latestDate) {
                throw new Error('無法獲取最新日期');
            }
            
            const latestData = marketData.filter(item => 
                item.交易日期 === latestDate.toISOString().split('T')[0]
            );
            
            // 改為按交易量排序
            return latestData.sort((a, b) => Number(b.交易量) - Number(a.交易量));
        } catch (error) {
            console.error('獲取最新價格失敗:', error);
            throw error;
        }
    },

    // 檢查數據更新
    async checkDataUpdate() {
        try {
            const lastUpdate = Utils.storage.get(CONFIG.STORAGE_KEYS.LAST_UPDATE);
            const currentData = await this.getPriceData();
            const currentDate = Utils.getLatestDate(currentData);
            
            if (!lastUpdate || new Date(lastUpdate) < currentDate) {
                Utils.storage.set(CONFIG.STORAGE_KEYS.LAST_UPDATE, currentDate);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('檢查數據更新失敗:', error);
            return false;
        }
    }
}; 