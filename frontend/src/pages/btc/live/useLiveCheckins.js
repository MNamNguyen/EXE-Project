import { useState, useEffect, useRef } from 'react';
import { eventApi } from '../../../services/api';

const POLL_MS = 3000;
const MAX_BACKOFF_MS = 15000;

// Hỏi server mỗi vài giây danh sách check-in mới nhất (GET /events/:id/live) và
// báo onArrivals với những người CHƯA thấy, cũ trước mới sau. Lần tải đầu chỉ
// ghi nhận là "đã thấy" — mở màn hình giữa sự kiện không chào lại cả trăm người.
export default function useLiveCheckins(eventId, { enabled = true, onArrivals } = {}) {
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);
  const seenRef = useRef(null);
  const onArrivalsRef = useRef(onArrivals);
  onArrivalsRef.current = onArrivals;

  useEffect(() => {
    if (!enabled) return undefined;
    seenRef.current = null;
    let stopped = false;
    let timer = null;
    let delay = POLL_MS;

    const poll = async () => {
      try {
        const { data: res } = await eventApi.getLive(eventId);
        if (stopped) return;
        const live = res.data;
        setData(live);
        setOffline(false);
        delay = POLL_MS;

        if (!seenRef.current) {
          seenRef.current = new Set(live.recent.map((r) => r.id));
        } else {
          const fresh = live.recent.filter((r) => !seenRef.current.has(r.id));
          fresh.forEach((r) => seenRef.current.add(r.id));
          if (fresh.length) onArrivalsRef.current?.(fresh.reverse());
        }
      } catch {
        if (stopped) return;
        setOffline(true);
        delay = Math.min(delay * 2, MAX_BACKOFF_MS);
      }
      // setTimeout nối tiếp thay vì setInterval: request chậm (server vừa ngủ
      // dậy) không làm các lượt hỏi chồng lên nhau.
      if (!stopped) timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [eventId, enabled]);

  return { data, offline };
}
