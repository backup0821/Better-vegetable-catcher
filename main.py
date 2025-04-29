# v2.2 (2.2 - RELEASE-VERSION)
import sys
import requests
import pandas as pd
import numpy as np
from datetime import datetime
import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext
from ttkthemes import ThemedTk
from tkinter import messagebox
import time
import os
from analysis_utils import DataAnalyzer
import webbrowser
import pyperclip
import re
from packaging import version
import json
from price_alert import PriceAlertSystem
from advanced_visualization import AdvancedVisualizer
from token_manager import TokenManager

# 版本資訊
CURRENT_VERSION = "2.2"
CURRENT_BUILD = "2.2 - RELEASE-VERSION"
GITHUB_REPO = "backup0821/Better-vegetable-catcher"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
GITHUB_RELEASES_URL = f"https://github.com/{GITHUB_REPO}/releases"
GITHUB_REPO_URL = f"https://github.com/{GITHUB_REPO}"

# 檢查必要套件
try:
    from ttkthemes import ThemedTk
except ImportError:
    print("錯誤：缺少 ttkthemes 套件")
    print("請執行：pip install ttkthemes")
    sys.exit(1)

try:
    from analysis_utils import DataAnalyzer
except ImportError:
    print("錯誤：缺少 analysis_utils.py 檔案")
    sys.exit(1)

# 連接本地 Ollama API
OLLAMA_API_URL = "http://26.64.105.58:11434/api/generate"
MODEL_NAME = "gemma3:1b"

