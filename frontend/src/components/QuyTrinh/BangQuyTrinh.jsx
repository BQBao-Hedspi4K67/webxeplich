import React from 'react';

const tabRules = [
  {
    tab: 'Dashboard',
    chucNang: 'Tổng quan nhanh lịch công tác, trực ban, bảng cán bộ rút gọn, thông báo và hoạt động mới.',
    admin: 'Xem',
    quanly: 'Xem',
    canbo: 'Xem',
  },
  {
    tab: 'Quản lý cán bộ',
    chucNang: 'Xem danh sách cán bộ, tìm kiếm theo đơn vị/vai trò/trạng thái.',
    admin: 'Thêm / Sửa / Xóa',
    quanly: 'Chỉ xem',
    canbo: 'Chỉ xem',
  },
  {
    tab: 'Lập lịch công tác',
    chucNang: 'Tạo và cập nhật lịch họp/công tác theo tuần, xem dạng bảng hoặc danh sách.',
    admin: 'Thêm / Sửa / Xóa',
    quanly: 'Thêm / Sửa / Xóa',
    canbo: 'Chỉ xem',
  },
  {
    tab: 'Lập lịch trực ban',
    chucNang: 'Trực ban giám đốc theo tuần, trực cán bộ theo nguyên ngày.',
    admin: 'Thêm / Sửa / Xóa',
    quanly: 'Thêm / Sửa / Xóa',
    canbo: 'Chỉ xem',
  },
  {
    tab: 'Tra cứu lịch',
    chucNang: 'Lọc theo từ khóa, tháng, trạng thái; xem lịch công tác và trực ban tổng hợp.',
    admin: 'Xem',
    quanly: 'Xem',
    canbo: 'Xem',
  },
  {
    tab: 'Xuất / In lịch',
    chucNang: 'Xuất lịch PDF/Excel hoặc in nhanh theo phạm vi tuần/tháng.',
    admin: 'Xem / Xuất',
    quanly: 'Xem / Xuất',
    canbo: 'Xem / Xuất',
  },
  {
    tab: 'Đơn xin nghỉ',
    chucNang: 'Cán bộ có thể gửi đơn xin nghỉ cho bất kỳ ngày nào kèm lý do, quản lý/Ban giám đốc duyệt.',
    admin: 'Duyệt / Từ chối / Phản hồi',
    quanly: 'Duyệt / Từ chối / Phản hồi',
    canbo: 'Gửi đơn xin nghỉ',
  },
  {
    tab: 'Quản trị tài khoản',
    chucNang: 'Xem thông tin tài khoản và danh mục quyền hiện tại.',
    admin: 'Xem',
    quanly: 'Không hiển thị',
    canbo: 'Không hiển thị',
  },
];

const BangQuyTrinh = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Bảng quy trình chức năng theo tab</h2>
        <p className="text-sm text-slate-500 mt-0.5">Tài liệu vận hành nhanh: mỗi tab làm gì và quyền theo từng vai trò.</p>
      </div>

      <div className="card bg-blue-50/60 border-blue-100">
        <p className="text-sm text-slate-700">
          Nguyên tắc phân quyền hiện tại: chức năng không có quyền sẽ không hiển thị nút thao tác trên giao diện.
          Ví dụ: vai trò Cán bộ không nhìn thấy nút Thêm/Sửa/Xóa ở tab Quản lý cán bộ.
        </p>
      </div>

      <div className="card-lg p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                {['Tab', 'Mô tả chức năng', 'Quản trị viên', 'Quản lý', 'Cán bộ'].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabRules.map(row => (
                <tr key={row.tab} className="hover:bg-slate-50/70">
                  <td className="table-td font-semibold text-slate-800">{row.tab}</td>
                  <td className="table-td text-slate-600">{row.chucNang}</td>
                  <td className="table-td"><span className="badge bg-emerald-100 text-emerald-700">{row.admin}</span></td>
                  <td className="table-td"><span className="badge bg-blue-100 text-blue-700">{row.quanly}</span></td>
                  <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{row.canbo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BangQuyTrinh;
