#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QTimer>
#include <QNetworkAccessManager>
#include "httpserver.h"
#include "printservice.h"

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    void onStartClicked();
    void onStopClicked();
    void onRefreshPrintersClicked();
    void onTestPrintClicked();
    void onClearLogClicked();
    void onRegisterClicked();
    void onDisconnectClicked();
    void onAddPaperSizesClicked();
    void onDiagnosticClicked();

    void onPrintRequest(const QJsonObject& task);
    void onLogMessage(const QString& message);
    void onHeartbeat();

private:
    void loadSettings();
    void saveSettings();
    void loadPrinters();
    void updateUI(bool running);
    void addLog(const QString& message);
    void registerToServer();
    void disconnectFromServer();

    Ui::MainWindow *ui;
    HttpServer* m_httpServer;
    PrintService* m_printService;
    QTimer* m_heartbeatTimer;
    QNetworkAccessManager* m_networkManager;
    
    QString m_registeredClientId;
    bool m_isConnectedToServer;
    int m_printCount;
};

#endif // MAINWINDOW_H
