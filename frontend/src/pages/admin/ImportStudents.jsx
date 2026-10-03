import { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import Button, { IconButton } from '../../components/ui/Button';
import { cx } from '../../utils/cx';

// Import sinh viên từ Excel: khung kéo thả (cả khung là chỗ bấm), kết quả gồm số thành công /
// bỏ qua / lỗi và từng dòng lỗi. onSuccess đóng hộp và nạp lại bảng.
export default function ImportStudents({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Chỉ hỗ trợ file .xlsx, .xls, .csv');
      return;
    }
    setFile(f);
    setResults(null);
  };

  const handleImport = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const { data } = await adminApi.importStudents(formData);
      setResults(data.results);
      toast.success(data.message);
      if (data.results.success > 0) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-background p-4">
        <p className="text-sm font-medium text-foreground">Định dạng file Excel</p>
        <p className="mt-2 overflow-x-auto rounded-lg bg-surface px-3 py-2 font-mono text-xs text-foreground">MSSV | Họ tên | Email | Lớp | Khoa</p>
        <p className="mt-2 text-xs text-muted">Hàng đầu tiên là tiêu đề. Các cột theo thứ tự trên.</p>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-border-strong px-4 py-3">
          <FileSpreadsheet className="size-5 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs tabular-nums text-muted">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <IconButton icon={X} label="Bỏ file" onClick={() => setFile(null)} />
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          className={cx(
            'flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors hover:bg-item-hover',
            dragging ? 'border-foreground/40 bg-background' : 'border-border-strong bg-background/60',
          )}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => handleFile(e.target.files[0])} />
          <p className="text-sm font-medium text-foreground [@media(hover:none)]:hidden">
            {dragging ? 'Thả file để chọn' : 'Kéo thả file vào đây'}
          </p>
          <p className="mt-1 text-pretty text-sm text-muted">Hỗ trợ .xlsx, .xls, .csv</p>
          <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-foreground">
            <Upload className="size-4" aria-hidden="true" /> Chọn file
          </span>
        </label>
      )}

      {results && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border text-center">
            <div className="bg-surface p-3">
              <p className="text-xl font-semibold tabular-nums text-success">{results.success}</p>
              <p className="text-xs text-muted">Thành công</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xl font-semibold tabular-nums text-warning">{results.skipped}</p>
              <p className="text-xs text-muted">Bỏ qua</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xl font-semibold tabular-nums text-error-text">{results.errors?.length || 0}</p>
              <p className="text-xs text-muted">Lỗi</p>
            </div>
          </div>
          {results.errors?.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-xl bg-error-bg p-3">
              {results.errors.map((e, i) => (
                <li key={i} className="text-xs text-error-strong">Dòng {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button variant="primary" size="form" icon={Upload} loading={loading} disabled={!file} onClick={handleImport} className="w-full">
        Bắt đầu import
      </Button>
    </div>
  );
}
