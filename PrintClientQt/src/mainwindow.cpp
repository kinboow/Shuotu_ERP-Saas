#include "mainwindow.h"
#include "ui_mainwindow.h"
#include <QMessageBox>
#include <QCloseEvent>
#include <QSettings>
#include <QDateTime>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QHostInfo>
#include <QNetworkInterface>
#include <QPrinterInfo>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
    , m_httpServer(new HttpServer(this))
    , m_printService(new PrintService(this))
    , m_heartbeatTimer(new QTimer(this))
    , m_networkManager(new QNetworkAccessManager(this))
    , m_isConnectedToServer(false)
    , m_printCount(0)
{
    ui->setupUi(this);

    // 连接信号槽
    connect(ui->btnStart, &QPushButton::clicked, this, &MainWindow::onStartClicked);
    connect(ui->btnStop, &QPushButton::clicked, this, &MainWindow::onStopClicked);
    connect(ui->btnRefresh, &QPushButton::clicked, this, &MainWindow::onRefreshPrintersClicked);
    connect(ui->btnTestPrint, &QPushButton::clicked, this, &MainWindow::onTestPrintClicked);
    connect(ui->btnClearLog, &QPushButton::clicked, this, &MainWindow::onClearLogClicked);
    connect(ui->btnRegister, &QPushButton::clicked, this, &MainWindow::onRegisterClicked);
    connect(ui->btnDisconnect, &QPushButton::clicked, this, &MainWindow::onDisconnectClicked);
    connect(ui->btnAddPaperSizes, &QPushButton::clicked, this, &MainWindow::onAddPaperSizesClicked);
    connect(ui->btnDiagnostic, &QPushButton::clicked, this, &MainWindow::onDiagnosticClicked);

    connect(m_httpServer, &HttpServer::printRequest, this, &MainWindow::onPrintRequest);
    connect(m_httpServer, &HttpServer::logMessage, this, &MainWindow::onLogMessage);
    connect(m_printService, &PrintService::logMessage, this, &MainWindow::onLogMessage);

    connect(m_heartbeatTimer, &QTimer::timeout, this, &MainWindow::onHeartbeat);
    m_heartbeatTimer->setInterval(30000);

    loadSettings();
    loadPrinters();
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::closeEvent(QCloseEvent *event)
{
    if (m_httpServer->isRunning() || m_isConnectedToServer) {
        auto result = QMessageBox::question(this, "确认", "服务正在运行，确定要退出吗？");
        if (result == QMessageBox::No) {
            event->ignore();
            return;
        }
        m_httpServer->stop();
        disconnectFromServer();
    }
    saveSettings();
    event->accept();
}

void MainWindow::loadSettings()
{
    QSettings settings("PrintClient", "PrintClient");
    ui->editServerUrl->setText(settings.value("serverUrl", "http://localhost:5000").toString());
    ui->editClientName->setText(settings.value("clientName", "打印客户端").toString());
    ui->spinPort->setValue(settings.value("port", 9100).toInt());
}

void MainWindow::saveSettings()
{
    QSettings settings("PrintClient", "PrintClient");
    settings.setValue("serverUrl", ui->editServerUrl->text());
    settings.setValue("clientName", ui->editClientName->text());
    settings.setValue("port", ui->spinPort->value());
}

void MainWindow::loadPrinters()
{
    ui->comboPrinters->clear();
    QStringList printers = m_printService->getPrinterList();
    ui->comboPrinters->addItems(printers);
    
    // 选择默认打印机
    QString defaultPrinter = QPrinterInfo::defaultPrinterName();
    int index = ui->comboPrinters->findText(defaultPrinter);
    if (index >= 0) {
        ui->comboPrinters->setCurrentIndex(index);
    }
}

void MainWindow::updateUI(bool running)
{
    ui->btnStart->setEnabled(!running);
    ui->btnStop->setEnabled(running);
    ui->spinPort->setEnabled(!running);
    ui->labelStatus->setText(running ? "● 服务运行中" : "● 服务未启动");
    ui->labelStatus->setStyleSheet(running ? "color: green;" : "color: gray;");
}

void MainWindow::addLog(const QString& message)
{
    QString timestamp = QDateTime::currentDateTime().toString("[HH:mm:ss]");
    ui->listLog->insertItem(0, timestamp + " " + message);
    
    // 限制日志数量
    while (ui->listLog->count() > 500) {
        delete ui->listLog->takeItem(ui->listLog->count() - 1);
    }
}

void MainWindow::onStartClicked()
{
    int port = ui->spinPort->value();
    
    // 设置打印机列表
    m_httpServer->setPrinterList(m_printService->getPrinterList());
    
    if (m_httpServer->start(port)) {
        updateUI(true);
        addLog(QString("服务已启动，监听端口: %1").arg(port));
        
        // 自动连接到后端服务器
        if (!ui->editServerUrl->text().isEmpty()) {
            QTimer::singleShot(500, this, &MainWindow::registerToServer);
        }
    } else {
        QMessageBox::warning(this, "错误", "启动服务失败，端口可能被占用");
    }
}

void MainWindow::onStopClicked()
{
    m_httpServer->stop();
    updateUI(false);
    addLog("服务已停止");
}

void MainWindow::onRefreshPrintersClicked()
{
    loadPrinters();
    // 更新 HTTP 服务器的打印机列表
    m_httpServer->setPrinterList(m_printService->getPrinterList());
    addLog("已刷新打印机列表");
}

void MainWindow::onTestPrintClicked()
{
    if (ui->comboPrinters->currentText().isEmpty()) {
        QMessageBox::warning(this, "提示", "请先选择打印机");
        return;
    }

    // 创建测试打印任务
    PrintTask task;
    task.taskId = QString("test-%1").arg(QDateTime::currentMSecsSinceEpoch());
    task.title = "测试标签";
    task.labelWidth = 100;
    task.labelHeight = 70;
    task.copies = 1;

    PrintElement textEl;
    textEl.type = "text";
    textEl.content = "测试标签";
    textEl.x = 5;
    textEl.y = 10;
    textEl.fontSize = 14;
    textEl.bold = true;
    task.elements.append(textEl);

    PrintElement sizeEl;
    sizeEl.type = "text";
    sizeEl.content = QString("尺寸: %1x%2mm").arg(task.labelWidth).arg(task.labelHeight);
    sizeEl.x = 5;
    sizeEl.y = 30;
    sizeEl.fontSize = 10;
    task.elements.append(sizeEl);

    addLog(QString("测试打印: %1x%2mm").arg(task.labelWidth).arg(task.labelHeight));
    
    PrintResult result = m_printService->print(task, ui->comboPrinters->currentText());
    
    if (result.success) {
        m_printCount++;
        ui->labelPrintCount->setText(QString("已打印: %1").arg(m_printCount));
        addLog("✅ 测试打印成功");
    } else {
        addLog("❌ 测试打印失败: " + result.message);
    }
}

void MainWindow::onClearLogClicked()
{
    ui->listLog->clear();
    addLog("日志已清空");
}

void MainWindow::onRegisterClicked()
{
    if (!m_httpServer->isRunning()) {
        QMessageBox::warning(this, "提示", "请先启动本地 HTTP 服务");
        return;
    }
    registerToServer();
}

void MainWindow::onDisconnectClicked()
{
    disconnectFromServer();
}

void MainWindow::registerToServer()
{
    QString serverUrl = ui->editServerUrl->text().trimmed();
    QString clientName = ui->editClientName->text().trimmed();
    int port = ui->spinPort->value();

    if (serverUrl.isEmpty() || clientName.isEmpty()) {
        QMessageBox::warning(this, "提示", "请输入服务器地址和客户端名称");
        return;
    }

    addLog(QString("正在连接到服务器: %1").arg(serverUrl));

    // 获取本机 IP - 改进的方法，获取所有可用的IPv4地址
    QString localIp = "localhost";
    QList<QHostAddress> allAddresses = QNetworkInterface::allAddresses();
    addLog(QString("检测到 %1 个网络地址").arg(allAddresses.size()));
    
    for (const QHostAddress& addr : allAddresses) {
        if (addr.protocol() == QAbstractSocket::IPv4Protocol && !addr.isLoopback()) {
            QString ipStr = addr.toString();
            // 优先选择192.168开头的局域网地址
            if (ipStr.startsWith("192.168.") || ipStr.startsWith("10.") || ipStr.startsWith("172.")) {
                localIp = ipStr;
                addLog(QString("选择局域网IP: %1").arg(localIp));
                break;
            }
            // 如果还没有找到，先记录第一个非回环地址
            if (localIp == "localhost") {
                localIp = ipStr;
            }
        }
    }
    
    // 如果服务器地址包含localhost或127.0.0.1，则客户端也使用localhost
    if (serverUrl.contains("localhost") || serverUrl.contains("127.0.0.1")) {
        localIp = "localhost";
        addLog("服务器是本地地址，客户端也使用 localhost");
    }

    QString localUrl = QString("http://%1:%2").arg(localIp).arg(port);
    m_registeredClientId = QString("http-%1-%2").arg(QHostInfo::localHostName()).arg(port);

    addLog(QString("客户端ID: %1").arg(m_registeredClientId));
    addLog(QString("客户端URL: %1").arg(localUrl));

    QJsonObject requestData;
    requestData["clientId"] = m_registeredClientId;
    requestData["clientName"] = clientName;
    requestData["url"] = localUrl;

    QNetworkRequest request(QUrl(serverUrl + "/api/remote-print/http-clients"));
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    addLog("发送注册请求...");
    QNetworkReply* reply = m_networkManager->post(request, QJsonDocument(requestData).toJson());
    
    connect(reply, &QNetworkReply::finished, this, [this, reply, localUrl]() {
        QByteArray responseData = reply->readAll();
        addLog(QString("服务器响应: %1").arg(QString::fromUtf8(responseData)));
        
        if (reply->error() == QNetworkReply::NoError) {
            QJsonDocument doc = QJsonDocument::fromJson(responseData);
            QJsonObject obj = doc.object();
            if (obj["success"].toBool()) {
                m_isConnectedToServer = true;
                ui->labelServerStatus->setText("● 已连接到服务器");
                ui->labelServerStatus->setStyleSheet("color: green;");
                ui->btnDisconnect->setVisible(true);
                m_heartbeatTimer->start();
                
                // 显示更详细的信息
                QString msg = obj["message"].toString();
                bool online = obj["data"].toObject()["online"].toBool();
                addLog(QString("注册成功: %1").arg(msg));
                addLog(QString("客户端状态: %1").arg(online ? "在线" : "离线"));
                addLog(QString("本地服务地址: %1").arg(localUrl));
                
                if (!online) {
                    addLog("⚠️ 警告: 服务器无法连接到本客户端，请检查防火墙设置");
                }
                
                saveSettings();
            } else {
                addLog("注册失败: " + obj["message"].toString());
            }
        } else {
            addLog("连接服务器失败: " + reply->errorString());
            addLog("HTTP状态码: " + QString::number(reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt()));
        }
        reply->deleteLater();
    });
}

void MainWindow::disconnectFromServer()
{
    if (!m_isConnectedToServer) return;

    m_heartbeatTimer->stop();

    QString serverUrl = ui->editServerUrl->text().trimmed();
    QNetworkRequest request(QUrl(serverUrl + "/api/remote-print/http-clients/" + m_registeredClientId));
    
    QNetworkReply* reply = m_networkManager->deleteResource(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
    });

    m_isConnectedToServer = false;
    m_registeredClientId.clear();
    ui->labelServerStatus->setText("● 未连接到后端服务器");
    ui->labelServerStatus->setStyleSheet("color: gray;");
    ui->btnDisconnect->setVisible(false);
    addLog("已断开与服务器的连接");
}

