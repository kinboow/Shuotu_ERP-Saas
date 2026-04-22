import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Toast, Input, List, Tag, Empty, Dialog } from 'antd-mobile';
import {
  ScanningOutline,
  CheckCircleOutline,
  CloseCircleOutline,
  SearchOutline,
  VideoOutline,
} from 'antd-mobile-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../config/api';

const VideoScan = () => {
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [orderNo, setOrderNo] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState([]);

  useEffect(() => {
    // 自动聚焦输入框
    if (inputRef.current) {
      inputRef.current.focus();
    }
    fetchRecentScans();
  }, []);

  const fetchRecentScans = async () => {
    try {
      const response = await apiFetch('/api/package-videos/scan-logs?limit=10');
      const data = await response.json();
      if (data.success) {
        setRecentScans(data.data || []);
      }
    } catch (error) {
      console.error('获取扫描记录失败:', error);
    }
  };

  const handleScan = async () => {
    if (!orderNo.trim()) {
      Toast.show({ content: '请输入订单号', icon: 'fail' });
      return;
    }

    setLoading(true);
    setScanResult(null);

    try {
      const response = await apiFetch(`/api/package-videos/check/${orderNo.trim()}`);
      const data = await response.json();

      if (data.success) {
        setScanResult(data.data);

        // 记录扫描日志
        await apiFetch('/api/package-videos/scan-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_no: orderNo.trim(),
            has_video: data.data?.has_video || false,
            operator_id: user?.id,
            operator_name: user?.name,
          }),
        });

        fetchRecentScans();

        if (data.data?.has_video) {
          Toast.show({ content: '该订单已有包装录像', icon: 'success' });
        } else {
          Toast.show({ content: '该订单暂无包装录像', icon: 'fail' });
        }
      } else {
        Toast.show({ content: data.message || '查询失败', icon: 'fail' });
      }
    } catch (error) {
      Toast.show({ content: '查询失败: ' + error.message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  // 创建录像任务，通知录像端
  const handleCreateVideoTask = async () => {
    if (!orderNo.trim()) {
      Toast.show({ content: '请先输入订单号', icon: 'fail' });
      return;
    }

    try {
      const response = await apiFetch('/api/package-videos/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_no: orderNo.trim(),
          sku_code: '',
          product_name: '',
          operator_id: user?.id,
          operator_name: user?.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({
          content: '已通知录像端开始录像',
          icon: 'success',
          duration: 2000,
        });
        // 清空并准备下一次扫描
        clearAndFocus();
      } else {
        Toast.show({ content: data.message || '创建任务失败', icon: 'fail' });
      }
    } catch (error) {
      Toast.show({ content: '创建任务失败: ' + error.message, icon: 'fail' });
    }
  };

  // 扫描并自动创建录像任务
  const handleScanAndRecord = async () => {
    if (!orderNo.trim()) {
      Toast.show({ content: '请输入订单号', icon: 'fail' });
      return;
    }

    setLoading(true);

    try {
      // 先检查是否已有录像
      const checkResponse = await apiFetch(`/api/package-videos/check/${orderNo.trim()}`);
      const checkData = await checkResponse.json();

      if (checkData.success && checkData.data?.has_video) {
        // 已有录像，询问是否重新录制
        Dialog.confirm({
          content: '该订单已有包装录像，是否重新录制？',
          confirmText: '重新录制',
          cancelText: '取消',
          onConfirm: async () => {
            await createTaskAndNotify();
          },
        });
      } else {
        // 没有录像，直接创建任务
        await createTaskAndNotify();
      }
    } catch (error) {
      Toast.show({ content: '操作失败: ' + error.message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const createTaskAndNotify = async () => {
    try {
      // 记录扫描日志
      await apiFetch('/api/package-videos/scan-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_no: orderNo.trim(),
          has_video: false,
          operator_id: user?.id,
          operator_name: user?.name,
        }),
      });

      // 创建录像任务
      const response = await apiFetch('/api/package-videos/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_no: orderNo.trim(),
          sku_code: '',
          product_name: '',
          operator_id: user?.id,
          operator_name: user?.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({
          content: `订单 ${orderNo} 已发送到录像端`,
          icon: 'success',
          duration: 2000,
        });
        fetchRecentScans();
        clearAndFocus();
      } else {
        Toast.show({ content: data.message || '创建任务失败', icon: 'fail' });
      }
    } catch (error) {
      Toast.show({ content: '创建任务失败: ' + error.message, icon: 'fail' });
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleScanAndRecord();
    }
  };

  const clearAndFocus = () => {
    setOrderNo('');
    setScanResult(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return timeStr;
    }
  };

  return (
    <div style={{ padding: 12, background: '#f5f5f5', minHeight: '100%' }}>
      {/* 扫描输入区域 */}
      <Card style={{ marginBottom: 12, borderRadius: 8 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            扫描订单号，自动通知录像端开始录像
          </div>
          <Input
            ref={inputRef}
            placeholder="请扫描或输入订单号"
            value={orderNo}
            onChange={setOrderNo}
            onKeyDown={handleInputKeyDown}
            clearable
            style={{ fontSize: 16 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            block
            color="danger"
            size="large"
            loading={loading}
            onClick={handleScanAndRecord}
          >
            <VideoOutline /> 扫描并录像
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Button block color="primary" size="middle" onClick={handleScan}>
            <SearchOutline /> 仅查询
          </Button>
          <Button block color="default" size="middle" onClick={clearAndFocus}>
            清空
          </Button>
        </div>
      </Card>

      {/* 查询结果 */}
      {scanResult && (
        <Card style={{ marginBottom: 12, borderRadius: 8 }}>
          <div style={{ textAlign: 'center', padding: 16 }}>
            {scanResult.has_video ? (
              <>
                <CheckCircleOutline
                  style={{ fontSize: 64, color: '#52c41a', marginBottom: 12 }}
                />
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: '#52c41a',
                    marginBottom: 8,
                  }}
                >
                  已有包装录像
                </div>
                <div style={{ color: '#666', marginBottom: 16 }}>
                  订单号: {scanResult.order_no}
                </div>
                {scanResult.video_info && (
                  <div
                    style={{
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 8,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#999' }}>录制时间: </span>
                      {formatTime(scanResult.video_info.created_at)}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#999' }}>录制时长: </span>
                      {scanResult.video_info.duration
                        ? `${Math.floor(scanResult.video_info.duration / 60)}:${(scanResult.video_info.duration % 60).toString().padStart(2, '0')}`
                        : '-'}
                    </div>
                    <div>
                      <span style={{ color: '#999' }}>操作员: </span>
                      {scanResult.video_info.operator_name || '-'}
                    </div>
                  </div>
                )}
                <Button
                  color="warning"
                  size="small"
                  style={{ marginTop: 12 }}
                  onClick={handleCreateVideoTask}
                >
                  重新录像
                </Button>
              </>
            ) : (
              <>
                <CloseCircleOutline
                  style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 12 }}
                />
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: '#ff4d4f',
                    marginBottom: 8,
                  }}
                >
                  暂无包装录像
                </div>
                <div style={{ color: '#666' }}>订单号: {scanResult.order_no}</div>
                <Button
                  color="primary"
                  size="middle"
                  style={{ marginTop: 12 }}
                  onClick={handleCreateVideoTask}
                >
                  <VideoOutline /> 通知录像端录像
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* 最近扫描记录 */}
      <Card title="最近扫描" style={{ borderRadius: 8 }}>
        {recentScans.length > 0 ? (
          <List>
            {recentScans.map((record, index) => (
              <List.Item
                key={index}
                description={formatTime(record.created_at)}
                extra={
                  <Tag color={record.has_video ? 'success' : 'danger'}>
                    {record.has_video ? '有录像' : '无录像'}
                  </Tag>
                }
                onClick={() => {
                  setOrderNo(record.order_no);
                }}
              >
                {record.order_no}
              </List.Item>
            ))}
          </List>
        ) : (
          <Empty description="暂无扫描记录" />
        )}
      </Card>
    </div>
  );
};

export default VideoScan;
