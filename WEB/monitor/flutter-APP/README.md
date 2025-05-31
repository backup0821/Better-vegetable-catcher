# ETag 監看系統

這是一個使用 Flutter 開發的 Android 應用程式，用於監控多個 API 端點的狀態。

## 功能特點

- 即時監控多個 API 端點狀態
- 支援分頁顯示多個監控單元
- 自動更新狀態和計時器
- 狀態變更通知和音效提示
- 深色主題設計
- 響應式佈局

## 系統需求

- Flutter SDK 3.0.0 或更高版本
- Android SDK 21 或更高版本
- Android Studio 或 VS Code 與 Flutter 擴充功能

## 安裝步驟

1. 確保已安裝 Flutter SDK 並設置好環境變數
2. 克隆此專案到本地
3. 在專案根目錄執行以下命令安裝依賴：
   ```bash
   flutter pub get
   ```
4. 將音效檔案複製到 `assets/sounds/` 目錄：
   - error.mp3
   - maintenance.mp3
   - outdated.mp3

## 運行應用程式

1. 連接 Android 裝置或啟動模擬器
2. 在專案根目錄執行：
   ```bash
   flutter run
   ```

## 專案結構

```
lib/
  ├── main.dart              # 應用程式入口點
  ├── providers/             # 狀態管理
  │   └── monitor_provider.dart
  ├── screens/              # 畫面
  │   └── monitor_screen.dart
  └── widgets/              # 可重用元件
      ├── monitor_cell.dart
      └── status_bar.dart
```

## 開發者注意事項

- 使用 Provider 進行狀態管理
- 遵循 Material Design 設計規範
- 支援橫向和縱向顯示
- 使用 Flutter 的響應式設計原則

## 授權

MIT License 