void MainWindow::onHeartbeat()
{
    if (!m_isConnectedToServer) return;

    QString serverUrl = ui->editServerUrl->text().trimmed();
    QNetworkRequest request(QUrl(serverUrl + "/api/remote-print/http-clients/" + m_registeredClientId + "/refresh"));
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    QNetworkReply* reply = m_networkManager->post(request, QByteArray());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        if (reply->error() != QNetworkReply::NoError) {
            addLog("心跳失败，尝试重新连接...");
            m_isConnectedToServer = false;
            registerToServer();
        }
        reply->deleteLater();
    });
}

void MainWindow::onPrintRequest(const QJsonObject& taskJson)
{
    addLog(QString("收到打印请求，数据大小: %1 字节").arg(QJsonDocument(taskJson).toJson().size()));

    PrintTask task = PrintTask::fromJson(taskJson);
    
    addLog(QString("解析成功 - 尺寸: %1x%2mm, 元素: %3 个")
           .arg(task.labelWidth).arg(task.labelHeight).arg(task.elements.size()));

    QString printerName = ui->comboPrinters->currentText();
    PrintResult result = m_printService->print(task, printerName);

    if (result.success) {
        m_printCount++;
        ui->labelPrintCount->setText(QString("已打印: %1").arg(m_printCount));
        addLog("✅ " + result.message);
    } else {
        addLog("❌ " + result.message);
    }
}

