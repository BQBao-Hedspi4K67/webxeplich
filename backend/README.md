# Backend - API quản lý lịch công tác và lịch trực ban

## 1. Vai trò của backend
Backend là lớp nghiệp vụ trung tâm của hệ thống, đảm nhiệm:
- Xác thực JWT và phân quyền theo vai trò/quyền hiệu lực.
- Quản lý cán bộ, tài khoản nội bộ và dữ liệu phòng ban.
- Quản lý lịch công tác và lịch trực ban.
- Quản lý xin nghỉ / ý kiến / phản hồi liên quan đến trực ban.
- Phát thông báo theo đúng đối tượng nhận.
- Tổng hợp dashboard và lịch sử xuất dữ liệu.

## 2. Chạy backend
```bash
npm install
npm run dev
```

Server mặc định: `http://localhost:3000`

Health check:
- `GET /health`

Production:
```bash
npm start
```

## 3. Biến môi trường
Tạo file `.env` trong thư mục `backend` với các biến sau:
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
- `CORS_ORIGIN` hỗ trợ nhiều origin, phân tách bằng dấu phẩy.

## 4. Kiến trúc code
```text
backend/
  app.js
  server.js
  config/
  controllers/
  database/
  middleware/
  routes/
  utils/
```

## 5. Cấu hình và middleware
- `verifyToken`: đọc JWT từ header `Authorization` và gắn thông tin user vào request.
- `optionalVerifyToken`: cho phép route vừa đọc công khai vừa tận dụng token nếu có.
- `requireRole`: chặn truy cập theo role.
- `errorHandler`: trả lỗi thống nhất cho API.

## 6. Route map
### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/profile`
- `PUT /api/auth/profile/contact`
- `PUT /api/auth/profile/password`
- `POST /api/auth/users` (superadmin)

### Officers
- `GET /api/officers`
- `GET /api/officers/:id`
- `POST /api/officers`
- `PUT /api/officers/:id`
- `DELETE /api/officers/:id`
- `PUT /api/officers/:id/duty-schedule-permission`
- `PUT /api/officers/:id/work-schedule-permission`
- `GET /api/officers/admin-delegations`
- `PUT /api/officers/:id/admin-delegation`

### Work schedules
- `GET /api/work-schedules`
- `GET /api/work-schedules/:id`
- `POST /api/work-schedules`
- `PUT /api/work-schedules/:id`
- `DELETE /api/work-schedules/:id`
- `PUT /api/work-schedules/:id/approve`

### Duty schedules
- `GET /api/duty-schedules`
- `GET /api/duty-schedules/:id`
- `POST /api/duty-schedules`
- `PUT /api/duty-schedules/:id`
- `DELETE /api/duty-schedules/:id`
- `POST /api/duty-schedules/auto-assign-week`
- `POST /api/duty-schedules/auto-assign-holiday`
- `GET /api/duty-schedules/check-auto-scheduled`

### Leave requests / opinions
- `GET /api/leave-requests`
- `GET /api/leave-requests/:id`
- `POST /api/leave-requests`
- `PUT /api/leave-requests/:id`
- `DELETE /api/leave-requests/:id`
- `GET /api/opinions`  
  Legacy alias tương thích với frontend cũ.

### Holidays and departments
- `GET /api/holidays`
- `POST /api/holidays`
- `PUT /api/holidays/:id`
- `DELETE /api/holidays/:id`
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id`

### Notifications, dashboard, exports
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`
- `GET /api/dashboard/overview`
- `GET /api/exports/preview`
- `GET /api/exports/download`
- `GET /api/exports/history`

## 7. Cơ chế thông báo theo mục tiêu
Hệ thống thông báo hỗ trợ:
- `targetUserId`: gửi cho một người dùng cụ thể.
- `targetRole`: gửi cho một nhóm vai trò.

Các controller liên quan đã tích hợp cơ chế này, nên thông báo không bị phát đại trà.

## 8. Đồng bộ tài khoản và hồ sơ cán bộ
Endpoint `POST /api/auth/users` tạo đồng thời:
- user đăng nhập trong bảng `users`.
- hồ sơ nghiệp vụ tương ứng trong bảng `officers`.

Mục tiêu là giữ dữ liệu tài khoản và dữ liệu nghiệp vụ luôn khớp nhau.

## 9. Database
Script khởi tạo và seed:
- `database/init.sql`

Các bảng chính:
- `users`
- `officers`
- `work_schedules`
- `duty_schedules`
- `leave_requests`
- `opinions`
- `notifications`
- `notification_reads`
- `activity_logs`
- `export_logs`
- `departments`
- `holidays`

Khởi tạo nhanh:
```bash
mysql -u root < database/init.sql
```

## 10. Tài khoản seed
Mật khẩu mặc định: `123456`

- Admin: `admin`, `admin2`
- Manager: `quanly1` đến `quanly4`
- Officer: `canbo1` đến `canbo10`

## 11. Lưu ý vận hành
- Nếu đổi quyền ở backend, nên đăng nhập lại để frontend nhận JWT mới.
- `CORS_ORIGIN` có thể dùng nhiều origin, rất hữu ích khi dev với nhiều môi trường.
- Backend có log request cơ bản để hỗ trợ debug khi phát triển.

## 12. Liên kết
- README gốc: [README.md](../README.md)
- Frontend: [frontend/README.md](../frontend/README.md)
