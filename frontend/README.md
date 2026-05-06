# Frontend - Ứng dụng giao diện quản lý lịch công tác và lịch trực ban

## 1. Mục tiêu
Frontend là lớp giao diện cho hệ thống nội bộ, phục vụ:
- Đăng nhập và xem trước lịch công khai.
- Hiển thị dashboard và các màn nghiệp vụ theo vai trò.
- Cung cấp thao tác CRUD, tra cứu, xuất dữ liệu và xem thông báo.
- Đồng bộ với backend qua API có JWT.

## 2. Chạy frontend
Yêu cầu: Node.js 18+.

```bash
npm install
npm run dev
```

Mặc định frontend chạy tại `http://localhost:5173`.

Build production:

```bash
npm run build
npm run preview
```

## 3. Biến môi trường
Nếu cần ghi đè backend API mặc định, tạo file `.env` trong thư mục `frontend`:
- `VITE_API_URL`

Nếu không cấu hình, frontend dùng `http://localhost:3000/api`.

## 4. Cấu trúc chính
```text
frontend/
  src/
    App.jsx
    main.jsx
    index.css
    pages/
      LandingLogin.jsx
      Login.jsx
    components/
      Layout/
      Dashboard/
      CanBo/
      LichCongTac/
      LichTrucBan/
      LichCuaToi/
      LichTongHop/
      NgayLe/
      PhongBan/
      ThongBao/
      TraCuu/
      QuyTrinh/
      XuatLich/
      YKien/
    services/
      api.js
    data/
      uiConstants.js
    utils/
      notify.js
```

## 5. Các màn hình chính
- Màn đăng nhập / xem trước lịch tuần.
- Dashboard.
- Quản lý cán bộ.
- Lịch công tác.
- Lịch trực ban.
- Lịch của tôi.
- Lịch tổng hợp / tra cứu lịch.
- Ngày lễ.
- Phòng ban.
- Thông báo.
- Quy trình.
- Xuất lịch.
- Ý kiến / xin nghỉ.
- Quản trị tài khoản.

## 6. Luồng dữ liệu
1. Người dùng đăng nhập qua `POST /api/auth/login`.
2. JWT được lưu trong `localStorage` với khóa `hvktcnan_token`.
3. Khi reload, app gọi `GET /api/auth/profile` để khôi phục phiên.
4. Sau khi có user hợp lệ, app tải đồng thời danh sách cán bộ, lịch công tác, lịch trực ban, xin nghỉ/ý kiến, thông báo, dashboard overview, lịch sử xuất, ngày lễ và phòng ban.
5. Dữ liệu backend được normalize trong `App.jsx` và các component liên quan trước khi render.

## 7. App shell và phân quyền
File trung tâm: `src/App.jsx`

Frontend điều hướng theo vai trò backend và quyền hiệu lực:
- `superadmin`
- `admin`
- `manager`
- `officer`

Ứng dụng cũng xử lý các trường hợp ủy quyền, ví dụ quản trị được ủy quyền hoặc quản lý được ủy quyền.

## 8. Landing login
File: `src/pages/LandingLogin.jsx`

Màn đăng nhập không chỉ có form login mà còn hiển thị trước:
- bảng lịch công tác theo tuần,
- bảng lịch trực ban,
- ngày lễ của tuần đang chọn.

Đây là phần giao diện công khai trước khi người dùng đăng nhập.

## 9. API client
File: `src/services/api.js`

Client đã gom sẵn các nhóm API:
- auth
- officers
- workSchedules
- dutySchedules
- leaveRequests
- opinions (legacy alias)
- notifications
- dashboard
- holidays
- departments
- exports

Client xử lý sẵn:
- Tự gắn header `Authorization`.
- Mapping lỗi API ra `Error` chuẩn.
- Download file export với tên file lấy từ response header nếu có.

## 10. Quy ước dữ liệu UI
Trong frontend có các hàm normalize để ổn định cách render:
- Chuẩn hóa ngày và giờ.
- Chuẩn hóa trạng thái lịch.
- Chuyển role backend sang nhãn giao diện.
- Ghép tên/military rank để hiển thị tên cán bộ đồng nhất.

## 11. Xử lý dữ liệu lịch
Các component lịch dùng chung logic nhóm theo ngày/tuần và theo buổi:
- Sáng.
- Chiều.
- Danh sách trực.

Hiện giao diện đã hỗ trợ xem bảng lịch trực theo nhiều dòng nội dung, nên khi thêm padding/scroll container cần giữ đủ khoảng trống ở đáy bảng để không cắt mất dòng cuối.

## 12. Vận hành và debug
- Không thấy menu hay chức năng mới: đăng xuất rồi đăng nhập lại, sau đó hard refresh.
- Lỗi 401/403: kiểm tra token, quyền và thời hạn phiên.
- Không thấy thông báo: kiểm tra thông báo có `targetUserId` hoặc `targetRole` đúng với người dùng hiện tại.

## 13. Ghi chú phát triển
- Khi thêm module mới, nên mở rộng `src/services/api.js` trước để giữ một điểm gọi API tập trung.
- Khi backend đổi role/quyền, cập nhật lại map role và page access trong `App.jsx`.
- Khi schema dữ liệu lịch thay đổi, cập nhật hàm normalize trước khi sửa UI chi tiết.

## 14. Liên kết
- README gốc: [README.md](../README.md)
- Backend: [backend/README.md](../backend/README.md)
