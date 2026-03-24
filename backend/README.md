# Backend - He thong API quan ly lich cong tac va lich truc ban

## 1. Muc tieu backend
Backend la lop nghiep vu trung tam, dam nhan:
- Xac thuc, phan quyen va kiem soat truy cap.
- Xu ly CRUD cho can bo, lich cong tac, lich truc ban.
- Xu ly y kien truc ban va phe duyet.
- Cap phat thong bao theo doi tuong nhan.
- Tong hop so lieu dashboard.
- Cung cap du lieu export va lich su export.

## 2. Cong nghe va thu vien
- Node.js + Express
- mysql2/promise
- jsonwebtoken
- bcryptjs
- joi
- cors
- dotenv

## 3. Khoi dong backend
```bash
npm install
npm run dev
```

Server mac dinh: `http://localhost:3000`

Health endpoint:
- `GET /health`

## 4. Bien moi truong can co
Tao file `.env` dua tren `.env.example`.

Danh sach bien quan trong:
- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`

Luu y:
- `CORS_ORIGIN` cho phep nhieu origin, tach boi dau phay.

## 5. Cau truc code
```
backend/
	app.js
	server.js
	config/
		constants.js
		database.js
	controllers/
	routes/
	middleware/
	utils/
	database/
		init.sql
```

## 6. Chuan middleware va bao mat
1. `verifyToken`
- Doc JWT tu header Authorization.
- Gan thong tin user vao request.

2. `requireRole`
- Kiem tra role duoc phep theo route.

3. Error handling
- Su dung middleware tong de tra loi loi co cau truc.

## 7. Route map va quyen truy cap
Tat ca route `/api/*` deu qua xac thuc, tru login/logout theo route auth.

### 7.1. Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/profile` (can token)
- `POST /api/auth/users` (admin/manager)

### 7.2. Officers
- `GET /api/officers`
- `GET /api/officers/:id`
- `POST /api/officers` (admin)
- `PUT /api/officers/:id` (admin)
- `DELETE /api/officers/:id` (admin)

### 7.3. Work schedules
- `GET /api/work-schedules`
- `GET /api/work-schedules/:id`
- `POST /api/work-schedules` (admin/manager)
- `PUT /api/work-schedules/:id` (admin/manager)
- `DELETE /api/work-schedules/:id` (admin/manager)

### 7.4. Duty schedules
- `GET /api/duty-schedules`
- `GET /api/duty-schedules/:id`
- `POST /api/duty-schedules` (admin/manager)
- `PUT /api/duty-schedules/:id` (admin/manager)
- `DELETE /api/duty-schedules/:id` (admin/manager)

### 7.5. Opinions
- `GET /api/opinions`
- `GET /api/opinions/:id`
- `POST /api/opinions`
- `PUT /api/opinions/:id` (admin/manager)
- `DELETE /api/opinions/:id` (admin)

### 7.6. Notifications
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`

### 7.7. Dashboard
- `GET /api/dashboard/overview`

### 7.8. Exports
- `GET /api/exports/preview`
- `GET /api/exports/download`
- `GET /api/exports/history`

## 8. Notification targeting (trong backend)
File trung tam: `utils/notificationTargeting.js`

He thong thong bao ho tro:
- `targetUserId`: thong bao cho mot user cu the.
- `targetRole`: thong bao cho nhom role.

Cac controller da tich hop co che nay:
- `workSchedulesController.js`
- `dutySchedulesController.js`
- `opinionsController.js`
- `notificationsController.js`

## 9. Dong bo users va officers
Route `POST /api/auth/users` khong chi tao user dang nhap, ma con:
- Tao them ban ghi trong bang officers.
- Sinh ma can bo dang `CBxxx` tang dan.

Dieu nay giup du lieu nghiep vu va du lieu tai khoan khop nhau ngay tu dau.

## 10. Database
Script khoi tao va seed du lieu:
- `database/init.sql`

Bang du lieu chinh:
- `users`
- `officers`
- `work_schedules`
- `duty_schedules`
- `opinions`
- `notifications`
- `notification_reads`
- `activity_logs`
- `export_logs`

Lenh khoi tao nhanh:
```bash
mysql -u root < database/init.sql
```

## 11. Quy tac nghiep vu quan trong
1. Officer gui y kien theo luong truc ban.
2. Admin/manager co the duyet hoac tu choi y kien.
3. Lich cong tac va lich truc ban khi tao/cap nhat co the sinh thong bao target.
4. API notifications chi tra thong bao dung nguoi dung dang nhap.

## 12. Van hanh va debug
1. Loi 401:
- Kiem tra token co gui len header khong.
- Kiem tra token con han khong.

2. Loi 403:
- Kiem tra role trong token.
- Kiem tra route co `requireRole` dung role khong.

3. Khong thay thong bao:
- Kiem tra du lieu notifications co targetUserId/targetRole dung user hien tai.

4. DB cu thieu cot target thong bao:
- Utility se tu ensure schema notifications khi xu ly.

## 13. Tai khoan seed de test
Mat khau mac dinh: `123456`

- Admin: `admin`, `admin2`
- Manager: `quanly1` den `quanly4`
- Officer: `canbo1` den `canbo10`

## 14. Khuyen nghi cho phat trien tiep
- Bo sung test tu dong cho controller va route quan trong.
- Tach service layer neu can mo rong nghiep vu lon hon.
- Bo sung rate limit va audit bao mat cho login route.
