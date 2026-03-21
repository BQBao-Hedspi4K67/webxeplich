# 🔧 SETUP HƯỚNG DẪN - HVKTCNAN Schedule Management System

Hướng dẫn cài đặt từ đầu cho hệ thống quản lý lịch công tác và trực ban.

---

## ✅ YÊU CẦU HỆ THỐNG

- **Windows 10/11** hoặc OS khác
- **Node.js** v16+ (khuyến cáo v20 LTS)  
  → Download: https://nodejs.org
- **MySQL 5.7+** (hoặc MariaDB)  
  → Khuyến cáo: **XAMPP** (kèm MySQL + phpMyAdmin)
  → Download: https://www.apachefriends.org
- **Git** (optional, nhưng hữu ích)

---

## 📥 BƯỚC 1: CHUẨN BỊ HỆ THỐNG

### 1.1. Cài Node.js
```bash
# Verify Node.js installed
node --version   # Expected: v16.0.0 or higher
npm --version    # Expected: 7.0.0 or higher
```

### 1.2. Cài XAMPP (MySQL)
1. Download XAMPP từ: https://www.apachefriends.org/
2. Chạy installer
3. Chọn **MySQL** khi cài (bắt buộc)
4. Cài đặt vào `C:\xampp` (default)

### 1.3. Khởi động MySQL
**Cách 1: XAMPP Control Panel**
- Mở `C:\xampp\xampp-control.exe`
- Click **Start** next to MySQL
- Verify status = "Running"

**Cách 2: Command line**
```bash
# Windows CMD (Admin)
"C:\xampp\mysql\bin\mysql" -u root

# Hoặc nếu XAMPP MySQL trong PATH
mysql -u root
```

Nếu kết nối thành công, bạn sẽ thấy:
```
mysql>
```

---

## 📂 BƯỚC 2: CẤU TRÚC PROJECT

Sau khi clone/download:
```
d:\web7cu5\                    (Root folder)
├── frontend/                  (React + Vite app)
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── backend/                   (Node.js + Express API)
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── database/
│   │   └── init.sql          ← Important!
│   ├── package.json
│   ├── .env
│   └── README.md
├── Claude.md                  (Project documentation)
└── SETUP.md                   (This file)
```

---

## 🗄️ BƯỚC 3: CHUẨN BỊ DATABASE

### 3.1. Tạo Database mới
Nếu XAMPP MySQL đã chạy:

**Option A: Dùng phpMyAdmin (GUI)**
1. Mở browser đến: `http://localhost/phpmyadmin`
2. Click **Databases** tab
3. Nhập tên: `hvktcnan_schedule`
4. Click **Create**

**Option B: Dùng MySQL Command Line**
```bash
mysql -u root -p

# Nhấp Enter nếu MySQL không có password (default)
# Sau đó chạy:

CREATE DATABASE hvktcnan_schedule CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hvktcnan_schedule;
```

### 3.2. Import SQL Schema
**Option A: phpMyAdmin (Recommended)**
1. Mở `http://localhost/phpmyadmin`
2. Click vào database `hvktcnan_schedule`
3. Click **Import** tab
4. Choose file `backend/database/init.sql`
5. Click **Go**

**Option B: Command line**
```bash
cd d:\web7cu5\backend

# Import SQL script
mysql -u root hvktcnan_schedule < database/init.sql

# Verify (should show tables)
mysql -u root -e "USE hvktcnan_schedule; SHOW TABLES;"
```

**Expected output:**
```
+---------------------------+
| Tables_in_hvktcnan_schedule |
+---------------------------+
| duty_schedules            |
| officers                  |
| opinions                  |
| users                     |
| work_schedules            |
+---------------------------+
```

### 3.3. Verify Data
```bash
mysql -u root -e "USE hvktcnan_schedule; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM officers;"
```

Expected:
- `users` = 3 rows (admin, quanly, canbo)
- `officers` = 12 rows

---

## 🔧 BƯỚC 4: CẤU HÌNH BACKEND

### 4.1. Cài npm packages
```bash
cd d:\web7cu5\backend

npm install
```

Sẽ cài: express, mysql2, bcryptjs, jsonwebtoken, joi, cors, dotenv,...

### 4.2. Kiểm tra .env file
File `backend/.env` đã được tạo với giá trị mặc định:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hvktcnan_schedule
PORT=3000
JWT_SECRET=hvktcnan_dev_secret_key_2026
```

**⚠️ Nếu MySQL có password, cập nhật:**
```env
DB_PASSWORD=your_mysql_password
```

---

## 🚀 BƯỚC 5: CHẠY PROJECT

### Terminal 1: Start Backend API
```bash
cd d:\web7cu5\backend
npm run dev
# Hoặc: npm start

