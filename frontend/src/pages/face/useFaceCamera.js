import { useCallback, useEffect, useRef, useState } from 'react';

// Camera trước (hoặc webcam laptop) cho nhận diện khuôn mặt. Cùng cách quản lý vòng đời
// với scan/useQrCamera.js (thế hệ genRef để start() bị stop giữa chừng tự tắt stream),
// nhưng mỗi khung gọi onFrame(video) bất đồng bộ và CHỜ nó xong mới lấy khung sau — mô
// hình chạy chậm hơn một vòng lặp cố định thì không chồng việc lên nhau.
//
// onFrame trả về 'idle' khi khung không có ai → khung sau cách xa hơn: kiosk đứng cả buổi,
// phần lớn thời gian không có người trước camera, không cần đốt GPU/pin ở nhịp tối đa.
//
// status: idle | starting | running | denied | unsupported | error

const MIN_FRAME_GAP_MS = 150;
const IDLE_FRAME_GAP_MS = 400;

export default function useFaceCamera({ onFrame, paused = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const genRef = useRef(0);
  const pendingRef = useRef(false);
  const pausedRef = useRef(paused);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState('idle');

  pausedRef.current = paused;
  onFrameRef.current = onFrame;

  const stop = useCallback(() => {
    genRef.current += 1;
    pendingRef.current = false;
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((s) => (s === 'running' || s === 'starting' ? 'idle' : s));
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current || pendingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    const gen = genRef.current;
    pendingRef.current = true;
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = videoRef.current;
      if (gen !== genRef.current || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      pendingRef.current = false;
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStatus('running');

      const tick = async () => {
        if (gen !== genRef.current || !streamRef.current) return;
        const started = Date.now();
        let gap = MIN_FRAME_GAP_MS;
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          try {
            if (await onFrameRef.current?.(video) === 'idle') gap = IDLE_FRAME_GAP_MS;
          } catch {
            // Một khung lỗi (GPU bận, mô hình chưa sẵn) không được làm dừng cả vòng lặp.
          }
        }
        if (gen !== genRef.current) return;
        timerRef.current = setTimeout(tick, Math.max(0, gap - (Date.now() - started)));
      };
      tick();
    } catch (err) {
      if (gen !== genRef.current) return;
      pendingRef.current = false;
      setStatus(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'error');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, start, stop };
}
