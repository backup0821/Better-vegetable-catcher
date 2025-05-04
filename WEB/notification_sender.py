import tkinter as tk
from tkinter import ttk, messagebox
import json
from datetime import datetime, timedelta
import requests
from pywebpush import webpush, WebPushException
import base64
import os

class NotificationSender:
    def __init__(self, root):
        self.root = root
        self.root.title("通知發送器")
        
        # 主框架
        self.main_frame = ttk.Frame(self.root, padding="10")
        self.main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 通知標題
        ttk.Label(self.main_frame, text="通知標題:").grid(row=0, column=0, sticky=tk.W)
        self.title_entry = ttk.Entry(self.main_frame, width=40)
        self.title_entry.grid(row=0, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        # 通知內容
        ttk.Label(self.main_frame, text="通知內容:").grid(row=1, column=0, sticky=tk.W)
        self.content_text = tk.Text(self.main_frame, width=40, height=5)
        self.content_text.grid(row=1, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        # 通知類型
        ttk.Label(self.main_frame, text="通知類型:").grid(row=2, column=0, sticky=tk.W)
        self.notification_type = tk.StringVar(value="public")
        ttk.Radiobutton(self.main_frame, text="公開通知", variable=self.notification_type, value="public").grid(row=2, column=1, sticky=tk.W)
        ttk.Radiobutton(self.main_frame, text="特定裝置", variable=self.notification_type, value="private").grid(row=2, column=2, sticky=tk.W)
        
        # 裝置識別碼
        ttk.Label(self.main_frame, text="裝置識別碼:").grid(row=3, column=0, sticky=tk.W)
        self.device_id_entry = ttk.Entry(self.main_frame, width=40)
        self.device_id_entry.grid(row=3, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        # 通知時間
        ttk.Label(self.main_frame, text="顯示時間:").grid(row=4, column=0, sticky=tk.W)
        self.time_frame = ttk.Frame(self.main_frame)
        self.time_frame.grid(row=4, column=1, columnspan=2, sticky=(tk.W, tk.E))
        
        self.days_var = tk.StringVar(value="0")
        self.hours_var = tk.StringVar(value="1")
        
        ttk.Label(self.time_frame, text="天").grid(row=0, column=0)
        self.days_spinbox = ttk.Spinbox(self.time_frame, from_=0, to=30, width=5, textvariable=self.days_var)
        self.days_spinbox.grid(row=0, column=1, padx=5)
        
        ttk.Label(self.time_frame, text="小時").grid(row=0, column=2)
        self.hours_spinbox = ttk.Spinbox(self.time_frame, from_=0, to=23, width=5, textvariable=self.hours_var)
        self.hours_spinbox.grid(row=0, column=3, padx=5)
        
        # 發送按鈕
        self.send_button = ttk.Button(self.main_frame, text="發送通知", command=self.send_notification)
        self.send_button.grid(row=5, column=1, columnspan=2, pady=10)
        
        # 狀態標籤
        self.status_label = ttk.Label(self.main_frame, text="")
        self.status_label.grid(row=6, column=0, columnspan=3, sticky=(tk.W, tk.E))
        
        # 設定 VAPID 金鑰
        try:
            with open(r"D:\桌面\coding\大型專案\果菜市場總整理-高級版\VAPID.txt", 'r') as f:
                vapid_data = json.load(f)
                self.vapid_private_key = vapid_data.get('privateKey')
                self.vapid_public_key = vapid_data.get('publicKey')
                
                if not self.vapid_private_key or not self.vapid_public_key:
                    raise ValueError("VAPID 金鑰格式錯誤")
        except Exception as e:
            messagebox.showerror("錯誤", f"讀取 VAPID 金鑰失敗: {str(e)}")
            self.root.destroy()
            return
        
        # 載入訂閱資訊
        self.load_subscriptions()
        
    def load_subscriptions(self):
        try:
            with open('subscriptions.json', 'r') as f:
                self.subscriptions = json.load(f)
        except FileNotFoundError:
            self.subscriptions = {}
            messagebox.showwarning("警告", "找不到訂閱資訊檔案")
    
    def send_notification(self):
        title = self.title_entry.get().strip()
        content = self.content_text.get("1.0", tk.END).strip()
        
        if not title or not content:
            messagebox.showerror("錯誤", "請填寫通知標題和內容")
            return
        
        # 計算通知時間
        days = int(self.days_var.get())
        hours = int(self.hours_var.get())
        duration = timedelta(days=days, hours=hours)
        start_time = datetime.now()
        end_time = start_time + duration
        
        # 建立通知資料
        notification = {
            "id": f"notification_{int(datetime.now().timestamp())}",
            "title": title,
            "messenge": content,
            "time": f"{start_time.isoformat()} ~ {end_time.isoformat()}",
            "public": self.notification_type.get() == "public",
            "targetDevices": ["everyone"] if self.notification_type.get() == "public" else [self.device_id_entry.get().strip()]
        }
        
        try:
            # 直接推送通知
            if self.notification_type.get() == "public":
                # 發送給所有訂閱者
                for device_id, subscription in self.subscriptions.items():
                    self.send_push_notification(subscription, notification)
            else:
                # 發送給特定裝置
                device_id = self.device_id_entry.get().strip()
                if device_id in self.subscriptions:
                    self.send_push_notification(self.subscriptions[device_id], notification)
                else:
                    messagebox.showwarning("警告", f"找不到裝置 {device_id} 的訂閱資訊")
            
            # 更新通知檔案
            self.update_notification_file(notification)
            
            self.status_label.config(text="通知發送成功！")
            messagebox.showinfo("成功", "通知已發送")
        except Exception as e:
            self.status_label.config(text=f"發送失敗: {str(e)}")
            messagebox.showerror("錯誤", f"發送通知失敗: {str(e)}")
    
    def send_push_notification(self, subscription, notification):
        try:
            # 準備推送資料
            push_data = {
                "title": notification["title"],
                "body": notification["messenge"],
                "icon": "./icon-192.png",
                "badge": "./icon-192.png",
                "vibrate": [200, 100, 200],
                "tag": notification["id"],
                "requireInteraction": True,
                "data": {
                    "url": "/",
                    "notification": notification
                }
            }
            
            # 發送推送通知
            webpush(
                subscription_info=subscription,
                data=json.dumps(push_data),
                vapid_private_key=self.vapid_private_key,
                vapid_claims={
                    "sub": "mailto:your-email@example.com"  # 替換為您的郵箱
                }
            )
        except WebPushException as e:
            if e.response and e.response.status_code == 410:
                # 訂閱已過期，從訂閱列表中移除
                device_id = self.find_device_id_by_subscription(subscription)
                if device_id:
                    del self.subscriptions[device_id]
                    self.save_subscriptions()
            raise e
    
    def find_device_id_by_subscription(self, subscription):
        for device_id, sub in self.subscriptions.items():
            if sub == subscription:
                return device_id
        return None
    
    def update_notification_file(self, notification):
        try:
            # 讀取現有通知
            try:
                with open('notfiy.json', 'r') as f:
                    notifications = json.load(f)
            except FileNotFoundError:
                notifications = []
            
            # 添加新通知
            notifications.append(notification)
            
            # 寫回檔案
            with open('notfiy.json', 'w') as f:
                json.dump(notifications, f, indent=2)
        except Exception as e:
            print(f"更新通知檔案失敗: {str(e)}")
    
    def save_subscriptions(self):
        try:
            with open('subscriptions.json', 'w') as f:
                json.dump(self.subscriptions, f, indent=2)
        except Exception as e:
            print(f"儲存訂閱資訊失敗: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = NotificationSender(root)
    root.mainloop() 