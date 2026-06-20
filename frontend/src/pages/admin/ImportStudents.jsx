import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import Spinner from '../../components/ui/Spinner';

export default function ImportStudents({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
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
    <div className="space-y-5">
      {/* Template info */}
      <div className="bg-primary-50 rounded-xl p-4 text-sm">
        <p className="font-medium text-primary-800 mb-2">Định dạng file Excel:</p>
        <div className="font-mono text-xs bg-white rounded-lg p-2 text-gray-600 overflow-x-auto">
          MSSV | Họ tên | Email | Lớp | Khoa
        </div>
        <p className="text-xs text-primary-600 mt-2">* Hàng đầu tiên là tiêu đề. Các cột theo thứ tự trên.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          file ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-surface'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => handleFile(e.target.files[0])} />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet size={28} className="text-primary-600" />
            <div className="text-left">
              <p className="font-medium text-gray-900 text-sm">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="p-1 rounded-lg hover:bg-primary-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">Kéo thả file vào đây hoặc click để chọn</p>
            <p className="text-xs text-gray-400 mt-1">Hỗ trợ .xlsx, .xls, .csv</p>
          </>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
              <p className="text-xs text-emerald-600">Thành công</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-amber-600">{results.skipped}</p>
              <p className="text-xs text-amber-600">Bỏ qua</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-red-500">{results.errors?.length || 0}</p>
              <p className="text-xs text-red-500">Lỗi</p>
            </div>
          </div>
          {results.errors?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 max-h-32 overflow-y-auto">
              {results.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">Dòng {e.row}: {e.message}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={handleImport} disabled={!file || loading} className="btn-primary btn-lg btn-full">
        {loading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Upload size={16} />}
        {loading ? 'Đang import...' : 'Bắt đầu import'}
      </button>
    </div>
  );
}
