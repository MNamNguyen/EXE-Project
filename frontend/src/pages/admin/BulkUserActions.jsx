import { useState } from 'react';
import {
  Pencil, KeyRound, Smartphone, Trash2, X, Copy, AlertTriangle, UserX, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// Trần của backend (lib/bulkUsers.js). Chặn sớm ở đây để admin thấy lý do
// ngay trên thanh thao tác thay vì bấm xong mới nhận lỗi 400.
const MAX_BULK = 200;
const MAX_BULK_PASSWORD = 50;

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Sinh viên' },
  { value: 'BTC', label: 'Ban tổ chức' },
  { value: 'LECTURER', label: 'Giảng viên' },
  { value: 'ADMIN', label: 'Admin' },
];

const EMPTY_EDIT = {
  role: { on: false, value: 'STUDENT' },
  class: { on: false, value: '' },
  faculty: { on: false, value: '' },
  isActive: { on: false, value: true },
};

// Kết quả hàng loạt luôn "thành công một phần" được: hiện rõ số đã xử lý và
// TỪNG tài khoản bị bỏ qua kèm lý do, đừng nuốt vào một dòng toast.
function BulkResult({ result, onClose, children }) {
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-emerald-800">{result.message}</p>
      </div>

      {children}

      {result.skipped?.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            {result.skipped.length} tài khoản bị bỏ qua
          </p>
          <ul className="space-y-1.5">
            {result.skipped.map((s) => (
              <li key={s.id} className="text-xs text-amber-700">
                <span className="font-medium">{s.name}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onClose} className="btn-primary btn-md w-full">Đóng</button>
    </div>
  );
}

export default function BulkUserActions({ selected, currentUserId, onClear, onDone }) {
  const [modal, setModal] = useState(null); // 'edit' | 'password' | 'device' | 'delete'
  const [edit, setEdit] = useState(EMPTY_EDIT);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const ids = selected.map((u) => u.id);
  const count = selected.length;
  const includesSelf = ids.includes(currentUserId);
  // Tài khoản của chính admin luôn bị backend loại khỏi lô → đếm theo số thực sự bị tác động.
  const affected = includesSelf ? count - 1 : count;

  if (count === 0) return null;

  const close = () => { setModal(null); setResult(null); setConfirmText(''); };

  // Đóng modal có kết quả = danh sách đã đổi → nạp lại bảng và xoá lựa chọn.
  const finish = () => {
    close();
    onClear();
    onDone();
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      const { data } = await fn();
      setResult(data);
      if (data.skipped?.length === 0) toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => { setEdit(EMPTY_EDIT); setResult(null); setModal('edit'); };

  const submitEdit = (e) => {
    e.preventDefault();
    const patch = {};
    if (edit.role.on) patch.role = edit.role.value;
    if (edit.class.on) patch.class = edit.class.value;
    if (edit.faculty.on) patch.faculty = edit.faculty.value;
    if (edit.isActive.on) patch.isActive = edit.isActive.value;

    if (Object.keys(patch).length === 0) {
      return toast.error('Hãy bật ít nhất một trường để thay đổi');
    }
    run(() => adminApi.bulkUpdate(ids, patch));
  };

  const openToggleActive = (value) => {
    setEdit({ ...EMPTY_EDIT, isActive: { on: true, value } });
    setResult(null);
    setModal(value ? 'unlock' : 'lock');
  };

  const submitToggleActive = (value) => run(() => adminApi.bulkUpdate(ids, { isActive: value }));

  const copyAllPasswords = async () => {
    const text = result.results
      .map((r) => [r.name, r.email, r.password].join('\t'))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép danh sách mật khẩu');
    } catch {
      toast.error('Trình duyệt không cho phép sao chép. Hãy bôi đen và copy thủ công.');
    }
  };

  const tooManyForPassword = affected > MAX_BULK_PASSWORD;

  const actions = [
    { key: 'edit', icon: Pencil, label: 'Sửa thông tin', onClick: openEdit },
    {
      key: 'password',
      icon: KeyRound,
      label: 'Đặt lại mật khẩu',
      onClick: () => { setResult(null); setModal('password'); },
      disabled: tooManyForPassword,
      title: tooManyForPassword ? `Chỉ đặt lại được tối đa ${MAX_BULK_PASSWORD} tài khoản mỗi lần` : undefined,
    },
    { key: 'lock', icon: UserX, label: 'Khoá', onClick: () => openToggleActive(false) },
    { key: 'unlock', icon: UserCheck, label: 'Mở khoá', onClick: () => openToggleActive(true) },
    { key: 'device', icon: Smartphone, label: 'Reset thiết bị', onClick: () => { setResult(null); setModal('device'); } },
    { key: 'delete', icon: Trash2, label: 'Xoá', danger: true, onClick: () => { setResult(null); setConfirmText(''); setModal('delete'); } },
  ];

  const summary = (
    <div className="bg-surface rounded-xl p-3 space-y-1">
      <p className="text-sm font-medium text-gray-900">{affected} tài khoản sẽ bị tác động</p>
      <p className="text-xs text-gray-400 line-clamp-3">
        {selected.filter((u) => u.id !== currentUserId).map((u) => u.name).join(', ')}
      </p>
      {includesSelf && (
        <p className="text-xs text-amber-600">Tài khoản của bạn nằm trong lựa chọn và sẽ được bỏ qua.</p>
      )}
    </div>
  );

  return (
    <>
      {/* Thanh thao tác nổi — luôn thấy được khi cuộn bảng dài */}
      <div className="sticky bottom-4 z-30 mt-4">
        <div className="mx-auto max-w-4xl bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 pr-3 border-r border-white/15">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-primary-500 text-sm font-bold">
              {count}
            </span>
            <span className="text-sm text-white/70">đã chọn</span>
          </div>

          <div className="flex items-center gap-1 flex-wrap flex-1">
            {actions.map(({ key, icon: Icon, label, onClick, danger, disabled, title }) => (
              <button
                key={key}
                onClick={onClick}
                disabled={disabled || affected === 0}
                title={title}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  danger ? 'text-red-300 hover:bg-red-500/20' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <button onClick={onClear} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Bỏ chọn tất cả">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sửa hàng loạt */}
      <Modal open={modal === 'edit'} onClose={result ? finish : close} title={`Sửa ${affected} tài khoản`} size="sm">
        {result ? (
          <BulkResult result={result} onClose={finish} />
        ) : (
          <form onSubmit={submitEdit} className="space-y-4">
            {summary}
            <p className="text-xs text-gray-400">
              Chỉ những trường được bật mới bị ghi đè.
            </p>

            <div className="space-y-2">
              <BulkField
                label="Vai trò"
                state={edit.role}
                onToggle={(on) => setEdit({ ...edit, role: { ...edit.role, on } })}
              >
                <select className="input" value={edit.role.value}
                  onChange={(e) => setEdit({ ...edit, role: { on: true, value: e.target.value } })}>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </BulkField>

              <BulkField
                label="Lớp"
                state={edit.class}
                onToggle={(on) => setEdit({ ...edit, class: { ...edit.class, on } })}
              >
                <input className="input" placeholder="SE1701 — để trống để xoá lớp"
                  value={edit.class.value}
                  onChange={(e) => setEdit({ ...edit, class: { on: true, value: e.target.value } })} />
              </BulkField>

              <BulkField
                label="Khoa"
                state={edit.faculty}
                onToggle={(on) => setEdit({ ...edit, faculty: { ...edit.faculty, on } })}
              >
                <input className="input" placeholder="Software Engineering — để trống để xoá khoa"
                  value={edit.faculty.value}
                  onChange={(e) => setEdit({ ...edit, faculty: { on: true, value: e.target.value } })} />
              </BulkField>

              <BulkField
                label="Trạng thái"
                state={edit.isActive}
                onToggle={(on) => setEdit({ ...edit, isActive: { ...edit.isActive, on } })}
              >
                <select className="input" value={edit.isActive.value ? 'active' : 'locked'}
                  onChange={(e) => setEdit({ ...edit, isActive: { on: true, value: e.target.value === 'active' } })}>
                  <option value="active">Hoạt động</option>
                  <option value="locked">Bị khoá</option>
                </select>
              </BulkField>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={close} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="submit" disabled={busy} className="btn-primary btn-md flex-1">
                {busy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Áp dụng
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Khoá / Mở khoá hàng loạt */}
      <Modal
        open={modal === 'lock' || modal === 'unlock'}
        onClose={result ? finish : close}
        title={modal === 'lock' ? `Khoá ${affected} tài khoản` : `Mở khoá ${affected} tài khoản`}
        size="sm"
      >
        {result ? (
          <BulkResult result={result} onClose={finish} />
        ) : (
          <div className="space-y-4">
            {summary}
            <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
              {modal === 'lock'
                ? 'Tài khoản bị khoá không đăng nhập được, dữ liệu điểm danh vẫn giữ nguyên.'
                : 'Người dùng có thể đăng nhập lại bằng mật khẩu hiện tại.'}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={close} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" disabled={busy}
                onClick={() => submitToggleActive(modal === 'unlock')}
                className="btn-primary btn-md flex-1">
                {busy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {modal === 'lock' ? 'Khoá tất cả' : 'Mở khoá tất cả'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset mật khẩu hàng loạt */}
      <Modal open={modal === 'password'} onClose={result ? finish : close} title={`Đặt lại mật khẩu cho ${affected} tài khoản`} size="lg">
        {result ? (
          <BulkResult result={result} onClose={finish}>
            {result.results?.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
                  <p className="text-xs text-gray-500">
                    Mật khẩu tạm — người dùng phải đổi ở lần đăng nhập kế tiếp
                  </p>
                  <button type="button" onClick={copyAllPasswords}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800">
                    <Copy size={13} /> Sao chép tất cả
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="table">
                    <tbody>
                      {result.results.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <p className="text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.email}</p>
                          </td>
                          <td>
                            <code className="font-mono text-sm text-primary-700 select-all">{r.password}</code>
                          </td>
                          <td className="text-right">
                            <span className={`text-xs ${r.emailSent ? 'text-emerald-600' : 'text-red-500'}`}>
                              {r.emailSent ? 'Đã gửi email' : 'Email lỗi'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </BulkResult>
        ) : (
          <div className="space-y-4">
            {summary}
            <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
              Mỗi người nhận một mật khẩu tạm qua email, phải đổi ở lần đăng nhập kế tiếp.
              Tài khoản đang bị khoá cũng được mở.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={close} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" disabled={busy}
                onClick={() => run(() => adminApi.bulkResetPassword(ids))}
                className="btn-primary btn-md flex-1">
                {busy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Đặt lại mật khẩu
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset thiết bị hàng loạt */}
      <Modal open={modal === 'device'} onClose={result ? finish : close} title={`Reset thiết bị cho ${affected} tài khoản`} size="sm">
        {result ? (
          <BulkResult result={result} onClose={finish} />
        ) : (
          <div className="space-y-4">
            {summary}
            <p className="text-xs text-gray-400 bg-surface rounded-lg p-3">
              Gỡ thiết bị đã tin cậy — lần đăng nhập kế tiếp sẽ cần mã OTP.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={close} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" disabled={busy}
                onClick={() => run(() => adminApi.bulkResetDevice(ids))}
                className="btn-primary btn-md flex-1">
                {busy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Reset thiết bị
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Xoá hàng loạt — xoá cứng, bắt gõ xác nhận */}
      <Modal open={modal === 'delete'} onClose={result ? finish : close} title={`Xoá ${affected} tài khoản`} size="sm">
        {result ? (
          <BulkResult result={result} onClose={finish} />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-800">Không thể hoàn tác</p>
                <p className="text-xs text-red-700">
                  Xoá vĩnh viễn tài khoản và toàn bộ lịch sử điểm danh. Người đã tạo sự kiện được bỏ qua.
                </p>
              </div>
            </div>
            {summary}
            <div>
              <label className="label">Gõ <strong>XOA</strong> để xác nhận</label>
              <input className="input" value={confirmText} placeholder="XOA"
                onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={close} className="btn-secondary btn-md flex-1">Huỷ</button>
              <button type="button" disabled={busy || confirmText.trim().toUpperCase() !== 'XOA'}
                onClick={() => run(() => adminApi.bulkDelete(ids))}
                className="btn-danger btn-md flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                Xoá vĩnh viễn
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// Một dòng "bật để ghi đè" trong form sửa hàng loạt.
function BulkField({ label, state, onToggle, children }) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${state.on ? 'border-primary-300 bg-primary-50/50' : 'border-border'}`}>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary-600"
          checked={state.on} onChange={(e) => onToggle(e.target.checked)} />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </label>
      {state.on && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

export { MAX_BULK };
