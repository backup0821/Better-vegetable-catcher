import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
import plotly.express as px
from datetime import datetime

class AdvancedVisualizer:
    def __init__(self, data):
        self.data = data if isinstance(data, pd.DataFrame) else pd.DataFrame(data)

    def create_interactive_price_trend(self, crop_name):
        """創建互動式價格趨勢圖"""
        try:
            # 篩選特定作物的資料
            df = self.data[self.data['作物名稱'] == crop_name].copy()
            
            # 轉換日期格式
            def convert_tw_date(date_str):
                try:
                    year, month, day = map(int, date_str.split('.'))
                    year += 1911  # 民國年轉西元年
                    return f"{year}/{month:02d}/{day:02d}"
                except:
                    return date_str

            df['交易日期'] = df['交易日期'].apply(convert_tw_date)
            df['交易日期'] = pd.to_datetime(df['交易日期'])
            df = df.sort_values('交易日期')
            
            # 計算移動平均
            df['7日均價'] = df['平均價'].rolling(window=7).mean()
            df['30日均價'] = df['平均價'].rolling(window=30).mean()
            
            # 創建圖表
            fig = go.Figure()
            
            # 添加價格線
            fig.add_trace(go.Scatter(
                x=df['交易日期'],
                y=df['平均價'],
                name='每日均價',
                line=dict(color='#1f77b4'),
                hovertemplate='日期: %{x}<br>價格: %{y:.2f} 元/公斤<extra></extra>'
            ))
            
            # 添加移動平均線
            fig.add_trace(go.Scatter(
                x=df['交易日期'],
                y=df['7日均價'],
                name='7日均價',
                line=dict(color='#ff7f0e', dash='dash'),
                hovertemplate='日期: %{x}<br>7日均價: %{y:.2f} 元/公斤<extra></extra>'
            ))
            
            fig.add_trace(go.Scatter(
                x=df['交易日期'],
                y=df['30日均價'],
                name='30日均價',
                line=dict(color='#2ca02c', dash='dash'),
                hovertemplate='日期: %{x}<br>30日均價: %{y:.2f} 元/公斤<extra></extra>'
            ))
            
            # 設定圖表樣式
            fig.update_layout(
                title=f'{crop_name} 價格趨勢分析',
                xaxis_title='交易日期',
                yaxis_title='價格 (元/公斤)',
                hovermode='x unified',
                template='plotly_white',
                showlegend=True,
                legend=dict(
                    yanchor="top",
                    y=0.99,
                    xanchor="left",
                    x=0.01
                )
            )
            
            # 添加範圍選擇器
            fig.update_xaxes(rangeslider_visible=True)
            
            return fig
            
        except Exception as e:
            raise Exception(f"創建價格趨勢圖時發生錯誤：{str(e)}")

    def create_market_distribution(self, crop_name):
        """建立市場分布圖"""
        df = self.data[self.data['作物名稱'] == crop_name].copy()
        
        # 計算每個市場的總交易量
        market_volume = df.groupby('市場名稱')['交易量'].sum().sort_values(ascending=True)

        # 建立圖表
        fig = go.Figure()

        fig.add_trace(
            go.Bar(
                y=market_volume.index,
                x=market_volume.values,
                orientation='h',
                marker_color='#1f77b4',
                hovertemplate='市場: %{y}<br>總交易量: %{x:.0f}公斨<extra></extra>'
            )
        )

        fig.update_layout(
            title=f'{crop_name}各市場交易量分布',
            xaxis_title='交易量 (公斤)',
            yaxis_title='市場名稱',
            height=600,
            showlegend=False,
            hovermode='closest'
        )

        return fig

    def create_price_distribution(self, crop_name):
        """建立價格分布圖"""
        df = self.data[self.data['作物名稱'] == crop_name].copy()

        fig = go.Figure()

        fig.add_trace(
            go.Histogram(
                x=df['平均價'],
                nbinsx=30,
                name='價格分布',
                marker_color='#1f77b4',
                hovertemplate='價格區間: %{x:.2f}元/公斨<br>次數: %{y}<extra></extra>'
            )
        )

        fig.update_layout(
            title=f'{crop_name}價格分布',
            xaxis_title='價格 (元/公斨)',
            yaxis_title='次數',
            showlegend=False,
            hovermode='x'
        )

        return fig
