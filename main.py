# V1.2
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
        self.root.title("農產品交易資料分析 v1.2")
        self.root.geometry("1200x800")
        
        # 設定主題和樣式
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # 自定義樣式
        self.style.configure('TLabel', font=('微軟正黑體', 10))
        self.style.configure('TButton', font=('微軟正黑體', 10))
        self.style.configure('TEntry', font=('微軟正黑體', 10))
        self.style.configure('TCombobox', font=('微軟正黑體', 10))
        self.style.configure('Treeview', font=('微軟正黑體', 10))
        
        # 初始化資料
        self.data = None
        self.crop_list = []
        self.filtered_crop_list = []
        self.analyzer = None
        self.cache = {}  # 新增快取機制
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
            
            # 控制區域 - 使用漸層背景
            control_frame = ttk.LabelFrame(main_frame, text="控制選項", padding="10")
            control_frame.pack(fill=tk.X, pady=5)
            
            # 第一行：搜尋框和作物選擇
            row1_frame = ttk.Frame(control_frame)
            row1_frame.pack(fill=tk.X, pady=5)
            
            # 美化搜尋框
            search_label = ttk.Label(row1_frame, text="搜尋作物：")
            search_label.pack(side=tk.LEFT, padx=5)
            self.search_var = tk.StringVar()
            self.search_entry = ttk.Entry(row1_frame, textvariable=self.search_var, 
                                        width=15, style='Search.TEntry')
            self.search_entry.pack(side=tk.LEFT, padx=5)
            self.search_var.trace('w', self.filter_crops)
            
            # 美化下拉選單
            ttk.Label(row1_frame, text="選擇作物：").pack(side=tk.LEFT, padx=5)
            self.crop_var = tk.StringVar()
            self.crop_combo = ttk.Combobox(row1_frame, textvariable=self.crop_var, 
                                         state="readonly", width=20)
            self.crop_combo.pack(side=tk.LEFT, padx=5)
            
            ttk.Label(row1_frame, text="計算方式：").pack(side=tk.LEFT, padx=5)
            self.calc_method_var = tk.StringVar(value="加權平均")
            calc_methods = ["加權平均", "簡單平均", "分區統計"]
            self.calc_method_combo = ttk.Combobox(row1_frame, textvariable=self.calc_method_var, 
                                                values=calc_methods, state="readonly", width=15)
            self.calc_method_combo.pack(side=tk.LEFT, padx=5)
            
            # 添加計算方式說明
            calc_method_desc = ttk.Label(row1_frame, text="(加權平均：考慮交易量 | 簡單平均：所有價格平均 | 分區統計：按區域分析)")
            calc_method_desc.pack(side=tk.LEFT, padx=5)
            
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
            self.text_area.config(state=tk.DISABLED)  # 設定為不可編輯
            
            # 設定滾動條
            scrollbar.config(command=self.text_area.yview)
            
            # 狀態列
            self.status_var = tk.StringVar(value="就緒")
            status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
            status_bar.pack(fill=tk.X, side=tk.BOTTOM, pady=5)
            
            # 綁定事件
            self.crop_combo.bind("<<ComboboxSelected>>", self.load_data_for_selected_crop)
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
        """處理資料並計算統計值，加入快取機制"""
        try:
            # 檢查快取
            cache_key = f"{crop_name}_{calc_method}"
            if cache_key in self.cache:
                return self.cache[cache_key]
            
            if not self.analyzer or not isinstance(self.analyzer.data, pd.DataFrame):
                return None
            
            # 使用已經處理過的資料
            df = self.analyzer.data
            
            # 篩選特定作物
            df = df[df['作物名稱'] == crop_name]
            
            if len(df) == 0:
                return None
            
            result = ""
            if calc_method == "加權平均":
                # 計算加權平均價格（以交易量為權重）
                total_volume = df['交易量'].sum()
                if total_volume > 0:
                    weighted_avg_price = (df['平均價'] * df['交易量']).sum() / total_volume
                    result = f"""作物：{crop_name}
計算方式：加權平均
------------------------
加權平均價格：{weighted_avg_price:.2f} 元/公斤
資料筆數：{len(df)}

價格統計：
  最低價：{df['平均價'].min():.2f} 元/公斤
  最高價：{df['平均價'].max():.2f} 元/公斤
  標準差：{df['平均價'].std():.2f} 元/公斤

交易量統計：
  總量：{df['交易量'].sum():.2f} 公斤
  平均：{df['交易量'].mean():.2f} 公斤
  最大：{df['交易量'].max():.2f} 公斤"""
            
            elif calc_method == "分區統計":
                # 計算各區域統計
                df['區域'] = df['市場名稱'].apply(self.get_market_region)
                result = f"作物：{crop_name}\n計算方式：分區統計\n"
                
                for region in sorted(df['區域'].unique()):
                    region_data = df[df['區域'] == region]
                    result += f"\n{region}區域統計：\n"
                    result += "-" * 30 + "\n"
                    result += f"平均價格：{region_data['平均價'].mean():.2f} 元/公斤\n"
                    result += f"最低價格：{region_data['平均價'].min():.2f} 元/公斤\n"
                    result += f"最高價格：{region_data['平均價'].max():.2f} 元/公斤\n"
                    result += f"交易總量：{region_data['交易量'].sum():.2f} 公斤\n"
            
            # 儲存到快取
            self.cache[cache_key] = result
            return result
            
        except Exception as e:
            self.status_var.set(f"處理資料時發生錯誤：{str(e)}")
            return None
    
    def update_display(self, event=None):
        """更新顯示區域的內容"""
        try:
            self.text_area.config(state=tk.NORMAL)  # 暫時允許編輯以更新內容
            self.text_area.delete(1.0, tk.END)
            
            crop_name = self.crop_var.get()
            calc_method = self.calc_method_var.get()
            
            if not crop_name:
                self.text_area.insert(tk.END, "請選擇作物")
                self.text_area.config(state=tk.DISABLED)  # 恢復為不可編輯
                return
            
            result = self.process_data(crop_name, calc_method)
            if result:
                self.text_area.insert(tk.END, result)
            else:
                self.text_area.insert(tk.END, "無可用資料")
            
            self.text_area.config(state=tk.DISABLED)  # 恢復為不可編輯
            
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
        """顯示價格預測結果，使用改進的預測算法"""
        try:
            crop_name = self.crop_var.get()
            if not crop_name or not self.analyzer:
                messagebox.showwarning("警告", "請先選擇作物")
                return
            
            # 獲取該作物的歷史資料
            df = self.analyzer.data[self.analyzer.data['作物名稱'] == crop_name].copy()
            if len(df) == 0:
                messagebox.showwarning("警告", "沒有足夠的資料進行預測")
                return
            
            # 轉換日期格式
            df['交易日期'] = pd.to_datetime(df['交易日期'])
            df = df.sort_values('交易日期')
            
            # 計算移動平均
            df['MA7'] = df['平均價'].rolling(window=7).mean()
            df['MA30'] = df['平均價'].rolling(window=30).mean()
            
            # 計算價格趨勢
            df['價格趨勢'] = df['MA7'].diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
            
            # 考慮季節性因素
            df['月份'] = df['交易日期'].dt.month
            monthly_avg = df.groupby('月份')['平均價'].mean()
            current_month = datetime.now().month
            seasonal_factor = monthly_avg.get(current_month, 1.0) / monthly_avg.mean()
            
            # 計算預測價格
            last_price = df['平均價'].iloc[-1]
            last_ma7 = df['MA7'].iloc[-1]
            last_ma30 = df['MA30'].iloc[-1]
            price_trend = df['價格趨勢'].iloc[-1]
            
            # 綜合多個因素進行預測
            base_prediction = (last_price * 0.4 + last_ma7 * 0.4 + last_ma30 * 0.2)
            predicted_price = base_prediction * seasonal_factor
            
            # 計算預測區間
            price_std = df['平均價'].std()
            confidence_interval = 1.96 * price_std / np.sqrt(len(df))
            
            # 更新顯示
            self.text_area.config(state=tk.NORMAL)
            self.text_area.delete(1.0, tk.END)
            
            result_text = f"""作物：{crop_name}
預測結果：
-----------------
目前價格：{last_price:.2f} 元/公斤
預測價格：{predicted_price:.2f} 元/公斤
預測區間：{(predicted_price - confidence_interval):.2f} ~ {(predicted_price + confidence_interval):.2f} 元/公斤

預測依據：
• 近期價格趨勢：{'上升' if price_trend > 0 else '下降' if price_trend < 0 else '穩定'}
• 季節性因素：{seasonal_factor:.2f}
• 7日移動平均：{last_ma7:.2f}
• 30日移動平均：{last_ma30:.2f}

註：此預測基於歷史數據分析，僅供參考。
實際價格可能受到天氣、市場供需等多種因素影響。"""
            
            self.text_area.insert(tk.END, result_text)
            self.text_area.config(state=tk.DISABLED)
            
        except Exception as e:
            self.status_var.set(f"預測價格時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"預測價格時發生錯誤：{str(e)}")
    
    def filter_crops(self, *args):
        """根據搜尋文字過濾作物列表"""
        search_text = self.search_var.get().lower()
        if not search_text:
            self.filtered_crop_list = self.crop_list
        else:
            self.filtered_crop_list = [crop for crop in self.crop_list 
                                     if search_text in crop.lower()]
        
        # 更新下拉選單
        self.crop_combo['values'] = self.filtered_crop_list
        if self.filtered_crop_list:
            if self.crop_var.get() not in self.filtered_crop_list:
                self.crop_combo.set(self.filtered_crop_list[0])
        else:
            self.crop_combo.set('')

    def clear_cache(self):
        """清除快取資料"""
        self.cache = {}

    def load_data_for_selected_crop(self, event=None):
        """根據選取的作物載入資料"""
        try:
            crop_name = self.crop_var.get()
            if not crop_name:
                self.status_var.set("請選擇作物")
                return

            self.status_var.set(f"正在載入 {crop_name} 的資料...")
            self.root.update()
            self.data = self.fetch_data_for_crop(crop_name)
            if self.data and isinstance(self.data, list) and len(self.data) > 0:
                # 初始化分析器
                self.analyzer = DataAnalyzer(self.data)
                self.update_display()
                self.status_var.set(f"{crop_name} 的資料載入成功")
            else:
                self.status_var.set(f"沒有可用的 {crop_name} 資料")
                messagebox.showwarning("警告", f"沒有可用的 {crop_name} 資料")
        except Exception as e:
            self.status_var.set(f"載入 {crop_name} 資料時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"載入 {crop_name} 資料時發生錯誤：{str(e)}")

    def fetch_data_for_crop(self, crop_name, max_retries=3):
        """從農產品交易資料平台下載特定作物的資料，加入重試機制"""
        url = f"https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?crop={crop_name}"
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

        raise Exception(f"下載 {crop_name} 資料失敗: {str(last_error)}")

def main():
    try:
        root = ThemedTk(theme="arc")
        app = FarmDataApp(root)
        root.mainloop()
    except Exception as e:
        messagebox.showerror("錯誤", f"程式啟動時發生錯誤：{str(e)}")

if __name__ == "__main__":
    main() 