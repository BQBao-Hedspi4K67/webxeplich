# Frontend - He thong quan ly lich cong tac va lich truc ban

## 1. Muc tieu frontend
Frontend la ung dung giao dien cho he thong quan tri noi bo, phuc vu 3 vai tro:
- Admin
- Manager
- Officer

Frontend tap trung vao 3 nhiem vu:
- Hien thi du lieu nghiep vu theo role.
- Cung cap thao tac CRUD than thien cho cac module chinh.
- Dong bo voi backend thong qua API co xac thuc JWT.

## 2. Cong nghe va thu vien
- React 18
- Vite 5
- Tailwind CSS 3
- Lucide React (icon)
- Recharts (bieu do)
- dayjs (xu ly ngay gio)

## 3. Cach chay frontend
Yeu cau:
- Node.js >= 18

Lenh chay:

```bash
npm install
npm run dev
```

Frontend mac dinh chay tren `http://localhost:5173` (hoac cong fallback do Vite cap).

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
    main.jsx
    index.css
    pages/
      Login.jsx
    services/
      api.js
    data/
      uiConstants.js
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

## 5. Luong du lieu tong quat
1. Dang nhap:
- Goi `POST /api/auth/login`.
- Nhan JWT va thong tin user.

2. Luu phien:
- Token duoc luu tai localStorage voi key `hvktcnan_token`.

3. Khoi phuc phien:
- Goi `GET /api/auth/profile` khi reload app.

4. Nap du lieu dashboard va nghiep vu:
- officers
- work-schedules
- duty-schedules
- opinions
- notifications
- dashboard/overview
- exports/history

5. Render theo phan quyen:
- Dieu huong trang dua tren role map trong `App.jsx`.

## 6. Danh sach man hinh hien co
- Dang nhap
- Dashboard
- Quan ly can bo
- Lap lich cong tac
- Lap lich truc ban
- Lich cua toi
- Tra cuu lich
- Xuat/In lich
- Y kien truc ban
- Quy trinh chuc nang
- Quan tri tai khoan (chi admin/manager)

## 7. Phan quyen tren frontend
- Admin: co tat ca trang, bao gom `Lich cua toi`.
- Manager: co tat ca trang nghiep vu, bao gom `Lich cua toi`.
- Officer: khong co trang `Quan tri tai khoan`, cac trang con lai theo luong hien tai.

## 8. Module Lich cua toi
File: `src/components/LichCuaToi/LichCuaToi.jsx`

Chuc nang:
- Tong hop lich cong tac va lich truc ban cua user dang dang nhap.
- Loc theo thang, loai lich, trang thai.
- Hien thong ke nhanh so luong lich.

Co che doi chieu du lieu:
- Lich cong tac: so theo truong nguoi phu trach (ten).
- Lich truc ban: uu tien khop officerId, fallback theo ten can bo.

## 9. Lop API client
File: `src/services/api.js`

Client da dong goi cac nhom API:
- auth
- officers
- workSchedules
- dutySchedules
- opinions
- notifications
- dashboard
- exports

Client xu ly san:
- Header Authorization Bearer token.
- Bat loi va map thong diep loi.
- Download file export (csv/json).

## 10. Quy uoc du lieu UI
Trong frontend co cac ham normalize giup map du lieu backend thanh du lieu hien thi:
- Chuan hoa ngay gio.
- Chuan hoa trang thai (`done` -> `completed`).
- Chuan hoa ten role backend -> role giao dien.

Muc dich la giu giao dien on dinh ngay ca khi backend thay doi dinh dang nho.

## 11. Van hanh va debug
1. Khong thay menu/chuc nang moi:
- Dang xuat dang nhap lai.
- Hard refresh (Ctrl+F5).

2. Loi 401/403:
- Kiem tra token het han.
- Kiem tra role trong token co dung voi route backend.

3. Khong thay thong bao:
- Kiem tra du lieu notifications co targetUserId/targetRole dung user hien tai.

## 12. Luu y cho dev tiep theo
- Neu them module moi, uu tien bo sung vao `api.js` truoc de giu mot diem goi API tap trung.
- Neu thay doi role/quyen o backend, cap nhat dong bo map role va page access trong `App.jsx`.
- Neu thay doi schema schedule/opinion, cap nhat normalize function truoc khi sua UI.
