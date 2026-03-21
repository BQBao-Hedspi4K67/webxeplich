# 🛡️ Hệ thống Lịch công tác & Trực ban
### Học viện Kỹ thuật và Công nghệ An ninh

Phần mềm quản trị nội bộ hỗ trợ **lập lịch công tác tuần**, **lập lịch trực ban**, **quản lý cán bộ** và **tra cứu lịch** tại Học viện Kỹ thuật và Công nghệ An ninh.

---

## 📋 Tổng quan

| Thông tin | Chi tiết |
|-----------|---------|
| **Tên dự án** | Phần mềm hỗ trợ lập lịch công tác & lịch trực ban |
| **Đơn vị** | Học viện Kỹ thuật và Công nghệ An ninh |
| **Loại** | Web App quản trị nội bộ (Internal Admin Dashboard) |
| **Frontend** | ReactJS 18 + Vite + TailwindCSS |
| **Phiên bản** | 1.0.0 |

---

## 🎯 Mục tiêu

Thay thế quy trình lập lịch thủ công hiện tại bằng một hệ thống số hóa giúp:
- Quản lý thông tin cán bộ tập trung
- Lập và phân phối lịch công tác tuần tự động
- Phân công ca trực ban khoa học, tránh trùng lặp
- Tra cứu lịch nhanh chóng theo nhiều tiêu chí
- Xuất và in lịch ra PDF / Excel tiện lợi

---

## 👥 Đối tượng sử dụng

| Vai trò | Quyền hạn |
|---------|-----------|
| **Lãnh đạo** | Xem lịch tổng quan, phê duyệt lịch, xem báo cáo thống kê |
| **Người lập lịch** | Tạo, chỉnh sửa, xóa lịch công tác và lịch trực ban |
| **Cán bộ** | Tra cứu lịch cá nhân, xem thông báo |

---

## 🖥️ Các màn hình chính

### 1. 🔐 Đăng nhập
- Giao diện dark theme hiện đại với branding Học viện
- Xác thực tài khoản, ghi nhớ đăng nhập
- Hiển thị thông báo lỗi thân thiện

### 2. 📊 Dashboard
- **4 thẻ thống kê**: Tổng cán bộ, Lịch công tác tuần, Ca trực hôm nay, Lịch cần xử lý
- **Biểu đồ cột** thống kê lịch 6 tháng gần nhất (Recharts)
- Lịch công tác hôm nay, thông báo mới, hoạt động gần đây

### 3. 👤 Quản lý cán bộ
- Bảng dữ liệu phân trang với tìm kiếm và lọc nâng cao
- Thêm / sửa / xóa cán bộ qua modal dialog
- Xem chi tiết hồ sơ cán bộ
- Thống kê nhanh: Tổng, Đang công tác, Lãnh đạo, Quản lý

### 4. 📅 Lập lịch công tác tuần
- **Calendar view**: Grid lịch tuần (07:00–17:00), click ô để thêm nhanh
- **List view**: Bảng danh sách theo tuần
- Điều hướng qua các tuần, lọc theo loại lịch
- 8 loại lịch: Họp, Hội thảo, Tiếp khách, Khảo sát, Diễn tập, Sinh hoạt, Báo cáo, Khai giảng

### 5. 🛡️ Lập lịch trực ban
- **Board view**: Ma trận 3 ca × 7 ngày, drag-and-drop phân công trực quan
- **List view**: Danh sách tất cả ca trực trong tuần
- 3 ca trực: Ca sáng 🌅 / Ca chiều ☀️ / Ca tối 🌙
- Phân biệt màu theo trạng thái: Đã trực / Đang trực / Sắp trực

### 6. 🔍 Tra cứu lịch
- Tìm kiếm full-text theo tên lịch, cán bộ, địa điểm
- Lọc đa chiều: loại lịch, tháng, trạng thái
- **2 chế độ xem**: Danh sách bảng + Theo ngày (grouped by date)
- Modal chi tiết khi click vào từng mục

### 7. 🖨️ Xuất / In lịch
- Preview tài liệu mô phỏng trước khi xuất
- Xuất PDF / Excel / In trực tiếp
- Lịch sử các file đã xuất

### 8. ⚙️ Quản trị tài khoản
- Thông tin tài khoản đang đăng nhập
- Hiển thị phân quyền hệ thống

