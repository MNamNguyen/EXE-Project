import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { guestApi } from '../../../services/api';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Input';

// Thêm hoặc sửa một khách mời. guest = null là thêm mới. Họ tên bắt buộc; SĐT, email
// tuỳ chọn (không có email thì BTC tải thiệp PDF tự gửi). Trùng email/SĐT trong cùng
// sự kiện server trả 409.
export default function GuestFormModal({ open, eventId, guest, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: guest?.name || '', phone: guest?.phone || '', email: guest?.email || '' });
  }, [open, guest]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Vui lòng nhập họ tên khách');
    setSaving(true);
    try {
      const { data } = guest
        ? await guestApi.update(eventId, guest.id, form)
        : await guestApi.add(eventId, form);
      toast.success(data.message);
      onSaved?.(data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lưu khách mời thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guest ? 'Sửa khách mời' : 'Thêm khách mời'}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" size="form" onClick={onClose}>Huỷ</Button>
          <Button type="submit" form="guest-form" variant="primary" size="form" loading={saving}>{guest ? 'Lưu' : 'Thêm khách'}</Button>
        </>
      )}
    >
      <form id="guest-form" onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Họ tên" required>
          {(id) => <Input id={id} value={form.name} onChange={set('name')} autoFocus autoComplete="off" />}
        </Field>
        <Field label="Số điện thoại" optional>
          {(id) => <Input id={id} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="off" />}
        </Field>
        <Field label="Email" optional hint={guest?.email && form.email.trim().toLowerCase() !== guest.email ? 'Đổi email thì thiệp được đánh dấu chưa gửi để bạn gửi lại tới địa chỉ mới.' : 'Có email thì gửi thiệp được ngay từ hệ thống.'}>
          {(id) => <Input id={id} type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="off" />}
        </Field>
      </form>
    </Modal>
  );
}
