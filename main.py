import requests
import pandas as pd
import numpy as np
from datetime import datetime
import tkinter as tk
from tkinter import ttk, filedialog
from ttkthemes import ThemedTk
from tkinter import messagebox
import time
import os
from analysis_utils import DataAnalyzer
import webbrowser

class FarmDataApp:
    def __init__(self, root):
        self.root = root
        self.root.title("農產品交易資料分析")
        self.root.geometry("1200x800")
        
        # 初始化資料
        self.data = None
        self.crop_list = []
        self.analyzer = None
        self.market_regions = {
            '北部': ['台北一', '台北二', '三重', '板橋', '桃園', '新竹'],
            '中部': ['台中', '豐原', '南投', '彰化'],
            '南部': ['高雄', '鳳山', '屏東', '台南'],
            '東部': ['宜蘭', '花蓮', '台東']
        }
        
        # 建立介面
        self.create_widgets()
        
        # 建立輸出目錄
        self.output_dir = "output"
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 載入資料
        self.load_data()
    
    def create_widgets(self):
        try:
            # 建立主框架
            main_frame = ttk.Frame(self.root, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # 控制區域
            control_frame = ttk.LabelFrame(main_frame, text="控制選項", padding="10")
            control_frame.pack(fill=tk.X, pady=5)
            
            # 第一行：作物選擇和計算方式
            row1_frame = ttk.Frame(control_frame)
            row1_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(row1_frame, text="選擇作物：").pack(side=tk.LEFT, padx=5)
            self.crop_var = tk.StringVar()
            self.crop_combo = ttk.Combobox(row1_frame, textvariable=self.crop_var, state="readonly", width=20)
            self.crop_combo.pack(side=tk.LEFT, padx=5)
            
            ttk.Label(row1_frame, text="計算方式：").pack(side=tk.LEFT, padx=5)
            self.calc_method_var = tk.StringVar(value="加權平均")
            calc_methods = ["加權平均", "簡單平均", "分區統計"]
            self.calc_method_combo = ttk.Combobox(row1_frame, textvariable=self.calc_method_var, 
                                                values=calc_methods, state="readonly", width=15)
            self.calc_method_combo.pack(side=tk.LEFT, padx=5)
            
            # 第二行：功能按鈕
            button_frame = ttk.Frame(control_frame)
            button_frame.pack(fill=tk.X, pady=5)
            
            # 資料相關按鈕
            ttk.Button(button_frame, text="重新載入資料", command=self.reload_data).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="匯出Excel", command=self.export_excel).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="匯出CSV", command=self.export_csv).pack(side=tk.LEFT, padx=5)
            
            # 圖表相關按鈕
            ttk.Button(button_frame, text="價格趨勢圖", command=self.show_price_trend).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="交易量分布", command=self.show_volume_distribution).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="價格分布", command=self.show_price_distribution).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="季節性分析", command=self.show_seasonal_analysis).pack(side=tk.LEFT, padx=5)
            
            # 分析相關按鈕
            ttk.Button(button_frame, text="相似作物分析", command=self.show_similar_crops).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="價格預測", command=self.show_price_prediction).pack(side=tk.LEFT, padx=5)
            
            # 搜尋和篩選框架
            filter_frame = ttk.LabelFrame(main_frame, text="搜尋和篩選", padding="10")
            filter_frame.pack(fill=tk.X, pady=5)
            
            # 價格範圍
            price_frame = ttk.Frame(filter_frame)
            price_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(price_frame, text="價格範圍：").pack(side=tk.LEFT, padx=5)
            self.min_price_var = tk.StringVar()
            ttk.Entry(price_frame, textvariable=self.min_price_var, width=10).pack(side=tk.LEFT, padx=5)
            ttk.Label(price_frame, text="至").pack(side=tk.LEFT, padx=5)
            self.max_price_var = tk.StringVar()
            ttk.Entry(price_frame, textvariable=self.max_price_var, width=10).pack(side=tk.LEFT, padx=5)
            
            # 交易量範圍
            volume_frame = ttk.Frame(filter_frame)
            volume_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(volume_frame, text="交易量範圍：").pack(side=tk.LEFT, padx=5)
            self.min_volume_var = tk.StringVar()
            ttk.Entry(volume_frame, textvariable=self.min_volume_var, width=10).pack(side=tk.LEFT, padx=5)
            ttk.Label(volume_frame, text="至").pack(side=tk.LEFT, padx=5)
            self.max_volume_var = tk.StringVar()
            ttk.Entry(volume_frame, textvariable=self.max_volume_var, width=10).pack(side=tk.LEFT, padx=5)
            
            ttk.Button(volume_frame, text="應用篩選", command=self.apply_filters).pack(side=tk.LEFT, padx=5)
            ttk.Button(volume_frame, text="重置篩選", command=self.reset_filters).pack(side=tk.LEFT, padx=5)
            
            # 顯示區域
            display_frame = ttk.LabelFrame(main_frame, text="統計結果", padding="10")
            display_frame.pack(fill=tk.BOTH, expand=True, pady=5)
            
            # 建立文字區域和滾動條的框架
            text_frame = ttk.Frame(display_frame)
            text_frame.pack(fill=tk.BOTH, expand=True)
            
            # 滾動條
            scrollbar = ttk.Scrollbar(text_frame)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            
            # 文字區域
            self.text_area = tk.Text(text_frame, wrap=tk.WORD, font=("微軟正黑體", 10),
                                   yscrollcommand=scrollbar.set)
            self.text_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            
            # 設定滾動條
            scrollbar.config(command=self.text_area.yview)
            
            # 狀態列
            self.status_var = tk.StringVar(value="就緒")
            status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
            status_bar.pack(fill=tk.X, side=tk.BOTTOM, pady=5)
            
            # 綁定事件
            self.crop_combo.bind("<<ComboboxSelected>>", self.update_display)
            self.calc_method_combo.bind("<<ComboboxSelected>>", self.update_display)
            
        except Exception as e:
            messagebox.showerror("錯誤", f"建立介面時發生錯誤：{str(e)}")
    
    def reload_data(self):
        """重新載入資料"""
        try:
            self.status_var.set("正在重新載入資料...")
            self.root.update()
            self.load_data()
        except Exception as e:
            self.status_var.set(f"重新載入資料時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"重新載入資料時發生錯誤：{str(e)}")
    
    def load_data(self):
        """載入資料並更新介面"""
        try:
            self.data = self.fetch_data()
            if self.data and isinstance(self.data, list) and len(self.data) > 0:
                # 初始化分析器
                self.analyzer = DataAnalyzer(self.data)
                
                # 更新作物列表
                self.crop_list = sorted(self.analyzer.data['作物名稱'].unique().tolist())
                if self.crop_list:
                    self.crop_combo['values'] = self.crop_list
                    self.crop_combo.set(self.crop_list[0])
                    self.update_display()
                    self.status_var.set("資料載入成功")
                else:
                    self.status_var.set("沒有有效的作物資料")
                    messagebox.showwarning("警告", "沒有有效的作物資料")
            else:
                self.status_var.set("沒有可用的資料")
                messagebox.showerror("錯誤", "沒有可用的資料")
        except Exception as e:
            self.status_var.set(f"載入資料時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"載入資料時發生錯誤：{str(e)}")
    
    def fetch_data(self, max_retries=3):
        """從農產品交易資料平台下載資料，加入重試機制"""
        url = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx"
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if isinstance(data, list) and len(data) > 0:
                    return data
                else:
                    last_error = ValueError("回傳的資料格式不正確")
                    
            except requests.exceptions.RequestException as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                    
            except ValueError as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                    
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
        
        raise Exception(f"下載資料失敗: {str(last_error)}")
    
    def get_market_region(self, market_name):
        """根據市場名稱判斷所屬區域"""
        if not isinstance(market_name, str):
            return "其他"
            
        for region, markets in self.market_regions.items():
            if any(market in market_name for market in markets):
                return region
        return "其他"
    
    def process_data(self, crop_name, calc_method):
        """處理資料並計算統計值"""
        try:
            if not self.analyzer or not isinstance(self.analyzer.data, pd.DataFrame) or len(self.analyzer.data) == 0:
                return None
            
            # 使用已經處理過的資料
            df = self.analyzer.data
            
            # 篩選特定作物
            df = df[df['作物名稱'] == crop_name]
            
            if len(df) == 0:
                return None
            
            if calc_method == "加權平均":
                # 計算加權平均價格（以交易量為權重）
                total_volume = df['交易量'].sum()
                if total_volume > 0:
                    weighted_avg_price = (df['平均價'] * df['交易量']).sum() / total_volume
                else:
                    weighted_avg_price = 0
                
                result = {
                    '平均價': {
                        '加權平均': weighted_avg_price,
                        '簡單平均': df['平均價'].mean(),
                        '最低': df['平均價'].min(),
                        '最高': df['平均價'].max(),
                        '標準差': df['平均價'].std()
                    },
                    '交易量': {
                        '總量': total_volume,
                        '平均': df['交易量'].mean(),
                        '最低': df['交易量'].min(),
                        '最高': df['交易量'].max()
                    }
                }
                
            elif calc_method == "簡單平均":
                result = {
                    '平均價': {
                        '平均': df['平均價'].mean(),
                        '最低': df['平均價'].min(),
                        '最高': df['平均價'].max(),
                        '標準差': df['平均價'].std()
                    },
                    '交易量': {
                        '總量': df['交易量'].sum(),
                        '平均': df['交易量'].mean(),
                        '最低': df['交易量'].min(),
                        '最高': df['交易量'].max()
                    }
                }
                
            else:  # 分區統計
                # 添加區域資訊
                df['區域'] = df['市場名稱'].apply(self.get_market_region)
                
                # 計算各區域統計值
                region_stats = {}
                for region in sorted(df['區域'].unique()):
                    region_df = df[df['區域'] == region]
                    if len(region_df) > 0:
                        region_stats[region] = {
                            '平均價': {
                                '平均': region_df['平均價'].mean(),
                                '最低': region_df['平均價'].min(),
                                '最高': region_df['平均價'].max(),
                                '標準差': region_df['平均價'].std()
                            },
                            '交易量': {
                                '總量': region_df['交易量'].sum(),
                                '平均': region_df['交易量'].mean(),
                                '最低': region_df['交易量'].min(),
                                '最高': region_df['交易量'].max()
                            }
                        }
                
                result = {'分區統計': region_stats}
            
            return result
            
        except Exception as e:
            self.status_var.set(f"處理資料時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"處理資料時發生錯誤：{str(e)}")
            return None
    
    def update_display(self, event=None):
        """更新顯示結果"""
        try:
            crop_name = self.crop_var.get()
            calc_method = self.calc_method_var.get()
            
            if not crop_name or not self.analyzer:
                self.text_area.delete(1.0, tk.END)
                self.text_area.insert(tk.END, "請選擇作物")
                return
            
            # 獲取原始資料
            crop_data = self.analyzer.data[self.analyzer.data['作物名稱'] == crop_name]
            
            if len(crop_data) == 0:
                self.text_area.delete(1.0, tk.END)
                self.text_area.insert(tk.END, "沒有可顯示的資料")
                return
            
            # 清除現有內容
            self.text_area.delete(1.0, tk.END)
            
            # 顯示基本資訊
            self.text_area.insert(tk.END, f"作物：{crop_name}\n")
            self.text_area.insert(tk.END, f"計算方式：{calc_method}\n")
            self.text_area.insert(tk.END, f"資料筆數：{len(crop_data)}\n")
            self.text_area.insert(tk.END, "=" * 50 + "\n\n")
            
            if calc_method == "分區統計":
                # 添加區域資訊
                crop_data['區域'] = crop_data['市場名稱'].apply(self.analyzer.get_market_region)
                
                # 計算各區域統計值
                for region in sorted(crop_data['區域'].unique()):
                    region_data = crop_data[crop_data['區域'] == region]
                    
                    self.text_area.insert(tk.END, f"\n{region}區域統計：\n")
                    self.text_area.insert(tk.END, "-" * 30 + "\n")
                    
                    self.text_area.insert(tk.END, "平均價格統計：\n")
                    self.text_area.insert(tk.END, f"  平均：{region_data['平均價'].mean():.2f} 元/公斤\n")
                    self.text_area.insert(tk.END, f"  最低：{region_data['平均價'].min():.2f} 元/公斤\n")
                    self.text_area.insert(tk.END, f"  最高：{region_data['平均價'].max():.2f} 元/公斤\n")
                    self.text_area.insert(tk.END, f"  標準差：{region_data['平均價'].std():.2f} 元/公斤\n\n")
                    
                    self.text_area.insert(tk.END, "交易量統計：\n")
                    self.text_area.insert(tk.END, f"  總量：{region_data['交易量'].sum():.2f} 公斤\n")
                    self.text_area.insert(tk.END, f"  平均：{region_data['交易量'].mean():.2f} 公斤\n")
                    self.text_area.insert(tk.END, f"  最低：{region_data['交易量'].min():.2f} 公斤\n")
                    self.text_area.insert(tk.END, f"  最高：{region_data['交易量'].max():.2f} 公斤\n\n")
            
            else:
                # 計算加權平均價格
                if calc_method == "加權平均":
                    total_volume = crop_data['交易量'].sum()
                    weighted_avg = (crop_data['平均價'] * crop_data['交易量']).sum() / total_volume
                    self.text_area.insert(tk.END, f"加權平均價格：{weighted_avg:.2f} 元/公斤\n")
                
                # 顯示一般統計資訊
                self.text_area.insert(tk.END, "\n價格統計：\n")
                self.text_area.insert(tk.END, f"  平均：{crop_data['平均價'].mean():.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  最低：{crop_data['平均價'].min():.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  最高：{crop_data['平均價'].max():.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  標準差：{crop_data['平均價'].std():.2f} 元/公斤\n\n")
                
                self.text_area.insert(tk.END, "交易量統計：\n")
                self.text_area.insert(tk.END, f"  總量：{crop_data['交易量'].sum():.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  平均：{crop_data['交易量'].mean():.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  最低：{crop_data['交易量'].min():.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  最高：{crop_data['交易量'].max():.2f} 公斤\n")
            
        except Exception as e:
            self.status_var.set(f"更新顯示時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"更新顯示時發生錯誤：{str(e)}")
    
    def apply_filters(self):
        """應用價格和交易量篩選"""
        try:
            if not self.analyzer:
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                return
            
            # 獲取篩選條件
            min_price = float(self.min_price_var.get()) if self.min_price_var.get() else None
            max_price = float(self.max_price_var.get()) if self.max_price_var.get() else None
            min_volume = float(self.min_volume_var.get()) if self.min_volume_var.get() else None
            max_volume = float(self.max_volume_var.get()) if self.max_volume_var.get() else None
            
            # 篩選資料
            filtered_data = self.analyzer.data[self.analyzer.data['作物名稱'] == crop_name].copy()
            
            if min_price is not None:
                filtered_data = filtered_data[filtered_data['平均價'] >= min_price]
            if max_price is not None:
                filtered_data = filtered_data[filtered_data['平均價'] <= max_price]
            if min_volume is not None:
                filtered_data = filtered_data[filtered_data['交易量'] >= min_volume]
            if max_volume is not None:
                filtered_data = filtered_data[filtered_data['交易量'] <= max_volume]
            
            # 顯示篩選結果
            self.text_area.delete(1.0, tk.END)
            self.text_area.insert(tk.END, f"篩選結果：\n")
            self.text_area.insert(tk.END, f"符合條件的資料筆數：{len(filtered_data)}\n\n")
            
            if len(filtered_data) > 0:
                # 計算統計值
                stats = filtered_data.agg({
                    '平均價': ['mean', 'min', 'max', 'std'],
                    '交易量': ['sum', 'mean', 'min', 'max']
                }).round(2)
                
                self.text_area.insert(tk.END, "價格統計：\n")
                self.text_area.insert(tk.END, f"  平均：{stats['平均價']['mean']:.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  最低：{stats['平均價']['min']:.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  最高：{stats['平均價']['max']:.2f} 元/公斤\n")
                self.text_area.insert(tk.END, f"  標準差：{stats['平均價']['std']:.2f} 元/公斤\n\n")
                
                self.text_area.insert(tk.END, "交易量統計：\n")
                self.text_area.insert(tk.END, f"  總量：{stats['交易量']['sum']:.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  平均：{stats['交易量']['mean']:.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  最低：{stats['交易量']['min']:.2f} 公斤\n")
                self.text_area.insert(tk.END, f"  最高：{stats['交易量']['max']:.2f} 公斤\n")
            
            self.status_var.set("篩選完成")
            
        except ValueError as e:
            messagebox.showerror("錯誤", "請輸入有效的數值")
        except Exception as e:
            messagebox.showerror("錯誤", f"篩選資料時發生錯誤：{str(e)}")
    
    def reset_filters(self):
        """重置篩選條件"""
        self.min_price_var.set("")
        self.max_price_var.set("")
        self.min_volume_var.set("")
        self.max_volume_var.set("")
        self.update_display()
    
    def export_excel(self):
        """匯出資料到Excel"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            filename = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel files", "*.xlsx")],
                initialdir=self.output_dir,
                initialfile=f"{crop_name}_分析報告.xlsx"
            )
            
            if filename:
                self.analyzer.export_to_excel(crop_name, filename)
                self.status_var.set(f"資料已匯出至 {filename}")
                messagebox.showinfo("成功", "資料匯出完成")
                
        except Exception as e:
            messagebox.showerror("錯誤", f"匯出Excel時發生錯誤：{str(e)}")
    
    def export_csv(self):
        """匯出資料到CSV"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            filename = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV files", "*.csv")],
                initialdir=self.output_dir,
                initialfile=f"{crop_name}_資料.csv"
            )
            
            if filename:
                self.analyzer.export_to_csv(crop_name, filename)
                self.status_var.set(f"資料已匯出至 {filename}")
                messagebox.showinfo("成功", "資料匯出完成")
                
        except Exception as e:
            messagebox.showerror("錯誤", f"匯出CSV時發生錯誤：{str(e)}")
    
    def show_price_trend(self):
        """顯示價格趨勢圖"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 生成圖表
            fig = self.analyzer.create_price_trend_plot(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_價格趨勢.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示價格趨勢圖")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示價格趨勢圖時發生錯誤：{str(e)}")
    
    def show_volume_distribution(self):
        """顯示交易量分布圖"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 生成圖表
            fig = self.analyzer.create_volume_pie_chart(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_交易量分布.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示交易量分布圖")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示交易量分布圖時發生錯誤：{str(e)}")
    
    def show_price_distribution(self):
        """顯示價格分布圖"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 生成圖表
            fig = self.analyzer.create_price_distribution_plot(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_價格分布.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示價格分布圖")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示價格分布圖時發生錯誤：{str(e)}")
    
    def show_seasonal_analysis(self):
        """顯示季節性分析圖"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 生成圖表
            fig = self.analyzer.create_seasonal_plot(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_季節性分析.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示季節性分析圖")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示季節性分析圖時發生錯誤：{str(e)}")
    
    def show_similar_crops(self):
        """顯示相似作物分析"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 獲取相似作物
            similar_crops = self.analyzer.get_similar_crops(crop_name)
            
            # 顯示結果
            self.text_area.delete(1.0, tk.END)
            self.text_area.insert(tk.END, f"與 {crop_name} 價格變動模式最相似的作物：\n\n")
            
            for crop, correlation in similar_crops:
                self.text_area.insert(tk.END, f"{crop}: 相關係數 = {correlation:.4f}\n")
            
            self.status_var.set("已顯示相似作物分析")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"分析相似作物時發生錯誤：{str(e)}")
    
    def show_price_prediction(self):
        """顯示價格預測"""
        try:
            if not self.analyzer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 獲取預測結果
            predictions = self.analyzer.predict_price(crop_name)
            
            # 顯示結果
            self.text_area.delete(1.0, tk.END)
            self.text_area.insert(tk.END, f"{crop_name} 未來7天價格預測：\n\n")
            
            for _, row in predictions.iterrows():
                date_str = row['日期'].strftime('%Y-%m-%d')
                self.text_area.insert(tk.END, f"{date_str}: {row['預測價格']:.2f} 元/公斤\n")
            
            self.status_var.set("已顯示價格預測")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"預測價格時發生錯誤：{str(e)}")

def main():
    try:
        root = ThemedTk(theme="arc")
        app = FarmDataApp(root)
        root.mainloop()
    except Exception as e:
        messagebox.showerror("錯誤", f"程式啟動時發生錯誤：{str(e)}")

if __name__ == "__main__":
    main() 