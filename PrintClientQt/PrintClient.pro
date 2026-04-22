# Qt 标签打印客户端 - qmake 项目文件
# 如果你更喜欢使用 qmake 而不是 CMake，可以使用此文件

QT += core gui widgets network printsupport

greaterThan(QT_MAJOR_VERSION, 5): QT += core5compat

CONFIG += c++17

TARGET = PrintClient
TEMPLATE = app

# 源文件
SOURCES += \
    src/main.cpp \
    src/mainwindow.cpp \
    src/httpserver.cpp \
    src/printservice.cpp \
    src/printtask.cpp \
    src/barcodegenerator.cpp

# 头文件
HEADERS += \
    src/mainwindow.h \
    src/httpserver.h \
    src/printservice.h \
    src/printtask.h \
    src/barcodegenerator.h

# UI 文件
FORMS += \
    src/mainwindow.ui

# Windows 图标
win32:RC_ICONS = resources/icon.ico

# 输出目录
DESTDIR = $$PWD/bin

# 默认规则
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target
