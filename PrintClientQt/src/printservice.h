#ifndef PRINTSERVICE_H
#define PRINTSERVICE_H

#include <QObject>
#include <QPrinter>
#include <QPainter>
#include <QStringList>
#include "printtask.h"

class PrintService : public QObject
{
    Q_OBJECT

public:
    explicit PrintService(QObject *parent = nullptr);

    // 获取打印机列表
    QStringList getPrinterList() const;

    // 执行打印
    PrintResult print(const PrintTask& task, const QString& defaultPrinter);

signals:
    void printCompleted(const PrintResult& result);
    void logMessage(const QString& message);

private:
    // 绘制元素
    void drawElement(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawText(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawBarcode(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawQRCode(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawImage(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawLine(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawRect(QPainter& painter, const PrintElement& el, double mmToPixel);
    void drawTable(QPainter& painter, const PrintElement& el, double mmToPixel);

    // 生成条码图像
    QImage generateBarcode(const QString& content, const QString& type, int width, int height, bool showText);
    QImage generateQRCode(const QString& content, int size);

#ifdef Q_OS_WIN
    // Windows 专用：向打印机添加自定义纸张
    bool addCustomPaperToPrinter(const QString& printerName, double widthMm, double heightMm);
#endif
};

#endif // PRINTSERVICE_H
