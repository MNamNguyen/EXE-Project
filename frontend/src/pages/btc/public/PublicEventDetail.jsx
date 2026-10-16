import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ellipsis, Eye, FileCode2, FileSpreadsheet, FileText, Globe, Lock, Pencil, QrCode, Save, Trash2, UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { guestApi, publicCheckinAdminApi, reportApi } from '../../../services/api';
import Button, { IconButton, OutlineIconButton } from '../../../components/ui/Button';
import Badge, { PhaseBadge } from '../../../components/ui/Badge';
import Tabs from '../../../components/ui/Tabs';
import Pagination from '../../../components/ui/Pagination';
import Modal, { useConfirm } from '../../../components/ui/Modal';
import Dropdown, { MenuGroup, MenuItem, MenuSeparator } from '../../../components/ui/Dropdown';
import { Card, StatGrid, TableCard, Th } from '../../../components/ui/Card';
import { Field, SearchInput, Textarea } from '../../../components/ui/Input';
import { Banner, EmptyText, LoadError, SkeletonRows } from '../../../components/ui/States';
import { eventPhase } from '../../../utils/eventStatus';
import { downloadBlob } from '../../certificates/certRender';
import ReportViewerModal from '../ReportViewerModal';
import GateRow from '../GateRow';
import PublicFormEditor, { formFieldsError } from './PublicFormEditor';
import PublicFormFields, { emptyFormValue, formValueError } from '../../public/checkin/PublicFormFields';

const PAGE_SIZE = 20;
const answerText = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');

