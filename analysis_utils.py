import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os

class DataAnalyzer:
    def __init__(self, data):
        self.data = pd.DataFrame(data)
        self.prepare_data()
    
    def prepare_data(self):
        """準備和清理資料"""
        # 確保必要欄位存在
        required_columns = ['交易日期', '作物名稱', '市場名稱', '平均價', '交易量']
        if not all(col in self.data.columns for col in required_columns):
            raise ValueError("資料缺少必要欄位")
            
        # 移除所有必要欄位中的空值
        self.data = self.data.dropna(subset=required_columns)
        
        # 轉換民國年日期為西元年日期
        def convert_tw_date(date_str):
            try:
                if not isinstance(date_str, str):
                    return pd.NaT
                year, month, day = map(int, date_str.split('.'))
                year += 1911  # 民國年轉西元年
                return pd.to_datetime(f'{year}-{month:02d}-{day:02d}')
            except:
                return pd.NaT
        
        # 轉換日期
        self.data['日期'] = self.data['交易日期'].apply(convert_tw_date)
        
        # 移除無效日期的資料
        self.data = self.data.dropna(subset=['日期'])
        
        # 轉換數值欄位
        numeric_columns = ['平均價', '交易量']
        for col in numeric_columns:
            self.data[col] = pd.to_numeric(self.data[col], errors='coerce')
        
        # 移除無效的數值
        self.data = self.data.dropna(subset=numeric_columns)
        
        # 確保作物名稱和市場名稱是字串類型
        self.data['作物名稱'] = self.data['作物名稱'].astype(str)
        self.data['市場名稱'] = self.data['市場名稱'].astype(str)
        
        # 添加星期幾
        self.data['星期'] = self.data['日期'].dt.day_name()
        
        # 添加月份
        self.data['月份'] = self.data['日期'].dt.month
    
    def get_price_trend(self, crop_name):
        """獲取價格趨勢資料"""
        crop_data = self.data[self.data['作物名稱'] == crop_name]
        daily_price = crop_data.groupby('日期')['平均價'].mean().reset_index()
        return daily_price
    
    def get_volume_by_market(self, crop_name):
        """獲取各市場交易量資料"""
        crop_data = self.data[self.data['作物名稱'] == crop_name]
        market_volume = crop_data.groupby('市場名稱')['交易量'].sum().reset_index()
        return market_volume
    
    def get_price_distribution(self, crop_name):
        """獲取價格分布資料"""
        crop_data = self.data[self.data['作物名稱'] == crop_name]
        return crop_data['平均價']
    
    def predict_price(self, crop_name, days=7):
        """預測未來價格"""
        crop_data = self.data[self.data['作物名稱'] == crop_name].copy()
        
        # 準備特徵
        crop_data['日期序號'] = (crop_data['日期'] - crop_data['日期'].min()).dt.days
        X = crop_data[['日期序號', '月份']]
        y = crop_data['平均價']
        
        # 訓練模型
        model = LinearRegression()
        model.fit(X, y)
        
        # 準備預測資料
        last_date = crop_data['日期'].max()
        future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=days)
        future_X = pd.DataFrame({
            '日期序號': [(date - crop_data['日期'].min()).days for date in future_dates],
            '月份': [date.month for date in future_dates]
        })
        
        # 預測
        predictions = model.predict(future_X)
        return pd.DataFrame({
            '日期': future_dates,
            '預測價格': predictions
        })
    
    def get_seasonal_analysis(self, crop_name):
        """獲取季節性分析資料"""
        crop_data = self.data[self.data['作物名稱'] == crop_name]
        monthly_stats = crop_data.groupby('月份').agg({
            '平均價': ['mean', 'std'],
            '交易量': ['sum', 'mean']
        }).round(2)
        return monthly_stats
    
    def get_similar_crops(self, crop_name, n=5):
        """找出價格變動模式相似的作物"""
        target_crop = self.data[self.data['作物名稱'] == crop_name]
        target_prices = target_crop.groupby('日期')['平均價'].mean()
        
        similarities = {}
        for crop in self.data['作物名稱'].unique():
            if crop == crop_name:
                continue
            
            crop_prices = self.data[self.data['作物名稱'] == crop].groupby('日期')['平均價'].mean()
            # 計算相關係數
            correlation = target_prices.corr(crop_prices)
            if not np.isnan(correlation):
                similarities[crop] = correlation
        
        # 返回最相似的n個作物
        return sorted(similarities.items(), key=lambda x: abs(x[1]), reverse=True)[:n]
    
    def create_price_trend_plot(self, crop_name):
        """創建價格趨勢圖"""
        daily_price = self.get_price_trend(crop_name)
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=daily_price['日期'],
            y=daily_price['平均價'],
            mode='lines+markers',
            name='實際價格'
        ))
        
        # 添加預測價格
        predictions = self.predict_price(crop_name)
        fig.add_trace(go.Scatter(
            x=predictions['日期'],
            y=predictions['預測價格'],
            mode='lines+markers',
            name='預測價格',
            line=dict(dash='dash')
        ))
        
        fig.update_layout(
            title=f'{crop_name}價格趨勢和預測',
            xaxis_title='日期',
            yaxis_title='價格 (元/公斤)',
            hovermode='x unified'
        )
        return fig
    
    def create_volume_pie_chart(self, crop_name):
        """創建交易量分布圓餅圖"""
        market_volume = self.get_volume_by_market(crop_name)
        fig = px.pie(
            market_volume,
            values='交易量',
            names='市場名稱',
            title=f'{crop_name}各市場交易量分布'
        )
        return fig
    
    def create_price_distribution_plot(self, crop_name):
        """創建價格分布圖"""
        prices = self.get_price_distribution(crop_name)
        
        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=prices,
            nbinsx=30,
            name='價格分布'
        ))
        
        fig.update_layout(
            title=f'{crop_name}價格分布',
            xaxis_title='價格 (元/公斤)',
            yaxis_title='次數',
            bargap=0.1
        )
        return fig
    
    def create_seasonal_plot(self, crop_name):
        """創建季節性分析圖"""
        seasonal_data = self.get_seasonal_analysis(crop_name)
        
        fig = go.Figure()
        
        # 價格曲線
        fig.add_trace(go.Scatter(
            x=list(range(1, 13)),
            y=seasonal_data['平均價']['mean'],
            mode='lines+markers',
            name='平均價格',
            yaxis='y1'
        ))
        
        # 交易量柱狀圖
        fig.add_trace(go.Bar(
            x=list(range(1, 13)),
            y=seasonal_data['交易量']['mean'],
            name='平均交易量',
            yaxis='y2'
        ))
        
        fig.update_layout(
            title=f'{crop_name}季節性分析',
            xaxis_title='月份',
            yaxis_title='價格 (元/公斤)',
            yaxis2=dict(
                title='交易量 (公斤)',
                overlaying='y',
                side='right'
            ),
            hovermode='x unified'
        )
        return fig
    
    def export_to_excel(self, crop_name, filename):
        """匯出資料到Excel"""
        crop_data = self.data[self.data['作物名稱'] == crop_name].copy()
        
        # 創建Excel寫入器
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            # 匯出原始資料
            crop_data.to_excel(writer, sheet_name='原始資料', index=False)
            
            # 匯出每日統計
            daily_stats = crop_data.groupby('日期').agg({
                '平均價': ['mean', 'min', 'max', 'std'],
                '交易量': ['sum', 'mean']
            }).round(2)
            daily_stats.to_excel(writer, sheet_name='每日統計')
            
            # 匯出月度統計
            monthly_stats = crop_data.groupby('月份').agg({
                '平均價': ['mean', 'min', 'max', 'std'],
                '交易量': ['sum', 'mean']
            }).round(2)
            monthly_stats.to_excel(writer, sheet_name='月度統計')
            
            # 匯出市場統計
            market_stats = crop_data.groupby('市場名稱').agg({
                '平均價': ['mean', 'min', 'max', 'std'],
                '交易量': ['sum', 'mean']
            }).round(2)
            market_stats.to_excel(writer, sheet_name='市場統計')
    
    def export_to_csv(self, crop_name, filename):
        """匯出資料到CSV"""
        crop_data = self.data[self.data['作物名稱'] == crop_name]
        crop_data.to_csv(filename, index=False, encoding='utf-8-sig')
    
    def save_plot_as_image(self, fig, filename):
        """儲存圖表為圖片"""
        fig.write_image(filename) 