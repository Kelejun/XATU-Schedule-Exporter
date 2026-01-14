# XATU 课表导出助手 (XATU Schedule Exporter)

这是一个适用于西安工业大学（XATU）教务系统的浏览器扩展程序。它可以帮助学生将教务系统的课程表一键导出为 `.ics` 日历文件，方便导入到 Outlook, Apple Calendar, Google Calendar 等日程管理软件中。

## 功能特点

- 📅 **一键导出**：自动识别教务系统课程表，生成标准 ICS 文件。
- 🔄 **智能解析**：
  - 支持单双周课程解析。
  - 支持多时间段、多地点的复杂课程。
  - 自动合并连续的课程节次。
- 🛡️ **本地处理**：所有数据解析在本地完成。

## 安装说明

1. 下载本项目的 `.zip` 压缩包或克隆代码仓库。
2. 打开 Microsoft Edge 或 Google Chrome 浏览器。
3. 进入扩展程序管理页面：
   - Edge: `edge://extensions`
   - Chrome: `chrome://extensions`
4. 开启右上角的 **“开发者模式”**。
5. 点击 **“加载解压缩的扩展”** (Load unpacked)。
6. 选择包含 `manifest.json` 文件的目录。

## 使用方法

1. 登录西安工业大学教务系统 (`jwgl2018.xatu.edu.cn`)。
2. 进入 **“我的课表”** 页面。
3. 扩展程序会自动检测课程表，并在屏幕右下角显示一个悬浮按钮 **“📅 导出课程表”**。
4. 点击按钮，输入本学期第一周周一的日期（例如 `2026-03-02`）。
5. 浏览器将自动下载 `.ics` 文件。
6. 打开 `.ics` 文件即可导入到您的系统日历中。

## 隐私政策

请参阅 [PRIVACY.md](PRIVACY.md)。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## AI 开发辅助情况

本项目在 Gemini 3.0 Pro 及 Github Copilot 的辅助下开发。
