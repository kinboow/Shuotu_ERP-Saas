import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Button, Toast, Input, List, Tag, Switch, NoticeBar } from 'antd-mobile';
import {
  VideoOutline,
  StopOutline,
  CheckCircleOutline,
  CloseCircleOutline,
  SoundOutline,
} from 'antd-mobile-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../config/api';

const VideoRecord = () => {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const pollIntervalRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [orderNo, setOrderNo] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [duration, setDuration] = useState(0);
  const [recentRecords, setRecentRecords] = useState([]);
  const [autoMode, setAutoMode] = useState(true); // 自动模式
  const [pendingTask, setPendingTask] = useState(null); // 当前待处理任务
  const [lastTaskId, setLastTaskId] = useState(0);
  const timerRef = useRef(null);
  const currentTaskRef = useRef(null);

  useEffect(() => {
    fetchRecentRecords();
    // 自动模式下启动轮询
    if (autoMode) {
      startPolling();
    }
    return () => {
      stopCamera();
      stopPolling();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 自动模式切换
  useEffect(() => {
    if (autoMode) {
      startPolling();
      // 自动模式下预先打开摄像头
      if (!isPreviewing && !isRecording) {
        startCamera();
      }
    } else {
      stopPolling();
    }
  }, [autoMode]);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    console.log('[录像端] 开始轮询任务...');
    pollIntervalRef.current = setInterval(pollPendingTasks, 2000);
    // 立即执行一次
    pollPendingTasks();
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      console.log('[录像端] 停止轮询');
    }
  };

  const pollPendingTasks = async () => {
    // 如果正在录像或有待上传的视频，不获取新任务
    if (isRecording || recordedBlob || currentTaskRef.current) {
      return;
    }

    try {
      const response = await apiFetch(`/api/package-videos/tasks/pending?last_id=${lastTaskId}`);
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const task = data.data[0];
        console.log('[录像端] 收到新任务:', task);

        // 领取任务
        const claimResponse = await apiFetch(`/api/package-videos/task/${task.id}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operator_id: user?.id,
            operator_name: user?.name,
            device_name: navigator.userAgent.substring(0, 50),
          }),
        });

        const claimData = await claimResponse.json();

        if (claimData.success) {
          currentTaskRef.current = task;
          setPendingTask(task);
          setOrderNo(task.order_no);
          setSkuCode(task.sku_code || '');
          setLastTaskId(task.id);

          // 播放提示音
          playNotificationSound();

          // 显示提示
          Toast.show({
            content: `收到录像任务: ${task.order_no}`,
            icon: 'success',
            duration: 2000,
          });

          // 自动开始录像
          setTimeout(() => {
            autoStartRecording(task);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('[录像端] 轮询任务失败:', error);
    }
  };

  // 播放提示音
  const playNotificationSound = () => {
    try {
      // 使用Web Audio API播放提示音
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 300);

      // 再播放一声
      setTimeout(() => {
        const audioContext2 = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator2 = audioContext2.createOscillator();
        const gainNode2 = audioContext2.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext2.destination);
        oscillator2.frequency.value = 1000;
        oscillator2.type = 'sine';
        gainNode2.gain.value = 0.3;
        oscillator2.start();
        setTimeout(() => {
          oscillator2.stop();
          audioContext2.close();
        }, 300);
      }, 350);
    } catch (e) {
      console.warn('播放提示音失败:', e);
    }
  };

  const fetchRecentRecords = async () => {
    try {
      const response = await apiFetch('/api/package-videos?limit=5&device_type=video');
      const data = await response.json();
      if (data.success) {
        setRecentRecords(data.data || []);
      }
    } catch (error) {
      console.error('获取最近记录失败:', error);
    }
  };

  const startCamera = async () => {
    // 检查是否支持mediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // 检查是否是非HTTPS环境
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        Toast.show({ 
          content: '摄像头功能需要HTTPS环境，请使用HTTPS访问或在localhost调试', 
          icon: 'fail',
          duration: 3000
        });
      } else {
        Toast.show({ 
          content: '您的浏览器不支持摄像头功能', 
          icon: 'fail' 
        });
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsPreviewing(true);
    } catch (error) {
      let errorMsg = '无法访问摄像头';
      if (error.name === 'NotAllowedError') {
        errorMsg = '请允许访问摄像头权限';
      } else if (error.name === 'NotFoundError') {
        errorMsg = '未找到摄像头设备';
      } else if (error.name === 'NotReadableError') {
        errorMsg = '摄像头被其他应用占用';
      } else if (error.message) {
        errorMsg = '无法访问摄像头: ' + error.message;
      }
      Toast.show({ content: errorMsg, icon: 'fail' });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsPreviewing(false);
  };

  // 自动开始录像
  const autoStartRecording = async (task) => {
    if (!isPreviewing) {
      await startCamera();
      // 等待摄像头准备好
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      const stream = videoRef.current?.srcObject;
      if (!stream) {
        Toast.show({ content: '摄像头未就绪', icon: 'fail' });
        return;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      Toast.show({ content: '自动开始录制', icon: 'success' });
    } catch (error) {
      Toast.show({ content: '录制失败: ' + error.message, icon: 'fail' });
      // 任务失败，重置
      currentTaskRef.current = null;
      setPendingTask(null);
    }
  };

  const startRecording = async () => {
    if (!orderNo.trim()) {
      Toast.show({ content: '请先输入订单号', icon: 'fail' });
      return;
    }

    if (!isPreviewing) {
      await startCamera();
    }

    try {
      const stream = videoRef.current.srcObject;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      Toast.show({ content: '开始录制', icon: 'success' });
    } catch (error) {
      Toast.show({ content: '录制失败: ' + error.message, icon: 'fail' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      Toast.show({ content: '录制完成', icon: 'success' });
    }
  };

  const uploadVideo = async () => {
    if (!recordedBlob) {
      Toast.show({ content: '没有可上传的视频', icon: 'fail' });
      return;
    }

    Toast.show({ content: '正在上传...', icon: 'loading', duration: 0 });

    try {
      const formData = new FormData();
      formData.append('video', recordedBlob, `${orderNo}_${Date.now()}.webm`);
      formData.append('order_no', orderNo);
      formData.append('sku_code', skuCode);
      formData.append('duration', duration);
      formData.append('device_type', 'video');
      formData.append('device_name', navigator.userAgent.substring(0, 50));
      formData.append('operator_id', user?.id || '');
      formData.append('operator_name', user?.name || '');

      const response = await apiFetch('/api/package-videos/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      Toast.clear();

      if (data.success) {
        // 如果有关联任务，标记完成
        if (currentTaskRef.current) {
          await apiFetch(`/api/package-videos/task/${currentTaskRef.current.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: null }),
          });
        }

        Toast.show({ content: '上传成功', icon: 'success' });
        resetState();
        fetchRecentRecords();
      } else {
        Toast.show({ content: data.message || '上传失败', icon: 'fail' });
      }
    } catch (error) {
      Toast.clear();
      Toast.show({ content: '上传失败: ' + error.message, icon: 'fail' });
    }
  };

  const discardVideo = async () => {
    // 如果有关联任务，取消任务
    if (currentTaskRef.current) {
      await apiFetch(`/api/package-videos/task/${currentTaskRef.current.id}/cancel`, {
        method: 'POST',
      });
    }
    resetState();
    Toast.show({ content: '已放弃录像', icon: 'success' });
  };

  const resetState = () => {
    setRecordedBlob(null);
    setOrderNo('');
    setSkuCode('');
    setDuration(0);
    currentTaskRef.current = null;
    setPendingTask(null);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: 12, background: '#f5f5f5', minHeight: '100%' }}>
      {/* 自动模式提示 */}
      {autoMode && (
        <NoticeBar
          content="自动模式已开启，扫描端扫描后将自动开始录像"
          color="info"
          icon={<SoundOutline />}
          style={{ marginBottom: 12, borderRadius: 8 }}
        />
      )}

      {/* 待处理任务提示 */}
      {pendingTask && !isRecording && !recordedBlob && (
        <Card
          style={{
            marginBottom: 12,
            borderRadius: 8,
            background: '#fff7e6',
            border: '1px solid #ffd591',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <VideoOutline style={{ fontSize: 24, color: '#fa8c16' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#d46b08' }}>待录像任务</div>
              <div style={{ fontSize: 12, color: '#ad6800' }}>
                订单号: {pendingTask.order_no}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 录像预览区域 */}
      <Card style={{ marginBottom: 12, borderRadius: 8 }}>
        <div
          style={{
            position: 'relative',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: '16/9',
          }}
        >
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            playsInline
            muted
          />
          {!isPreviewing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Button color="primary" onClick={startCamera}>
                <VideoOutline /> 打开摄像头
              </Button>
            </div>
          )}
          {isRecording && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(255,0,0,0.8)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: '#fff',
                  borderRadius: '50%',
                  animation: 'blink 1s infinite',
                }}
              />
              REC {formatDuration(duration)}
            </div>
          )}
        </div>
        <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
      </Card>

      {/* 自动模式开关 */}
      <Card style={{ marginBottom: 12, borderRadius: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 500 }}>自动录像模式</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              开启后，扫描端扫描订单会自动开始录像
            </div>
          </div>
          <Switch checked={autoMode} onChange={setAutoMode} />
        </div>
      </Card>

      {/* 订单信息输入 */}
      <Card style={{ marginBottom: 12, borderRadius: 8 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>订单号 *</div>
          <Input
            placeholder="请输入或扫描订单号"
            value={orderNo}
            onChange={setOrderNo}
            clearable
            disabled={autoMode && pendingTask}
          />
        </div>
        <div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>SKU编码</div>
          <Input
            placeholder="请输入SKU编码（可选）"
            value={skuCode}
            onChange={setSkuCode}
            clearable
          />
        </div>
      </Card>

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 12, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {!isRecording ? (
            <Button
              block
              color="danger"
              size="large"
              onClick={startRecording}
              disabled={!orderNo.trim() || recordedBlob}
            >
              <VideoOutline /> 开始录制
            </Button>
          ) : (
            <Button block color="default" size="large" onClick={stopRecording}>
              <StopOutline /> 停止录制
            </Button>
          )}
        </div>

        {recordedBlob && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <Button block color="primary" size="large" onClick={uploadVideo}>
              <CheckCircleOutline /> 上传视频
            </Button>
            <Button block color="default" size="large" onClick={discardVideo}>
              <CloseCircleOutline /> 放弃
            </Button>
          </div>
        )}
      </Card>

      {/* 最近录制 */}
      <Card title="最近录制" style={{ borderRadius: 8 }}>
        {recentRecords.length > 0 ? (
          <List>
            {recentRecords.map((record) => (
              <List.Item
                key={record.id}
                description={`${record.created_at?.substring(0, 16) || '-'}`}
                extra={
                  <Tag color={record.status === 'completed' ? 'success' : 'warning'}>
                    {record.status === 'completed' ? '已完成' : '处理中'}
                  </Tag>
                }
              >
                {record.order_no}
              </List.Item>
            ))}
          </List>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
            暂无录制记录
          </div>
        )}
      </Card>
    </div>
  );
};

export default VideoRecord;
