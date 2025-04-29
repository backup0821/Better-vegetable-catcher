import os
import json
from datetime import datetime

class TokenManager:
    def __init__(self):
        self.token_file = "token.txt"
        self.tokens = {}
        self.load_tokens()
    
    def load_tokens(self):
        """載入 token 資料"""
        try:
            if os.path.exists(self.token_file):
                with open(self.token_file, 'r', encoding='utf-8') as f:
                    self.tokens = json.load(f)
            else:
                # 如果檔案不存在，創建一個空的 token 檔案
                self.save_tokens()
        except Exception as e:
            print(f"載入 token 時發生錯誤：{str(e)}")
            self.tokens = {}
    
    def save_tokens(self):
        """儲存 token 資料"""
        try:
            with open(self.token_file, 'w', encoding='utf-8') as f:
                json.dump(self.tokens, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"儲存 token 時發生錯誤：{str(e)}")
    
    def add_token(self, token, user_name):
        """新增 token"""
        try:
            self.tokens[token] = {
                "user_name": user_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            self.save_tokens()
            return True
        except Exception as e:
            print(f"新增 token 時發生錯誤：{str(e)}")
            return False
    
    def remove_token(self, token):
        """移除 token"""
        try:
            if token in self.tokens:
                del self.tokens[token]
                self.save_tokens()
                return True
            return False
        except Exception as e:
            print(f"移除 token 時發生錯誤：{str(e)}")
            return False
    
    def verify_token(self, token):
        """驗證 token"""
        return token in self.tokens
    
    def get_user_name(self, token):
        """取得使用者名稱"""
        return self.tokens.get(token, {}).get("user_name", "")
    
    def get_all_tokens(self):
        """取得所有 token 資訊"""
        return self.tokens 