#include "barcodegenerator.h"
#include <QPainter>
#include <QFont>

const QMap<QChar, QString>& BarcodeGenerator::getCode128Table()
{
    static QMap<QChar, QString> table;
    if (table.isEmpty()) {
        // Code128B 编码（简化版，仅包含常用字符）
        table[' '] = "11011001100";
        table['!'] = "11001101100";
        table['"'] = "11001100110";
        table['#'] = "10010011000";
        table['$'] = "10010001100";
        table['%'] = "10001001100";
        table['&'] = "10011001000";
        table['\''] = "10011000100";
        table['('] = "10001100100";
        table[')'] = "11001001000";
        table['*'] = "11001000100";
        table['+'] = "11000100100";
        table[','] = "10110011100";
        table['-'] = "10011011100";
        table['.'] = "10011001110";
        table['/'] = "10111001100";
        table['0'] = "10011101100";
        table['1'] = "10011100110";
        table['2'] = "11001110010";
        table['3'] = "11001011100";
        table['4'] = "11001001110";
        table['5'] = "11011100100";
        table['6'] = "11001110100";
        table['7'] = "11101101110";
        table['8'] = "11101001100";
        table['9'] = "11100101100";
        table[':'] = "11100100110";
        table[';'] = "11101100100";
        table['<'] = "11100110100";
        table['='] = "11100110010";
        table['>'] = "11011011000";
        table['?'] = "11011000110";
        table['@'] = "11000110110";
        
        // 大写字母
        for (char c = 'A'; c <= 'Z'; c++) {
            int idx = c - 'A';
            QString pattern;
            // 简化的编码模式
            for (int i = 0; i < 11; i++) {
                pattern += ((idx + i) % 2 == 0) ? '1' : '0';
            }
            table[QChar(c)] = pattern;
        }
        
        // 小写字母
        for (char c = 'a'; c <= 'z'; c++) {
            int idx = c - 'a';
            QString pattern;
            for (int i = 0; i < 11; i++) {
                pattern += ((idx + i + 1) % 2 == 0) ? '1' : '0';
            }
            table[QChar(c)] = pattern;
        }
    }
    return table;
}

const QMap<QChar, QString>& BarcodeGenerator::getCode39Table()
{
    static QMap<QChar, QString> table;
    if (table.isEmpty()) {
        table['0'] = "101001101101";
        table['1'] = "110100101011";
        table['2'] = "101100101011";
        table['3'] = "110110010101";
        table['4'] = "101001101011";
        table['5'] = "110100110101";
        table['6'] = "101100110101";
        table['7'] = "101001011011";
        table['8'] = "110100101101";
        table['9'] = "101100101101";
        table['A'] = "110101001011";
        table['B'] = "101101001011";
        table['C'] = "110110100101";
        table['D'] = "101011001011";
        table['E'] = "110101100101";
        table['F'] = "101101100101";
        table['G'] = "101010011011";
        table['H'] = "110101001101";
        table['I'] = "101101001101";
        table['J'] = "101011001101";
        table['K'] = "110101010011";
        table['L'] = "101101010011";
        table['M'] = "110110101001";
        table['N'] = "101011010011";
        table['O'] = "110101101001";
        table['P'] = "101101101001";
        table['Q'] = "101010110011";
        table['R'] = "110101011001";
        table['S'] = "101101011001";
        table['T'] = "101011011001";
        table['U'] = "110010101011";
        table['V'] = "100110101011";
        table['W'] = "110011010101";
        table['X'] = "100101101011";
        table['Y'] = "110010110101";
        table['Z'] = "100110110101";
        table['-'] = "100101011011";
        table['.'] = "110010101101";
        table[' '] = "100110101101";
        table['*'] = "100101101101"; // 起始/结束符
    }
    return table;
}

QImage BarcodeGenerator::generateCode128(const QString& content, int width, int height, bool showText)
{
    QImage image(width, height, QImage::Format_RGB32);
    image.fill(Qt::white);
    
    QPainter painter(&image);
    painter.setPen(Qt::black);
    painter.setBrush(Qt::black);
    
    const auto& table = getCode128Table();
    
    // 构建条码数据
    QString barcodeData;
    barcodeData += "11010010000"; // 起始符 (Code B)
    
    for (const QChar& c : content) {
        if (table.contains(c)) {
            barcodeData += table[c];
        } else {
            barcodeData += table['?']; // 未知字符用 ? 替代
        }
    }
    
    barcodeData += "1100011101011"; // 结束符
    
    // 计算条宽
    int textHeight = showText ? 20 : 0;
    int barHeight = height - textHeight - 4;
    double barWidth = (double)(width - 20) / barcodeData.length();
    if (barWidth < 1) barWidth = 1;
    
    // 绘制条码
    double x = 10;
    for (const QChar& bit : barcodeData) {
        if (bit == '1') {
            painter.fillRect(QRectF(x, 2, barWidth, barHeight), Qt::black);
        }
        x += barWidth;
    }
    
    // 绘制文字
    if (showText) {
        QFont font("Arial", 10);
        painter.setFont(font);
        painter.drawText(QRect(0, height - textHeight, width, textHeight), Qt::AlignCenter, content);
    }
    
    painter.end();
    return image;
}