// Trang chi tiết sự kiện check-in công khai (EventDetail rẽ sang đây khi kind = PUBLIC):
// cổng check-in, người đã check-in, soạn form. Người check-in nằm ở bảng khách
// (EventGuest), câu trả lời ở guest.answers theo id trường của form.
// Spec: docs/superpowers/specs/2026-10-16-public-checkin-design.md
export default function PublicEventDetail({ event, onEdit, onGateChange, gateLoading }) {
  const confirm = useConfirm();
  const [setup, setSetup] = useState(null); // { form, locked, count }
  const [guests, setGuests] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadState, setLoadState] = useState('loading'); // loading | ok | error | forbidden
  const [tab, setTab] = useState('people');
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [exporting, setExporting] = useState(null);

  const loadSetup = useCallback(() => publicCheckinAdminApi.getForm(event.id)
    .then(({ data }) => setSetup(data.data))
    .catch((err) => { if (err.response?.status === 403) setLoadState('forbidden'); }), [event.id]);

  const load = useCallback((p = page) => guestApi.list(event.id, { page: p, limit: PAGE_SIZE, search })
    .then(({ data }) => {
      setGuests(data.data || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
      setLoadState('ok');
    })
    .catch((err) => setLoadState(err.response?.status === 403 ? 'forbidden' : (s) => (s === 'ok' ? 'ok' : 'error'))),
  [event.id, page, search]);

  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đang có người check-in liên tục — tự làm mới.
  useEffect(() => {
    const t = setInterval(() => { load(page); loadSetup(); }, 15000);
    return () => clearInterval(t);
  }, [load, loadSetup, page]);

  const reload = () => { load(page); loadSetup(); };
  const fields = setup?.form.fields || [];
  // Hai trường đầu hiện ngay trong bảng, còn lại xem ở "Chi tiết".
  const preview = fields.slice(0, 2);

  const handleDelete = async (g) => {
    if (!(await confirm({
      title: 'Xoá lượt check-in?',
      body: <><span className="font-medium text-foreground">{g.name}</span> sẽ bị xoá khỏi danh sách và báo cáo; người này có thể check-in lại.</>,
      confirmLabel: 'Xoá',
    }))) return;
    try {
      await guestApi.remove(event.id, g.id);
      toast.success('Đã xoá lượt check-in');
      setDetail(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá thất bại');
    }
  };

  const handleExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'xlsx') {
        const { data } = await reportApi.exportAttendance(event.id);
        downloadBlob(data, `checkin-${event.name}.xlsx`);
      } else {
        const { data } = await reportApi.exportAttendanceHtml(event.id);
        downloadBlob(data, `baocao-${event.name}.html`);
      }
    } catch {
      toast.error('Xuất báo cáo thất bại');
    } finally {
      setExporting(null);
    }
  };

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-md pb-16 pt-16 text-center sm:pt-24">
        <h1 className="text-xl font-semibold text-foreground">{event.name}</h1>
        <p className="mt-2 text-pretty text-sm/6 text-muted">Chỉ người tạo sự kiện hoặc Admin quản lý được sự kiện này.</p>
        <Button as={Link} to="/events" size="form" className="mt-6">Về danh sách sự kiện</Button>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-lg font-semibold text-foreground">{event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted sm:gap-3">
            <PhaseBadge phase={eventPhase(event)} />
            <Badge tone="teal" icon={Globe}>Check-in công khai</Badge>
            {event.gpsEnabled && <span>GPS bật · {event.radius} m</span>}
          </div>
          <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">{event.location}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button as="a" href={`/events/${event.id}/qr`} target="_blank" rel="noopener noreferrer" variant="primary" icon={QrCode}>Mở màn chiếu QR</Button>
          <Button icon={FileText} onClick={() => setReportOpen(true)}>Báo cáo</Button>
          <Dropdown align="end" ariaLabel="Thêm thao tác" trigger={<OutlineIconButton icon={Ellipsis} label="Thêm thao tác" />}>
            <MenuGroup>
              <MenuItem icon={Pencil} onSelect={onEdit}>Sửa sự kiện</MenuItem>
              <MenuItem icon={FileSpreadsheet} disabled={exporting === 'xlsx'} onSelect={() => handleExport('xlsx')}>Tải file Excel</MenuItem>
              <MenuItem icon={FileCode2} disabled={exporting === 'html'} onSelect={() => handleExport('html')}>Tải file HTML</MenuItem>
            </MenuGroup>
          </Dropdown>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Cổng check-in">
          <GateRow
            label="Check-in"
            gate={event.gate?.checkin}
            state={event.checkinState}
            openAt={event.checkinOpen}
            closeAt={event.checkinClose}
            loading={gateLoading === 'checkin'}
            onChange={(state) => onGateChange('checkin', state)}
          />
        </Card>
        <StatGrid
          cols="grid-cols-3 xl:grid-cols-3"
          tiles={[
            { label: 'Đã check-in', value: stats?.checkedIn ?? '—' },
            { label: 'Hôm nay', value: stats?.today ?? '—' },
            { label: 'Gần nhất', value: stats?.lastCheckedInAt ? format(new Date(stats.lastCheckedInAt), 'HH:mm') : '—' },
          ]}
        />
      </div>

      <div className="mb-4 mt-6">
        <Tabs
          variant="underline"
          ariaLabel="Nội dung sự kiện"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'people', label: 'Người check-in', count: setup?.count ?? 0 },
            { value: 'form', label: 'Form check-in' },
          ]}
        />
      </div>

      <div hidden={tab !== 'people'}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput className="w-full sm:w-72" placeholder="Tìm theo tên, SĐT, email" value={search}
            onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />
          <Button icon={UserPlus} onClick={() => setAddOpen(true)} disabled={!setup} className="sm:ml-auto">Thêm người</Button>
        </div>
        <TableCard>
          {loadState === 'loading' ? (
            <SkeletonRows rows={6} avatar={false} />
          ) : loadState === 'error' ? (
            <LoadError title="Không tải được danh sách" onRetry={reload} />
          ) : guests.length === 0 ? (
            <EmptyText className="py-10">
              {search ? 'Không có ai khớp tìm kiếm.' : 'Chưa có ai check-in. Mở màn chiếu QR để người ghé thăm quét.'}
            </EmptyText>
          ) : (
            <>
              <table className="hidden w-full text-sm sm:table">
                <thead className="border-b border-border">
                  <tr>
                    <Th className="w-full">Họ và tên</Th>
                    {preview.map((f) => <Th key={f.id}>{f.label}</Th>)}
                    <Th>Check-in</Th>
                    <th className="w-px px-2"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="max-w-0 px-4 py-3">
                        <button type="button" onClick={() => setDetail(g)} className="block max-w-full truncate text-left font-medium text-foreground outline-none hover:underline" title={g.name}>
                          {g.name}
                        </button>
                        {g.checkedInBy && g.checkedInBy !== 'Tự check-in' && <p className="mt-0.5 truncate text-xs text-muted">Thêm bởi {g.checkedInBy}</p>}
                      </td>
                      {preview.map((f) => (
                        <td key={f.id} className="max-w-48 truncate px-4 py-3 text-foreground" title={answerText(g.answers?.[f.id])}>
                          {answerText(g.answers?.[f.id]) || <span className="text-muted">—</span>}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">
                        {g.checkedInAt ? format(new Date(g.checkedInAt), 'HH:mm · dd/MM') : '—'}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton icon={Eye} label="Xem chi tiết" row onClick={() => setDetail(g)} />
                          <IconButton icon={Trash2} label="Xoá" row danger onClick={() => handleDelete(g)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border sm:hidden">
                {guests.map((g) => (
                  <li key={g.id}>
                    <button type="button" onClick={() => setDetail(g)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {preview.map((f) => answerText(g.answers?.[f.id])).filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums text-muted">{g.checkedInAt ? format(new Date(g.checkedInAt), 'HH:mm') : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination compact page={page} pages={totalPages} total={total} pageSize={PAGE_SIZE} noun="người" note="tự cập nhật mỗi 15 giây"
                onPageChange={(p) => { setPage(p); load(p); }} />
            </>
          )}
        </TableCard>
      </div>

      <div hidden={tab !== 'form'}>
        {setup && <FormTab event={event} setup={setup} onSaved={setSetup} />}
      </div>

      {/* Chi tiết một lượt check-in: mọi câu trả lời */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        description={detail?.checkedInAt ? `Check-in lúc ${format(new Date(detail.checkedInAt), 'HH:mm · dd/MM/yyyy')}${detail.checkedInBy ? ` · ${detail.checkedInBy}` : ''}` : undefined}
        size="sm"
        footer={(
          <>
            <Button variant="danger" size="form" icon={Trash2} onClick={() => handleDelete(detail)} className="sm:mr-auto">Xoá</Button>
            <Button variant="secondary" size="form" onClick={() => setDetail(null)}>Đóng</Button>
          </>
        )}
      >
        <dl className="divide-y divide-border">
          {fields.map((f) => (
            <div key={f.id} className="py-2.5 first:pt-0">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="mt-0.5 text-pretty text-sm text-foreground">{answerText(detail?.answers?.[f.id]) || <span className="text-muted">—</span>}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      {setup && (
        <AddPersonModal
          open={addOpen}
          event={event}
          fields={fields}
          onClose={() => setAddOpen(false)}
          onAdded={reload}
        />
      )}
      <ReportViewerModal open={reportOpen} eventId={event.id} eventName={event.name} onClose={() => setReportOpen(false)} />
    </>
  );
}

// Tab soạn form + lời cảm ơn. Đã có người check-in thì trường bị khoá (server cũng chặn).
function FormTab({ event, setup, onSaved }) {
  const [fields, setFields] = useState(setup.form.fields);
  const [thankYou, setThankYou] = useState(setup.form.thankYou);
  const [saving, setSaving] = useState(false);

  // Đồng bộ lại khi server trả form mới (vd. sau khi xoá hết lượt check-in thì mở khoá).
  const serverKey = useMemo(() => JSON.stringify(setup.form), [setup.form]);
  useEffect(() => {
    setFields(setup.form.fields);
    setThankYou(setup.form.thankYou);
  }, [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify({ fields, thankYou }) !== serverKey;

  const save = async () => {
    const invalid = setup.locked ? null : formFieldsError(fields);
    if (invalid) return toast.error(invalid);
    setSaving(true);
    try {
      const { data } = await publicCheckinAdminApi.saveForm(event.id, {
        fields: setup.locked ? setup.form.fields : fields,
        thankYou,
      });
      toast.success(data.message);
      onSaved(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lưu form thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card
        title="Các trường của form"
        sub="Người ghé thăm điền form này sau khi quét QR"
        action={<Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>Lưu form</Button>}
      >
        {setup.locked && (
          <Banner tone="info" compact className="mb-4" title={`Đã có ${setup.count} người check-in`}>
            Các trường đã khoá để cột báo cáo và chống trùng không lệch với dữ liệu đã có. Xoá hết lượt check-in (vd. lượt thử) để sửa lại; lời cảm ơn vẫn sửa được.
          </Banner>
        )}
        <PublicFormEditor fields={fields} onChange={setFields} locked={setup.locked} />
      </Card>
      <div className="flex flex-col gap-4">
        <Card title="Lời cảm ơn" sub="Hiện sau khi check-in thành công">
          <Field label="Nội dung" hint="VD: Mời bạn nhận quà lưu niệm tại quầy số 2.">
            {(id) => <Textarea id={id} rows={4} maxLength={500} className="resize-none" value={thankYou} onChange={(e) => setThankYou(e.target.value)} />}
          </Field>
        </Card>
        <Card title="Xem trước" sub="Form người ghé thăm thấy (chỉ để xem)">
          <div className="pointer-events-none select-none opacity-90" aria-hidden="true">
            <PublicFormFields fields={setup.locked ? setup.form.fields : fields.filter((f) => f.label.trim())} value={emptyFormValue()} onChange={() => {}} />
          </div>
        </Card>
        {setup.locked && (
          <p className="flex items-start gap-2 text-pretty text-xs text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Form đang khoá.
          </p>
        )}
      </div>
    </div>
  );
}

// BTC thêm tay (GPS kém, khách không dùng điện thoại): cùng form, bỏ qua cổng và GPS.
function AddPersonModal({ open, event, fields, onClose, onAdded }) {
  const [value, setValue] = useState(emptyFormValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setValue(emptyFormValue()); }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const invalid = formValueError(fields, value);
    if (invalid) return toast.error(invalid);
    setSaving(true);
    try {
      const { data } = await publicCheckinAdminApi.addCheckin(event.id, value);
      toast.success(data.message);
      onAdded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thêm thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm người check-in"
      description="Dùng khi người tham gia không tự check-in được (GPS kém, không có điện thoại…). Không bị giới hạn bởi giờ mở cổng hay GPS."
      footer={(
        <>
          <Button variant="secondary" size="form" onClick={onClose}>Huỷ</Button>
          <Button type="submit" form="public-add-form" variant="primary" size="form" loading={saving}>Check-in</Button>
        </>
      )}
    >
      <form id="public-add-form" onSubmit={submit}>
        <PublicFormFields fields={fields} value={value} onChange={setValue} disabled={saving} />
      </form>
    </Modal>
  );
}
