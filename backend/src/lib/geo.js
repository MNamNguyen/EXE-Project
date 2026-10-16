// Khoảng cách (mét) giữa hai toạ độ theo công thức haversine.
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const isCoord = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Kiểm tra GPS người dùng gửi so với sự kiện (gpsEnabled). Trả null nếu hợp lệ, hoặc
// { status, body, fraud } để controller trả lỗi — fraud là lý do ghi FraudLog (nếu có).
// Dùng chung cho check-in tự quét (checkin.controller) và check-in công khai.
function gpsRejection(event, gps) {
  if (!event.gpsEnabled) return null;
  if (gps?.lat == null || gps?.lng == null) {
    return {
      status: 400,
      body: { success: false, error: 'GPS_REQUIRED', message: 'Vui lòng bật GPS và cấp quyền vị trí để check-in' },
    };
  }
  if (!isCoord(gps.lat, -90, 90) || !isCoord(gps.lng, -180, 180)) {
    return {
      status: 400,
      fraud: { reason: 'GPS_INVALID', extra: { gps } },
      body: { success: false, error: 'GPS_INVALID', message: 'Dữ liệu GPS không hợp lệ. Vui lòng thử lại.' },
    };
  }
  if (event.lat !== null && event.lng !== null) {
    const distance = haversineDistance(gps.lat, gps.lng, event.lat, event.lng);
    if (distance > event.radius) {
      return {
        status: 400,
        fraud: { reason: 'GPS_OUT_OF_RANGE', extra: { gps, distance: Math.round(distance) } },
        body: {
          success: false,
          error: 'OUT_OF_RANGE',
          message: `Bạn đang cách địa điểm sự kiện ${Math.round(distance)}m. Vui lòng đến gần hơn.`,
          distance: Math.round(distance),
          requiredRadius: event.radius,
        },
      };
    }
  }
  return null;
}

module.exports = { haversineDistance, gpsRejection };
