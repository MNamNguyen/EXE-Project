import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Spinner from '../../components/ui/Spinner';
import { loadCertFonts, loadImage, drawCertificate } from './certRender';

// Độ phân giải canvas tối đa — đủ nét để xem/tải PNG mà không nặng máy khi
// editor vẽ lại liên tục lúc kéo thả.
const MAX_CANVAS_WIDTH = 2000;

// Canvas hiển thị chứng nhận. imageUrl: object URL của ảnh mẫu (tải bằng blob có
// token). onLayout(boxes) nhận khung bao từng ô sau mỗi lần vẽ (dùng cho editor).
const CertificateCanvas = forwardRef(function CertificateCanvas(
  { imageUrl, template, fields, values, onLayout, className = '' }, ref,
) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    toPngBlob: () => new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')),
  }));

  useEffect(() => {
    if (!imageUrl) return undefined;
    let cancelled = false;
    setImg(null);
    setError(null);
    Promise.all([loadImage(imageUrl), loadCertFonts()])
      .then(([image]) => { if (!cancelled) setImg(image); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Không vẽ được chứng nhận'); });
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const scale = Math.min(1, MAX_CANVAS_WIDTH / template.width);
    const canvas = canvasRef.current;
    const w = Math.round(template.width * scale);
    const h = Math.round(template.height * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const boxes = drawCertificate(canvas.getContext('2d'), img, fields || template.fields, values);
    onLayout?.(boxes);
  }, [img, template, fields, values]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${template.width} / ${template.height}` }}>
      <canvas ref={canvasRef} className="w-full h-full block rounded-lg shadow-sm bg-gray-50" />
      {!img && !error && (
        <div className="absolute inset-0 flex items-center justify-center"><Spinner size="lg" /></div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500 bg-gray-50 rounded-lg">{error}</div>
      )}
    </div>
  );
});

export default CertificateCanvas;
