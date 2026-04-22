cmake_minimum_required(VERSION 3.16)
project(PrintClient VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# 查找 Qt6
find_package(Qt6 REQUIRED COMPONENTS 
    Core 
    Gui 
    Widgets 
    Network 
    PrintSupport
)

# 源文件
set(SOURCES
    src/main.cpp
    src/mainwindow.cpp
    src/httpserver.cpp
    src/printservice.cpp
    src/printtask.cpp
    src/barcodegenerator.cpp
)

# 头文件
set(HEADERS
    src/mainwindow.h
    src/httpserver.h
    src/printservice.h
    src/printtask.h
    src/barcodegenerator.h
)

# UI 文件
set(UI_FILES
    src/mainwindow.ui
)

# 创建可执行文件
add_executable(${PROJECT_NAME}
    ${SOURCES}
    ${HEADERS}
    ${UI_FILES}
)

# 链接 Qt 库
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Network
    Qt6::PrintSupport
)

# Windows 特定设置
if(WIN32)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
endif()