class FarmDataApp:
    def __init__(self, root):
        try:
            self.root = root
            self.root.title(f"農產品交易資料分析 v{CURRENT_VERSION}({CURRENT_BUILD})")
            self.root.geometry("1200x800")
            
            # 初始化重要變數
            self.status_var = tk.StringVar(value="系統就緒")
            self.filter_crops = []
            self.token_manager = TokenManager()
            self.current_token = None
            
            # 確保視窗大小合適
            screen_width = self.root.winfo_screenwidth()
            screen_height = self.root.winfo_screenheight()
            if screen_width < 1200 or screen_height < 800:
                self.root.geometry("1024x768")  # 使用較小的預設大小
            
            # 設定主題和樣式
            self.style = ttk.Style()
            self.style.theme_use('clam')  # 使用較穩定的主題
            
            # 基本樣式設定
            self.setup_styles()
            
            # 初始化資料結構
            self.initialize_data()
            
            # 建立介面
            self.create_widgets()
            
            # 建立輸出目錄
            self.setup_output_directory()
            
            # 載入資料
            self.load_data()
            
            # 檢查更新
            self.check_for_updates()
            
            self.alert_system = PriceAlertSystem()
            self.visualizer = None  # 將在載入資料時初始化
            
            # 檢查開發者通知
            self.check_dev_notifications()
            
        except Exception as e:
            messagebox.showerror("初始化錯誤", f"程式初始化時發生錯誤：\n{str(e)}")
            raise
    
    def setup_styles(self):
        """設定介面樣式"""
        try:
            # 基本字型設定
            default_font = ('微軟正黑體', 11)
            
            # 設定各種元件的樣式
            self.style.configure('TLabel', font=default_font)
            self.style.configure('TButton', font=default_font, padding=5)
            self.style.configure('TEntry', font=default_font)
            self.style.configure('TCombobox', font=default_font)
            self.style.configure('Treeview', font=default_font)
            self.style.configure('Title.TLabel', font=('微軟正黑體', 14, 'bold'))
            self.style.configure('Subtitle.TLabel', font=('微軟正黑體', 12))
            
            # 設定顏色
            self.style.configure('TFrame', background='#f0f0f0')
            self.style.configure('TLabelframe', background='#f0f0f0')
            
            # 按鈕樣式
            self.style.configure('TButton', background='#4a90e2', foreground='black')
            self.style.map('TButton',
                          background=[('active', '#357abd')],
                          foreground=[('active', 'black')])
                          
        except Exception as e:
            messagebox.showerror("樣式設定錯誤", f"設定介面樣式時發生錯誤：\n{str(e)}")
            raise
    
    def initialize_data(self):
        """初始化資料結構"""
        try:
            self.data = None
            self.crop_list = []
            self.filtered_crop_list = []
            self.analyzer = None
            self.cache = {}
            self.market_regions = {
                '北部': ['台北一', '台北二', '三重', '板橋', '桃園', '新竹'],
                '中部': ['台中', '豐原', '南投', '彰化'],
                '南部': ['高雄', '鳳山', '屏東', '台南'],
                '東部': ['宜蘭', '花蓮', '台東']
            }
        except Exception as e:
            messagebox.showerror("資料初始化錯誤", f"初始化資料結構時發生錯誤：\n{str(e)}")
            raise
    
    def setup_output_directory(self):
        """設定輸出目錄"""
        try:
            self.output_dir = "output"
            os.makedirs(self.output_dir, exist_ok=True)
        except Exception as e:
            messagebox.showerror("目錄建立錯誤", f"建立輸出目錄時發生錯誤：\n{str(e)}")
            raise
    
    def create_widgets(self):
        try:
            # 主標題
            title_frame = ttk.Frame(self.root)
            title_frame.pack(fill=tk.X, pady=10)
            
            title_label = ttk.Label(title_frame, text="農產品交易資料分析系統", style='Title.TLabel')
            title_label.pack()
            
            subtitle_label = ttk.Label(title_frame, 
                text="快速查詢與分析農產品價格趨勢，協助您做出更好的交易決策", 
                style='Subtitle.TLabel')
            subtitle_label.pack(pady=5)
            
            # 版本資訊和更新按鈕
            version_frame = ttk.Frame(title_frame)
            version_frame.pack(pady=5)
            
            version_label = ttk.Label(version_frame, 
                text=f"版本：v{CURRENT_VERSION}({CURRENT_BUILD})", 
                style='Subtitle.TLabel')
            version_label.pack(side=tk.LEFT, padx=5)
            
            ttk.Button(version_frame, 
                      text="檢查更新", 
                      command=self.check_for_updates).pack(side=tk.LEFT, padx=5)
            ttk.Button(version_frame, 
                      text="更新歷史", 
                      command=self.show_update_history).pack(side=tk.LEFT, padx=5)
            
            # 建立主框架
            main_frame = ttk.Frame(self.root, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # 左側控制面板（新增滾動功能）
            left_frame = ttk.Frame(main_frame)
            left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)
            
            # 建立 Canvas 和 Scrollbar
            canvas = tk.Canvas(left_frame, width=250)
            scrollbar = ttk.Scrollbar(left_frame, orient="vertical", command=canvas.yview)
            control_frame = ttk.Frame(canvas)
            
            # 配置滾動
            canvas.configure(yscrollcommand=scrollbar.set)
            
            # 打包元件
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            
            # 在 Canvas 中建立視窗
            canvas_frame = canvas.create_window((0, 0), window=control_frame, anchor="nw", width=canvas.winfo_width())
            
            # 更新 Canvas 滾動區域
            def _configure_canvas(event):
                canvas.configure(scrollregion=canvas.bbox("all"))
                # 更新 control_frame 的寬度以符合 canvas
                canvas.itemconfig(canvas_frame, width=canvas.winfo_width())
            
            # 綁定事件
            control_frame.bind("<Configure>", _configure_canvas)
            canvas.bind("<Configure>", lambda e: canvas.itemconfig(canvas_frame, width=canvas.winfo_width()))
            
            # 綁定滑鼠滾輪事件
            def _on_mousewheel(event):
                canvas.yview_scroll(int(-1*(event.delta/120)), "units")
            canvas.bind_all("<MouseWheel>", _on_mousewheel)
            
            # 搜尋和選擇區域
            search_frame = ttk.LabelFrame(control_frame, text="作物選擇", padding="10")
            search_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(search_frame, text="🔍 搜尋作物：").pack(anchor=tk.W, pady=2)
            self.search_var = tk.StringVar()
            self.search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=20)
            self.search_entry.pack(fill=tk.X, pady=2)
            self.search_var.trace('w', self.filter_crops_list)
            
            ttk.Label(search_frame, text="📋 選擇作物：").pack(anchor=tk.W, pady=2)
            self.crop_var = tk.StringVar()
            self.crop_combo = ttk.Combobox(search_frame, textvariable=self.crop_var, 
                                         state="readonly", width=20)
            self.crop_combo.pack(fill=tk.X, pady=2)
            
            # 分析方式選擇
            analysis_frame = ttk.LabelFrame(control_frame, text="分析設定", padding="10")
            analysis_frame.pack(fill=tk.X, pady=5)
            
            ttk.Label(analysis_frame, text="📊 計算方式：").pack(anchor=tk.W, pady=2)
            self.calc_method_var = tk.StringVar(value="加權平均")
            calc_methods = ["加權平均", "簡單平均", "分區統計"]
            self.calc_method_combo = ttk.Combobox(analysis_frame, textvariable=self.calc_method_var, 
                                                values=calc_methods, state="readonly")
            self.calc_method_combo.pack(fill=tk.X, pady=2)
            
            # 功能按鈕區
            button_frame = ttk.LabelFrame(control_frame, text="功能選單", padding="10")
            button_frame.pack(fill=tk.X, pady=5)
            
            # 基本功能
            ttk.Label(button_frame, text="基本功能：", style='Subtitle.TLabel').pack(anchor=tk.W, pady=2)
            ttk.Button(button_frame, text="🔄 重新載入資料", command=self.reload_data).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📊 查看分析結果", command=self.update_display).pack(fill=tk.X, pady=2)
            
            # 匯出功能
            ttk.Label(button_frame, text="匯出功能：", style='Subtitle.TLabel').pack(anchor=tk.W, pady=2)
            ttk.Button(button_frame, text="📑 匯出Excel", command=self.export_excel).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📄 匯出CSV", command=self.export_csv).pack(fill=tk.X, pady=2)
            
            # 圖表分析
            ttk.Label(button_frame, text="圖表分析：", style='Subtitle.TLabel').pack(anchor=tk.W, pady=2)
            ttk.Button(button_frame, text="📈 價格趨勢圖", command=self.show_price_trend).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="🥧 交易量分布", command=self.show_volume_distribution).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📊 價格分布", command=self.show_price_distribution).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📅 季節性分析", command=self.show_seasonal_analysis).pack(fill=tk.X, pady=2)
            
            # 進階分析
            ttk.Label(button_frame, text="進階分析：", style='Subtitle.TLabel').pack(anchor=tk.W, pady=2)
            ttk.Button(button_frame, text="🔍 相似作物分析", command=self.show_similar_crops).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="🎯 價格預測", command=self.show_price_prediction).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="⚠️ 價格預警設定", command=self.create_alert_window).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📊 進階圖表分析", command=self.show_advanced_visualization).pack(fill=tk.X, pady=2)
            
            # 開發者功能
            ttk.Label(button_frame, text="開發者功能：", style='Subtitle.TLabel').pack(anchor=tk.W, pady=2)
            ttk.Button(button_frame, text="📢 發送通知", command=self.create_notification_window).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="📋 查看通知", command=self.show_notifications).pack(fill=tk.X, pady=2)
            ttk.Button(button_frame, text="🔑 Token 管理", command=self.create_token_management_window).pack(fill=tk.X, pady=2)
            
            # 右側顯示區域
            display_frame = ttk.LabelFrame(main_frame, text="分析結果", padding="10")
            display_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)
            
            # 文字顯示區域
            self.text_area = scrolledtext.ScrolledText(display_frame, wrap=tk.WORD, font=("微軟正黑體", 11))
            self.text_area.pack(fill=tk.BOTH, expand=True)
            
            # 綁定事件
            self.crop_combo.bind("<<ComboboxSelected>>", self.load_data_for_selected_crop)
            self.calc_method_combo.bind("<<ComboboxSelected>>", self.update_display)
            
            # 狀態列
            status_bar = ttk.Label(self.root, textvariable=self.status_var, 
                                 relief=tk.SUNKEN, padding=(5, 2))
            status_bar.pack(fill=tk.X, side=tk.BOTTOM, pady=5)
            
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
                # 初始化視覺化工具
                self.visualizer = AdvancedVisualizer(self.analyzer.data)
                
                # 更新作物列表
                self.crop_list = sorted(self.analyzer.data['作物名稱'].unique().tolist())
                if self.crop_list:
                    self.crop_combo['values'] = self.crop_list
                    self.crop_combo.set(self.crop_list[0])
                    self.update_display()
                    # 檢查價格預警
                    self.check_price_alerts()
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
    
    def filter_crops_list(self, *args):
        """根據搜尋文字過濾作物列表"""
        try:
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
        except Exception as e:
            self.status_var.set(f"過濾作物清單時發生錯誤：{str(e)}")

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

    def show_price_trend(self):
        """顯示價格趨勢圖"""
        try:
            if not self.visualizer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 使用新的互動式圖表
            fig = self.visualizer.create_interactive_price_trend(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_價格趨勢.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示進階價格趨勢圖")
            
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
            
            # 轉換日期格式並排序
            # 將民國年轉換為西元年
            def convert_tw_date(date_str):
                try:
                    year, month, day = map(int, date_str.split('.'))
                    # 民國年轉西元年
                    year += 1911
                    return f"{year}/{month:02d}/{day:02d}"
                except:
                    return date_str

            # 先轉換民國年為西元年，再轉換為日期格式
            df['交易日期'] = df['交易日期'].apply(convert_tw_date)
            df['交易日期'] = pd.to_datetime(df['交易日期'], format='%Y/%m/%d')
            df = df.sort_values('交易日期')
            
            # 收集相關數據
            last_price = df['平均價'].iloc[-1]
            total_volume = df['交易量'].sum()
            avg_price = df['平均價'].mean()
            
            # 計算7日和30日移動平均
            df['MA7'] = df['平均價'].rolling(window=7).mean()
            df['MA30'] = df['平均價'].rolling(window=30).mean()
            
            # 獲取最近的移動平均數據
            last_ma7 = df['MA7'].iloc[-1]
            last_ma30 = df['MA30'].iloc[-1]
            
            # 計算價格趨勢（最近7天）
            recent_trend = df['平均價'].iloc[-7:].diff().mean()
            trend_direction = "上升" if recent_trend > 0 else "下降" if recent_trend < 0 else "穩定"
            
            # 構建提示
            prompt = (
                f"請用100字以內，簡短預測{crop_name}未來七天的價格趨勢。\n"
                f"目前價格：{last_price:.2f}元/公斤\n"
                f"7日均價：{last_ma7:.2f}元/公斤\n"
                f"趨勢：{trend_direction}\n"
                f"\n請直接給出：\n"
                f"1. 預測價格\n"
                f"2. 建議操作\n"
            )
            
            # 使用 AI 進行預測
            response = self.chat_with_ollama(prompt)
            
            # 更新顯示
            self.text_area.config(state=tk.NORMAL)
            self.text_area.delete(1.0, tk.END)
            self.text_area.insert(tk.END, f"作物：{crop_name}\n")
            self.text_area.insert(tk.END, f"預測時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            self.text_area.insert(tk.END, "-" * 50 + "\n\n")
            self.text_area.insert(tk.END, response)
            self.text_area.config(state=tk.DISABLED)
            
        except Exception as e:
            self.status_var.set(f"預測價格時發生錯誤：{str(e)}")
            messagebox.showerror("錯誤", f"預測價格時發生錯誤：{str(e)}")
    
    def chat_with_ollama(self, prompt):
        payload = {
            "model": MODEL_NAME,
            "prompt": f"請用簡短的語言回答（100字以內）：\n{prompt}",
            "stream": False
        }
        try:
            response = requests.post(OLLAMA_API_URL, json=payload)
            response.raise_for_status()
            return response.json().get("response", "⚠️ 沒有回應！")
        except Exception as e:
            return f"⚠️ 錯誤：{e}"

    def send_message(self):
        user_input = self.entry.get()
        if not user_input.strip():
            return
        
        self.chat_box.config(state=tk.NORMAL)
        self.chat_box.insert(tk.END, f"🧑‍💻 你：{user_input}\n", "user")
        self.entry.delete(0, tk.END)

        # 呼叫 Ollama
        response = self.chat_with_ollama(user_input)
        self.chat_box.insert(tk.END, f"🤖 Gemma：{response}\n\n", "bot")

        self.chat_box.config(state=tk.DISABLED)
        self.chat_box.yview(tk.END)

    def copy_last_response(self):
        text = self.chat_box.get("end-3l", "end-1l").strip()
        if text:
            pyperclip.copy(text)
            messagebox.showinfo("複製成功", "已複製 Gemma 的回應！")

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

    def check_for_updates(self):
        """檢查是否有新版本可用"""
        try:
            self.status_var.set("正在檢查更新...")
            self.root.update()
            
            # 取得最新版本資訊
            headers = {'Accept': 'application/vnd.github.v3+json'}
            response = requests.get(GITHUB_API_URL, headers=headers, timeout=5)
            response.raise_for_status()
            latest_release = response.json()
            
            if 'tag_name' not in latest_release:
                self.status_var.set("無法獲取版本資訊")
                return
            
            # 解析版本號，排除網頁版本
            latest_version_tag = latest_release['tag_name'].replace('v', '')
            if '.web' in latest_version_tag:
                # 如果是網頁版本，嘗試獲取下一個非網頁版本
                response = requests.get(f"https://api.github.com/repos/{GITHUB_REPO}/releases", headers=headers, timeout=5)
                response.raise_for_status()
                releases = response.json()
                for release in releases:
                    version_tag = release['tag_name'].replace('v', '')
                    if '.web' not in version_tag:
                        latest_version_tag = version_tag
                        latest_release = release
                        break
            
            latest_version = version.parse(latest_version_tag)
            current_version = version.parse(CURRENT_VERSION)
            
            if latest_version > current_version:
                # 有新版本可用
                update_msg = f"""發現新版本！

目前版本：v{CURRENT_VERSION}({CURRENT_BUILD})
最新版本：v{latest_version_tag}

更新內容：
{latest_release.get('body', '暫無更新說明')}

是否要前往下載頁面？"""
                
                if messagebox.askyesno("版本更新", update_msg):
                    webbrowser.open(latest_release.get('html_url', GITHUB_RELEASES_URL))
                    self.status_var.set("已開啟下載頁面")
                else:
                    self.status_var.set("已取消更新")
            else:
                self.status_var.set("已是最新版本")
                messagebox.showinfo("版本檢查", "您使用的已經是最新版本！")
                
        except requests.exceptions.ConnectionError:
            self.status_var.set("網路連線失敗，無法檢查更新")
            messagebox.showerror("錯誤", "網路連線失敗，請檢查網路連線後再試")
        except requests.exceptions.Timeout:
            self.status_var.set("檢查更新超時")
            messagebox.showerror("錯誤", "檢查更新超時，請稍後再試")
        except Exception as e:
            self.status_var.set(f"檢查更新時發生錯誤")
            messagebox.showerror("錯誤", f"檢查更新時發生錯誤：\n{str(e)}")

    def show_update_history(self):
        """顯示更新歷史"""
        try:
            self.status_var.set("正在獲取更新歷史...")
            self.root.update()
            
            # 取得所有發布版本
            headers = {'Accept': 'application/vnd.github.v3+json'}
            response = requests.get(f"https://api.github.com/repos/{GITHUB_REPO}/releases", 
                                 headers=headers, timeout=5)
            response.raise_for_status()
            releases = response.json()
            
            if not releases:
                messagebox.showinfo("更新歷史", "目前沒有任何發布版本")
                self.status_var.set("無更新歷史")
                return
            
            # 建立更新歷史視窗
            history_window = tk.Toplevel(self.root)
            history_window.title("更新歷史")
            history_window.geometry("800x600")
            
            # 設定視窗圖示和樣式
            history_window.transient(self.root)
            history_window.grab_set()
            
            # 新增文字區域
            text_area = scrolledtext.ScrolledText(history_window, 
                                                wrap=tk.WORD, 
                                                width=80, 
                                                height=30,
                                                font=("微軟正黑體", 10))
            text_area.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
            
            # 顯示更新歷史
            for release in releases:
                version_tag = release['tag_name']
                publish_date = datetime.strptime(release['published_at'], 
                                               '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d %H:%M:%S')
                
                text_area.insert(tk.END, f"版本：{version_tag}\n", "version")
                text_area.insert(tk.END, f"發布日期：{publish_date}\n", "date")
                text_area.insert(tk.END, f"下載連結：{release['html_url']}\n", "link")
                text_area.insert(tk.END, "\n更新內容：\n", "header")
                text_area.insert(tk.END, f"{release.get('body', '暫無更新說明')}\n", "content")
                text_area.insert(tk.END, "\n" + "=" * 80 + "\n\n", "separator")
            
            # 設定文字樣式
            text_area.tag_configure("version", font=("微軟正黑體", 12, "bold"))
            text_area.tag_configure("date", font=("微軟正黑體", 10))
            text_area.tag_configure("link", font=("微軟正黑體", 10, "underline"), foreground="blue")
            text_area.tag_configure("header", font=("微軟正黑體", 10, "bold"))
            text_area.tag_configure("content", font=("微軟正黑體", 10))
            text_area.tag_configure("separator", foreground="gray")
            
            text_area.config(state=tk.DISABLED)
            
            # 新增底部按鈕
            button_frame = ttk.Frame(history_window)
            button_frame.pack(pady=10)
            
            ttk.Button(button_frame, 
                      text="前往發布頁面", 
                      command=lambda: webbrowser.open(GITHUB_RELEASES_URL)).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, 
                      text="關閉", 
                      command=history_window.destroy).pack(side=tk.LEFT, padx=5)
            
            self.status_var.set("更新歷史載入完成")
            
        except requests.exceptions.ConnectionError:
            self.status_var.set("網路連線失敗")
            messagebox.showerror("錯誤", "網路連線失敗，請檢查網路連線後再試")
        except requests.exceptions.Timeout:
            self.status_var.set("獲取更新歷史超時")
            messagebox.showerror("錯誤", "獲取更新歷史超時，請稍後再試")
        except Exception as e:
            self.status_var.set("獲取更新歷史失敗")
            messagebox.showerror("錯誤", f"獲取更新歷史時發生錯誤：\n{str(e)}")

    def create_alert_window(self):
        """建立價格預警設定視窗"""
        try:
            alert_window = tk.Toplevel(self.root)
            alert_window.title("價格預警設定")
            alert_window.geometry("600x700")
            
            # 主要內容框架
            main_frame = ttk.Frame(alert_window, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # 作物選擇區域
            crop_frame = ttk.LabelFrame(main_frame, text="作物選擇", padding="10")
            crop_frame.pack(fill=tk.X, pady=5)
            
            crop_var = tk.StringVar(value=self.crop_var.get())
            ttk.Label(crop_frame, text="選擇作物：").pack(anchor=tk.W)
            crop_combo = ttk.Combobox(crop_frame, 
                                     textvariable=crop_var,
                                     values=self.crop_list,
                                     state="readonly")
            crop_combo.pack(fill=tk.X, pady=5)
            
            # 價格設定區域
            price_frame = ttk.LabelFrame(main_frame, text="價格範圍設定", padding="10")
            price_frame.pack(fill=tk.X, pady=5)
            
            # 上限價格
            upper_frame = ttk.Frame(price_frame)
            upper_frame.pack(fill=tk.X, pady=2)
            ttk.Label(upper_frame, text="價格上限：").pack(side=tk.LEFT)
            upper_var = tk.StringVar()
            upper_entry = ttk.Entry(upper_frame, textvariable=upper_var)
            upper_entry.pack(side=tk.LEFT, padx=5)
            ttk.Label(upper_frame, text="元/公斤").pack(side=tk.LEFT)
            
            # 下限價格
            lower_frame = ttk.Frame(price_frame)
            lower_frame.pack(fill=tk.X, pady=2)
            ttk.Label(lower_frame, text="價格下限：").pack(side=tk.LEFT)
            lower_var = tk.StringVar()
            lower_entry = ttk.Entry(lower_frame, textvariable=lower_var)
            lower_entry.pack(side=tk.LEFT, padx=5)
            ttk.Label(lower_frame, text="元/公斤").pack(side=tk.LEFT)
            
            # 通知設定
            notify_frame = ttk.LabelFrame(main_frame, text="通知設定", padding="10")
            notify_frame.pack(fill=tk.X, pady=5)
            
            notify_var = tk.StringVar(value="system")
            ttk.Radiobutton(notify_frame, 
                           text="系統通知", 
                           variable=notify_var,
                           value="system").pack(anchor=tk.W)
            ttk.Radiobutton(notify_frame, 
                           text="電子郵件", 
                           variable=notify_var,
                           value="email").pack(anchor=tk.W)
            
            # 預警列表
            list_frame = ttk.LabelFrame(main_frame, text="現有預警", padding="10")
            list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
            
            # 建立 Treeview
            columns = ("作物", "上限價格", "下限價格", "通知方式", "狀態")
            tree = ttk.Treeview(list_frame, columns=columns, show="headings")
            
            # 設定欄位標題
            for col in columns:
                tree.heading(col, text=col)
                tree.column(col, width=100)
            
            # 加入捲軸
            scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=tree.yview)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            tree.configure(yscrollcommand=scrollbar.set)
            tree.pack(fill=tk.BOTH, expand=True)
            
            def save_alert():
                """儲存預警設定"""
                try:
                    crop = crop_var.get()
                    upper = float(upper_var.get())
                    lower = float(lower_var.get())
                    
                    if not crop:
                        messagebox.showerror("錯誤", "請選擇作物")
                        return
                    
                    if upper <= lower:
                        messagebox.showerror("錯誤", "上限價格必須大於下限價格")
                        return
                    
                    # 儲存預警設定
                    self.alert_system.add_alert(
                        crop_name=crop,
                        upper_limit=upper,
                        lower_limit=lower,
                        notification_type=notify_var.get()
                    )
                    
                    # 清空輸入
                    upper_var.set("")
                    lower_var.set("")
                    
                    # 更新列表
                    refresh_alerts()
                    
                    messagebox.showinfo("成功", "預警設定已儲存")
                    
                except ValueError:
                    messagebox.showerror("錯誤", "請輸入有效的價格數值")
            
            def refresh_alerts():
                """重新整理預警列表"""
                # 清空現有項目
                for item in tree.get_children():
                    tree.delete(item)
                
                # 載入最新預警列表
                alerts = self.alert_system.get_all_alerts()
                for alert in alerts:
                    tree.insert("", tk.END, values=(
                        alert["crop_name"],
                        f"{alert['upper_limit']:.2f}",
                        f"{alert['lower_limit']:.2f}",
                        "系統通知" if alert["notification_type"] == "system" else "電子郵件",
                        "啟用" if alert["is_active"] else "停用"
                    ))
            
            # 按鈕區域
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            ttk.Button(button_frame, 
                       text="儲存設定", 
                       command=save_alert).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                       text="重新整理",
                       command=refresh_alerts).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                       text="關閉",
                       command=alert_window.destroy).pack(side=tk.RIGHT, padx=5)
            
            # 初始載入預警列表
            refresh_alerts()
            
        except Exception as e:
            messagebox.showerror("錯誤", f"建立預警視窗時發生錯誤：{str(e)}")

    def check_price_alerts(self):
        """檢查價格預警"""
        try:
            if not self.analyzer or not isinstance(self.analyzer.data, pd.DataFrame):
                return
            
            df = self.analyzer.data
            current_prices = {}
            
            # 獲取最新價格
            for crop_name in df['作物名稱'].unique():
                crop_data = df[df['作物名稱'] == crop_name]
                if not crop_data.empty:
                    current_prices[crop_name] = crop_data['平均價'].iloc[-1]
            
            # 檢查每個作物的預警條件
            for crop_name, price in current_prices.items():
                self.alert_system.check_price(crop_name, price)
            
        except Exception as e:
            self.status_var.set(f"檢查價格預警時發生錯誤：{str(e)}")

    def show_advanced_visualization(self):
        """顯示進階視覺化分析"""
        try:
            if not self.visualizer:
                messagebox.showerror("錯誤", "沒有可用的資料")
                return
            
            crop_name = self.crop_var.get()
            if not crop_name:
                messagebox.showerror("錯誤", "請選擇作物")
                return
            
            # 生成互動式圖表
            fig = self.visualizer.create_interactive_price_trend(crop_name)
            
            # 儲存圖表
            filename = os.path.join(self.output_dir, f"{crop_name}_進階分析.html")
            fig.write_html(filename)
            
            # 開啟瀏覽器顯示圖表
            webbrowser.open(f"file://{os.path.abspath(filename)}")
            self.status_var.set("已顯示進階視覺化分析")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示進階視覺化分析時發生錯誤：{str(e)}")

    def create_notification_window(self):
        """建立發送通知視窗"""
        try:
            # 先驗證 token
            if not self.verify_token():
                return
            
            notification_window = tk.Toplevel(self.root)
            notification_window.title("發送通知")
            notification_window.geometry("500x400")
            
            # 主要內容框架
            main_frame = ttk.Frame(notification_window, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # 標題輸入
            title_frame = ttk.Frame(main_frame)
            title_frame.pack(fill=tk.X, pady=5)
            ttk.Label(title_frame, text="通知標題：").pack(side=tk.LEFT)
            title_var = tk.StringVar()
            title_entry = ttk.Entry(title_frame, textvariable=title_var, width=40)
            title_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            
            # 訊息輸入
            message_frame = ttk.Frame(main_frame)
            message_frame.pack(fill=tk.BOTH, expand=True, pady=5)
            ttk.Label(message_frame, text="通知內容：").pack(anchor=tk.W)
            message_text = scrolledtext.ScrolledText(message_frame, wrap=tk.WORD, height=10)
            message_text.pack(fill=tk.BOTH, expand=True)
            
            # 通知方式選擇
            notify_frame = ttk.LabelFrame(main_frame, text="通知方式", padding="10")
            notify_frame.pack(fill=tk.X, pady=5)
            
            notify_var = tk.StringVar(value="system")
            ttk.Radiobutton(notify_frame, 
                           text="系統通知", 
                           variable=notify_var,
                           value="system").pack(anchor=tk.W)
            ttk.Radiobutton(notify_frame, 
                           text="電子郵件", 
                           variable=notify_var,
                           value="email").pack(anchor=tk.W)
            
            def send_notification():
                """發送通知"""
                try:
                    title = title_var.get().strip()
                    message = message_text.get("1.0", tk.END).strip()
                    
                    if not title:
                        messagebox.showerror("錯誤", "請輸入通知標題")
                        return
                    
                    if not message:
                        messagebox.showerror("錯誤", "請輸入通知內容")
                        return
                    
                    # 發送通知
                    if self.alert_system.send_dev_notification(
                        title=title,
                        message=message,
                        notification_type=notify_var.get()
                    ):
                        messagebox.showinfo("成功", "通知已發送")
                        notification_window.destroy()
                    else:
                        messagebox.showerror("錯誤", "發送通知失敗")
                    
                except Exception as e:
                    messagebox.showerror("錯誤", f"發送通知時發生錯誤：{str(e)}")
            
            # 按鈕區域
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            ttk.Button(button_frame, 
                      text="發送", 
                      command=send_notification).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="取消",
                      command=notification_window.destroy).pack(side=tk.RIGHT, padx=5)
            
        except Exception as e:
            messagebox.showerror("錯誤", f"建立通知視窗時發生錯誤：{str(e)}")

    def show_notifications(self):
        """顯示通知列表"""
        try:
            # 先驗證 token
            if not self.verify_token():
                return
            
            notifications_window = tk.Toplevel(self.root)
            notifications_window.title("通知列表")
            notifications_window.geometry("800x600")
            
            # 主要內容框架
            main_frame = ttk.Frame(notifications_window, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # 建立 Treeview
            columns = ("標題", "內容", "通知方式", "時間", "狀態")
            tree = ttk.Treeview(main_frame, columns=columns, show="headings")
            
            # 設定欄位標題
            for col in columns:
                tree.heading(col, text=col)
                tree.column(col, width=100)
            
            # 加入捲軸
            scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=tree.yview)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            tree.configure(yscrollcommand=scrollbar.set)
            tree.pack(fill=tk.BOTH, expand=True)
            
            def refresh_notifications():
                """重新整理通知列表"""
                # 清空現有項目
                for item in tree.get_children():
                    tree.delete(item)
                
                # 載入最新通知列表
                notifications = self.alert_system.get_dev_notifications()
                for notif in notifications:
                    tree.insert("", tk.END, values=(
                        notif["title"],
                        notif["message"][:50] + "..." if len(notif["message"]) > 50 else notif["message"],
                        "系統通知" if notif["notification_type"] == "system" else "電子郵件",
                        notif["created_at"],
                        "未讀" if notif["is_read"] == 0 else "已讀"
                    ))
            
            def mark_selected_read():
                """標記選中的通知為已讀"""
                selected = tree.selection()
                if not selected:
                    messagebox.showwarning("警告", "請選擇要標記的通知")
                    return
                
                for item in selected:
                    values = tree.item(item)["values"]
                    # 這裡需要根據實際情況修改，可能需要添加通知ID
                    # self.alert_system.mark_notification_read(notification_id)
                
                refresh_notifications()
            
            # 按鈕區域
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            ttk.Button(button_frame, 
                      text="重新整理", 
                      command=refresh_notifications).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="標記已讀",
                      command=mark_selected_read).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="關閉",
                      command=notifications_window.destroy).pack(side=tk.RIGHT, padx=5)
            
            # 初始載入通知列表
            refresh_notifications()
            
        except Exception as e:
            messagebox.showerror("錯誤", f"顯示通知列表時發生錯誤：{str(e)}")

    def check_dev_notifications(self):
        """檢查開發者通知"""
        try:
            notifications = self.alert_system.get_dev_notifications(unread_only=True)
            if notifications:
                # 顯示未讀通知數量
                self.status_var.set(f"您有 {len(notifications)} 則未讀通知")
                
                # 顯示最新通知
                latest = notifications[0]
                self.notify(latest["title"], latest["message"])
                
        except Exception as e:
            print(f"檢查開發者通知時發生錯誤：{str(e)}")

    def verify_token(self):
        """驗證 token"""
        try:
            # 建立驗證視窗
            verify_window = tk.Toplevel(self.root)
            verify_window.title("Token 驗證")
            verify_window.geometry("400x200")
            verify_window.transient(self.root)
            verify_window.grab_set()
            
            # 主要內容框架
            main_frame = ttk.Frame(verify_window, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # Token 輸入
            token_frame = ttk.Frame(main_frame)
            token_frame.pack(fill=tk.X, pady=5)
            ttk.Label(token_frame, text="請輸入 Token：").pack(side=tk.LEFT)
            token_var = tk.StringVar()
            token_entry = ttk.Entry(token_frame, textvariable=token_var, width=30)
            token_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            
            # 驗證結果標籤
            result_var = tk.StringVar()
            result_label = ttk.Label(main_frame, textvariable=result_var)
            result_label.pack(pady=5)
            
            def do_verify():
                token = token_var.get().strip()
                if not token:
                    result_var.set("請輸入 Token")
                    return
                
                if self.token_manager.verify_token(token):
                    self.current_token = token
                    user_name = self.token_manager.get_user_name(token)
                    result_var.set(f"驗證成功！歡迎 {user_name}")
                    verify_window.after(1000, verify_window.destroy)
                else:
                    result_var.set("Token 無效")
                    token_var.set("")
            
            # 按鈕區域
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            ttk.Button(button_frame, 
                      text="驗證", 
                      command=do_verify).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="取消",
                      command=verify_window.destroy).pack(side=tk.RIGHT, padx=5)
            
            # 綁定 Enter 鍵
            token_entry.bind('<Return>', lambda e: do_verify())
            
            # 等待視窗關閉
            self.root.wait_window(verify_window)
            
            return self.current_token is not None
            
        except Exception as e:
            messagebox.showerror("錯誤", f"Token 驗證時發生錯誤：{str(e)}")
            return False

    def create_token_management_window(self):
        """建立 token 管理視窗"""
        try:
            # 先驗證 token
            if not self.verify_token():
                return
            
            token_window = tk.Toplevel(self.root)
            token_window.title("Token 管理")
            token_window.geometry("600x400")
            
            # 主要內容框架
            main_frame = ttk.Frame(token_window, padding="10")
            main_frame.pack(fill=tk.BOTH, expand=True)
            
            # Token 列表
            list_frame = ttk.LabelFrame(main_frame, text="Token 列表", padding="10")
            list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
            
            # 建立 Treeview
            columns = ("Token", "使用者名稱", "建立時間")
            tree = ttk.Treeview(list_frame, columns=columns, show="headings")
            
            # 設定欄位標題
            for col in columns:
                tree.heading(col, text=col)
                tree.column(col, width=150)
            
            # 加入捲軸
            scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=tree.yview)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            tree.configure(yscrollcommand=scrollbar.set)
            tree.pack(fill=tk.BOTH, expand=True)
            
            # 新增 Token 區域
            add_frame = ttk.LabelFrame(main_frame, text="新增 Token", padding="10")
            add_frame.pack(fill=tk.X, pady=5)
            
            # Token 輸入
            token_frame = ttk.Frame(add_frame)
            token_frame.pack(fill=tk.X, pady=2)
            ttk.Label(token_frame, text="Token：").pack(side=tk.LEFT)
            token_var = tk.StringVar()
            token_entry = ttk.Entry(token_frame, textvariable=token_var)
            token_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            
            # 使用者名稱輸入
            name_frame = ttk.Frame(add_frame)
            name_frame.pack(fill=tk.X, pady=2)
            ttk.Label(name_frame, text="使用者名稱：").pack(side=tk.LEFT)
            name_var = tk.StringVar()
            name_entry = ttk.Entry(name_frame, textvariable=name_var)
            name_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
            
            def refresh_tokens():
                """重新整理 Token 列表"""
                # 清空現有項目
                for item in tree.get_children():
                    tree.delete(item)
                
                # 載入最新 Token 列表
                tokens = self.token_manager.get_all_tokens()
                for token, info in tokens.items():
                    tree.insert("", tk.END, values=(
                        token,
                        info["user_name"],
                        info["created_at"]
                    ))
            
            def add_token():
                """新增 Token"""
                token = token_var.get().strip()
                user_name = name_var.get().strip()
                
                if not token:
                    messagebox.showerror("錯誤", "請輸入 Token")
                    return
                
                if not user_name:
                    messagebox.showerror("錯誤", "請輸入使用者名稱")
                    return
                
                if self.token_manager.add_token(token, user_name):
                    messagebox.showinfo("成功", "Token 新增成功")
                    token_var.set("")
                    name_var.set("")
                    refresh_tokens()
                else:
                    messagebox.showerror("錯誤", "Token 新增失敗")
            
            def remove_token():
                """移除選中的 Token"""
                selected = tree.selection()
                if not selected:
                    messagebox.showwarning("警告", "請選擇要移除的 Token")
                    return
                
                if messagebox.askyesno("確認", "確定要移除選中的 Token？"):
                    for item in selected:
                        token = tree.item(item)["values"][0]
                        if self.token_manager.remove_token(token):
                            tree.delete(item)
            
            # 按鈕區域
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            ttk.Button(button_frame, 
                      text="新增", 
                      command=add_token).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="移除",
                      command=remove_token).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="重新整理",
                      command=refresh_tokens).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame,
                      text="關閉",
                      command=token_window.destroy).pack(side=tk.RIGHT, padx=5)
            
            # 初始載入 Token 列表
            refresh_tokens()
            
        except Exception as e:
            messagebox.showerror("錯誤", f"建立 Token 管理視窗時發生錯誤：{str(e)}")

def main():
    try:
        root = ThemedTk(theme="arc")
        app = FarmDataApp(root)
        root.mainloop()
    except Exception as e:
        messagebox.showerror("錯誤", f"程式啟動時發生錯誤：{str(e)}")

if __name__ == "__main__":
    main() 