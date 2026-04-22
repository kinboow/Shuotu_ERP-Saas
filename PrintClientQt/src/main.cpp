#include "mainwindow.h"
#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    
    // 设置应用程序信息
    QApplication::setApplicationName("PrintClient");
    QApplication::setApplicationVersion("1.0.0");
    QApplication::setOrganizationName("PrintClient");
    
    MainWindow w;
    w.show();
    
    return a.exec();
}
