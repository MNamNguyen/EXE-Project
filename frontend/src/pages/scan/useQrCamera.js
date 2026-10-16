import { useCallback, useEffect, useRef, useState } from 'react';

// Đọc QR từ camera sau của điện thoại: getUserMedia → vẽ khung hình xuống canvas nhỏ
// → jsQR. jsQR nạp động (chỉ trang quét mới tải). Không dùng BarcodeDetector vì
// Safari iOS chưa có — một đường duy nhất thì máy nào cũng cư xử giống nhau.
//
// status: idle | starting | running | denied | unsupported | error
// paused: vẫn giữ camera chạy (không phải xin quyền lại) nhưng ngừng giải mã, để
// người quét đọc xong kết quả mới quét tiếp.

const SCAN_INTERVAL_MS = 120;
// Thu nhỏ khung hình trước khi giải mã: thiệp đưa sát camera nên 720px là thừa
// đủ, mà nhẹ hơn nhiều trên điện thoại yếu.
const MAX_DECODE_SIDE = 720;

export default function useQrCamera({ onDecode, paused = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  // Mỗi lần stop() tăng "thế hệ": một start() đang chờ xin quyền camera mà bị stop
  // giữa chừng sẽ tự tắt stream vừa nhận thay vì để camera chạy ngầm.
  const genRef = useRef(0);
  const pendingRef = useRef(false);
  const pausedRef = useRef(paused);
  const onDecodeRef = useRef(onDecode);
  const [status, setStatus] = useState('idle');

  pausedRef.current = paused;
  onDecodeRef.current = onDecode;

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
      const [{ default: jsQR }, stream] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
      ]);
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

      const canvas = canvasRef.current || (canvasRef.current = document.createElement('canvas'));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!streamRef.current) return;
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (found?.data) onDecodeRef.current?.(found.data);
        }
        timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    } catch (err) {
      if (gen !== genRef.current) return;
      pendingRef.current = false;
      setStatus(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'error');
    }
  }, []);

  // Rời trang hay đổi tab ứng dụng thì tắt camera (đèn camera tắt theo, đỡ hao pin).
  useEffect(() => () => stop(), [stop]);

  return { videoRef, status, start, stop };
}
