import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  QrCode, Download, Search, Users, CheckCircle, LogOut,
  RefreshCw, ExternalLink, UserCheck, ChevronLeft, ChevronRight,
  Pencil, UserPlus, Link2, TicketCheck, PlayCircle, StopCircle,
  FileCode2, Circle, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { eventApi, reportApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Spinner from '../../components/ui/Spinner';
import Badge, { attendanceStatusBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EventEditModal from './EventEditModal';
import EventMembersModal from './EventMembersModal';
import ReportViewerModal from './ReportViewerModal';

const PAGE_SIZE = 20;

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [gateLoading, setGateLoading] = useState(null); // 'checkin' | 'checkout' | null
  const [manualModal, setManualModal] = useState(false);
  const [manualUser, setManualUser] = useState('');
  const [manualType, setManualType] = useState('checkin');
  const [editModal, setEditModal] = useState(false);
  const [membersModal, setMembersModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);

  const reloadEvent = () => eventApi.get(id).then(({ data }) => setEvent(data.data));

  const loadAttendance = useCallback((p = page) => {
    eventApi.getAttendance(id, { search, status: statusFilter, page: p, limit: PAGE_SIZE })
      .then(({ data }) => {
        setAttendances(data.data || []);
        setStats(data.stats || {});
        setTotal(data.total || 0);
      });
  }, [id, search, statusFilter, page]);

  useEffect(() => {
    Promise.all([
      eventApi.get(id),
      eventApi.getAttendance(id, { page: 1, limit: PAGE_SIZE }),
    ]).then(([eventRes, attRes]) => {
      setEvent(eventRes.data.data);
      setAttendances(attRes.data.data || []);
      setStats(attRes.data.stats || {});
      setTotal(attRes.data.total || 0);
    }).finally(() => setLoading(false));
  }, [id]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    loadAttendance(1);
  }, [search, statusFilter]); // eslint-disable-line

  // Auto-refresh every 15s
  useEffect(() => {
    const timer = setInterval(() => loadAttendance(page), 15000);
    return () => clearInterval(timer);
  }, [loadAttendance, page]);

  const goToPage = (p) => {
    setPage(p);
    loadAttendance(p);
  };

  const downloadBlob = (data, mime, filename) => {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await reportApi.exportAttendance(id);
      downloadBlob(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `diemdanh-${event.name}.xlsx`);
    } catch {
      toast.error('Xuất báo cáo thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleExportHtml = async () => {
    setExportingHtml(true);
    try {
      const { data } = await reportApi.exportAttendanceHtml(id);
      downloadBlob(data, 'text/html', `baocao-${event.name}.html`);
    } catch {
      toast.error('Xuất báo cáo thất bại');
    } finally {
      setExportingHtml(false);
    }
  };

  // Nút "Mở điểm danh" / "Đóng điểm danh" — chủ động điều khiển cổng check-in
  // hoặc check-out mà không cần đặt trước giờ bắt đầu/kết thúc.
  const handleSetGate = async (type, state) => {
    setGateLoading(type);
    try {
      const field = type === 'checkin' ? 'checkinState' : 'checkoutState';
      const { data } = await eventApi.update(id, { [field]: state });
      setEvent((e) => ({ ...e, [field]: data.data[field], gate: data.data.gate }));
      toast.success(
        state === 'OPEN'
          ? `Đã mở ${type === 'checkin' ? 'điểm danh' : 'check-out'}`
          : `Đã đóng ${type === 'checkin' ? 'điểm danh' : 'check-out'}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setGateLoading(null);
    }
  };

  // Link công khai để BTC phát cho sinh viên tự đăng ký tham gia.
  const registrationUrl = `${window.location.origin}/dang-ky/${id}`;

  const handleCopyRegistrationLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      toast.success('Đã copy link đăng ký');
    } catch {
      // clipboard API cần HTTPS/quyền — hiện link để BTC copy tay.
      toast(registrationUrl, { duration: 8000 });
    }
  };

  const handleManualCheckin = async () => {
    if (!manualUser.trim()) return toast.error('Nhập MSSV hoặc Email sinh viên');
    try {
      await eventApi.manualCheckin(id, { identifier: manualUser, type: manualType });
      toast.success('Check-in thủ công thành công');
      setManualModal(false);
      setManualUser('');
      loadAttendance(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thất bại');
    }
  };

  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="xl" /></div></Layout>;
  if (!event) return <Layout><div className="p-8 text-center text-gray-400">Không tìm thấy sự kiện</div></Layout>;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startRow = (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, total);

  const statCards = [
    { label: 'Tổng đăng ký', value: stats.total || 0, icon: Users, color: 'text-primary-600 bg-primary-50' },
    { label: 'Chưa check-in', value: stats.registered || 0, icon: TicketCheck, color: 'text-amber-600 bg-amber-50' },
    { label: 'Đã check-in', value: stats.checkedIn || 0, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Đã check-out', value: stats.checkedOut || 0, icon: LogOut, color: 'text-teal-600 bg-teal-50' },
  ];

  return (
    <Layout>
      <div className="bg-gradient-brand px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white line-clamp-1">{event.name}</h1>
          <p className="text-white/60 text-sm mt-1">{event.location}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link to={`/events/${id}/qr`} target="_blank"
              className="flex items-center gap-2 bg-white text-primary-700 font-semibold px-4 py-2 rounded-xl text-sm shadow hover:shadow-md transition-all">
              <QrCode size={16} /> Mở màn hình QR
              <ExternalLink size={13} />
            </Link>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              {exporting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Download size={16} />}
              Xuất Excel
            </button>
            <button onClick={() => setReportModal(true)}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              <Eye size={16} /> Xem báo cáo
            </button>
            <button onClick={handleExportHtml} disabled={exportingHtml}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              {exportingHtml ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <FileCode2 size={16} />}
              Tải HTML
            </button>
            <button onClick={() => setManualModal(true)}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              <UserCheck size={16} /> Check-in thủ công
            </button>
            <button onClick={() => setMembersModal(true)}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              <UserPlus size={16} /> Danh sách tham gia
            </button>
            {event.allowRegistration !== false && (
              <button onClick={handleCopyRegistrationLink}
                className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
                <Link2 size={16} /> Copy link đăng ký
              </button>
            )}
            <button onClick={() => setEditModal(true)}
              className="flex items-center gap-2 bg-white/20 text-white font-medium px-4 py-2 rounded-xl text-sm hover:bg-white/30 transition-colors">
              <Pencil size={16} /> Sửa sự kiện
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Điều khiển cổng điểm danh — mở/đóng thủ công, không cần đặt lịch */}
        <div className="card p-4 space-y-3">
          <GateControlRow
            label="Điểm danh (check-in)"
            gate={event.gate?.checkin}
            loading={gateLoading === 'checkin'}
            onOpen={() => handleSetGate('checkin', 'OPEN')}
            onClose={() => handleSetGate('checkin', 'CLOSED')}
          />
          <div className="border-t border-border" />
          <GateControlRow
            label="Check-out"
            gate={event.gate?.checkout}
            loading={gateLoading === 'checkout'}
            onOpen={() => handleSetGate('checkout', 'OPEN')}
            onClose={() => handleSetGate('checkout', 'CLOSED')}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance table */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10 text-sm py-2.5" placeholder="Tìm theo tên, MSSV..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input text-sm py-2.5 w-full sm:w-40" value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="REGISTERED">Đã đăng ký</option>
              <option value="CHECKED_IN">Đã check-in</option>
              <option value="CHECKED_OUT">Đã check-out</option>
              <option value="ABSENT">Vắng</option>
            </select>
            <button onClick={() => loadAttendance(page)} className="btn-secondary btn-md flex-shrink-0">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Sinh viên</th>
                  <th>Lớp</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có dữ liệu điểm danh</td></tr>
                ) : attendances.map((att, i) => {
                  const { label, variant } = attendanceStatusBadge(att.status);
                  return (
                    <tr key={att.id}>
                      <td className="text-gray-400 text-xs">{startRow + i}</td>
                      <td>
                        <p className="font-medium text-gray-900 text-sm">{att.user.name}</p>
                        <p className="text-xs text-gray-400">{att.user.mssv}</p>
                      </td>
                      <td><span className="text-xs text-gray-500">{att.user.class || '—'}</span></td>
                      <td className="text-xs text-gray-600">
                        {att.checkinTime ? format(new Date(att.checkinTime), 'HH:mm:ss') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="text-xs text-gray-600">
                        {att.checkoutTime ? format(new Date(att.checkoutTime), 'HH:mm:ss') : <span className="text-gray-300">—</span>}
                      </td>
                      <td><Badge variant={variant}>{label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-400">
              {total === 0
                ? 'Tự động cập nhật mỗi 15 giây'
                : `Hiển thị ${startRow}–${endRow} / ${total} bản ghi · Tự động cập nhật mỗi 15 giây`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-xs">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`min-w-[30px] h-[30px] rounded-lg text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-primary-600 text-white'
                            : 'border border-border text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual checkin modal */}
      <Modal open={manualModal} onClose={() => setManualModal(false)} title="Check-in thủ công" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Dùng khi sinh viên không thể quét QR (hết pin, lỗi GPS...)</p>
          <div>
            <label className="label">MSSV hoặc Email sinh viên</label>
            <input className="input" placeholder="SE123456 hoặc email@fpt.edu.vn"
              value={manualUser} onChange={(e) => setManualUser(e.target.value)} />
          </div>
          <div>
            <label className="label">Loại</label>
            <select className="input" value={manualType} onChange={(e) => setManualType(e.target.value)}>
              <option value="checkin">Check-in</option>
              <option value="checkout">Check-out</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setManualModal(false)} className="btn-secondary btn-md flex-1">Huỷ</button>
            <button onClick={handleManualCheckin} className="btn-primary btn-md flex-1">Xác nhận</button>
          </div>
        </div>
      </Modal>

      {/* Edit event modal */}
      <EventEditModal
        open={editModal}
        event={event}
        onClose={() => setEditModal(false)}
        onSaved={reloadEvent}
      />

      {/* Members modal */}
      <EventMembersModal
        open={membersModal}
        eventId={id}
        onClose={() => setMembersModal(false)}
        onChanged={() => { reloadEvent(); loadAttendance(page); }}
      />

      {/* Xem báo cáo HTML ngay trên web (kèm nút tải file / in PDF bên trong) */}
      <ReportViewerModal
        open={reportModal}
        eventId={id}
        eventName={event.name}
        onClose={() => setReportModal(false)}
      />
    </Layout>
  );
}

// Một hàng điều khiển cổng điểm danh: trạng thái hiện tại (tính sẵn từ server,
// xem attendanceGate.js) + hai nút Mở/Đóng ghi đè hoàn toàn khung giờ đã đặt
// (nếu có) — BTC không cần huỷ lịch để chủ động mở/đóng.
function GateControlRow({ label, gate, loading, onOpen, onClose }) {
  const isOpen = gate?.open;
  const statusText = {
    MANUALLY_OPEN: 'Đang mở (thủ công)',
    MANUALLY_CLOSED: 'Đang đóng (thủ công)',
    SCHEDULED: 'Đang mở (theo lịch)',
    NOT_STARTED: 'Chưa tới giờ mở',
    ENDED: 'Đã hết giờ',
    NOT_OPENED: 'Chưa mở',
  }[gate?.reason] || '—';

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
          isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          <Circle size={7} className={isOpen ? 'fill-emerald-500 text-emerald-500' : 'fill-gray-400 text-gray-400'} />
          {statusText}
        </span>
        <p className="text-sm font-medium text-gray-700 truncate">{label}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={onOpen} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
          {loading ? <Spinner size="sm" /> : <PlayCircle size={14} />} Mở
        </button>
        <button onClick={onClose} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
          {loading ? <Spinner size="sm" /> : <StopCircle size={14} />} Đóng
        </button>
      </div>
    </div>
  );
}
