import { useId, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, Input, Textarea } from '../../components/ui/Input';
import { Checkbox, Switch } from '../../components/ui/Choice';
import DateTimePicker from '../../components/ui/DateTimePicker';
import { getCurrentPosition, GPS_ERROR_MESSAGES, reverseGeocode } from '../../utils/gps';
import { cx } from '../../utils/cx';

const TIME_FIELDS = [
  { key: 'checkinOpen', label: 'Check-in mở' },
  { key: 'checkinClose', label: 'Check-in đóng' },
  { key: 'checkoutOpen', label: 'Check-out mở' },
  { key: 'checkoutClose', label: 'Check-out đóng' },
];

// Một mục của form: ở trang tạo là card riêng; trong modal sửa là khối có tiêu đề, ngăn bằng
// đường kẻ (không card lồng trong modal).
function Section({ inModal, title, children }) {
  if (!inModal) return <Card title={title}>{children}</Card>;
  return (
    <section className="border-t border-border pt-5 first:border-0 first:pt-0">
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function SettingRow({ id, title, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={id} className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-pretty text-sm text-muted">{desc}</p>
      </div>
      <div className="pt-0.5">
        <Switch checked={checked} onChange={onChange} labelledBy={id} />
      </div>
    </div>
  );
}

// Các trường của sự kiện, dùng chung cho trang Tạo sự kiện và modal Sửa sự kiện (một form, hai
// chỗ dùng, không lệch nhau). form/setForm do trang gọi giữ; kiểm tra và gửi cũng ở trang gọi.
// "Đặt lịch tự động" tắt là xoá cả bốn mốc (luật cũ: đủ bốn mốc hoặc để trống hết).
export default function EventFormFields({ form, setForm, inModal = false }) {
  const uid = useId();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [scheduleOn, setScheduleOn] = useState(() => TIME_FIELDS.some(({ key }) => form[key]));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleSchedule = (on) => {
    setScheduleOn(on);
    if (!on) setForm((f) => ({ ...f, checkinOpen: '', checkinClose: '', checkoutOpen: '', checkoutClose: '' }));
  };

  const handleDetectLocation = async () => {
    setGpsLoading(true);
    setDetectedAddress('');
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({ ...f, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }));
      toast.success('Đã lấy vị trí thành công!');
      // Địa chỉ tra ngầm, không chặn form
      const address = await reverseGeocode(pos.lat, pos.lng);
      if (address) setDetectedAddress(address);
    } catch (err) {
      toast.error(GPS_ERROR_MESSAGES[err.message] || 'Không lấy được vị trí');
    } finally {
      setGpsLoading(false);
    }
  };

  const hasCoords = form.lat && form.lng;
  const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${form.lat},${form.lng}` : null;

  return (
    <div className={cx('flex flex-col', inModal ? 'gap-5' : 'gap-4')}>
      <Section inModal={inModal} title="Thông tin cơ bản">
        <div className="flex flex-col gap-5">
          <Field label="Tên sự kiện" required>
            {(id) => <Input id={id} placeholder="VD: Workshop AI 2026" value={form.name} onChange={(e) => set('name', e.target.value)} />}
          </Field>
          <Field label="Mô tả" optional>
            {(id) => (
              <Textarea id={id} rows={3} className="resize-none" value={form.description} onChange={(e) => set('description', e.target.value)} />
            )}
          </Field>
          <Field label="Địa điểm" required>
            {(id) => <Input id={id} placeholder="VD: Hội trường A1, FPT University" value={form.location} onChange={(e) => set('location', e.target.value)} />}
          </Field>
        </div>
      </Section>

      <Section inModal={inModal} title="Thời gian điểm danh">
        <SettingRow
          id={`${uid}-lich`}
          title="Đặt lịch tự động"
          desc="Cổng điểm danh tự mở, tự đóng theo bốn mốc dưới. Tắt thì BTC tự mở, đóng ở trang sự kiện."
          checked={scheduleOn}
          onChange={toggleSchedule}
        />
        {scheduleOn && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {TIME_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label}>
                {(id) => <DateTimePicker id={id} label={label} value={form[key]} onChange={(v) => set(key, v)} />}
              </Field>
            ))}
          </div>
        )}
      </Section>

      <Section inModal={inModal} title="Xác thực vị trí (GPS)">
        <SettingRow
          id={`${uid}-gps`}
          title="Bắt buộc ở gần địa điểm"
          desc="Sinh viên phải đứng trong bán kính cho phép mới check-in được."
          checked={form.gpsEnabled}
          onChange={(on) => set('gpsEnabled', on)}
        />
        {form.gpsEnabled ? (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <Button icon={LocateFixed} loading={gpsLoading} onClick={handleDetectLocation}>Lấy vị trí hiện tại của tôi</Button>
            </div>
            {(detectedAddress || hasCoords) && (
              <div className="rounded-xl bg-background p-3 text-sm">
                {detectedAddress && <p className="text-pretty text-foreground">{detectedAddress}</p>}
                <p className={cx('flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted', detectedAddress && 'mt-1')}>
                  {form.lat}, {form.lng}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative font-sans font-medium text-foreground underline-offset-4 before:absolute before:-inset-x-1.5 before:-inset-y-2 hover:underline"
                    >
                      Xem bản đồ
                    </a>
                  )}
                </p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Vĩ độ" required>
                {(id) => (
                  <Input id={id} type="number" step="any" inputMode="decimal" placeholder="10.8495" className="tabular-nums"
                    value={form.lat} onChange={(e) => { set('lat', e.target.value); setDetectedAddress(''); }} />
                )}
              </Field>
              <Field label="Kinh độ" required>
                {(id) => (
                  <Input id={id} type="number" step="any" inputMode="decimal" placeholder="106.7740" className="tabular-nums"
                    value={form.lng} onChange={(e) => { set('lng', e.target.value); setDetectedAddress(''); }} />
                )}
              </Field>
              <Field label="Bán kính (m)" hint="Tối thiểu 50 m. Trong nhà nên đặt 150–200 m.">
                {(id) => (
                  <Input id={id} type="number" min="50" max="1000" inputMode="numeric" className="tabular-nums"
                    value={form.radius} onChange={(e) => set('radius', e.target.value)} />
                )}
              </Field>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-pretty text-sm text-muted">GPS tắt — chỉ chống gian lận bằng Dynamic QR + Device Binding.</p>
        )}
      </Section>

      <Section inModal={inModal} title="Người tham dự">
        <div className="flex flex-col gap-4">
          <Checkbox
            label="Cho phép tự đăng ký tham gia"
            desc="Sinh viên tự đăng ký qua link công khai."
            checked={form.allowRegistration}
            onChange={(e) => set('allowRegistration', e.target.checked)}
          />
          <Checkbox
            label="Chỉ cho phép danh sách đã đăng ký"
            desc="Bật thì chỉ người trong danh sách tham gia mới check-in được."
            checked={form.isWhitelisted}
            onChange={(e) => set('isWhitelisted', e.target.checked)}
          />
        </div>
      </Section>
    </div>
  );
}
