import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, FileDown, ImageDown, Eye, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { certificateApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import CertificateCanvas from '../certificates/CertificateCanvas';
import { downloadBlob } from '../certificates/certRender';

// "Chứng nhận của tôi": danh sách chứng nhận đã được cấp, xem ngay trên web
// (canvas) và tải PDF (server vẽ) hoặc ảnh PNG (từ canvas). ?open=<id> mở sẵn
// một chứng nhận — dùng cho nút "Xem chứng nhận" ở Lịch sử tham dự.
export default function MyCertificates() {
  const [params, setParams] = useSearchParams();
  const [certs, setCerts] = useState(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState(params.get('open'));
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    certificateApi.mine()
      .then(({ data }) => setCerts(data.data))
      .catch(() => setError(true));
  }, []);

  const openCert = (id) => {
    setOpenId(id);
    setParams(id ? { open: id } : {}, { replace: true });
  };

  const downloadPdf = async (cert) => {
    setDownloading(cert.id);
    try {
      const { data } = await certificateApi.pdf(cert.id);
      downloadBlob(data, `chung-nhan-${cert.event.name}.pdf`);
    } catch {
      toast.error('Tải chứng nhận thất bại');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <h1 className="text-2xl font-bold text-white">Chứng nhận của tôi</h1>
        <p className="text-white/60 text-sm mt-1">Chứng nhận tham gia các sự kiện bạn đã hoàn thành</p>
      </div>

      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        {error ? (
          <div className="card p-12 text-center text-sm text-gray-500">Không tải được danh sách chứng nhận</div>
        ) : !certs ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : certs.length === 0 ? (
          <div className="card p-12 text-center">
            <Award size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Bạn chưa có chứng nhận nào</p>
            <p className="text-gray-400 text-xs mt-1">Chứng nhận được Ban tổ chức cấp sau sự kiện cho người đã check-out.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {certs.map((c) => (
              <div key={c.id} className="card p-4 flex items-center gap-3 flex-wrap">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Award size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{c.event.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={11} /> Cấp ngày {format(new Date(c.issuedAt), 'dd/MM/yyyy')} · <span className="font-mono">{c.code}</span>
                  </p>
                </div>
                {/* Dưới sm: nút xuống dòng riêng để tên sự kiện không bị ép còn vài chữ mỗi dòng */}
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button onClick={() => openCert(c.id)} className="btn-secondary btn-sm"><Eye size={14} /> Xem</button>
                  <button onClick={() => downloadPdf(c)} disabled={downloading === c.id} className="btn-primary btn-sm">
                    {downloading === c.id ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <FileDown size={14} />} PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CertificateViewer id={openId} onClose={() => openCert(null)} onDownloadPdf={downloadPdf} downloading={downloading} />
    </Layout>
  );
}

function CertificateViewer({ id, onClose, onDownloadPdf, downloading }) {
  const [cert, setCert] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    let url = null;
    setCert(null);
    setImageUrl(null);
    setError(null);
    Promise.all([certificateApi.get(id), certificateApi.background(id)])
      .then(([info, bg]) => {
        if (cancelled) return;
        url = URL.createObjectURL(bg.data);
        setCert(info.data.data);
        setImageUrl(url);
      })
      .catch((err) => { if (!cancelled) setError(err.response?.status === 404 ? 'Không tìm thấy chứng nhận' : 'Không tải được chứng nhận'); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  const downloadPng = async () => {
    const blob = await canvasRef.current?.toPngBlob();
    if (blob) downloadBlob(blob, `chung-nhan-${cert.event.name}.png`);
  };

  return (
    <Modal open={!!id} onClose={onClose} title="Chứng nhận tham gia" size="xl">
      {error ? (
        <p className="text-center text-sm text-gray-500 py-10">{error}</p>
      ) : !cert || !imageUrl ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          <CertificateCanvas ref={canvasRef} imageUrl={imageUrl} template={cert.template} values={cert.values} />
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={downloadPng} className="btn-secondary btn-sm"><ImageDown size={14} /> Tải ảnh PNG</button>
            <button onClick={() => onDownloadPdf(cert)} disabled={downloading === cert.id} className="btn-primary btn-sm">
              {downloading === cert.id ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <FileDown size={14} />} Tải PDF
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
