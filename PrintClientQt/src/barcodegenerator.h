#ifndef BARCODEGENERATOR_H
#define BARCODEGENERATOR_H

#include <QImage>
#include <QString>
#include <QMap>

/**
 * 简单的条码生成器
 * 支持 Code128、Code39 和 QR Code
 * 
 * 注意：这是一个简化实现，用于演示
 * 生产环境建议使用 QZXing 或 ZXing-cpp 库
 */
class BarcodeGenerator
{
public:
    // 生成 Code128 条码
    static QImage generateCode128(const QString& content, int width, int height, bool showText = true);
    
    // 生成 Code39 条码
    static QImage generateCode39(const QString& content, int width, int height, bool showText = true);
    
    // 生成 QR Code
    static QImage generateQRCode(const QString& content, int size);

private:
    // Code128 编码表
    static const QMap<QChar, QString>& getCode128Table();
    
    // Code39 编码表
    static const QMap<QChar, QString>& getCode39Table();
};

#endif // BARCODEGENERATOR_H
