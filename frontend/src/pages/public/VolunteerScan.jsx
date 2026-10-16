import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, UserRound } from 'lucide-react';
import { publicInvitationApi } from '../../services/api';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { Field, Input } from '../../components/ui/Input';
import GuestScanner from '../scan/GuestScanner';

// Trang quét thiệp cho tình nguyện viên — mở bằng link BTC phát (/quet/:token), không
// cần tài khoản. BTC thu hồi link là trang này hết dùng được ngay. SĐT/email khách
// đã được server che. Tình nguyện viên tự ghi tên (lưu ở máy họ) để BTC biết ai đã
// cho khách vào.
const NAME_KEY = 'volunteer-scanner-name';

function readName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* chế độ riêng tư — bỏ qua */ }
}

export default function VolunteerScan() {
  const { token } = useParams();
  const [name, setName] = useState(readName);
  const [asking, setAsking] = useState(() => !readName());
  const [draft, setDraft] = useState(name);
  const [revoked, setRevoked] = useState(false);

  const api = useMemo(() => ({
    summary: () => publicInvitationApi.scannerSummary(token),
    scan: (code) => publicInvitationApi.scan(token, code, name),
    search: (q) => publicInvitationApi.search(token, q),
    checkIn: (guestId) => publicInvitationApi.checkIn(token, guestId, name),
    walkIn: (data) => publicInvitationApi.walkIn(token, data, name),
  }), [token, name]);

  const onFatal = useCallback((err) => {
    if (err?.response?.status === 404) setRevoked(true);
  }, []);

  const confirmName = (e) => {
    e.preventDefault();
    const v = draft.trim().replace(/\s+/g, ' ').slice(0, 40);
    saveName(v);
    setName(v);
    setAsking(false);
  };

  if (revoked) {
    return (
      <div className="min-h-screen bg-background px-4 pt-24 sm:pt-40">
        <div className="mx-auto max-w-md text-center">
          <div className="flex justify-center"><Logo className="size-10" /></div>
          <h1 className="mt-8 text-xl font-semibold text-foreground">Link quét không còn hiệu lực</h1>
          <p className="mt-2 text-pretty text-sm/6 text-muted">Ban tổ chức đã thu hồi hoặc đổi link này. Liên hệ Ban tổ chức để nhận link mới.</p>
          <Button as={Link} to="/" size="form" className="mt-6">Về trang chủ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Logo className="size-7" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">Quét thiệp mời</p>
          {!asking && (
            <Button variant="ghost" size="hdr" icon={name ? Pencil : UserRound} onClick={() => { setDraft(name); setAsking(true); }}>
              <span className="max-w-[9rem] truncate">{name || 'Ghi tên'}</span>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4">
        {asking ? (
          <form onSubmit={confirmName} className="mx-auto flex max-w-sm flex-col gap-4 pt-8">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Bạn là ai?</h1>
              <p className="mt-1 text-pretty text-sm text-muted">
                Tên của bạn được ghi kèm mỗi lượt check-in để Ban tổ chức biết ai đã đón khách. Có thể bỏ trống.
              </p>
            </div>
            <Field label="Tên của bạn">
              {(id) => <Input id={id} value={draft} maxLength={40} autoFocus onChange={(e) => setDraft(e.target.value)} placeholder="VD: Mai Anh – cửa chính" />}
            </Field>
            <Button type="submit" variant="primary" size="form">Bắt đầu quét</Button>
          </form>
        ) : (
          <GuestScanner api={api} onFatal={onFatal} />
        )}
      </main>
    </div>
  );
}
