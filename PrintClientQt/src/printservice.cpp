#include "printservice.h"
#include <QPrinterInfo>
#include <QPageSize>
#include <QPageLayout>
#include <QFont>
#include <QPen>
#include <QBrush>
#include <QDebug>
#include <QBuffer>
#include <QFile>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QEventLoop>
#include <algorithm>

#ifdef Q_OS_WIN
#include <windows.h>
#include <winspool.h>
#endif

PrintService::PrintService(QObject *parent) : QObject(parent)
{
}

QStringList PrintService::getPrinterList() const
{
    return QPrinterInfo::availablePrinterNames();
}

#ifdef Q_OS_WIN
// Windows 专用：向打印机添加自定义纸张尺寸
bool PrintService::addCustomPaperToPrinter(const QString& printerName, double widthMm, double heightMm)
{
    // 转换 mm �?1/100 英寸（Windows 打印机表单单位）
    double widthInch = widthMm / 25.4;
    double heightInch = heightMm / 25.4;
    LONG widthHundredthInch = static_cast<LONG>(widthInch * 100);
    LONG heightHundredthInch = static_cast<LONG>(heightInch * 100);
    
    emit logMessage(QString("尝试添加自定义纸�? %1x%2mm = %3x%4 (1/100英寸)")
                    .arg(widthMm).arg(heightMm)
                    .arg(widthHundredthInch).arg(heightHundredthInch));
    
    // 打开打印�?
    HANDLE hPrinter = nullptr;
    std::wstring printerNameW = printerName.toStdWString();
    
    if (!OpenPrinterW((LPWSTR)printerNameW.c_str(), &hPrinter, nullptr)) {
        emit logMessage(QString("打开打印机失败，错误�? %1").arg(GetLastError()));
        return false;
    }
    
    // 创建自定义表单名称（包含尺寸信息�?
    QString formName = QString("QtCustom_%1x%2").arg(widthMm, 0, 'f', 0).arg(heightMm, 0, 'f', 0);
    std::wstring formNameW = formName.toStdWString();
    
    // 检查表单是否已存在
    FORM_INFO_1W formInfo;
    DWORD needed = 0;
    if (GetFormW(hPrinter, (LPWSTR)formNameW.c_str(), 1, (LPBYTE)&formInfo, sizeof(formInfo), &needed)) {
        emit logMessage(QString("自定义纸张已存在: %1").arg(formName));
        ClosePrinter(hPrinter);
        return true;
    }
    
    // 创建新表�?
    FORM_INFO_1W newForm = {0};
    newForm.Flags = FORM_USER;  // 用户自定义表�?
    newForm.pName = (LPWSTR)formNameW.c_str();
    newForm.Size.cx = widthHundredthInch;
    newForm.Size.cy = heightHundredthInch;
    newForm.ImageableArea.left = 0;
    newForm.ImageableArea.top = 0;
    newForm.ImageableArea.right = widthHundredthInch;
    newForm.ImageableArea.bottom = heightHundredthInch;
    
    // 添加表单到打印机
    if (!AddFormW(hPrinter, 1, (LPBYTE)&newForm)) {
        DWORD error = GetLastError();
        if (error == ERROR_FILE_EXISTS || error == ERROR_ALREADY_EXISTS) {
            emit logMessage(QString("自定义纸张已存在（忽略错误）"));
            ClosePrinter(hPrinter);
            return true;
        }
        emit logMessage(QString("添加自定义纸张失败，错误�? %1").arg(error));
        ClosePrinter(hPrinter);
        return false;
    }
    
    emit logMessage(QString("�?自定义纸张添加成�? %1").arg(formName));
    ClosePrinter(hPrinter);
    return true;
}
#endif

