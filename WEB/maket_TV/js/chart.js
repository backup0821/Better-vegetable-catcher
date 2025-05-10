// 圖表處理模組
const Chart = {
    // 圖表實例緩存
    chartInstances: {},

    // 圖表相關功能
    selectedCrop: null,
    cropData: [],

    // 初始化圖表
    initChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        // 如果已經存在圖表實例，先清除
        if (this.chartInstances[containerId]) {
            Plotly.purge(containerId);
        }

        const layout = {
            height: CONFIG.CHART.HEIGHT,
            width: CONFIG.CHART.WIDTH,
            margin: CONFIG.CHART.MARGIN,
            paper_bgcolor: CONFIG.CHART.COLORS.BACKGROUND,
            plot_bgcolor: CONFIG.CHART.COLORS.BACKGROUND,
            font: {
                family: '"Noto Sans TC", "Microsoft JhengHei", sans-serif'
            },
            xaxis: {
                title: '日期',
                tickangle: -45,
                tickformat: '%Y-%m-%d',
                showgrid: true,
                gridcolor: '#E0E0E0'
            },
            yaxis: {
                title: '價格 (NT$/公斤)',
                showgrid: true,
                gridcolor: '#E0E0E0'
            },
            showlegend: true,
            legend: {
                x: 0,
                y: 1,
                orientation: 'h'
            },
            // 添加動畫配置
            transition: {
                duration: 500,
                easing: 'cubic-in-out'
            }
        };

        // 創建新的圖表實例
        this.chartInstances[containerId] = Plotly.newPlot(container, [], layout, {
            responsive: true,
            displayModeBar: false,
            staticPlot: false
        });

        return this.chartInstances[containerId];
    },

    // 更新價格趨勢圖
    async updatePriceChart(containerId, marketName, cropName) {
        try {
            const trendData = await API.getCropPriceTrend(marketName, cropName);
            if (!trendData || trendData.length === 0) {
                throw new Error('無價格趨勢數據');
            }

            const trace = {
                x: trendData.map(item => item.date),
                y: trendData.map(item => item.price),
                type: 'scatter',
                mode: 'lines+markers',
                name: cropName,
                line: {
                    color: CONFIG.CHART.COLORS.PRIMARY,
                    width: 3
                },
                marker: {
                    size: 8,
                    color: CONFIG.CHART.COLORS.PRIMARY
                }
            };

            const layout = {
                title: {
                    text: `${cropName} 價格趨勢`,
                    font: {
                        size: 24,
                        family: '"Noto Sans TC", "Microsoft JhengHei", sans-serif'
                    }
                },
                annotations: [{
                    x: trendData[trendData.length - 1].date,
                    y: trendData[trendData.length - 1].price,
                    text: Utils.formatPrice(trendData[trendData.length - 1].price),
                    showarrow: true,
                    arrowhead: 2,
                    ax: 0,
                    ay: -40
                }]
            };

            // 使用 Plotly.react 進行高效更新
            Plotly.react(containerId, [trace], layout, {
                transition: {
                    duration: 500,
                    easing: 'cubic-in-out'
                }
            });
        } catch (error) {
            console.error('更新價格趨勢圖失敗:', error);
            Utils.showError('無法顯示價格趨勢圖');
        }
    },

    // 更新交易量圖
    async updateVolumeChart(containerId, marketName, cropName) {
        try {
            const trendData = await API.getCropPriceTrend(marketName, cropName);
            if (!trendData || trendData.length === 0) {
                throw new Error('無交易量數據');
            }

            const trace = {
                x: trendData.map(item => item.date),
                y: trendData.map(item => item.volume),
                type: 'bar',
                name: '交易量',
                marker: {
                    color: CONFIG.CHART.COLORS.SECONDARY
                }
            };

            const layout = {
                title: {
                    text: `${cropName} 交易量`,
                    font: {
                        size: 24,
                        family: '"Noto Sans TC", "Microsoft JhengHei", sans-serif'
                    }
                },
                yaxis: {
                    title: '交易量 (公斤)'
                }
            };

            // 使用 Plotly.react 進行高效更新
            Plotly.react(containerId, [trace], layout, {
                transition: {
                    duration: 500,
                    easing: 'cubic-in-out'
                }
            });
        } catch (error) {
            console.error('更新交易量圖失敗:', error);
            Utils.showError('無法顯示交易量圖');
        }
    },

    // 更新綜合圖表
    async updateCombinedChart(containerId, marketName, cropName) {
        try {
            const trendData = await API.getCropPriceTrend(marketName, cropName);
            if (!trendData || trendData.length === 0) {
                throw new Error('無數據');
            }

            const priceTrace = {
                x: trendData.map(item => item.date),
                y: trendData.map(item => item.price),
                type: 'scatter',
                mode: 'lines+markers',
                name: '價格',
                yaxis: 'y1',
                line: {
                    color: CONFIG.CHART.COLORS.PRIMARY,
                    width: 3
                },
                marker: {
                    size: 8,
                    color: CONFIG.CHART.COLORS.PRIMARY
                }
            };

            const volumeTrace = {
                x: trendData.map(item => item.date),
                y: trendData.map(item => item.volume),
                type: 'bar',
                name: '交易量',
                yaxis: 'y2',
                marker: {
                    color: CONFIG.CHART.COLORS.SECONDARY,
                    opacity: 0.7
                }
            };

            const layout = {
                title: {
                    text: `${cropName} 價格與交易量趨勢`,
                    font: {
                        size: 24,
                        family: '"Noto Sans TC", "Microsoft JhengHei", sans-serif'
                    }
                },
                yaxis: {
                    title: '價格 (NT$/公斤)',
                    titlefont: { color: CONFIG.CHART.COLORS.PRIMARY },
                    tickfont: { color: CONFIG.CHART.COLORS.PRIMARY }
                },
                yaxis2: {
                    title: '交易量 (公斤)',
                    titlefont: { color: CONFIG.CHART.COLORS.SECONDARY },
                    tickfont: { color: CONFIG.CHART.COLORS.SECONDARY },
                    overlaying: 'y',
                    side: 'right'
                },
                showlegend: true,
                legend: {
                    x: 0,
                    y: 1,
                    orientation: 'h'
                }
            };

            // 使用 Plotly.react 進行高效更新
            Plotly.react(containerId, [priceTrace, volumeTrace], layout, {
                transition: {
                    duration: 500,
                    easing: 'cubic-in-out'
                }
            });
        } catch (error) {
            console.error('更新綜合圖表失敗:', error);
            Utils.showError('無法顯示綜合圖表');
        }
    },

    // 清除圖表
    clearChart(containerId) {
        if (this.chartInstances[containerId]) {
            Plotly.purge(containerId);
            delete this.chartInstances[containerId];
        }
    },

    // 初始化圖表
    init() {
        const chartArea = document.getElementById('chartArea');
        chartArea.style.display = 'none';
    },

    // 顯示價格趨勢圖
    showPriceTrend() {
        if (!this.selectedCrop || !this.cropData.length) return;
        
        const chartArea = document.getElementById('chartArea');
        chartArea.style.display = 'block';
        
        const cropData = this.getCropData(this.selectedCrop);
        this.drawChart(cropData);
    },

    // 獲取作物數據
    getCropData(cropName) {
        return this.cropData
            .filter(item => item.作物名稱 === cropName)
            .sort((a, b) => new Date(a.交易日期) - new Date(b.交易日期));
    },

    // 繪製圖表
    drawChart(data) {
        const dates = data.map(item => item.交易日期);
        const prices = data.map(item => Number(item.平均價));
        const volumes = data.map(item => Number(item.交易量));
        
        const trace1 = {
            x: dates,
            y: prices,
            type: 'scatter',
            mode: 'lines+markers',
            name: '價格',
            line: { 
                color: '#1a237e',
                width: 3
            },
            marker: {
                size: 8,
                color: '#1a237e'
            }
        };
        
        const trace2 = {
            x: dates,
            y: volumes,
            type: 'bar',
            name: '交易量',
            yaxis: 'y2',
            marker: { 
                color: '#4caf50',
                opacity: 0.7
            }
        };
        
        const layout = {
            title: {
                text: `${data[0].作物名稱} 價格趨勢`,
                font: {
                    family: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
                    size: 24
                }
            },
            xaxis: {
                title: '日期',
                tickangle: -45,
                font: {
                    family: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
                    size: 14
                }
            },
            yaxis: {
                title: '價格 (元/公斤)',
                font: {
                    family: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
                    size: 14
                }
            },
            yaxis2: {
                title: '交易量 (公斤)',
                overlaying: 'y',
                side: 'right',
                font: {
                    family: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
                    size: 14
                }
            },
            showlegend: true,
            legend: {
                x: 1,
                y: 1,
                font: {
                    family: 'Noto Sans TC, Microsoft JhengHei, sans-serif',
                    size: 14
                }
            },
            margin: {
                t: 60,
                l: 60,
                r: 60,
                b: 60
            },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff'
        };
        
        const config = {
            responsive: true,
            displayModeBar: false
        };
        
        Plotly.newPlot('chartArea', [trace1, trace2], layout, config);
    },

    // 更新圖表數據
    updateChartData(newData) {
        this.cropData = newData;
        if (this.selectedCrop) {
            this.showPriceTrend();
        }
    },

    // 選擇作物
    selectCrop(cropName) {
        this.selectedCrop = cropName;
        this.showPriceTrend();
    }
};

// 導出函數
export {
    Chart
}; 