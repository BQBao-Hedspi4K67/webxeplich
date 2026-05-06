# Hệ thống quản lý lịch công tác và lịch trực ban

## 1. Tổng quan
Đây là ứng dụng nội bộ cho Học viện Kỹ thuật và Công nghệ An ninh, phục vụ số hóa quy trình:
- Quản lý cán bộ và tài khoản nội bộ.
- Lập, tra cứu và xuất lịch công tác.
- Lập, tra cứu và phân công lịch trực ban.
- Theo dõi thông báo theo đúng đối tượng nhận.
- Gửi, duyệt và phản hồi ý kiến/xin nghỉ liên quan đến trực ban.

Ứng dụng gồm một frontend React chạy trên Vite, một backend Node.js/Express và cơ sở dữ liệu MySQL. Giao diện hỗ trợ cả màn hình đăng nhập công khai có xem trước lịch tuần, lẫn các màn hình nghiệp vụ sau khi xác thực.

## 2. Kiến trúc
Hệ thống được tách thành 3 lớp:

1. Frontend
- React 18 + Vite.
- Điều hướng theo vai trò và quyền thực tế của người dùng.
- Gọi API tập trung qua lớp dịch vụ `frontend/src/services/api.js`.

2. Backend
- Node.js (ESM) + Express 4.
- Xác thực JWT, middleware phân quyền, kiểm tra vai trò và ghi log hoạt động.
- Xử lý các nghiệp vụ chính: cán bộ, lịch công tác, lịch trực ban, nghỉ phép/ý kiến, thông báo, dashboard, xuất dữ liệu.

3. Database
- MySQL/MariaDB.
- Lưu tài khoản, hồ sơ cán bộ, lịch, thông báo, log và dữ liệu khởi tạo.

## 3. Công nghệ
### Frontend
- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React
- Recharts
- dayjs
- sweetalert2

### Backend
- Node.js
- Express 4
- mysql2/promise
- jsonwebtoken
- bcryptjs
- joi
- cors
- dotenv
- pdfkit

## 4. Chức năng chính
### Màn công khai trước đăng nhập
- Đăng nhập.
- Xem trước bảng lịch tuần ngay trên màn landing/login.
- Xem lịch công tác, lịch trực ban và ngày lễ của tuần đang chọn.

### Sau đăng nhập
- Dashboard tổng quan.
- Quản lý cán bộ.
- Lập lịch công tác.
- Lập lịch trực ban.
- Lịch của tôi.
- Tra cứu lịch tổng hợp.
- Quản lý ngày lễ.
- Quản lý phòng ban.
- Thông báo.
- Quy trình / bảng quy trình.
- Quản trị tài khoản nội bộ.
- Ý kiến / xin nghỉ / phản hồi trực ban.
- Xuất và tải lịch.

## 5. Vai trò và quyền
Backend phân biệt vai trò kỹ thuật và quyền hiệu lực:
- `superadmin`
- `admin`
- `manager`
- `officer`

Frontend hiển thị vai trò theo nhãn:
- Quản trị viên
- Quản lý
- Cán bộ

Ngoài vai trò gốc, ứng dụng còn có các quyền suy diễn như:
- Ủy quyền quản trị hoặc quản lý.
- Quyền tạo/sửa/duyệt lịch công tác.
- Quyền quản lý lịch trực ban theo đơn vị hoặc theo phân quyền.

## 6. Luồng dữ liệu chính
1. Người dùng đăng nhập bằng `POST /api/auth/login`.
2. Frontend lưu JWT trong `localStorage` với khóa `hvktcnan_token`.
3. Khi tải lại trang, frontend gọi `GET /api/auth/profile` để khôi phục phiên.
4. Sau khi có phiên hợp lệ, frontend tải đồng thời:
- danh sách cán bộ,
- lịch công tác,
- lịch trực ban,
- danh sách xin nghỉ/ý kiến,
- thông báo,
- dashboard overview,
- lịch sử xuất,
- ngày lễ,
- phòng ban.
5. Dữ liệu được normalize ở frontend trước khi render để giữ UI ổn định dù backend thay đổi nhẹ định dạng.

## 7. API backend
Base URL mặc định:

```text
http://localhost:3000/api
```

### Nhóm route
- `/auth`
- `/officers`
- `/work-schedules`
- `/duty-schedules`
- `/leave-requests`
- `/opinions`  
    Route legacy alias, đang đi cùng dữ liệu nghỉ phép/xin nghỉ.
