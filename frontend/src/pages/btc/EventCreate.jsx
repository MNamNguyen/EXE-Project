import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { eventApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button from '../../components/ui/Button';
import { localInputToISO } from '../../utils/date';
import EventFormFields from './EventFormFields';

export default function EventCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    lat: '',
    lng: '',
    radius: '100',
    gpsEnabled: true,
    // Để trống mặc định — khung giờ giờ là TUỲ CHỌN, BTC có thể chủ động
    // "Mở điểm danh"/"Đóng điểm danh" ở trang chi tiết thay vì đặt lịch trước.
    checkinOpen: '',
    checkinClose: '',
    checkoutOpen: '',
    checkoutClose: '',
    isWhitelisted: false,
    allowRegistration: true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location) {
      return toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
    }
    const timeFields = [form.checkinOpen, form.checkinClose, form.checkoutOpen, form.checkoutClose];
    const filledCount = timeFields.filter(Boolean).length;
    if (filledCount > 0 && filledCount < 4) {
      return toast.error('Vui lòng điền đủ cả 4 mốc giờ, hoặc để trống tất cả để tự mở/đóng điểm danh thủ công');
    }
    if (form.gpsEnabled && (!form.lat || !form.lng)) {
      return toast.error('Vui lòng lấy vị trí GPS hoặc tắt tính năng GPS');
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        checkinOpen: form.checkinOpen ? localInputToISO(form.checkinOpen) : null,
        checkinClose: form.checkinClose ? localInputToISO(form.checkinClose) : null,
        checkoutOpen: form.checkoutOpen ? localInputToISO(form.checkoutOpen) : null,
        checkoutClose: form.checkoutClose ? localInputToISO(form.checkoutClose) : null,
      };
      const { data } = await eventApi.create(payload);
      toast.success('Tạo sự kiện thành công!');
      navigate(`/events/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tạo sự kiện thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout parent={{ label: 'Sự kiện', to: '/events' }} activeNav="/events">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-xl font-semibold text-foreground">Tạo sự kiện mới</h1>
          <p className="mt-2 max-w-[55ch] text-pretty text-sm/6 text-muted">
            Sau khi tạo, bạn được đưa thẳng tới trang sự kiện để mở màn QR.
          </p>
        </div>
      </header>
      <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
        <EventFormFields form={form} setForm={setForm} />
        <div className="flex flex-col-reverse gap-2 border-t border-border-strong pt-5 sm:flex-row sm:justify-end">
          <Button size="form" onClick={() => navigate('/events')}>Huỷ</Button>
          <Button type="submit" variant="primary" size="form" loading={loading}>Tạo sự kiện</Button>
        </div>
      </form>
    </Layout>
  );
}