---

## 🗂️ Cấu trúc thư mục

```
src/
├── App.jsx                          # Router & auth state chính
├── main.jsx                         # Entry point
├── index.css                        # Global styles + Tailwind
│
├── data/
│   └── sampleData.js                # Dữ liệu mẫu (cán bộ, lịch công tác, trực ban)
│
├── pages/
│   └── Login.jsx                    # Trang đăng nhập
│
└── components/
    ├── Layout/
    │   ├── Sidebar.jsx              # Sidebar có thể thu gọn
    │   ├── Topbar.jsx               # Header + thông báo + user menu
    │   └── MainLayout.jsx           # Layout wrapper chính
    │
    ├── Dashboard/
    │   └── Dashboard.jsx            # Trang tổng quan
    │
    ├── CanBo/
    │   └── QuanLyCanBo.jsx          # Quản lý cán bộ
    │
    ├── LichCongTac/
    │   └── LapLichCongTac.jsx       # Lập lịch công tác tuần
    │
    ├── LichTrucBan/
    │   └── LapLichTrucBan.jsx       # Lập lịch trực ban
    │
    ├── TraCuu/
    │   └── TraCuuLich.jsx           # Tra cứu lịch
    │
    └── XuatLich/
        └── XuatLich.jsx             # Xuất / In lịch
```

---

## ⚙️ Công nghệ sử dụng

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| **React** | 18.2 | UI framework |
| **Vite** | 5.1 | Build tool & dev server |
| **TailwindCSS** | 3.4 | Utility-first CSS |
| **Lucide React** | 0.363 | Icon library |
| **Recharts** | 2.12 | Biểu đồ thống kê |
| **Day.js** | 1.11 | Xử lý ngày tháng |

---

## 🚀 Hướng dẫn cài đặt & chạy

### Yêu cầu hệ thống
- Node.js >= 18
- npm >= 9

### Các bước thực hiện

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi động môi trường phát triển
npm run dev

# 3. Build sản phẩm (production)
npm run build

# 4. Xem trước bản build
npm run preview
```

Truy cập: **http://localhost:5173**

### Tài khoản demo
| Tài khoản | Mật khẩu | Vai trò | Họ tên | Quyền hạn |
|-----------|----------|--------------|--------|-----------|
| `admin`  | `123456` | Quản trị viên | Đại tá Nguyễn Văn Minh  | Toàn quyền |
| `quanly` | `123456` | Quản lý       | Thượng tá Lê Quốc Hùng  | Lập/duyệt lịch, xem cán bộ, xuất lịch |
| `canbo`  | `123456` | Cán bộ        | Đại úy Hoàng Thị Lan    | Xem lịch, xuất lịch |

---

## 🎨 Thiết kế UI/UX

- **Phong cách**: Modern Enterprise Admin Dashboard
- **Color scheme**: Navy / Blue chủ đạo — Cyan/Teal điểm nhấn — White/Slate nhẹ làm nền
- **Typography**: Inter (Google Fonts) — rõ ràng, chuyên nghiệp
- **Components**: Card với shadow mềm, nút bo góc, hover effects tinh tế
- **Responsive**: Desktop ✅ | Tablet ✅
- **Animation**: Fade-in, slide-up, stagger cho các phần tử xuất hiện

---

## 📊 Dữ liệu mẫu

Hệ thống bao gồm dữ liệu demo thực tế:
- **12 cán bộ** với đầy đủ thông tin (cấp bậc, chức vụ, đơn vị, liên hệ)
- **10 lịch công tác** trải dài tuần 10–11/2026
- **15 ca trực ban** phân công theo ngày và ca
- **4 thông báo** hệ thống
- **6 tháng** dữ liệu thống kê biểu đồ

---

## 📌 Ghi chú phát triển

- Dữ liệu hiện tại được quản lý bằng React state cục bộ (in-memory)
- Để tích hợp với backend thực: thay thế dữ liệu mẫu trong `src/data/sampleData.js` bằng các API call tương ứng
- Phân quyền hiện tại là demo — cần tích hợp JWT/session khi triển khai thực tế

---

> **Học viện Kỹ thuật và Công nghệ An ninh** · Hệ thống nội bộ · © 2026
# webxeplich
