Font dùng để vẽ chứng nhận tham gia. Server (PDF, `backend/assets/fonts`) và trình duyệt
(canvas, `frontend/public/fonts/cert`) PHẢI dùng cùng một bộ file để chữ trên bản xem web
khớp với file PDF tải về. Đổi font ở một bên thì đổi cả bên kia.

Tất cả thuộc SIL Open Font License 1.1 (xem các file OFL-*.txt), lấy từ github.com/google/fonts.

Thêm font: chép file .ttf (bản tĩnh, không phải variable) + OFL vào CẢ HAI thư mục, rồi thêm khoá
vào `FONTS` (backend/src/lib/certificateLayout.js) và `FONT_FILES`/`FONT_LABELS`
(frontend/src/pages/certificates/certRender.js). `backend/test/fonts.test.js` kiểm hai bên trùng
nhau và font đủ dấu tiếng Việt.
