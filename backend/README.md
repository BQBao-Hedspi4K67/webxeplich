# Backend - HVKTCNAN Schedule Management

## 1. Vai tro backend
Backend cung cap API cho toan bo nghiep vu:
- Dang nhap/xac thuc JWT
- Quan ly can bo
- Quan ly lich cong tac
- Quan ly lich truc ban
- Quan ly y kien truc ban
- Thong bao target theo user/role
- Tong hop dashboard
- Xuat du lieu va lich su xuat

## 2. Cong nghe
- Node.js + Express
- mysql2/promise
- jsonwebtoken
- bcryptjs
- joi
- cors
- dotenv

## 3. Chay backend
```bash
npm install
npm run dev
```

Server mac dinh: `http://localhost:3000`

Health check:
`GET /health`

## 4. Bien moi truong
Tao `.env` dua tren `.env.example`.

Bien quan trong:
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN`

`CORS_ORIGIN` ho tro nhieu origin, tach bang dau phay.

## 5. Cau truc thu muc
```
backend/
	app.js
	server.js
	config/
		constants.js
		database.js
	controllers/
	middleware/
	routes/
	utils/
	database/
		init.sql
```

## 6. Route map
Tat ca route `/api/*` deu yeu cau token, tru login/logout theo route auth.

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/profile` (verifyToken)
- `POST /api/auth/users` (admin/manager)

### Officers
- `GET /api/officers`
- `GET /api/officers/:id`
- `POST /api/officers` (admin)
- `PUT /api/officers/:id` (admin)
- `DELETE /api/officers/:id` (admin)

### Work schedules
- `GET /api/work-schedules`
- `GET /api/work-schedules/:id`
- `POST /api/work-schedules` (admin/manager)
- `PUT /api/work-schedules/:id` (admin/manager)
- `DELETE /api/work-schedules/:id` (admin/manager)

### Duty schedules
- `GET /api/duty-schedules`
- `GET /api/duty-schedules/:id`
- `POST /api/duty-schedules` (admin/manager)
- `PUT /api/duty-schedules/:id` (admin/manager)
- `DELETE /api/duty-schedules/:id` (admin/manager)

### Opinions
- `GET /api/opinions`
- `GET /api/opinions/:id`
- `POST /api/opinions`
- `PUT /api/opinions/:id` (admin/manager)
- `DELETE /api/opinions/:id` (admin)

### Notifications
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`

### Dashboard
- `GET /api/dashboard/overview`

### Exports
- `GET /api/exports/preview`
- `GET /api/exports/download`
- `GET /api/exports/history`

## 7. Notification targeting
File chinh: `utils/notificationTargeting.js`

He thong ho tro 2 co che target:
- `targetUserId`: thong bao ca nhan
- `targetRole`: thong bao theo nhom role

Controllers da dung co che nay:
- workSchedulesController
- dutySchedulesController
- opinionsController
- notificationsController (chi tra thong bao dung target)

## 8. Dong bo users va officers
Khi tao user noi bo qua `POST /api/auth/users`:
- Tao ban ghi `users`.
- Tu dong tao ban ghi `officers` moi voi ma `CBxxx` tang dan.

## 9. Database
Script khoi tao: `database/init.sql`

Bang chinh:
- `users`
- `officers`
- `work_schedules`
- `duty_schedules`
- `opinions`
- `notifications`
- `notification_reads`
- `activity_logs`
- `export_logs`

Khoi tao DB:
```bash
mysql -u root < database/init.sql
```

## 10. Luu y van hanh
- Token sai hoac het han -> API tra 401/403.
- Neu vua thay doi role/quyen route, can login lai de cap nhat token.
- Khi doi schema notifications tren DB cu, utility se tu check/bo sung cot target.

## 11. Tai khoan mau
Mat khau mac dinh: `123456`

- Admin: `admin`, `admin2`
- Manager: `quanly1` ... `quanly4`
- Officer: `canbo1` ... `canbo10`
