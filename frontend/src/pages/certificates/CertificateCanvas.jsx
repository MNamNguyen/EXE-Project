import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Spinner from '../../components/ui/Spinner';
import { cx } from '../../utils/cx';
import { loadCertFonts, fontKeysOf, loadImage, drawCertificate } from './certRender';

// Độ phân giải canvas tối đa — đủ nét để xem/tải PNG mà không nặng máy khi
// editor vẽ lại liên tục lúc kéo thả.
const MAX_CANVAS_WIDTH = 2000;

// Canvas hiển thị chứng nhận. imageUrl: object URL của ảnh mẫu (tải bằng blob có
// token). onLayout(boxes) nhận khung bao từng ô sau mỗi lần vẽ (dùng cho editor).
// draw: hàm vẽ — mặc định chứng nhận; thiệp mời truyền drawInvitation kèm qrText.
const CertificateCanvas = forwardRef(function CertificateCanvas(
  { imageUrl, template, fields, values, onLayout, draw = drawCertificate, qrText, className = '' }, ref,
) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  // Chỉ tải font các ô đang dùng; đổi font trong editor thì tải thêm font đó rồi vẽ lại.
  const fontKey = fontKeysOf(fields || template.fields).join(',');
  const [fontsReady, setFontsReady] = useState(null);

  useImperativeHandle(ref, () => ({
    toPngBlob: () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
  }));

  useEffect(() => {
    if (!imageUrl) return undefined;
    let cancelled = false;
    setImg(null);
    setError(null);
    loadImage(imageUrl)
      .then((image) => { if (!cancelled) setImg(image); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không vẽ được chứng nhận'); });
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    loadCertFonts(fontKey ? fontKey.split(',') : [])
      .then(() => { if (!cancelled) setFontsReady(fontKey); })
      .catch(() => { if (!cancelled) setError('Không tải được font chữ'); });
    return () => { cancelled = true; };
  }, [fontKey]);

  useEffect(() => {
    if (!img || fontsReady !== fontKey || !canvasRef.current) return;
    const scale = Math.min(1, MAX_CANVAS_WIDTH / template.width);
    const canvas = canvasRef.current;
    const w = Math.round(template.width * scale);
    const h = Math.round(template.height * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const boxes = draw(canvas.getContext('2d'), img, fields || template.fields, values, qrText);
    onLayout?.(boxes);
  }, [img, fontsReady, template, fields, values, draw, qrText]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cx('relative', className)} style={{ aspectRatio: `${template.width} / ${template.height}` }}>
      <canvas ref={canvasRef} className="block h-full w-full rounded-xl border border-border bg-background" />
      {(!img || fontsReady === null) && !error && (
        <div className="absolute inset-0 flex items-center justify-center"><Spinner size="lg" /></div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background p-4 text-center text-sm text-error-text">{error}</div>
      )}
    </div>
  );
});

export default CertificateCanvas;
