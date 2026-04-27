# Hệ Thống Quản Lý Lịch Công Tác Và Lịch Trực Ban

## 1. Giới thiệu dự án
Đây là hệ thống quản trị nội bộ dành cho Học viện Kỹ thuật và Công nghệ An ninh, hỗ trợ số hóa quy trình:
- Lập lịch công tác.
- Lập lịch trực ban.
- Quản lý cán bộ và tài khoản nội bộ.
- Theo dõi, phản hồi và phê duyệt ý kiến trực ban.
- Tra cứu lịch, xuất dữ liệu và theo dõi thông báo.

Mục tiêu của dự án là thay thế cách làm thủ công bằng một nền tảng thống nhất, có phân quyền rõ ràng, dữ liệu tập trung và quy trình xử lý minh bạch.

## 2. Kiến trúc tổng thể
Hệ thống được chia làm 3 lớp:

1. Frontend (React + Vite)
- Hiển thị giao diện người dùng.
- Điều hướng theo vai trò.
- Gọi API tập trung qua lớp dịch vụ.

2. Backend (Node.js + Express)
- Cung cấp REST API.
- Xác thực JWT, phân quyền route.
- Xử lý nghiệp vụ, ghi log, phát thông báo mục tiêu.

3. Cơ sở dữ liệu (MySQL/MariaDB)
- Lưu dữ liệu người dùng, cán bộ, lịch, ý kiến, thông báo và lịch sử thao tác.

## 3. Công nghệ sử dụng

### 3.1. Frontend
- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React
- Recharts
- dayjs

### 3.2. Backend
- Node.js (ESM)
- Express 4
- mysql2/promise
- jsonwebtoken
- bcryptjs
- joi
- cors
- dotenv

## 4. Vai trò và phân quyền
Hệ thống có 3 vai trò chính:

1. Admin
- Toàn quyền nghiệp vụ.
- Thông tin tài khoản nội bộ.
- Duyệt/từ chối ý kiến trực ban.

2. Manager
- Quản lý lịch công tác và trực ban (CRUD).
- Duyệt/từ chối ý kiến trực ban.
- Tạo tài khoản nội bộ cho manager/officer.

3. Officer
- Xem dữ liệu theo quyền.
- Gửi ý kiến trực ban theo quy tắc đang trực.

## 5. Chức năng nghiệp vụ hiện có
Hệ thống hiện đã triển khai các nhóm chức năng sau:
- Đăng nhập, khôi phục phiên từ token.
- Dashboard tổng quan.
- Quản lý cán bộ.
- Lập lịch công tác (CRUD).
- Lập lịch trực ban (CRUD).
- Lịch của tôi cho cả admin, manager, officer.
- Tra cứu lịch tổng hợp.
- Xuất/In lịch (preview, download, lịch sử xuất).
- Ý kiến trực ban (gửi, duyệt, từ chối).
- Thông tin tài khoản nội bộ.
- Thông báo theo đối tượng nhận.

## 6. Cơ chế thông báo theo mục tiêu
Thông báo không phát đại trà mà được gắn đích theo:
- `targetUserId`: thông báo cá nhân.
- `targetRole`: thông báo theo nhóm vai trò.

Frontend chỉ hiển thị thông báo phù hợp với người dùng đang đăng nhập.

## 7. API tổng quan
Base URL mặc định:

```text
http://localhost:3000/api
```

Các nhóm route chính:
- `/auth`
- `/officers`
- `/work-schedules`
- `/duty-schedules`
- `/opinions`
- `/notifications`
- `/dashboard`
- `/exports`

Xác thực:
- Các route nghiệp vụ dùng Bearer token JWT trong header `Authorization`.

## 8. Cấu trúc thư mục dự án
```text
webxeplich/
    frontend/
    backend/
    README.md
```

Tài liệu chi tiết theo từng tầng:
- Frontend: `frontend/README.md`
- Backend: `backend/README.md`

## 9. Cài đặt và chạy dự án

### 9.1. Khởi tạo cơ sở dữ liệu
1. Bật MySQL/XAMPP.
2. Import script khởi tạo:

```bash
mysql -u root < backend/database/init.sql
```

### 9.2. Chạy backend
```bash
cd backend
npm install
npm run dev
```

### 9.3. Chạy frontend
```bash
cd frontend
npm install
npm run dev
```

## 10. Tài khoản mẫu
Mật khẩu mặc định: `123456`

- Admin: `admin`, `admin2`
- Manager: `quanly1` đến `quanly4`
- Officer: `canbo1` đến `canbo10`

## 11. Cơ sở dữ liệu (bảng chính)
Script khởi tạo và seed dữ liệu nằm tại `backend/database/init.sql`.

Các bảng nghiệp vụ chính:
- `users`
- `officers`
- `work_schedules`
- `duty_schedules`
- `opinions`
- `notifications`
- `notification_reads`
- `activity_logs`
- `export_logs`

## 12. Luồng xử lý nổi bật

### 12.1. Đăng nhập
1. Frontend gọi `POST /api/auth/login`.
2. Backend kiểm tra mật khẩu băm bcrypt.
3. Trả JWT và hồ sơ người dùng.

### 12.2. Tải dữ liệu ban đầu sau đăng nhập
Frontend gọi đồng thời các API officers, schedules, opinions, notifications, dashboard, export history để dựng toàn bộ màn hình.

### 12.3. Tạo tài khoản nội bộ
`POST /api/auth/users` sẽ:
- Tạo user mới trong `users`.
- Tự tạo hồ sơ cán bộ tương ứng trong `officers`.

### 12.4. Ý kiến trực ban
- Officer gửi ý kiến.
- Admin/manager có quyền duyệt hoặc từ chối.
- Hệ thống phát thông báo về đúng đối tượng.

## 13. Lưu ý vận hành
- CORS dùng biến `CORS_ORIGIN`, hỗ trợ nhiều origin ngăn cách bằng dấu phẩy.
- Token frontend lưu trong localStorage với key `hvktcnan_token`.
- Sau khi thay đổi quyền trên backend, nên đăng nhập lại để cập nhật phiên/token.

## 14. Định hướng mở rộng
- Bổ sung test tự động (unit/integration/e2e).
- Tăng cường dashboard phân tích chuyên sâu theo đơn vị.
- Tối ưu thêm hiệu năng truy vấn khi dữ liệu lớn.

---
Nếu cần mình có thể viết thêm một mục “Hướng dẫn triển khai production” ngay trong README này (PM2, reverse proxy, HTTPS, backup DB, monitoring).
