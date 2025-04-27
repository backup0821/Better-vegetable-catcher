import sqlite3
import os
from datetime import datetime
from win10toast import ToastNotifier

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
