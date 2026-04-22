#ifndef PRINTTASK_H
#define PRINTTASK_H

#include <QString>
#include <QList>
#include <QMap>
#include <QJsonObject>
#include <QJsonArray>

// 打印元素
struct PrintElement {
    QString type;           // text, barcode, qrcode, image, line, rect, table
    QString content;
    double x = 0;           // 毫米
    double y = 0;           // 毫米
    double width = 0;       // 毫米
    double height = 0;      // 毫米
    double fontSize = 12;
    QString fontName = "Microsoft YaHei";
    bool bold = false;
    QString align = "left";
    QString barcodeType = "Code128";
    bool showText = true;
    QString imageData;
    double lineWidth = 1;
    int rows = 3;
    int cols = 2;
    QMap<QString, QString> cellData;

    static PrintElement fromJson(const QJsonObject& json);
};

// 打印任务
struct PrintTask {
    QString taskId;
    QString title;
    double labelWidth = 100;    // 毫米
    double labelHeight = 70;    // 毫米
    int copies = 1;
    QString printerName;
    QString orientation = "portrait";
    int dpi = 203;
    QList<PrintElement> elements;
    QString imageData;

    static PrintTask fromJson(const QJsonObject& json);
};

// 打印结果
struct PrintResult {
    bool success = false;
    QString message;
    QString taskId;

    QJsonObject toJson() const;
};

#endif // PRINTTASK_H
