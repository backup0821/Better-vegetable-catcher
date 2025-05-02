import json
import os
from datetime import datetime
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

class DataRecorder:
    def __init__(self):
        self.data_dir = "data_records"
        self.weather_file = os.path.join(self.data_dir, "weather_records.json")
        self.vegetable_file = os.path.join(self.data_dir, "vegetable_records.json")
        self.ensure_data_directory()
        self.load_data()

    def ensure_data_directory(self):
        """確保資料目錄存在"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def load_data(self):
        """載入現有的資料"""
        self.weather_data = self.load_json_file(self.weather_file)
        self.vegetable_data = self.load_json_file(self.vegetable_file)

    def load_json_file(self, file_path):
        """載入 JSON 檔案"""
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"records": []}

    def save_json_file(self, file_path, data):
        """儲存 JSON 檔案"""
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def record_weather(self, city, district, temperature, humidity, weather):
        """記錄天氣資料"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "timestamp": timestamp,
            "city": city,
            "district": district,
            "temperature": temperature,
            "humidity": humidity,
            "weather": weather
        }
        
        self.weather_data["records"].append(record)
        self.save_json_file(self.weather_file, self.weather_data)
        
        # 更新城市平均資料
        self.update_city_averages(city)

    def update_city_averages(self, city):
        """更新城市的平均天氣資料"""
        city_records = [r for r in self.weather_data["records"] if r["city"] == city]
        
        if not city_records:
            return
            
        # 計算平均溫度
        avg_temp = sum(float(r["temperature"]) for r in city_records) / len(city_records)
        # 計算平均濕度
        avg_humidity = sum(float(r["humidity"]) for r in city_records) / len(city_records)
        
        # 更新或新增城市平均資料
        if "city_averages" not in self.weather_data:
            self.weather_data["city_averages"] = {}
            
        self.weather_data["city_averages"][city] = {
            "average_temperature": round(avg_temp, 2),
            "average_humidity": round(avg_humidity, 2),
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "record_count": len(city_records)
        }
        
        self.save_json_file(self.weather_file, self.weather_data)

    def record_vegetable(self, crop_name, price, volume, market):
        """記錄果菜資料"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record = {
            "timestamp": timestamp,
            "crop_name": crop_name,
            "price": price,
            "volume": volume,
            "market": market
        }
        
        self.vegetable_data["records"].append(record)
        self.save_json_file(self.vegetable_file, self.vegetable_data)

    def create_weather_chart(self, output_path):
        """建立天氣資料圖表"""
        if not self.weather_data["records"]:
            return None
            
        # 建立子圖表
        fig = make_subplots(rows=2, cols=1, subplot_titles=("溫度變化", "濕度變化"))
        
        # 準備資料
        df = pd.DataFrame(self.weather_data["records"])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['temperature'] = pd.to_numeric(df['temperature'])
        df['humidity'] = pd.to_numeric(df['humidity'])
        
        # 按城市分組
        for city in df['city'].unique():
            city_data = df[df['city'] == city]
            
            # 添加溫度線
            fig.add_trace(
                go.Scatter(
                    x=city_data['timestamp'],
                    y=city_data['temperature'],
                    name=f"{city} 溫度",
                    mode='lines+markers'
                ),
                row=1, col=1
            )
            
            # 添加濕度線
            fig.add_trace(
                go.Scatter(
                    x=city_data['timestamp'],
                    y=city_data['humidity'],
                    name=f"{city} 濕度",
                    mode='lines+markers'
                ),
                row=2, col=1
            )
        
        # 更新布局
        fig.update_layout(
            title="天氣資料趨勢圖",
            height=800,
            showlegend=True
        )
        
        # 儲存圖表
        fig.write_html(output_path)
        return output_path

    def create_vegetable_chart(self, output_path):
        """建立果菜資料圖表"""
        if not self.vegetable_data["records"]:
            return None
            
        # 建立子圖表
        fig = make_subplots(rows=2, cols=1, subplot_titles=("價格變化", "交易量變化"))
        
        # 準備資料
        df = pd.DataFrame(self.vegetable_data["records"])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['price'] = pd.to_numeric(df['price'])
        df['volume'] = pd.to_numeric(df['volume'])
        
        # 按作物分組
        for crop in df['crop_name'].unique():
            crop_data = df[df['crop_name'] == crop]
            
            # 添加價格線
            fig.add_trace(
                go.Scatter(
                    x=crop_data['timestamp'],
                    y=crop_data['price'],
                    name=f"{crop} 價格",
                    mode='lines+markers'
                ),
                row=1, col=1
            )
            
            # 添加交易量線
            fig.add_trace(
                go.Scatter(
                    x=crop_data['timestamp'],
                    y=crop_data['volume'],
                    name=f"{crop} 交易量",
                    mode='lines+markers'
                ),
                row=2, col=1
            )
        
        # 更新布局
        fig.update_layout(
            title="果菜交易資料趨勢圖",
            height=800,
            showlegend=True
        )
        
        # 儲存圖表
        fig.write_html(output_path)
        return output_path 