- `/holidays`
- `/departments`
- `/notifications`
- `/dashboard`
- `/exports`

### Một số điểm đáng chú ý
- `GET /health` dùng kiểm tra sống của backend.
- Các route nghiệp vụ dùng Bearer token trong header `Authorization`.
- Một số route đọc công khai bằng `optionalVerifyToken` để phục vụ màn preview trước đăng nhập.

## 8. Cấu trúc thư mục
```text
web7cu5/
    backend/
        app.js
        server.js
        config/
        controllers/
        database/
        middleware/
        routes/
        utils/
    frontend/
        src/
            App.jsx
            main.jsx
            pages/
            components/
            services/
            data/
            utils/
    report/
    README.md
```

## 9. Thiết lập môi trường
### Backend
Tạo file `.env` trong thư mục `backend` và cấu hình các biến sau:
- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`

Ghi chú:
- Có thể dùng `DATABASE_URL` hoặc bộ biến DB tách rời.
- `CORS_ORIGIN` hỗ trợ nhiều origin, cách nhau bằng dấu phẩy.
- Nếu cần mở toàn bộ trong môi trường dev, có thể đặt `CORS_ORIGIN=*`.

### Frontend
Tạo file `.env` trong thư mục `frontend` nếu cần ghi đè API mặc định:
- `VITE_API_URL`

Nếu không cấu hình, frontend dùng mặc định `http://localhost:3000/api`.

## 10. Cài đặt và chạy
### 10.1. Khởi tạo database
Import file seed ban đầu:

```bash
mysql -u root < backend/database/init.sql
```

### 10.2. Chạy backend
```bash
cd backend
npm install
npm run dev
```

Backend production:

```bash
cd backend
npm start
```

### 10.3. Chạy frontend
```bash
cd frontend
npm install
npm run dev
```

Build production:

```bash
cd frontend
npm run build
npm run preview
```

## 11. Tài khoản mẫu
Mật khẩu mặc định của dữ liệu seed: `123456`

- Admin: `admin`, `admin2`
- Manager: `quanly1` đến `quanly4`
- Officer: `canbo1` đến `canbo10`

## 12. Dữ liệu chính
Script khởi tạo nằm tại `backend/database/init.sql`.

Các bảng nghiệp vụ chính hiện có:
- `users`
- `officers`
- `work_schedules`
- `duty_schedules`
- `leave_requests`
- `opinions`  
    Dùng như alias/legacy compatibility cho luồng ý kiến.
- `notifications`
- `notification_reads`
- `activity_logs`
- `export_logs`
- `departments`
- `holidays`

## 13. Các luồng quan trọng
### Đăng nhập và khôi phục phiên
- Frontend gọi `POST /api/auth/login`.
- Backend kiểm tra mật khẩu đã băm bằng bcrypt.
- Nếu hợp lệ, backend trả JWT và hồ sơ người dùng.

### Tải dữ liệu ban đầu
Sau khi có phiên, frontend tải đồng thời dữ liệu tổng quan để dựng dashboard và các màn nghiệp vụ.

### Tạo tài khoản nội bộ
`POST /api/auth/users` tạo user mới và đồng thời tạo hồ sơ cán bộ tương ứng để dữ liệu tài khoản và nghiệp vụ khớp nhau.

### Ý kiến / xin nghỉ
- Người dùng gửi yêu cầu qua `leave-requests`.
- Backend cho phép admin/manager xử lý trạng thái.
- Hệ thống phát thông báo đúng đích cho người liên quan.

### Thông báo theo mục tiêu
Thông báo được gắn theo:
- `targetUserId`: cho một người dùng cụ thể.
- `targetRole`: cho một nhóm vai trò.

Frontend chỉ render thông báo phù hợp với người đang đăng nhập.

## 14. Cấu hình và vận hành
- Token frontend lưu tại `hvktcnan_token`.
- Khi thay đổi quyền trên backend, nên đăng nhập lại để cập nhật phiên mới.
- Backend có log request cơ bản theo method và path để dễ theo dõi trong môi trường dev.

## 15. Ghi chú triển khai
Repository có sẵn các file cấu hình triển khai cho nền tảng cloud/hosting riêng (`backend/railway.json`, `frontend/vercel.json`). Nếu cần, có thể tách riêng hướng dẫn deploy production theo môi trường cụ thể.

## 16. Tài liệu liên quan
- Backend chi tiết: [backend/README.md](backend/README.md)
- Frontend chi tiết: [frontend/README.md](frontend/README.md)

---
