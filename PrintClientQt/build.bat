@echo off
chcp 65001 >nul
echo ========================================
echo Qt 标签打印客户端 - 编译脚本
echo ========================================
echo.

REM 尝试自动检测 Qt 路径
set QT_PATH=

REM 常见的 Qt 安装路径
if exist "C:\Qt\6.8.0\msvc2022_64\bin\qmake.exe" set QT_PATH=C:\Qt\6.8.0\msvc2022_64
if exist "C:\Qt\6.7.0\msvc2022_64\bin\qmake.exe" set QT_PATH=C:\Qt\6.7.0\msvc2022_64
if exist "C:\Qt\6.6.0\msvc2019_64\bin\qmake.exe" set QT_PATH=C:\Qt\6.6.0\msvc2019_64
if exist "C:\Qt\6.5.3\msvc2019_64\bin\qmake.exe" set QT_PATH=C:\Qt\6.5.3\msvc2019_64
if exist "C:\Qt\6.5.0\msvc2019_64\bin\qmake.exe" set QT_PATH=C:\Qt\6.5.0\msvc2019_64
if exist "D:\Qt\6.8.0\msvc2022_64\bin\qmake.exe" set QT_PATH=D:\Qt\6.8.0\msvc2022_64
if exist "D:\Qt\6.7.0\msvc2022_64\bin\qmake.exe" set QT_PATH=D:\Qt\6.7.0\msvc2022_64

REM 如果没有找到，提示用户手动设置
if "%QT_PATH%"=="" (
    echo 错误: 未自动检测到 Qt 安装路径
    echo.
    echo 请手动设置 Qt 路径，例如:
    echo   set QT_PATH=C:\Qt\6.5.0\msvc2019_64
    echo.
    echo 或者编辑此脚本，在上面添加你的 Qt 路径
    echo.
    set /p QT_PATH="请输入 Qt 路径: "
)

REM 检查 Qt 路径
if not exist "%QT_PATH%\bin\qmake.exe" (
    echo 错误: 未找到 Qt，路径无效: %QT_PATH%
    echo.
    echo 请安装 Qt 6.5+ (MSVC 版本) 并设置正确的路径
    echo 下载地址: https://www.qt.io/download-qt-installer
    pause
    exit /b 1
)

echo [√] Qt 路径: %QT_PATH%
echo.

REM 检查 CMake
where cmake >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 CMake
    echo 请安装 CMake: https://cmake.org/download/
    pause
    exit /b 1
)
echo [√] CMake 已安装

REM 创建构建目录
if not exist build mkdir build
cd build

echo.
echo 正在配置项目...
echo.

REM 尝试使用 Visual Studio 2022
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_PREFIX_PATH="%QT_PATH%" 2>nul
if errorlevel 1 (
    echo 尝试使用 Visual Studio 2019...
    cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_PREFIX_PATH="%QT_PATH%"
)

if errorlevel 1 (
    echo.
    echo 配置失败！
    echo 请确保已安装:
    echo   - Visual Studio 2019 或 2022 (带 C++ 桌面开发)
    echo   - CMake 3.16+
    pause
    exit /b 1
)

echo.
echo [√] 配置成功
echo.
echo 正在编译 Release 版本...
echo.

cmake --build . --config Release --parallel

if errorlevel 1 (
    echo.
    echo 编译失败！请检查错误信息
    pause
    exit /b 1
)

echo.
echo ========================================
echo [√] 编译成功！
echo ========================================
echo.

REM 创建发布目录
if not exist ..\dist mkdir ..\dist
copy Release\PrintClient.exe ..\dist\ >nul

REM 部署 Qt 依赖
echo 正在部署 Qt 依赖库...
"%QT_PATH%\bin\windeployqt.exe" --release --no-translations ..\dist\PrintClient.exe

if errorlevel 1 (
    echo 警告: windeployqt 执行失败，可能需要手动复制 DLL
)

echo.
echo ========================================
echo 打包完成！
echo.
echo 可执行文件位置:
echo   PrintClientQt\dist\PrintClient.exe
echo.
echo 可以将 dist 文件夹整体复制到其他电脑使用
echo ========================================
echo.

cd ..
pause
