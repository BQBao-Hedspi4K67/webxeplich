# HVKTCNAN Schedule Management - Backend API

Phần mềm quản lý lịch công tác và lịch trực ban cho Học viện Kỹ thuật và Công nghệ An ninh.

## 🚀 Quick Start

### Install dependencies
```bash
npm install
```

### Configure environment
Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

### Initialize database
1. Start XAMPP MySQL (phpMyAdmin, or command line)
2. Create database and import schema:
```bash
# Using phpMyAdmin: Tools → SQL → Upload init.sql
# Or using command line:
mysql -u root < database/init.sql
```

### Start development server
```bash
npm run dev
```

Server will run on http://localhost:3000

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### Main Endpoints

#### Auth
- `POST /auth/login` - Login và nhận JWT token
- `GET /auth/profile` - Lấy profile người dùng hiện tại
- `POST /auth/logout` - Logout

#### Officers (Cán bộ)
- `GET /officers` - Danh sách cán bộ (có pagination)
- `GET /officers/:id` - Chi tiết 1 cán bộ
- `POST /officers` - Tạo mới (admin only)
- `PUT /officers/:id` - Cập nhật (admin only)
- `DELETE /officers/:id` - Xóa (admin only)

#### Work Schedules (Lịch công tác)
- `GET /work-schedules` - Danh sách lịch công tác
- `GET /work-schedules/:id` - Chi tiết
- `POST /work-schedules` - Tạo mới (admin/manager)
- `PUT /work-schedules/:id` - Cập nhật (admin/manager)
- `DELETE /work-schedules/:id` - Xóa (admin/manager)

#### Duty Schedules (Lịch trực ban)
- `GET /duty-schedules` - Danh sách lịch trực ban
- `GET /duty-schedules/:id` - Chi tiết
- `POST /duty-schedules` - Tạo mới (admin/manager)
- `PUT /duty-schedules/:id` - Cập nhật (admin/manager)
- `DELETE /duty-schedules/:id` - Xóa (admin/manager)

#### Opinions (Ý kiến)
- `GET /opinions` - Danh sách ý kiến
- `GET /opinions/:id` - Chi tiết
- `POST /opinions` - Gửi ý kiến (officers on duty)
- `PUT /opinions/:id` - Phê duyệt/từ chối (admin only)
- `DELETE /opinions/:id` - Xóa (admin only)

## 🔑 Test Accounts (DEMO)

Default passwords: **123456**

| Username | Role | Permissions |
|----------|------|-------------|
| admin | admin | Full access |
| quanly | manager | Manage schedules, view officers |
| canbo | officer | View schedules, submit opinions |

## 🗄️ Database

### Schema
- **users** - Tài khoản người dùng
- **officers** - Danh sách cán bộ
- **work_schedules** - Lịch công tác
- **duty_schedules** - Lịch trực ban (2 loại: director & officer daily)
- **opinions** - Ý kiến từ cán bộ

### Import Script
```bash
mysql -u root hvktcnan_schedule < database/init.sql
```

## 🛠️ Development

### Project Structure
```
backend/
├── config/           - Cấu hình (database, constants)
├── controllers/      - Business logic
├── middleware/       - Auth, error handling
├── routes/           - API routes
├── database/         - SQL scripts
├── app.js            - Express app setup
├── server.js         - Server entry point
└── .env              - Environment variables
```

### Add New Route
1. Create controller in `controllers/`
2. Create route in `routes/`
3. Import route in `app.js`

## 📦 Dependencies

- **express** - Web framework
- **mysql2** - MySQL database driver
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT generation
- **joi** - Validation
- **cors** - Cross-origin support
- **dotenv** - Environment config

## 🔐 Security Notes

1. Change `JWT_SECRET` in .env for production
2. Hash passwords with bcryptjs before storing
3. Validate all input server-side
4. Use HTTPS in production
5. Implement rate limiting for login endpoint
6. Add CSRF protection if needed

## 🐛 Troubleshooting

### Database connection failed
- Verify XAMPP MySQL is running
- Check DB_ variables in .env
- Ensure database `hvktcnan_schedule` exists

### Port already in use
- Change PORT in .env
- Or kill process: `lsof -ti :3000 | xargs kill -9`

### Token expired
- Client should refresh token before expiry
- Token expires in 7 days

## 📝 License
ISC
