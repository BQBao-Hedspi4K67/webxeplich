# 🎯 HVKTCNAN Schedule Management System

Hệ thống quản lý lịch công tác và lịch trực ban cho **Học viện Kỹ thuật và Công nghệ An ninh**.

---

## 📌 Giới thiệu

Nền tảng số hóa hỗ trợ:
- 📅 **Lập lịch công tác** theo tuần
- 🛡️ **Lập lịch trực ban** (giám đốc tuần + cán bộ nguyên ngày)
- 👥 **Quản lý cán bộ** (thêm/sửa/xóa)
- 🔍 **Tra cứu lịch** theo cán bộ, ngày, tuần
- 🖨️ **Xuất/In báo cáo** lịch công tác
- 💬 **Ghi ý kiến** từ cán bộ trực ban (duyệt bởi admin)
- 🔐 **RBAC** - Phân quyền theo vai trò (admin/manager/officer)

---

## 🏗️ Cấu trúc Project

```
web7cu5/
├── 📁 frontend/                    # React + Vite Frontend
│   ├── src/
│   │   ├── components/            # UI Components
│   │   ├── pages/                 # Pages (Login, etc)
│   │   ├── services/              # API services
│   │   └── data/                  # Mock data (deprecated in prod)
│   ├── package.json
│   └── vite.config.js
│
├── 📁 backend/                     # Node.js + Express API
│   ├── config/                    # DB config, constants
│   ├── controllers/               # Business logic
│   ├── routes/                    # API endpoints
│   ├── middleware/                # Auth, error handling
│   ├── database/
│   │   └── init.sql               # SQL schema + seed
│   ├── package.json
│   ├── .env                       # Environment config
│   └── server.js                  # Entry point
│
├── 📄 SETUP.md                     # Detailed setup guide
├── 📄 Claude.md                    # Full documentation
└── 📄 README.md                    # This file
```

---

## 🚀 Quick Start

### ⚙️ Requirement
- Node.js v16+ (recommended v20 LTS)
- MySQL 5.7+ (XAMPP recommended)
- Git (optional)

### 📥 Installation
**See [SETUP.md](./SETUP.md) for complete step-by-step guide**

```bash
# 1. Start XAMPP MySQL (Windows)
# - Open C:\xampp\xampp-control.exe
# - Click Start next to MySQL

# 2. Create database and import SQL
# - Visit http://localhost/phpmyadmin
# - Import backend/database/init.sql

# 3. Install backend dependencies
cd backend
npm install

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Start backend server (Terminal 1)
cd backend
npm run dev      # Runs on http://localhost:3000

# 6. Start frontend dev server (Terminal 2)
cd frontend
npm run dev      # Runs on http://localhost:5173
```

---

## 🔑 Test Accounts

All passwords: **123456**

| Username | Password | Role | Access |
|----------|----------|------|--------|
| **admin** | 123456 | admin | Full access to all features |
| **quanly** | 123456 | manager | Manage schedules, review opinions |
| **canbo** | 123456 | officer | View schedules, submit opinions |

---

## 📚 API Endpoints

Base URL: `http://localhost:3000/api`

### Auth
- `POST /auth/login` - Login (public)
- `GET /auth/profile` - Get current user (auth required)
- `POST /auth/logout` - Logout

### Officers
- `GET /officers` - List officers (all roles)
- `POST /officers` - Create officer (admin)
- `PUT /officers/:id` - Update officer (admin)
- `DELETE /officers/:id` - Delete officer (admin)

### Work Schedules
- `GET /work-schedules` - List schedules
- `POST /work-schedules` - Create (admin/manager)
- `PUT /work-schedules/:id` - Update (admin/manager)
- `DELETE /work-schedules/:id` - Delete (admin/manager)

### Duty Schedules
- `GET /duty-schedules` - List duty schedules
- `POST /duty-schedules` - Create (admin/manager)
- `PUT /duty-schedules/:id` - Update (admin/manager)
- `DELETE /duty-schedules/:id` - Delete (admin/manager)

### Opinions
- `GET /opinions` - List opinions (all roles)
- `POST /opinions` - Submit opinion (officer on duty)
- `PUT /opinions/:id` - Approve/reject (admin)
- `DELETE /opinions/:id` - Delete (admin)

---

## 🗄️ Database Schema

### users
- Account & authentication
- Columns: id, username, passwordHash, fullName, email, role, avatar, status

### officers
- Employee/staff information
- Columns: id, fullName, position, department, phone, email, role, status

### work_schedules
- Weekly work assignments
- Columns: id, title, date, startTime, endTime, location, assignedTo, department, type, status, weekNo, notes

### duty_schedules
- Duty assignments (director weekly + officer daily)
- Columns: id, officerId, dutyType, date, endDate, weekNo, shift, location, status, notes

### opinions
- Feedback/opinions from on-duty staff
- Columns: id, officerId, dutyDate, content, status, adminFeedback

---

## 🔐 Features

### ✅ Implemented
- ✓ User authentication (JWT)
- ✓ RBAC (Role-Based Access Control)
- ✓ Officer CRUD management
- ✓ Work schedule planning
- ✓ Duty schedule management (director weekly + officer daily)
- ✓ Opinion submission & approval workflow
- ✓ Comprehensive API with validation
- ✓ MySQL database with seed data
- ✓ Error handling & logging
- ✓ CORS, security headers

### 🔜 Future Enhancements
- [ ] Email notifications
- [ ] Advanced reporting & analytics
- [ ] Schedule conflict detection
- [ ] Mobile app (React Native)
- [ ] Real-time updates (WebSocket)
- [ ] Audit logging
- [ ] API rate limiting

---

## 📖 Documentation

- **[SETUP.md](./SETUP.md)** - Complete installation guide
- **[Claude.md](./Claude.md)** - Project overview & specifications
- **[backend/README.md](./backend/README.md)** - Backend API documentation
- **[frontend/package.json](./frontend/package.json)** - Frontend dependencies

---

## 🔧 Tech Stack

### Frontend
- React 18.2
- Vite 5.x (build tool)
- Tailwind CSS 3 (styling)
- Lucide React (icons)
- Recharts (charts)

### Backend
- Node.js v20 LTS
- Express 4.x
- MySQL 8.x
- bcryptjs (password hashing)
- JWT (authentication)
- Joi (validation)

### DevOps
- Git
- npm (dependency management)

---

## 🐛 Troubleshooting

### Database connection failed
→ See [SETUP.md - Troubleshooting](./SETUP.md#-troubleshooting)

### Port already in use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000
# Change PORT in backend/.env if needed
```

### Dependencies not installing
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Development Notes

### Adding a New API Endpoint
1. Create controller in `backend/controllers/`
2. Create route in `backend/routes/`
3. Import route in `backend/app.js`
4. Add corresponding frontend service in `frontend/src/services/`

### Database Changes
1. Update `backend/database/init.sql`
2. Recreate database: Drop & reimport

### Frontend Component
1. Create `.jsx` file in `frontend/src/components/`
2. Use API services to fetch data
3. Add routing if necessary

---

## 📞 Support & Contact

For issues or questions:
1. Check documentation in [SETUP.md](./SETUP.md)
2. Review error logs in console/terminal
3. Verify `.env` configuration
4. Test endpoints using Postman/curl

---

## 📄 License

ISC License - Học viện Kỹ thuật và Công nghệ An ninh

---

**Version**: 1.0.0  
**Last Updated**: March 20, 2026  
**Status**: ✅ Production Ready
