# Frontend - HVKTCNAN Schedule Management

## 1. Muc dich
Frontend la ung dung React dung cho 3 nhom vai tro:
- Quan tri vien
- Quan ly
- Can bo

Ung dung cung cap giao dien quan tri lich cong tac, lich truc ban, y kien truc ban, thong bao va xuat lich.

## 2. Cong nghe
- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React
- Recharts
- dayjs

## 3. Chay frontend
Yeu cau: Node.js >= 18

```bash
npm install
npm run dev
```

Frontend mac dinh chay o `http://localhost:5173` (hoac cong Vite fallback).

Build production:

```bash
npm run build
npm run preview
```

## 4. Cau truc thu muc quan trong
```
frontend/
  src/
    App.jsx
    pages/Login.jsx
    services/api.js
    data/uiConstants.js
    components/
      Layout/
      Dashboard/
      CanBo/
      LichCongTac/
      LichTrucBan/
      LichCuaToi/
      TraCuu/
      XuatLich/
      YKien/
      QuyTrinh/
```

## 5. Luong du lieu chinh
1. Dang nhap qua `POST /api/auth/login`.
2. Luu JWT vao localStorage (`hvktcnan_token`).
3. Khoi phuc phien qua `GET /api/auth/profile`.
4. Tai dong bo du lieu tong hop:
   - officers
   - work-schedules
   - duty-schedules
   - opinions
   - notifications
   - dashboard overview
   - export history
5. Render theo role va phan quyen trang trong `App.jsx`.

## 6. Man hinh hien co
- Dang nhap (`Login`)
- Dashboard
- Quan ly can bo
- Lap lich cong tac
- Lap lich truc ban
- Lich cua toi
- Tra cuu lich
- Xuat/In lich
- Y kien truc ban
- Quy trinh chuc nang
- Quan tri tai khoan (admin/manager)

## 7. Phan quyen hien tai tren frontend
- Quan tri vien: truy cap tat ca trang, gom ca `Lich cua toi`.
- Quan ly: truy cap tat ca trang nghiep vu + `Lich cua toi`.
- Can bo: khong co trang quan tri tai khoan, con lai duoc xem theo luong hien tai.

## 8. Lich cua toi
Component: `src/components/LichCuaToi/LichCuaToi.jsx`

Chuc nang:
- Tong hop lich cong tac + truc ban cua nguoi dang nhap.
- Loc theo thang, loai lich, trang thai.
- Hien thi thong ke nhanh (so lich cong tac, so ca truc, tong lich).

Co che xac dinh lich ca nhan:
- Lich cong tac: doi chieu theo truong `nguoiPhuTrach` va ho ten nguoi dang nhap.
- Lich truc ban: uu tien khop `officerId`, fallback theo ten can bo.

## 9. API client
`src/services/api.js` la lop goi API trung tam:
- auth
- officers
- workSchedules
- dutySchedules
- opinions
- notifications
- dashboard
- exports

Client co xu ly:
- Bearer token header
- parse loi API
- tai file export (csv/json)

## 10. Luu y van hanh
- Frontend phu thuoc backend va CORS phai dung origin.
- Neu thay doi role/quyen backend, can dang nhap lai de cap nhat phien.
- Neu menu moi khong hien thi, thuc hien hard refresh (Ctrl+F5).
