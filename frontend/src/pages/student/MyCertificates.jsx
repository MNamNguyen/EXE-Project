import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, Eye, FileDown, ImageDown } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { certificateApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { EmptyText, LoadError, Skeleton, SkeletonRows } from '../../components/ui/States';
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

  const load = () => {
    setError(false);
    setCerts(null);
    certificateApi.mine()
      .then(({ data }) => setCerts(data.data))
      .catch(() => setError(true));
  };

  useEffect(() => { load(); }, []);

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

  let list;
  if (error) list = <LoadError title="Không tải được danh sách chứng nhận" onRetry={load} />;
  else if (!certs) list = <SkeletonRows rows={2} />;
  else if (certs.length === 0) {
    list = <EmptyText>Bạn chưa có chứng nhận nào. Ban tổ chức cấp chứng nhận sau sự kiện cho người đã check-out.</EmptyText>;
  } else {
    list = (
      <ul className="divide-y divide-border">
        {certs.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted">
                <Award className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-pretty text-sm font-medium text-foreground">{c.event.name}</p>
                <p className="mt-1 text-xs text-muted">
                  Cấp ngày {format(new Date(c.issuedAt), 'dd/MM/yyyy')} · <span className="font-mono">{c.code}</span>
                </p>
              </div>
            </div>
            {/* Dưới sm: nút xuống dòng riêng, thẳng mép chữ, để tên sự kiện không bị ép */}
            <div className="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
              <Button size="sm" icon={Eye} onClick={() => openCert(c.id)}>Xem</Button>
              <Button size="sm" icon={FileDown} loading={downloading === c.id} onClick={() => downloadPdf(c)}>PDF</Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Layout title="Chứng nhận của tôi">
      <div className="max-w-3xl">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">{list}</section>
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

  const ready = cert && imageUrl;

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      title="Chứng nhận tham gia"
      size="xl"
      closeOnOverlay
      footer={ready ? (
        <>
          <Button size="form" icon={ImageDown} onClick={downloadPng}>Tải ảnh PNG</Button>
          <Button variant="primary" size="form" icon={FileDown} loading={downloading === cert.id} onClick={() => onDownloadPdf(cert)}>Tải PDF</Button>
        </>
      ) : null}
    >
      {error ? (
        <p className="py-10 text-center text-sm text-muted">{error}</p>
      ) : !ready ? (
        <Skeleton className="aspect-[1.414] w-full rounded-xl" />
      ) : (
        <CertificateCanvas ref={canvasRef} imageUrl={imageUrl} template={cert.template} values={cert.values} />
      )}
    </Modal>
  );
}
