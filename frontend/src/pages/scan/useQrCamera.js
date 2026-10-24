import { useCallback, useEffect, useRef, useState } from 'react';

// Đọc QR từ camera sau của điện thoại: getUserMedia → bộ giải mã. Máy có
// BarcodeDetector (Chrome Android) thì dùng nó — giải mã gốc của hệ điều hành, nhanh
// và bắt mã nhỏ/xa/nghiêng tốt hơn jsQR nhiều. Máy không có (Safari iOS) thì về jsQR
// (nạp động, chỉ trang quét mới tải).
//
// status: idle | starting | running | denied | unsupported | error
// paused: vẫn giữ camera chạy (không phải xin quyền lại) nhưng ngừng giải mã, để
// người quét đọc xong kết quả mới quét tiếp.

const SCAN_INTERVAL_MS = 120;
// Thu nhỏ khung hình trước khi đưa jsQR: thiệp đưa sát camera nên 720px là thừa
// đủ, mà nhẹ hơn nhiều trên điện thoại yếu.
const MAX_DECODE_SIDE = 720;
// jsQR xen kẽ: một lượt cả khung hình (thiệp đưa lệch), một lượt cắt vùng giữa — đúng
// ô ngắm — ở độ phân giải gốc. Mã QR in nhỏ trên thiệp mà thu nhỏ cả khung thì mỗi ô
// của mã chỉ còn 1–2 điểm ảnh, jsQR không đọc ra; cắt giữa thì mã được giữ nét.
const CENTER_CROP = 0.8;

async function nativeDecoder() {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    if (!formats.includes('qr_code')) return null;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue;
  } catch {
    return null;
  }
}

async function jsQrDecoder() {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let frame = 0;
  return (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const crop = frame++ % 2 === 1;
    const side = Math.round(Math.min(vw, vh) * CENTER_CROP);
    const [sx, sy, sw, sh] = crop ? [(vw - side) / 2, (vh - side) / 2, side, side] : [0, 0, vw, vh];
    const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data;
  };
}

async function loadDecoder() {
  return (await nativeDecoder()) || jsQrDecoder();
}

export default function useQrCamera({ onDecode, paused = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
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
      const [decode, stream] = await Promise.all([
        loadDecoder(),
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

      const tick = async () => {
        if (!streamRef.current || gen !== genRef.current) return;
        if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
          const text = await Promise.resolve(decode(video)).catch(() => null);
          // Camera có thể đã tắt / tạm dừng trong lúc chờ giải mã.
          if (text && streamRef.current && gen === genRef.current && !pausedRef.current) onDecodeRef.current?.(text);
        }
        if (gen === genRef.current) timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
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
