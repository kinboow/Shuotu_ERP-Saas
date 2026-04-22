#ifndef HTTPSERVER_H
#define HTTPSERVER_H

#include <QObject>
#include <QTcpServer>
#include <QTcpSocket>
#include <QJsonObject>

class HttpServer : public QObject
{
    Q_OBJECT

public:
    explicit HttpServer(QObject *parent = nullptr);
    ~HttpServer();

    bool start(int port);
    void stop();
    bool isRunning() const;
    int port() const;

    // 设置打印机列表（由主窗口调用）
    void setPrinterList(const QStringList& printers);

signals:
    void printRequest(const QJsonObject& task);
    void statusRequest();
    void printersRequest();
    void logMessage(const QString& message);
    void clientConnected();
    void clientDisconnected();

private slots:
    void onNewConnection();
    void onReadyRead();
    void onDisconnected();

private:
    void handleRequest(QTcpSocket* socket, const QString& method, const QString& path, 
                       const QByteArray& body, const QMap<QString, QString>& headers);
    void sendResponse(QTcpSocket* socket, int statusCode, const QString& statusText,
                      const QByteArray& body, const QString& contentType = "application/json");
    void sendCorsHeaders(QTcpSocket* socket);

    QTcpServer* m_server;
    int m_port;
    int m_clientCount;
    QStringList m_printerList;
    int m_printCount;
};

#endif // HTTPSERVER_H