PrintResult PrintService::print(const PrintTask& task, const QString& defaultPrinter)
{
    PrintResult result;
    result.taskId = task.taskId;

    QString printerName = task.printerName.isEmpty() ? defaultPrinter : task.printerName;
    
    emit logMessage(QString("=== 打印任务开�?==="));
    emit logMessage(QString("打印�? %1").arg(printerName));
    emit logMessage(QString("前端设置的标签尺�? %1x%2mm").arg(task.labelWidth).arg(task.labelHeight));
    emit logMessage(QString("打印份数: %1").arg(task.copies));

    // 1. 获取前端传递的目标尺寸（单位：mm�?
    double targetWidth = task.labelWidth;
    double targetHeight = task.labelHeight;
    QPageLayout::Orientation pageOrientation = QPageLayout::Portrait;
    
    // 根据方向调整尺寸
    if (task.orientation == "landscape" && targetWidth < targetHeight) {
        std::swap(targetWidth, targetHeight);
        pageOrientation = QPageLayout::Landscape;
    } else {
        pageOrientation = QPageLayout::Portrait;
    }

#ifdef Q_OS_WIN
    // 2. Windows: 向打印机添加自定义纸�?
    if (!printerName.isEmpty()) {
        addCustomPaperToPrinter(printerName, targetWidth, targetHeight);
    }
#endif

    // 3. 创建打印机对�?
    QPrinter printer(QPrinter::HighResolution);
    int dpi = task.dpi > 0 ? task.dpi : 203;
    
    if (!printerName.isEmpty()) {
        printer.setPrinterName(printerName);
    }
    
    printer.setCopyCount(qMax(1, task.copies));

    // 4. Apply custom page size layout
    QPageSize customPageSize(QSizeF(targetWidth, targetHeight),
                             QPageSize::Millimeter,
                             QString("Custom_%1x%2").arg(targetWidth, 0, 'f', 0).arg(targetHeight, 0, 'f', 0));
    QPageLayout layout(customPageSize, pageOrientation, QMarginsF(0, 0, 0, 0));
    layout.setMode(QPageLayout::FullPageMode);
    printer.setPageLayout(layout);

    // 5. Disable scaling and use task DPI
    printer.setFullPage(true);  // Fill the entire page
    printer.setPageMargins(QMarginsF(0, 0, 0, 0), QPageLayout::Millimeter);  // Zero margins
    printer.setResolution(dpi);  // Use DPI from task
    
    // Verify settings
    QSizeF actualSize = printer.pageLayout().pageSize().size(QPageSize::Millimeter);
    emit logMessage(QString("Page size applied: %1x%2mm, DPI: %3").arg(actualSize.width(), 0, 'f', 1).arg(actualSize.height(), 0, 'f', 1).arg(printer.resolution()));

    // 6. Start drawing
    QPainter painter;
    if (!painter.begin(&printer)) {
        result.success = false;
        result.message = "Unable to start print";
        emit logMessage("Error: unable to start print");
        return result;
    }

    // Get actual printable area
    QRectF printRect = printer.pageRect(QPrinter::DevicePixel);
    int appliedDpi = printer.resolution();
    double mmToPixel = appliedDpi / 25.4;
    
    emit logMessage(QString("Page resolution: %1 DPI, px/mm: %2").arg(appliedDpi).arg(mmToPixel, 0, 'f', 2));
    emit logMessage(QString("Print area: %1x%2 px").arg(printRect.width(), 0, 'f', 0).arg(printRect.height(), 0, 'f', 0));

    // 7. 绘制所有元�?
    int elementCount = 0;
    for (const auto& el : task.elements) {
        try {
            drawElement(painter, el, mmToPixel);
            elementCount++;
        } catch (...) {
            emit logMessage(QString("绘制元素错误: %1").arg(el.type));
        }
    }

    painter.end();

    result.success = true;
    result.message = QString("打印成功 - 尺寸:%1x%2mm, 元素:%3�? 份数:%4")
                     .arg(targetWidth).arg(targetHeight)
                     .arg(elementCount).arg(task.copies);
    emit logMessage(QString("�?%1").arg(result.message));
    emit printCompleted(result);

    return result;
}

void PrintService::drawElement(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    QString type = el.type.toLower();
    
    if (type == "text") {
        drawText(painter, el, mmToPixel);
    } else if (type == "barcode") {
        drawBarcode(painter, el, mmToPixel);
    } else if (type == "qrcode") {
        drawQRCode(painter, el, mmToPixel);
    } else if (type == "image") {
        drawImage(painter, el, mmToPixel);
    } else if (type == "line") {
        drawLine(painter, el, mmToPixel);
    } else if (type == "rect") {
        drawRect(painter, el, mmToPixel);
    } else if (type == "table") {
        drawTable(painter, el, mmToPixel);
    }
}

