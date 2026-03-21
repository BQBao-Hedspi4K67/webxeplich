# Bao Cao Do An - He Thong Quan Ly Lich Cong Tac va Lich Truc Ban

## 1. Tong Quan Du An
- Ten de tai: Thiet ke phan mem ho tro lap lich cong tac, lich truc ban tai Hoc vien Ky thuat va Cong nghe An ninh.
- Muc tieu: So hoa quy trinh lap lich cong tac va truc ban, quan ly can bo, tra cuu, phan quyen, va ghi nhan y kien truc ban.
- Doi tuong su dung: admin, manager, officer.

## 2. Cong Nghe Thuc Te Dang Dung
### Frontend
- React 18 + Vite + Tailwind CSS
- Lucide React, Recharts
- Data layer: custom API client o frontend/src/services/api.js

### Backend
- Node.js + Express
- mysql2/promise
- JWT (jsonwebtoken), bcryptjs, CORS, dotenv

### Database
- MySQL (XAMPP), utf8mb4
- Script tao DB: backend/database/init.sql

## 3. Cau Truc Thu Muc
- frontend/src/components: Dashboard, QuanLyCanBo, LapLichCongTac, LapLichTrucBan, TraCuuLich, XuatLich, YKienPhanHoi, Layout, QuyTrinh
- frontend/src/pages: Login
- frontend/src/services: api.js
- frontend/src/data: sampleData.js (van con duoc dung cho mot so UI)
- backend/controllers: auth, officers, workSchedules, dutySchedules, opinions
- backend/routes: auth, officers, work-schedules, duty-schedules, opinions
- backend/config: database.js, constants.js
- backend/middleware: auth.js, errorHandler.js

## 4. Trang Thai Ket Noi Frontend-Backend (Thuc Te)
### Da noi API that
- Login: frontend/src/pages/Login.jsx -> POST /api/auth/login
- Session restore: frontend/src/App.jsx -> GET /api/auth/profile
- Load du lieu tong hop: frontend/src/App.jsx -> GET officers/work-schedules/duty-schedules/opinions
- Quan ly can bo: create/update/delete qua API (officers)
- Lich cong tac: create/update/delete qua API (work-schedules)
- Lich truc ban: create/update/delete qua API (duty-schedules)
- Y kien truc ban: submit/approve/reject qua API (opinions)

### Van con mock/static
- Topbar thong bao: frontend/src/components/Layout/Topbar.jsx dang dung thongBaoData tu sampleData
- Dashboard chart/thong bao/hoat dong gan day: mot phan dung sampleData
- Xuat/In lich: frontend/src/components/XuatLich/XuatLich.jsx la mo phong UI, chua goi API export
- Quy trinh chuc nang: frontend/src/components/QuyTrinh/BangQuyTrinh.jsx la noi dung tai lieu tinh

## 5. Mapping Frontend -> Backend -> Database
### Module Auth
- API: POST /api/auth/login, GET /api/auth/profile, POST /api/auth/logout
- DB: users (username, passwordHash, fullName, email, role, avatar, status)

### Module Can Bo
- API: GET/POST/PUT/DELETE /api/officers
- DB: officers (id, fullName, position, department, phone, email, role, status)

### Module Lich Cong Tac
- API: GET/POST/PUT/DELETE /api/work-schedules + bo loc (search, type, status, weekNo, date range)
- DB: work_schedules (id, title, date, startTime, endTime, location, assignedTo, department, type, status, weekNo, notes)

### Module Lich Truc Ban
- API: GET/POST/PUT/DELETE /api/duty-schedules + bo loc (dutyType, status, weekNo, date range, officerId)
- DB: duty_schedules (id, officerId, dutyType, date, endDate, weekNo, shift, startTime, endTime, location, status, notes)

### Module Y Kien
- API: GET/POST/PUT/DELETE /api/opinions
- Rule: officer phai dang truc dung ngay moi duoc submit opinion
- DB: opinions (id, officerId, dutyDate, content, status, adminFeedback)

## 6. CORS va Moi Truong
- Da sua CORS cho frontend chay dong tren 2 cong thong dung:
  - http://localhost:5173
  - http://localhost:5174
- Bien moi truong backend:
  - CORS_ORIGIN=http://localhost:5173,http://localhost:5174

## 7. Huong Dan Cai Dat va Chay Tu Dau
1. Bat XAMPP MySQL.
2. Import backend/database/init.sql vao MySQL.
3. Cai package:
   - cd backend && npm install
   - cd frontend && npm install
4. Chay backend:
   - cd backend && npm run dev
5. Chay frontend:
   - cd frontend && npm run dev
6. Truy cap UI:
   - http://localhost:5173 hoac cong fallback Vite (thuong la 5174)

## 8. Tai Khoan Mau Test
- admin / 123456
- quanly / 123456
- canbo / 123456

## 9. Ket Qua Test Thuc Te Da Chay
### Da test runtime
- Backend health: GET /health tra ve OK
- CORS preflight tu origin 5174: pass, Access-Control-Allow-Origin dung origin
- Login API admin: HTTP 200, co token
- Frontend build: pass (vite build thanh cong)
- Frontend dev server: truy cap duoc qua localhost:5174

### Da test CRUD smoke backend (thuc te)
- officers: create 201, delete 200
- work-schedules: create 201, delete 200
- duty-schedules: create 201, delete 200
- opinions: create 201

## 10. Cac Van De Da Sua
1. Loi CORS do frontend 5174 va backend chi allow 5173 -> da sua.
2. Frontend dang nhap demo local -> da chuyen sang auth backend that.
3. Cac man CRUD chinh con thao tac local state -> da noi API that (can bo, lich cong tac, lich truc ban, y kien).

## 11. Gioi Han Hien Tai / Viec Con Lai
- Thong bao Topbar va mot so widget Dashboard van dung sampleData (chua co module notifications/activity tren backend).
- Xuat/In lich hien dang la UI mo phong, chua co backend export file PDF/Excel.
- Chua co test tu dong (unit/integration/e2e), hien la smoke test thu cong + API runtime test.

## 12. Quyet Dinh Ky Thuat Quan Trong
- Lay frontend hien co lam nguon su that de map nguoc API va schema.
- Giu nguyen hinh dang UI hien tai, chi thay data source mock -> API that.
- Duy tri RBAC tren backend theo role admin/manager/officer.
- Chuan hoa CORS cho nhieu origin local de tranh loi khi Vite doi cong.

## 13. Trang Thai Cuoi Cung
- Backend: chay duoc, API core hoat dong.
- Database: schema + seed day du, ket noi backend OK.
- Frontend: da noi API that cho cac module nghiep vu chinh, con mot so widget mang tinh mo phong/noi dung tinh.
- Du an o trang thai: Co the demo end-to-end cac luong chinh (login, xem danh sach, CRUD can bo/lich, gui-duyet y kien).
