// 顯示控制模組
const Display = {
    // 當前狀態
    state: {
        currentMode: 'price', // 'price' 或 'chart'
        currentCropIndex: 0,
        crops: [],
        deviceId: null,
        marketName: '',
        lastUpdate: null
    },

    // 初始化顯示
    async init() {
        this.state.deviceId = Utils.storage.get(CONFIG.STORAGE_KEYS.DEVICE_ID);
        
        if (!this.state.deviceId) {
            this.showDeviceSetupDialog();
            return;
        }

        try {
            const deviceInfo = await API.getDeviceInfo(this.state.deviceId);
            this.state.marketName = deviceInfo.market_name;
            this.updateMarketInfo();
            this.initDisplay();
        } catch (error) {
            console.error('初始化顯示失敗:', error);
            this.showDeviceSetupDialog();
        }
    },

    // 顯示裝置設定對話框
    showDeviceSetupDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'device-setup-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h2>設定裝置識別碼</h2>
                <p>請輸入裝置識別碼以識別市場</p>
                <input type="text" id="deviceIdInput" placeholder="例如：drvice-Taipai01">
                <div class="dialog-buttons">
                    <button id="confirmDeviceId">確認</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('confirmDeviceId').addEventListener('click', async () => {
            const input = document.getElementById('deviceIdInput');
            const newDeviceId = input.value.trim();
            
            if (newDeviceId) {
                this.state.deviceId = newDeviceId;
                Utils.storage.set(CONFIG.STORAGE_KEYS.DEVICE_ID, newDeviceId);
                dialog.remove();
                await this.init();
            }
        });
    },

    // 更新市場資訊
    updateMarketInfo() {
        document.getElementById('marketName').textContent = this.state.marketName;
        document.getElementById('deviceId').textContent = `裝置ID：${this.state.deviceId}`;
    },

    // 初始化顯示
    async initDisplay() {
        // 初始化時鐘
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // 初始化圖表
        Chart.initChart('chartArea');

        // 獲取作物列表
        try {
            this.state.crops = await API.getCropList(this.state.marketName);
            this.startCropRotation();
        } catch (error) {
            console.error('獲取作物列表失敗:', error);
            Utils.showError('無法獲取作物列表');
        }

        // 開始顯示模式切換
        this.startDisplayRotation();

        // 檢查數據更新
        this.checkDataUpdate();
    },

    // 更新時鐘
    updateClock() {
        const now = new Date();
        document.getElementById('clockTime').textContent = Utils.formatDateTime(now);
        document.getElementById('currentTime').textContent = now.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    },

    // 開始顯示模式切換
    startDisplayRotation() {
        setInterval(() => {
            this.state.currentMode = this.state.currentMode === 'price' ? 'chart' : 'price';
            this.updateDisplay();
        }, CONFIG.DISPLAY.MODE_SWITCH_INTERVAL);
    },

    // 開始作物輪播
    startCropRotation() {
        if (this.state.crops.length === 0) return;

        setInterval(() => {
            this.state.currentCropIndex = (this.state.currentCropIndex + 1) % this.state.crops.length;
            this.updateCropInfo();
        }, CONFIG.DISPLAY.CROP_ROTATION_INTERVAL);
    },

    // 更新顯示內容
    updateDisplay() {
        const priceDisplay = document.getElementById('priceDisplay');
        const chartArea = document.getElementById('chartArea');
        const modeText = document.querySelector('.mode-text');

        if (this.state.currentMode === 'price') {
            priceDisplay.style.display = 'grid';
            chartArea.style.display = 'none';
            modeText.textContent = '價格列表';
            this.updatePriceDisplay();
        } else {
            priceDisplay.style.display = 'none';
            chartArea.style.display = 'block';
            modeText.textContent = '價格趨勢';
            this.updateChartDisplay();
        }
    },

    // 更新價格顯示
    async updatePriceDisplay() {
        try {
            const latestPrices = await API.getLatestPrices(this.state.marketName);
            const priceDisplay = document.getElementById('priceDisplay');
            priceDisplay.innerHTML = '';

            latestPrices.slice(0, CONFIG.DISPLAY.PRICE_CARDS_PER_PAGE).forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'price-card';
                card.style.animationDelay = `${index * 0.1}s`;
                card.innerHTML = `
                    <h3>${item.作物名稱}</h3>
                    <div class="price-value">${Utils.formatPrice(item.平均價)}</div>
                    <div class="volume">${Utils.formatVolume(item.交易量)}</div>
                `;
                priceDisplay.appendChild(card);
            });
        } catch (error) {
            console.error('更新價格顯示失敗:', error);
            Utils.showError('無法更新價格顯示');
        }
    },

    // 更新圖表顯示
    async updateChartDisplay() {
        if (this.state.crops.length === 0) return;

        const currentCrop = this.state.crops[this.state.currentCropIndex];
        await Chart.updateCombinedChart('chartArea', this.state.marketName, currentCrop);
    },

    // 更新作物資訊
    async updateCropInfo() {
        if (this.state.crops.length === 0) return;

        const currentCrop = this.state.crops[this.state.currentCropIndex];
        try {
            const trendData = await API.getCropPriceTrend(this.state.marketName, currentCrop);
            if (trendData && trendData.length > 0) {
                const latestData = trendData[trendData.length - 1];
                
                document.getElementById('cropName').textContent = currentCrop;
                document.getElementById('tradeVolume').textContent = Utils.formatVolume(latestData.volume);
                document.getElementById('avgPrice').textContent = Utils.formatPrice(latestData.price);
            }
        } catch (error) {
            console.error('更新作物資訊失敗:', error);
        }
    },

    // 檢查數據更新
    async checkDataUpdate() {
        try {
            const hasUpdate = await API.checkDataUpdate();
            if (hasUpdate) {
                Utils.showNotification('資料已更新', 'success');
                this.updateDisplay();
            }
        } catch (error) {
            console.error('檢查數據更新失敗:', error);
        }

        // 每5分鐘檢查一次更新
        setTimeout(() => this.checkDataUpdate(), 300000);
    }
}; 