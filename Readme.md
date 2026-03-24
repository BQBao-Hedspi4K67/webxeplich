# HVKTCNAN Schedule Management System

## 1. Tong quan du an
He thong quan ly lich cong tac va lich truc ban cho Hoc vien Ky thuat va Cong nghe An ninh.

Muc tieu chinh:
- So hoa quy trinh lap lich cong tac va lich truc ban.
- Quan ly can bo, tra cuu lich, xuat lich.
- Phan quyen theo vai tro va kiem soat truy cap.
- Ho tro y kien truc ban va phe duyet theo luong nghiep vu.

Vai tro nguoi dung:
- `admin`
- `manager`
- `officer`

## 2. Kien truc he thong
He thong gom 3 lop:

1. Frontend (React + Vite)
- Hien thi giao dien, dieu huong theo role.
- Goi API thong qua `frontend/src/services/api.js`.

2. Backend (Node.js + Express)
- Cung cap REST API.
- Xac thuc JWT, phan quyen route.
- Xu ly nghiep vu va ghi log hoat dong.

3. Database (MySQL/MariaDB)
- Luu du lieu users, officers, work_schedules, duty_schedules, opinions.
- Luu notifications, notification_reads, activity_logs, export_logs.

## 3. Cong nghe

### Frontend
- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React
- Recharts
- dayjs

### Backend
- Node.js (ESM)
- Express 4
- mysql2/promise
- jsonwebtoken
- bcryptjs
- joi
- cors
- dotenv

## 4. Chuc nang nghiep vu hien co
- Dang nhap va khoi phuc phien.
- Dashboard tong hop.
- Quan ly can bo.
- Lap lich cong tac (CRUD).
- Lap lich truc ban (CRUD).
- Lich cua toi (ca admin/manager/officer deu co).
- Tra cuu lich tong hop.
- Xuat/In lich (preview, download, history).
- Y kien truc ban (gui, duyet, tu choi).
- Quan tri tai khoan noi bo (admin/manager tao user).

## 5. Phan quyen tong quat
- `admin`: toan quyen nghiep vu.
- `manager`: CRUD lich cong tac/truc ban, duyet y kien, tao tai khoan manager/officer.
- `officer`: xem du lieu va gui y kien theo quy tac truc ban.

## 6. Notifications target
He thong thong bao da duoc target theo:
- `targetUserId` (ca nhan)
- `targetRole` (nhom vai tro)

Frontend chi nhan thong bao dung target cua user dang dang nhap.

## 7. Duong dan API chinh
Base URL:

```
http://localhost:3000/api
```

Nhom route:
- `/auth`
- `/officers`
- `/work-schedules`
- `/duty-schedules`
- `/opinions`
- `/notifications`
- `/dashboard`
- `/exports`

## 8. Cau truc thu muc
```
web7cu5/
    frontend/
    backend/
    BaoCao_DuAn_LaTeX.tex
```

## 9. Cai dat va chay du an

### 9.1. Khoi tao CSDL
1. Bat MySQL/XAMPP.
2. Import script:

```bash
mysql -u root < backend/database/init.sql
```

### 9.2. Chay backend
```bash
cd backend
npm install
npm run dev
```

### 9.3. Chay frontend
```bash
cd frontend
npm install
npm run dev
```

## 10. Tai khoan mau
Mat khau mac dinh: `123456`

- `admin`
- `admin2`
- `quanly1` ... `quanly4`
- `canbo1` ... `canbo10`

## 11. Ghi chu van hanh
- CORS backend ho tro danh sach origin qua bien `CORS_ORIGIN`.
- Frontend luu token trong localStorage key `hvktcnan_token`.
- Khi thay doi quyen tren backend, can dang nhap lai de cap nhat token/session.

## 12. Tai lieu thanh phan
- Frontend chi tiet: `frontend/README.md`
- Backend chi tiet: `backend/README.md`
