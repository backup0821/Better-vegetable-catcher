#test
import tkinter as tk
from tkinter import scrolledtext, messagebox
import requests
import pyperclip

# 連接本地 Ollama API
OLLAMA_API_URL = "http://26.64.105.58:11434/api/generate"
MODEL_NAME = "gemma3:1b"

# 發送請求給 Ollama
def chat_with_ollama(prompt):
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_API_URL, json=payload)
        response.raise_for_status()
        return response.json().get("response", "⚠️ 沒有回應！")
    except Exception as e:
        return f"⚠️ 錯誤：{e}"

# 發送訊息並顯示回應
def send_message():
    user_input = entry.get()
    if not user_input.strip():
        return
    
    chat_box.config(state=tk.NORMAL)
    chat_box.insert(tk.END, f"🧑‍💻 你：{user_input}\n", "user")
    entry.delete(0, tk.END)

    # 呼叫 Ollama
    response = chat_with_ollama(user_input)
    chat_box.insert(tk.END, f"🤖 Gemma：{response}\n\n", "bot")

    chat_box.config(state=tk.DISABLED)
    chat_box.yview(tk.END)

# 複製 Gemma 的最後一句話
def copy_last_response():
    text = chat_box.get("end-3l", "end-1l").strip()
    if text:
        pyperclip.copy(text)
        messagebox.showinfo("複製成功", "已複製 Gemma 的回應！")

# 建立 Tkinter 視窗
root = tk.Tk()
root.title("Ollama 聊天室")
root.geometry("500x600")

# 聊天框
chat_box = scrolledtext.ScrolledText(root, wrap=tk.WORD, width=60, height=20, state=tk.DISABLED)
chat_box.tag_config("user", foreground="blue")
chat_box.tag_config("bot", foreground="green")
chat_box.pack(pady=10)

# 輸入框
entry = tk.Entry(root, width=50)
entry.pack(pady=5)

# 按鈕區
btn_frame = tk.Frame(root)
btn_frame.pack()

send_btn = tk.Button(btn_frame, text="發送 🚀", command=send_message)
send_btn.grid(row=0, column=0, padx=5)

copy_btn = tk.Button(btn_frame, text="📋 複製回應", command=copy_last_response)
copy_btn.grid(row=0, column=1, padx=5)

# 啟動視窗
root.mainloop()
