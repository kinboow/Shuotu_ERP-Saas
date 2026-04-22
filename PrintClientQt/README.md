# Qt 标签打印客户端

基于 Qt6 的远程标签打印客户端，支持自定义纸张尺寸。

## 🎯 核心优势

### ✅ 精确的自定义纸张尺寸
Qt 的 `QPrinter` 可以直接设置任意纸张尺寸，无需在 Windows 中手动添加纸张：

```cpp
// 直接设置自定义纸张尺寸（毫米）
QPageSize customPageSize(QSizeF(100, 70), QPageSize::Millimeter);
printer.setPageLayout(QPageLayout(customPageSize, QPageLayout::Portrait, QMarginsF(0,0,0,0)));
```

**前端设置什么尺寸，打印出来就是什么尺寸！**

## 📋 功能特性

- ✅ HTTP 服务监听（端口 9100）
- ✅ 自定义纸张尺寸（任意毫米值）
- ✅ 支持文本、条码、二维码、图片、线条、矩形、表格
- ✅ 后端服务器注册和心跳
- ✅ 多打印机管理
- ✅ 实时日志显示

## 🔧 编译要求

### Windows
- Qt 6.5+ (包含 Qt PrintSupport 模块)
- CMake 3.16+
- Visual Studio 2019+ 或 MinGW

### 安装 Qt
1. 下载 Qt 安装器：https://www.qt.io/download-qt-installer
2. 安装时选择：
   - Qt 6.5 或更高版本
   - Qt PrintSupport 模块
   - CMake

## 🚀 编译步骤

### 方法一：使用 Qt Creator（推荐）

1. 打开 Qt Creator
2. 文件 → 打开文件或项目
3. 选择 `CMakeLists.txt`
4. 配置项目（选择 Qt 6 套件）
5. 点击 "构建" 按钮

### 方法二：命令行编译

```powershell
# 进入项目目录
cd PrintClientQt

# 创建构建目录
mkdir build
cd build

# 配置（需要设置 Qt 路径）
cmake .. -G "Visual Studio 17 2022" -DCMAKE_PREFIX_PATH="C:/Qt/6.5.0/msvc2019_64"

# 编译
cmake --build . --config Release

# 可执行文件在 Release/PrintClient.exe
```

### 方法三：使用 qmake

如果你更熟悉 qmake，可以创建 .pro 文件：

```pro
QT += core gui widgets network printsupport
CONFIG += c++17
TARGET = PrintClient
TEMPLATE = app

SOURCES += \
    src/main.cpp \
    src/mainwindow.cpp \
    src/httpserver.cpp \
    src/printservice.cpp \
    src/printtask.cpp

HEADERS += \
    src/mainwindow.h \
    src/httpserver.h \
    src/printservice.h \
    src/printtask.h

FORMS += \
    src/mainwindow.ui
```

## 📖 使用说明

### 1. 启动客户端
运行 `PrintClient.exe`

### 2. 配置服务
- 设置监听端口（默认 9100）
- 点击 "启动服务"

### 3. 连接后端
- 输入后端服务器地址
- 输入客户端名称
- 点击 "注册到服务器"

### 4. 打印测试
- 选择打印机
- 点击 "测试打印"
- 验证打印尺寸是否正确

## 🔌 API 接口

### POST /print
发送打印任务

```json
{
  "taskId": "task-123",
  "title": "标签打印",
  "labelWidth": 100,
  "labelHeight": 70,
  "copies": 1,
  "elements": [
    {
      "type": "text",
      "content": "测试文本",
      "x": 5,
      "y": 5,
      "fontSize": 12,
      "bold": true
    }
  ]
}
```

### GET /status
获取服务状态

### GET /printers
获取打印机列表

## 📐 纸张尺寸说明

Qt 版本的核心优势是可以直接设置任意纸张尺寸：

| 设置尺寸 | 实际输出 | 说明 |
|---------|---------|------|
| 100x70mm | 100x70mm | ✅ 精确匹配 |
| 50x30mm | 50x30mm | ✅ 精确匹配 |
| 任意尺寸 | 任意尺寸 | ✅ 精确匹配 |

**无需手动添加纸张，无需配置打印机！**

## 🐛 故障排除

### 编译错误：找不到 Qt
确保设置了正确的 `CMAKE_PREFIX_PATH`：
```powershell
cmake .. -DCMAKE_PREFIX_PATH="C:/Qt/6.5.0/msvc2019_64"
```

### 运行时错误：缺少 DLL
将 Qt 的 bin 目录添加到 PATH，或使用 `windeployqt`：
```powershell
windeployqt PrintClient.exe
```

### 打印尺寸不对
Qt 版本应该不会有这个问题。如果仍然不对：
1. 检查打印机驱动是否最新
2. 检查打印机是否支持自定义纸张
3. 查看日志中的 DPI 信息

## 📞 技术支持

如有问题，请查看日志输出或提交 Issue。

---

**版本**: 1.0.0  
**更新日期**: 2024年1月
