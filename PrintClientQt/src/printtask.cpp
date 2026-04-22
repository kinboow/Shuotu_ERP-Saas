#include "printtask.h"
#include <QJsonDocument>

PrintElement PrintElement::fromJson(const QJsonObject& json) {
    PrintElement el;
    el.type = json["type"].toString("text");
    el.content = json["content"].toString();
    el.x = json["x"].toDouble(0);
    el.y = json["y"].toDouble(0);
    el.width = json["width"].toDouble(0);
    el.height = json["height"].toDouble(0);
    el.fontSize = json["fontSize"].toDouble(12);
    el.fontName = json["fontName"].toString("Microsoft YaHei");
    el.bold = json["bold"].toBool(false);
    el.align = json["align"].toString("left");
    el.barcodeType = json["barcodeType"].toString("Code128");
    el.showText = json["showText"].toBool(true);
    el.imageData = json["imageData"].toString();
    el.lineWidth = json["lineWidth"].toDouble(1);
    el.rows = json["rows"].toInt(3);
    el.cols = json["cols"].toInt(2);
    
    // 解析表格数据
    QJsonObject cellDataObj = json["cellData"].toObject();
    for (auto it = cellDataObj.begin(); it != cellDataObj.end(); ++it) {
        el.cellData[it.key()] = it.value().toString();
    }
    
    return el;
}

PrintTask PrintTask::fromJson(const QJsonObject& json) {
    PrintTask task;
    task.taskId = json["taskId"].toString();
    task.title = json["title"].toString("标签打印");
    task.labelWidth = json["labelWidth"].toDouble(100);
    task.labelHeight = json["labelHeight"].toDouble(70);
    task.copies = json["copies"].toInt(1);
    task.printerName = json["printerName"].toString();
    task.orientation = json["orientation"].toString("portrait");
    task.dpi = json["dpi"].toInt(203);
    task.imageData = json["imageData"].toString();
    
    // 解析元素列表
    QJsonArray elementsArray = json["elements"].toArray();
    for (const auto& el : elementsArray) {
        task.elements.append(PrintElement::fromJson(el.toObject()));
    }
    
    return task;
}


QJsonObject PrintResult::toJson() const {
    QJsonObject obj;
    obj["success"] = success;
    obj["message"] = message;
    obj["taskId"] = taskId;
    return obj;
}
