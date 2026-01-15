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


### 通过浏览器直接安装
1. 通过 [Release 页面](https://github.com/Kelejun/XATU-Schedule-Exporter/releases)下载本项目的 `.zip` 压缩包或直接克隆代码仓库。
2. 将下载的 `.zip` 文件解压。
3. 打开 Microsoft Edge / Google Chrome 或其他基于 Chromium 的浏览器。
4. 进入扩展程序管理页面：
   - Edge: `edge://extensions`
   - Chrome: `chrome://extensions`
   - 其他浏览器：请自行寻找拓展管理页面。
5. 开启右上角的 **“开发者模式”**。
6. 点击 **“加载解压缩的扩展”** (Load unpacked)。
7. 选择包含 `manifest.json` 文件的目录。

### 通过 Microsoft Edge 商店安装
`待审核`

## 使用方法

1. 登录西安工业大学教务系统 (`jwgl2018.xatu.edu.cn`)。
2. 进入 **“我的课表”** 页面。
3. 扩展程序会自动检测课程表，并在屏幕右下角显示一个悬浮按钮 **“📅 导出课程表”**。
4. 点击按钮，输入本学期第一周周一的日期（例如 `2026-03-02`）。
5. 浏览器将自动下载 `.ics` 文件。
6. 然后你可以把 `.ics` 文件导入到日历软件中。

## 如何导入 .ics 文件到日历中

### Outlook (Windows)
1. 打开 Outlook。
2. 从左侧侧边栏切换到“日历”页面
3. 点击“**添加日历**”
4. 选择“**从文件上传**”并选择 `.ics` 文件

### Apple Calendar (iOS)
1. 将文件保存到 文件 (Files) app。
2. 打开 文件 (Files) app。
3. 找到对应的 `.ics` 文件，按住并拖动不释放，保持按住文件，然后切换到 Apple Calendar。
4. 将其拖动到日历中，此时文件右上角会出现一个绿色 + 号。
5. 松手，然后点击右上角“**添加**”。


## 隐私政策

请参阅 [PRIVACY.md](PRIVACY.md)。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## AI 声明

本项目在 Gemini 3.0 Pro 及 Github Copilot 的辅助下开发。