QImage BarcodeGenerator::generateCode39(const QString& content, int width, int height, bool showText)
{
    QImage image(width, height, QImage::Format_RGB32);
    image.fill(Qt::white);
    
    QPainter painter(&image);
    painter.setPen(Qt::black);
    painter.setBrush(Qt::black);
    
    const auto& table = getCode39Table();
    
    // 构建条码数据（Code39 需要起始和结束符 *）
    QString barcodeData;
    barcodeData += table['*']; // 起始符
    barcodeData += "0"; // 间隔
    
    QString upperContent = content.toUpper();
    for (const QChar& c : upperContent) {
        if (table.contains(c)) {
            barcodeData += table[c];
            barcodeData += "0"; // 字符间隔
        }
    }
    
    barcodeData += table['*']; // 结束符
    
    // 计算条宽
    int textHeight = showText ? 20 : 0;
    int barHeight = height - textHeight - 4;
    double barWidth = (double)(width - 20) / barcodeData.length();
    if (barWidth < 1) barWidth = 1;
    
    // 绘制条码
    double x = 10;
    for (const QChar& bit : barcodeData) {
        if (bit == '1') {
            painter.fillRect(QRectF(x, 2, barWidth, barHeight), Qt::black);
        }
        x += barWidth;
    }
    
    // 绘制文字
    if (showText) {
        QFont font("Arial", 10);
        painter.setFont(font);
        painter.drawText(QRect(0, height - textHeight, width, textHeight), Qt::AlignCenter, content);
    }
    
    painter.end();
    return image;
}

QImage BarcodeGenerator::generateQRCode(const QString& content, int size)
{
    // 简化的 QR Code 生成（仅用于演示）
    // 生产环境建议使用 QZXing 或 libqrencode
    
    QImage image(size, size, QImage::Format_RGB32);
    image.fill(Qt::white);
    
    QPainter painter(&image);
    painter.setPen(Qt::black);
    painter.setBrush(Qt::black);
    
    int moduleCount = 21; // QR Code Version 1
    int moduleSize = size / (moduleCount + 8); // 留边距
    if (moduleSize < 2) moduleSize = 2;
    
    int offset = (size - moduleCount * moduleSize) / 2;
    
    // 绘制定位图案
    auto drawFinderPattern = [&](int x, int y) {
        // 外框
        painter.fillRect(x, y, moduleSize * 7, moduleSize * 7, Qt::black);
        // 白色内框
        painter.fillRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5, Qt::white);
        // 黑色中心
        painter.fillRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize * 3, moduleSize * 3, Qt::black);
    };
    
    // 三个定位图案
    drawFinderPattern(offset, offset);
    drawFinderPattern(offset + (moduleCount - 7) * moduleSize, offset);
    drawFinderPattern(offset, offset + (moduleCount - 7) * moduleSize);
    
    // 时序图案
    for (int i = 8; i < moduleCount - 8; i++) {
        if (i % 2 == 0) {
            painter.fillRect(offset + i * moduleSize, offset + 6 * moduleSize, moduleSize, moduleSize, Qt::black);
            painter.fillRect(offset + 6 * moduleSize, offset + i * moduleSize, moduleSize, moduleSize, Qt::black);
        }
    }
    
    // 数据区域（简化：根据内容生成伪随机图案）
    for (int i = 0; i < content.length() && i < 100; i++) {
        int charCode = content[i].unicode();
        int row = 9 + (i / 8);
        int col = 9 + (i % 8);
        
        if (row < moduleCount - 1 && col < moduleCount - 1) {
            if (charCode % 2 == 0) {
                painter.fillRect(offset + col * moduleSize, offset + row * moduleSize, moduleSize, moduleSize, Qt::black);
            }
            // 添加一些额外的模块
            if ((charCode / 2) % 2 == 0 && col + 1 < moduleCount - 1) {
                painter.fillRect(offset + (col + 1) * moduleSize, offset + row * moduleSize, moduleSize, moduleSize, Qt::black);
            }
        }
    }
    
    painter.end();
    return image;
}
