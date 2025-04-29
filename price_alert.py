import sqlite3
import os
from datetime import datetime
from win10toast import ToastNotifier
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class PriceAlertSystem:
    def __init__(self):
        self.db_path = os.path.join('data', 'price_alerts.db')
        self.notifier = ToastNotifier()
        self.setup_database()
        
    def setup_database(self):
        """初始化資料庫"""
        os.makedirs('data', exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS alerts
                    (id INTEGER PRIMARY KEY,
                     crop_name TEXT,
                     upper_limit REAL,
                     lower_limit REAL,
                     notification_type TEXT,
                     is_active INTEGER,
                     created_at TIMESTAMP,
                     last_triggered TIMESTAMP)''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS dev_notifications
                    (id INTEGER PRIMARY KEY,
                     title TEXT,
                     message TEXT,
                     notification_type TEXT,
                     created_at TIMESTAMP,
                     is_read INTEGER DEFAULT 0)''')
        conn.commit()
        conn.close()

    def add_alert(self, crop_name, upper_limit, lower_limit, notification_type="system"):
        """新增預警設定"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""INSERT INTO alerts 
                    (crop_name, upper_limit, lower_limit, notification_type, is_active, created_at)
                    VALUES (?, ?, ?, ?, 1, ?)""",
                 (crop_name, upper_limit, lower_limit, notification_type, datetime.now()))
        conn.commit()
        conn.close()

    def get_all_alerts(self):
        """獲取所有預警設定"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        alerts = c.execute("SELECT * FROM alerts WHERE is_active = 1").fetchall()
        conn.close()
        
        return [
            {
                "id": alert[0],
                "crop_name": alert[1],
                "upper_limit": alert[2],
                "lower_limit": alert[3],
                "notification_type": alert[4],
                "is_active": alert[5],
                "created_at": alert[6],
                "last_triggered": alert[7]
            }
            for alert in alerts
        ]

    def check_price(self, crop_name, current_price):
        """檢查特定作物的價格是否觸發預警"""
        alerts = self.get_all_alerts()
        triggered = False
        
        for alert in alerts:
            if alert["crop_name"] == crop_name:
                if current_price > alert["upper_limit"]:
                    self.notify(f"{crop_name}價格預警", 
                              f"目前價格 {current_price:.2f} 元已超過上限 {alert['upper_limit']:.2f} 元")
                    triggered = True
                elif current_price < alert["lower_limit"]:
                    self.notify(f"{crop_name}價格預警", 
                              f"目前價格 {current_price:.2f} 元已低於下限 {alert['lower_limit']:.2f} 元")
                    triggered = True
        
        return triggered

    def notify(self, title, message):
        """發送通知"""
        self.notifier.show_toast(title, message, duration=10)

    def send_dev_notification(self, title, message, notification_type="system"):
        """開發者發送通知"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("""INSERT INTO dev_notifications 
                        (title, message, notification_type, created_at)
                        VALUES (?, ?, ?, ?)""",
                     (title, message, notification_type, datetime.now()))
            conn.commit()
            conn.close()

            # 根據通知類型發送通知
            if notification_type == "system":
                self.notify(title, message)
            elif notification_type == "email":
                self.send_email_notification(title, message)
            
            return True
        except Exception as e:
            print(f"發送通知時發生錯誤：{str(e)}")
            return False

    def get_dev_notifications(self, unread_only=False):
        """獲取開發者通知"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            if unread_only:
                notifications = c.execute("SELECT * FROM dev_notifications WHERE is_read = 0 ORDER BY created_at DESC").fetchall()
            else:
                notifications = c.execute("SELECT * FROM dev_notifications ORDER BY created_at DESC").fetchall()
            conn.close()
            
            return [
                {
                    "id": notif[0],
                    "title": notif[1],
                    "message": notif[2],
                    "notification_type": notif[3],
                    "created_at": notif[4],
                    "is_read": notif[5]
                }
                for notif in notifications
            ]
        except Exception as e:
            print(f"獲取通知時發生錯誤：{str(e)}")
            return []

    def mark_notification_read(self, notification_id):
        """標記通知為已讀"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute("UPDATE dev_notifications SET is_read = 1 WHERE id = ?", (notification_id,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"標記通知已讀時發生錯誤：{str(e)}")
            return False

    def send_email_notification(self, title, message):
        """發送電子郵件通知"""
        # 這裡需要實作電子郵件發送功能
        # 可以使用 smtplib 或其他郵件服務
        pass