void PrintService::drawText(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    if (el.content.isEmpty()) return;

    QFont font(el.fontName, el.fontSize);
    font.setBold(el.bold);
    painter.setFont(font);
    painter.setPen(Qt::black);

    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;

    int flags = Qt::AlignTop;
    if (el.align == "center") flags |= Qt::AlignHCenter;
    else if (el.align == "right") flags |= Qt::AlignRight;
    else flags |= Qt::AlignLeft;

    if (w > 0) {
        QRectF rect(x, y, w, 1000);
        painter.drawText(rect, flags | Qt::TextWordWrap, el.content);
    } else {
        painter.drawText(QPointF(x, y + el.fontSize), el.content);
    }
}

void PrintService::drawBarcode(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    if (el.content.isEmpty()) return;

    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;
    double h = el.height * mmToPixel;

    QImage barcode = generateBarcode(el.content, el.barcodeType, w, h, el.showText);
    if (!barcode.isNull()) {
        painter.drawImage(QRectF(x, y, w, h), barcode);
    }
}

void PrintService::drawQRCode(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    if (el.content.isEmpty()) return;

    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double size = qMax(el.width, el.height) * mmToPixel;

    QImage qrcode = generateQRCode(el.content, size);
    if (!qrcode.isNull()) {
        painter.drawImage(QRectF(x, y, size, size), qrcode);
    }
}

void PrintService::drawImage(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    QString src = el.imageData.isEmpty() ? el.content : el.imageData;
    if (src.isEmpty()) return;

    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;
    double h = el.height * mmToPixel;

    QImage img;
    
    if (src.startsWith("data:image")) {
        // Base64 图片
        int commaIndex = src.indexOf(',');
        if (commaIndex > 0) {
            QByteArray base64Data = src.mid(commaIndex + 1).toUtf8();
            QByteArray imageData = QByteArray::fromBase64(base64Data);
            img.loadFromData(imageData);
        }
    } else if (QFile::exists(src)) {
        // 本地文件
        img.load(src);
    }

    if (!img.isNull()) {
        painter.drawImage(QRectF(x, y, w, h), img);
    }
}

void PrintService::drawLine(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;
    double h = el.height * mmToPixel;

    QPen pen(Qt::black, el.lineWidth * mmToPixel / 3);
    painter.setPen(pen);
    painter.drawLine(QPointF(x, y), QPointF(x + w, y + h));
}

void PrintService::drawRect(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;
    double h = el.height * mmToPixel;

    QPen pen(Qt::black, el.lineWidth * mmToPixel / 3);
    painter.setPen(pen);
    painter.setBrush(Qt::NoBrush);
    painter.drawRect(QRectF(x, y, w, h));
}

void PrintService::drawTable(QPainter& painter, const PrintElement& el, double mmToPixel)
{
    double x = el.x * mmToPixel;
    double y = el.y * mmToPixel;
    double w = el.width * mmToPixel;
    double h = el.height * mmToPixel;

    int rows = qMax(1, el.rows);
    int cols = qMax(1, el.cols);
    double cw = w / cols;
    double ch = h / rows;

    QPen pen(Qt::black, mmToPixel / 3);
    painter.setPen(pen);

    // 绘制网格�?
    for (int i = 0; i <= rows; i++) {
        painter.drawLine(QPointF(x, y + i * ch), QPointF(x + w, y + i * ch));
    }
    for (int j = 0; j <= cols; j++) {
        painter.drawLine(QPointF(x + j * cw, y), QPointF(x + j * cw, y + h));
    }

    // 绘制单元格内�?
    QFont font(el.fontName, el.fontSize > 0 ? el.fontSize : 10);
    painter.setFont(font);
    
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            QString key = QString("%1-%2").arg(i).arg(j);
            if (el.cellData.contains(key)) {
                QRectF cellRect(x + j * cw, y + i * ch, cw, ch);
                painter.drawText(cellRect, Qt::AlignCenter, el.cellData[key]);
            }
        }
    }
}

// 使用条码生成�?
#include "barcodegenerator.h"

QImage PrintService::generateBarcode(const QString& content, const QString& type, int width, int height, bool showText)
{
    QString upperType = type.toUpper();
    
    if (upperType == "CODE39") {
        return BarcodeGenerator::generateCode39(content, width, height, showText);
    } else {
        // 默认使用 Code128
        return BarcodeGenerator::generateCode128(content, width, height, showText);
    }
}

QImage PrintService::generateQRCode(const QString& content, int size)
{
    return BarcodeGenerator::generateQRCode(content, size);
}
