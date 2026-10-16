import { useEffect, useRef, useState } from 'react';
import { FileDown, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Banner } from '../../../components/ui/States';
import { downloadBlob } from '../../certificates/certRender';

// File mẫu CSV (Excel mở được, BOM để Excel nhận đúng tiếng Việt).
function downloadSample() {
  const csv = '﻿Họ tên,SĐT,Email\nNguyễn Văn A,0901234567,nguyenvana@congty.vn\nTrần Thị B,0912345678,\n';
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'mau-danh-sach-khach-moi.csv');
}

// Import danh sách khách từ Excel/CSV: cột Họ tên (bắt buộc), SĐT, Email. Dòng lỗi
// hoặc trùng (email/SĐT đã có) bị bỏ qua và liệt kê lại để BTC sửa.
export default function GuestImportModal({ open, eventId, onClose, onImported }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { if (open) setResult(null); }, [open]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File tối đa 5MB');
    setBusy(true);
    try {
      const { data } = await guestApi.importFile(eventId, file);
      setResult(data.data);
      toast.success(data.message);
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import danh sách khách mời"
      footer={<Button variant="secondary" size="form" onClick={onClose}>Đóng</Button>}
    >
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      <div className="flex flex-col gap-4">
        <p className="text-pretty text-sm text-muted">
          File Excel (.xlsx) hoặc CSV, dòng đầu là tiêu đề cột: <span className="font-medium text-foreground">Họ tên</span> (bắt buộc),
          {' '}<span className="font-medium text-foreground">SĐT</span>, <span className="font-medium text-foreground">Email</span>.
          Khách trùng email hoặc SĐT với người đã có sẽ được bỏ qua.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" size="form" icon={Upload} loading={busy} onClick={() => fileRef.current?.click()}>Chọn file</Button>
          <Button size="form" icon={FileDown} onClick={downloadSample}>Tải file mẫu</Button>
        </div>

        {result && (
          <div className="flex flex-col gap-3">
            <Banner tone={result.skipped.length ? 'warning' : 'info'} compact title={`Đã thêm ${result.added} khách`}>
              {result.skipped.length > 0 && `Bỏ qua ${result.skipped.length} dòng — xem lý do bên dưới.`}
            </Banner>
            {result.skipped.length > 0 && (
              <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {result.skipped.map((s) => (
                  <li key={s.row} className="flex gap-3 px-3 py-2 text-sm">
                    <span className="w-14 shrink-0 tabular-nums text-muted">Dòng {s.row}</span>
                    <span className="min-w-0 flex-1">
                      {s.name && <span className="font-medium text-foreground">{s.name} · </span>}
                      <span className="text-muted">{s.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