void MainWindow::onLogMessage(const QString& message)
{
    addLog(message);
}

void MainWindow::onAddPaperSizesClicked()
{
    addLog("=== Qt 版本不需要手动添加纸张 ===");
    addLog("Qt 的 QPrinter 可以直接设置任意自定义纸张尺寸");
    addLog("前端设置什么尺寸，打印出来就是什么尺寸");
    
    QMessageBox::information(this, "提示", 
        "Qt 版本的打印客户端可以直接设置任意自定义纸张尺寸，\n"
        "无需手动添加纸张。\n\n"
        "前端设置什么尺寸，打印出来就是什么尺寸。");
}

void MainWindow::onDiagnosticClicked()
{
    addLog("=== 打印机诊断信息 ===");
    
    QStringList printers = QPrinterInfo::availablePrinterNames();
    addLog(QString("已安装的打印机: %1 台").arg(printers.size()));
    
    for (const QString& name : printers) {
        QPrinterInfo info = QPrinterInfo::printerInfo(name);
        addLog(QString("  - %1 %2")
               .arg(name)
               .arg(info.isDefault() ? "(默认)" : ""));
        
        // 显示支持的纸张尺寸
        QList<QPageSize> pageSizes = info.supportedPageSizes();
        if (!pageSizes.isEmpty()) {
            addLog(QString("    支持的纸张: %1 种").arg(pageSizes.size()));
            for (int i = 0; i < qMin(5, pageSizes.size()); i++) {
                QSizeF size = pageSizes[i].size(QPageSize::Millimeter);
                addLog(QString("      %1: %2x%3mm")
                       .arg(pageSizes[i].name())
                       .arg(size.width(), 0, 'f', 1)
                       .arg(size.height(), 0, 'f', 1));
            }
            if (pageSizes.size() > 5) {
                addLog(QString("      ... 还有 %1 种").arg(pageSizes.size() - 5));
            }
        }
    }
    
    addLog("=== Qt 自定义纸张支持 ===");
    addLog("Qt 的 QPrinter 支持任意自定义纸张尺寸");
    addLog("使用 QPageSize(QSizeF(width, height), QPageSize::Millimeter) 创建");
    
    QMessageBox::information(this, "诊断完成", "诊断信息已输出到日志");
}