# Expected output:
# ╔════════════════════════════════════════════════════════════╗
# ║     HVKTCNAN Schedule Management API Server                ║
# ║                                                            ║
# ║     ✓ Server is running at: http://localhost:3000
# ║     ✓ Database: hvktcnan_schedule
# ║     ✓ API Base URL: http://localhost:3000/api
# ...
```

### Terminal 2: Start Frontend (Vite dev server)
```bash
cd d:\web7cu5\frontend
npm install    # If not done already
npm run dev

# Expected output:
#   VITE v5.x.x  ready in 123 ms
#   ➜  Local:   http://localhost:5173/
```

### Terminal 3: Test dengan Postman hoặc curl
```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiIs...",
#     "user": {...}
#   }
# }
```

---

## 📋 TÀI KHOẢN TEST MẶC ĐỊNH

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| **admin** | 123456 | admin | Full access: tạo/sửa/xóa cán bộ, lịch, duyệt ý kiến |
| **quanly** | 123456 | manager | Lập lịch, xem cán bộ, duyệt ý kiến |
| **canbo** | 123456 | officer | Xem lịch, gửi ý kiến |

Sử dụng credentials này để đăng nhập vào Frontend.

---

## 🔌 API ENDPOINTS

### Base URL
```
http://localhost:3000/api
```

### Authentication
```
POST /auth/login
POST /auth/logout
GET /auth/profile
```

### Officers (Cán bộ)
```
GET    /officers?page=1&limit=10&search=&role=&status=
GET    /officers/:id
POST   /officers          (admin only)
PUT    /officers/:id      (admin only)
DELETE /officers/:id      (admin only)
```

### Work Schedules (Lịch công tác)
```
GET    /work-schedules?page=1&limit=20&type=&weekNo=
GET    /work-schedules/:id
POST   /work-schedules    (admin/manager)
PUT    /work-schedules/:id
DELETE /work-schedules/:id
```

### Duty Schedules (Lịch trực ban)
```
GET    /duty-schedules?page=1&limit=20&dutyType=
GET    /duty-schedules/:id
POST   /duty-schedules    (admin/manager)
PUT    /duty-schedules/:id
DELETE /duty-schedules/:id
```

### Opinions (Ý kiến)
```
GET    /opinions?status=pending
POST   /opinions          (officers on duty)
PUT    /opinions/:id      (admin - approve/reject)
DELETE /opinions/:id      (admin)
```

---

## 🐛 TROUBLESHOOTING

### ❌ "Cannot connect to database"
**Giải pháp:**
1. ✓ XAMPP MySQL đã start? (check Control Panel)
2. ✓ MySQL running trên localhost:3306?
3. ✓ Database `hvktcnan_schedule` đã được tạo?
4. ✓ SQL init script đã import?

Verify:
```bash
mysql -u root -e "SHOW DATABASES;" | grep hvktcnan
```

### ❌ "Port 3000 already in use"
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Or change port in backend/.env
PORT=3001
```

### ❌ "npm: command not found"
Cài Node.js từ: https://nodejs.org

### ❌ "MySQL password wrong"
Kiểm tra MySQL không có password (default):
```bash
mysql -u root
```

Nếu có password, cập nhật `backend/.env`:
```env
DB_PASSWORD=your_password
```

### ❌ Frontend không kết nối Backend
1. Backend server chạy chưa? Check http://localhost:3000/health
2. CORS config chuẩn chưa? Check `backend/app.js` line 13
3. API URL đúng chưa? Check `frontend/src/services/api.js`

---

## 📝 QUYỂN TRỊ PHÁT TRIỂN TIẾP

### Cấu trúc để mở rộng
- **Backend**: Thêm route mới trong `routes/`, tạo controller tương ứng
- **Frontend**: Thêm component mới trong `src/components/`
- **Database**: Cập nhật schema bằng migration script

### Best practices
- Luôn import từ `.env`, không hardcode secrets
- Validate input server-side (Joi)
- Hash password với bcryptjs trước lưu DB
- Return JSON standardized format `{ success, data, message, error, code }`

---

## ✨ Hoàn tất!

Nếu mọi bước đều thành công:
1. ✓ Frontend chạy trên http://localhost:5173
2. ✓ Backend API chạy trên http://localhost:3000/api
3. ✓ MySQL database ready
4. ✓ Có thể đăng nhập với tài khoản test

**Mời bạn truy cập:**
```
http://localhost:5173
```

Đăng nhập với: `admin / 123456`

---

## 📞 Support

Nếu gặp vấn đề:
1. Check `backend/README.md` để chi tiết về API
2. Check `backend/database/init.sql` để verify schema
3. Xem server logs khi call API (error message rõ ràng)
4. Test endpoint bằng Postman hoặc curl

---

**Last updated**: March 20, 2026
