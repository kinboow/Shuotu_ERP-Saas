#include "httpserver.h"
#include <QJsonDocument>
#include <QJsonArray>
#include <QDebug>

HttpServer::HttpServer(QObject *parent)
    : QObject(parent)
    , m_server(new QTcpServer(this))
    , m_port(0)
    , m_clientCount(0)
    , m_printCount(0)
{
    connect(m_server, &QTcpServer::newConnection, this, &HttpServer::onNewConnection);
}

void HttpServer::setPrinterList(const QStringList& printers)
{
    m_printerList = printers;
}

HttpServer::~HttpServer()
{
    stop();
}

bool HttpServer::start(int port)
{
    if (m_server->isListening()) {
        stop();
    }

    if (m_server->listen(QHostAddress::Any, port)) {
        m_port = port;
        emit logMessage(QString("HTTP 服务已启动，监听端口: %1").arg(port));
        return true;
    } else {
        emit logMessage(QString("启动失败: %1").arg(m_server->errorString()));
        return false;
    }
}

void HttpServer::stop()
{
    if (m_server->isListening()) {
        m_server->close();
        m_port = 0;
        emit logMessage("HTTP 服务已停止");
    }
}

bool HttpServer::isRunning() const
{
    return m_server->isListening();
}

int HttpServer::port() const
{
    return m_port;
}

void HttpServer::onNewConnection()
{
    while (m_server->hasPendingConnections()) {
        QTcpSocket* socket = m_server->nextPendingConnection();
        connect(socket, &QTcpSocket::readyRead, this, &HttpServer::onReadyRead);
        connect(socket, &QTcpSocket::disconnected, this, &HttpServer::onDisconnected);
        m_clientCount++;
        emit clientConnected();
    }
}

void HttpServer::onReadyRead()
{
    QTcpSocket* socket = qobject_cast<QTcpSocket*>(sender());
    if (!socket) return;

    QByteArray data = socket->readAll();
    QString request = QString::fromUtf8(data);

    // 解析 HTTP 请求
    QStringList lines = request.split("\r\n");
    if (lines.isEmpty()) return;

    // 解析请求行
    QStringList requestLine = lines[0].split(" ");
    if (requestLine.size() < 2) return;

    QString method = requestLine[0];
    QString path = requestLine[1];

    // 解析头部
    QMap<QString, QString> headers;
    int bodyStart = -1;
    for (int i = 1; i < lines.size(); i++) {
        if (lines[i].isEmpty()) {
            bodyStart = i + 1;
            break;
        }
        int colonIndex = lines[i].indexOf(':');
        if (colonIndex > 0) {
            QString key = lines[i].left(colonIndex).trimmed().toLower();
            QString value = lines[i].mid(colonIndex + 1).trimmed();
            headers[key] = value;
        }
    }

    // 获取请求体
    QByteArray body;
    if (bodyStart > 0 && bodyStart < lines.size()) {
        body = data.mid(data.indexOf("\r\n\r\n") + 4);
    }

    handleRequest(socket, method, path, body, headers);
}

void HttpServer::onDisconnected()
{
    QTcpSocket* socket = qobject_cast<QTcpSocket*>(sender());
    if (socket) {
        socket->deleteLater();
        m_clientCount--;
        emit clientDisconnected();
    }
}

void HttpServer::handleRequest(QTcpSocket* socket, const QString& method, const QString& path,
                                const QByteArray& body, const QMap<QString, QString>& headers)
{
    emit logMessage(QString("收到请求: %1 %2").arg(method).arg(path));

    // 处理 CORS 预检请求
    if (method == "OPTIONS") {
        sendCorsHeaders(socket);
        sendResponse(socket, 200, "OK", QByteArray(), "text/plain");
        return;
    }

    QString lowerPath = path.toLower();

    if (lowerPath == "/print" && method == "POST") {
        // 打印请求
        QJsonDocument doc = QJsonDocument::fromJson(body);
        if (doc.isObject()) {
            emit printRequest(doc.object());
            
            // 返回成功响应（实际结果由打印服务处理）
            QJsonObject response;
            response["success"] = true;
            response["message"] = "打印任务已接收";
            sendResponse(socket, 200, "OK", QJsonDocument(response).toJson());
        } else {
            QJsonObject response;
            response["success"] = false;
            response["message"] = "无效的 JSON 数据";
            sendResponse(socket, 400, "Bad Request", QJsonDocument(response).toJson());
        }
    }
    else if (lowerPath == "/status") {
        // 状态请求
        emit statusRequest();
        QJsonObject response;
        response["success"] = true;
        response["status"] = "running";
        response["printCount"] = m_printCount;
        response["clientCount"] = m_clientCount;
        sendResponse(socket, 200, "OK", QJsonDocument(response).toJson());
    }
    else if (lowerPath == "/printers") {
        // 打印机列表请求
        emit printersRequest();
        QJsonObject response;
        response["success"] = true;
        QJsonArray printersArray;
        for (const QString& printer : m_printerList) {
            printersArray.append(printer);
        }
        response["printers"] = printersArray;
        sendResponse(socket, 200, "OK", QJsonDocument(response).toJson());
    }
    else {
        // 未知路径
        QJsonObject response;
        response["success"] = false;
        response["message"] = "未知接口";
        sendResponse(socket, 404, "Not Found", QJsonDocument(response).toJson());
    }
}

void HttpServer::sendResponse(QTcpSocket* socket, int statusCode, const QString& statusText,
                               const QByteArray& body, const QString& contentType)
{
    QString response = QString("HTTP/1.1 %1 %2\r\n").arg(statusCode).arg(statusText);
    response += "Access-Control-Allow-Origin: *\r\n";
    response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
    response += "Access-Control-Allow-Headers: Content-Type\r\n";
    response += QString("Content-Type: %1; charset=utf-8\r\n").arg(contentType);
    response += QString("Content-Length: %1\r\n").arg(body.size());
    response += "\r\n";

    socket->write(response.toUtf8());
    socket->write(body);
    socket->flush();
    socket->disconnectFromHost();
}

void HttpServer::sendCorsHeaders(QTcpSocket* socket)
{
    // CORS 预检响应已在 sendResponse 中处理
}
