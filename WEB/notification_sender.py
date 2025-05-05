import tkinter as tk
from tkinter import ttk, messagebox
import firebase_admin
from firebase_admin import credentials, messaging
import json
import os

class NotificationSender:
    def __init__(self):
        # 檢查設定檔是否存在
        if not os.path.exists('config.json'):
            messagebox.showerror("錯誤", "找不到設定檔 config.json，請先建立設定檔")
            return
            
        if not os.path.exists('serviceAccountKey.json'):
            messagebox.showerror("錯誤", "找不到 Firebase 服務帳戶金鑰 serviceAccountKey.json")
            return

        # 讀取設定檔
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        except Exception as e:
            messagebox.showerror("錯誤", f"讀取設定檔失敗: {str(e)}")
            return

        # 初始化 Firebase Admin SDK
        try:
            if not firebase_admin._apps:
                # 檢查 serviceAccountKey.json 格式
                with open('serviceAccountKey.json', 'r', encoding='utf-8') as f:
                    key_data = json.load(f)
                    if key_data.get("type") != "service_account":
                        raise ValueError("Invalid service account certificate: 'type' field must be 'service_account'.")
                # 初始化 Firebase
                cred = credentials.Certificate('serviceAccountKey.json')
                firebase_admin.initialize_app(cred)
        except Exception as e:
            messagebox.showerror("錯誤", f"Firebase 初始化失敗: {str(e)}")
            return

        # 建立主視窗
        self.root = tk.Tk()
        self.root.title("農產品通知發送器")
        self.root.geometry("600x400")
        
        # 建立樣式
        style = ttk.Style()
        style.configure('TButton', padding=5)
        style.configure('TLabel', padding=5)
        style.configure('TEntry', padding=5)
        
        # 建立主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 通知標題
        ttk.Label(main_frame, text="通知標題:").grid(row=0, column=0, sticky=tk.W)
        self.title_entry = ttk.Entry(main_frame, width=50)
        self.title_entry.grid(row=0, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        # 通知內容
        ttk.Label(main_frame, text="通知內容:").grid(row=1, column=0, sticky=tk.W)
        self.body_text = tk.Text(main_frame, width=50, height=10)
        self.body_text.grid(row=1, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        # 目標裝置
        ttk.Label(main_frame, text="目標裝置:").grid(row=2, column=0, sticky=tk.W)
        self.target_var = tk.StringVar(value="all")
        ttk.Radiobutton(main_frame, text="所有裝置", variable=self.target_var, value="all").grid(row=2, column=1, sticky=tk.W)
        ttk.Radiobutton(main_frame, text="特定裝置", variable=self.target_var, value="specific").grid(row=2, column=2, sticky=tk.W)
        
        # 特定裝置 Token
        self.token_frame = ttk.Frame(main_frame)
        self.token_frame.grid(row=3, column=1, columnspan=2, sticky=(tk.W, tk.E))
        ttk.Label(self.token_frame, text="裝置 Token:").grid(row=0, column=0, sticky=tk.W)
        self.token_entry = ttk.Entry(self.token_frame, width=50)
        self.token_entry.grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # 發送按鈕
        self.send_button = ttk.Button(main_frame, text="發送通知", command=self.send_notification)
        self.send_button.grid(row=4, column=1, columnspan=2, pady=10)
        
        # 狀態標籤
        self.status_label = ttk.Label(main_frame, text="")
        self.status_label.grid(row=5, column=1, columnspan=2)
        
        # 綁定事件
        self.target_var.trace_add("write", self.on_target_change)
        
        # 設定權重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.columnconfigure(2, weight=1)
        
        # 初始化時隱藏 Token 輸入框
        self.token_frame.grid_remove()

    def on_target_change(self, *args):
        if self.target_var.get() == "specific":
            self.token_frame.grid()
        else:
            self.token_frame.grid_remove()

    def send_notification(self):
        title = self.title_entry.get().strip()
        body = self.body_text.get("1.0", tk.END).strip()
        
        if not title or not body:
            messagebox.showerror("錯誤", "請填寫通知標題和內容")
            return
        
        try:
            # 建立通知訊息
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data={
                    'click_action': 'FLUTTER_NOTIFICATION_CLICK',
                    'sound': 'default',
                    'status': 'done',
                    'screen': 'home'
                }
            )
            
            # 根據選擇的目標發送通知
            if self.target_var.get() == "all":
                message.topic = "all"
                response = messaging.send(message)
            else:
                token = self.token_entry.get().strip()
                if not token:
                    messagebox.showerror("錯誤", "請輸入裝置 Token")
                    return
                message.token = token
                response = messaging.send(message)
            
            self.status_label.config(text=f"通知已發送！訊息 ID: {response}")
            messagebox.showinfo("成功", "通知已成功發送！")
            
        except Exception as e:
            messagebox.showerror("錯誤", f"發送通知失敗: {str(e)}")
            self.status_label.config(text="發送失敗")

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = NotificationSender()
    app.run()