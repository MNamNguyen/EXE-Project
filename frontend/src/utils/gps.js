export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS_NOT_SUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === 1) reject(new Error('GPS_DENIED'));
        else if (err.code === 2) reject(new Error('GPS_UNAVAILABLE'));
        else reject(new Error('GPS_TIMEOUT'));
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true, ...options }
    );
  });
}

export const GPS_ERROR_MESSAGES = {
  GPS_NOT_SUPPORTED: 'Thiết bị không hỗ trợ GPS',
  GPS_DENIED: 'Bạn đã từ chối quyền truy cập GPS. Vui lòng vào Cài đặt → Trình duyệt → Cho phép vị trí.',
  GPS_UNAVAILABLE: 'Không lấy được vị trí GPS. Vui lòng ra ngoài trời hoặc bật Wi-Fi.',
  GPS_TIMEOUT: 'Lấy GPS quá lâu. Vui lòng thử lại.',
};

// Toạ độ → địa chỉ đọc được (OpenStreetMap), để BTC kiểm tra vị trí vừa lấy có đúng chỗ không.
// Lỗi mạng thì trả null, form vẫn dùng được toạ độ.
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
      { headers: { 'Accept-Language': 'vi' } }
    );
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}
