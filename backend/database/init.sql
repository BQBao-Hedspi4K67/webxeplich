-- ========== HVKTCNAN Schedule Management System ==========
-- Database initialization script for MySQL
-- Date: March 2026
-- Encoding: UTF-8

-- Drop existing database if exists (be careful in production!)
DROP DATABASE IF EXISTS hvktcnan_schedule;

-- Create new database
CREATE DATABASE hvktcnan_schedule;
USE hvktcnan_schedule;

-- ========== TABLE: users ==========
-- Tài khoản người dùng
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  fullName VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role ENUM('admin', 'manager', 'officer') DEFAULT 'officer' NOT NULL,
  avatar VARCHAR(10),
  status ENUM('active', 'inactive') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_status (status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: officers ==========
-- Danh sách cán bộ trong học viện
CREATE TABLE officers (
  id VARCHAR(10) PRIMARY KEY,
  fullName VARCHAR(100) NOT NULL,
  position VARCHAR(100),
  department VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  role ENUM('leader', 'manager', 'officer') DEFAULT 'officer',
  status ENUM('active', 'inactive') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_department (department),
  INDEX idx_status (status),
  INDEX idx_role (role)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: work_schedules ==========
-- Lịch công tác tuần
CREATE TABLE work_schedules (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  startTime TIME,
  endTime TIME,
  location VARCHAR(200),
  assignedTo VARCHAR(100),
  department VARCHAR(100),
  type VARCHAR(50) NOT NULL,
  status ENUM('completed', 'active', 'upcoming') DEFAULT 'upcoming',
  weekNo INT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_weekNo (weekNo),
  INDEX idx_status (status),
  INDEX idx_type (type)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: duty_schedules ==========
-- Lịch trực ban (2 loại: giám đốc tuần + cán bộ nguyên ngày)
CREATE TABLE duty_schedules (
  id VARCHAR(20) PRIMARY KEY,
  officerId VARCHAR(10) NOT NULL,
  dutyType ENUM('director_weekly', 'officer_daily') NOT NULL,
  date DATE NOT NULL,
  endDate DATE,
  weekStartDate DATE NULL,
  shift VARCHAR(50),
  startTime TIME DEFAULT '00:00',
  endTime TIME DEFAULT '23:59',
  location VARCHAR(200),
  status ENUM('done', 'active', 'upcoming') DEFAULT 'upcoming',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  INDEX idx_officerId (officerId),
  INDEX idx_date (date),
  INDEX idx_dutyType (dutyType),
  INDEX idx_status (status),
  UNIQUE KEY uq_director_week_start (weekStartDate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: opinions ==========
-- Ý kiến từ cán bộ đang trực
CREATE TABLE opinions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  officerId VARCHAR(10) NOT NULL,
  dutyDate DATE NOT NULL,
  content TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  adminFeedback TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  INDEX idx_officerId (officerId),
  INDEX idx_status (status),
  INDEX idx_dutyDate (dutyDate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: notifications ==========
-- Thong bao he thong hien thi tren Topbar va Dashboard
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('success', 'warning', 'info') DEFAULT 'info',
  module VARCHAR(50),
  entityType VARCHAR(50),
  entityId VARCHAR(50),
  targetUserId INT NULL,
  targetRole VARCHAR(20) NULL,
  isActive TINYINT(1) DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_targetUserId (targetUserId),
  INDEX idx_targetRole (targetRole),
  INDEX idx_isActive (isActive),
  INDEX idx_createdAt (createdAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: notification_reads ==========
-- Trang thai da doc theo user
CREATE TABLE notification_reads (
  notificationId INT NOT NULL,
  userId INT NOT NULL,
  readAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notificationId, userId),
  FOREIGN KEY (notificationId) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: activity_logs ==========
-- Luu thao tac gan day cho Dashboard
CREATE TABLE activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  actorUserId INT,
  actorUsername VARCHAR(50),
  actorRole VARCHAR(20),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(30) NOT NULL,
  entityType VARCHAR(50) NOT NULL,
  entityId VARCHAR(50),
  summary VARCHAR(255) NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module (module),
  INDEX idx_action (action),
  INDEX idx_createdAt (createdAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: export_logs ==========
-- Lich su xuat/in lich
CREATE TABLE export_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT,
  username VARCHAR(50),
  role VARCHAR(20),
  exportType ENUM('congtac', 'trucban', 'both') NOT NULL,
  exportScope ENUM('week', 'month', 'custom') DEFAULT 'week',
  exportFormat ENUM('csv', 'json', 'print') DEFAULT 'csv',
  itemCount INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_createdAt (createdAt),
  INDEX idx_exportType (exportType)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== SEED DATA HOÀN CHỈNH ==========
-- Dữ liệu cho 16 cán bộ + lịch 4 tuần + đủ thông báo, hoạt động, ý kiến
-- Toàn bộ dữ liệu liên kết logic với nhau

-- ========== USERS (16 tài khoản) ==========
-- Mật khẩu: 123456 (hash bcryptjs với salt=10)
INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
-- ADMIN (2 giám đốc)
('admin', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Nguyễn Văn Minh', 'nvminh@hvktcnan.edu.vn', 'admin', 'NM', 'active'),
('admin2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Thị Hương', 'tthuong@hvktcnan.edu.vn', 'admin', 'TH', 'active'),
-- MANAGER (4 quản lý)
('quanly1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Quốc Hùng', 'lqhung@hvktcnan.edu.vn', 'manager', 'LH', 'active'),
('quanly2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu tá Phạm Đức Thắng', 'pdthang@hvktcnan.edu.vn', 'manager', 'PT', 'active'),
('quanly3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu tá Trịnh Văn Nam', 'tvnam@hvktcnan.edu.vn', 'manager', 'TN', 'active'),
('quanly4', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Bùi Thị Thu', 'btthu@hvktcnan.edu.vn', 'manager', 'BT', 'active'),
-- OFFICER (10 cán bộ)
('canbo1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Thị Lan', 'htlan@hvktcnan.edu.vn', 'officer', 'HL', 'active'),
('canbo2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Vũ Minh Tú', 'vmtu@hvktcnan.edu.vn', 'officer', 'VT', 'active'),
('canbo3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Ngô Thanh Bình', 'ntbinh@hvktcnan.edu.vn', 'officer', 'NB', 'active'),
('canbo4', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Đặng Quỳnh Anh', 'dqanh@hvktcnan.edu.vn', 'officer', 'DA', 'active'),
('canbo5', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lý Văn Khánh', 'lvkhanh@hvktcnan.edu.vn', 'officer', 'LK', 'active'),
('canbo6', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Phan Thị Nga', 'ptnga@hvktcnan.edu.vn', 'officer', 'PN', 'active'),
('canbo7', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Nguyễn Minh Hiền', 'nmhien@hvktcnan.edu.vn', 'officer', 'NH', 'active'),
('canbo8', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Quang Anh', 'tqanh@hvktcnan.edu.vn', 'officer', 'TQ', 'active'),
('canbo9', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Phạm Hồng Yến', 'phyen@hvktcnan.edu.vn', 'officer', 'PY', 'active'),
('canbo10', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Võ Minh Khôi', 'vmkhoi@hvktcnan.edu.vn', 'officer', 'VK', 'active');

-- ========== OFFICERS (16 cán bộ) ==========
INSERT INTO officers (id, fullName, position, department, phone, email, role, status) VALUES
-- LEADER (2 giám đốc)
('CB001', 'Đại tá Nguyễn Văn Minh', 'Giám đốc Học viện', 'Ban Giám đốc', '0912345678', 'nvminh@hvktcnan.edu.vn', 'leader', 'active'),
('CB002', 'Thượng tá Trần Thị Hương', 'Phó Giám đốc', 'Ban Giám đốc', '0923456789', 'tthuong@hvktcnan.edu.vn', 'leader', 'active'),
-- MANAGER (4 quản lý)
('CB003', 'Thượng tá Lê Quốc Hùng', 'Trưởng phòng Đào tạo', 'Phòng Đào tạo', '0934567890', 'lqhung@hvktcnan.edu.vn', 'manager', 'active'),
('CB004', 'Thiếu tá Phạm Đức Thắng', 'Trưởng phòng CNTT', 'Phòng CNTT', '0945678901', 'pdthang@hvktcnan.edu.vn', 'manager', 'active'),
('CB005', 'Thiếu tá Trịnh Văn Nam', 'Trưởng khoa ATTT', 'Khoa ATTT', '0956789012', 'tvnam@hvktcnan.edu.vn', 'manager', 'active'),
('CB006', 'Trung tá Bùi Thị Thu', 'Trưởng phòng Tổ chức', 'Phòng Tổ chức', '0967890123', 'btthu@hvktcnan.edu.vn', 'manager', 'active'),
-- OFFICER (10 cán bộ)
('CB007', 'Đại úy Hoàng Thị Lan', 'Giảng viên cấp cao', 'Khoa ATTT', '0978901234', 'htlan@hvktcnan.edu.vn', 'officer', 'active'),
('CB008', 'Thiếu úy Vũ Minh Tú', 'Giảng viên', 'Khoa CNTT', '0989012345', 'vmtu@hvktcnan.edu.vn', 'officer', 'active'),
('CB009', 'Đại úy Ngô Thanh Bình', 'Chuyên viên', 'Phòng Hành chính', '0990123456', 'ntbinh@hvktcnan.edu.vn', 'officer', 'active'),
('CB010', 'Thượng úy Đặng Quỳnh Anh', 'Chuyên viên', 'Phòng CNTT', '0901234567', 'dqanh@hvktcnan.edu.vn', 'officer', 'active'),
('CB011', 'Đại úy Lý Văn Khánh', 'Giảng viên', 'Khoa Cơ sở', '0912340001', 'lvkhanh@hvktcnan.edu.vn', 'officer', 'active'),
('CB012', 'Thượng úy Phan Thị Nga', 'Chuyên viên', 'Phòng Đào tạo', '0923451112', 'ptnga@hvktcnan.edu.vn', 'officer', 'active'),
('CB013', 'Thiếu úy Nguyễn Minh Hiền', 'Nhân viên hành chính', 'Phòng Tổ chức', '0934567801', 'nmhien@hvktcnan.edu.vn', 'officer', 'active'),
('CB014', 'Đại úy Trần Quang Anh', 'Giảng viên', 'Khoa Cơ sở', '0945678902', 'tqanh@hvktcnan.edu.vn', 'officer', 'active'),
('CB015', 'Thiếu úy Phạm Hồng Yến', 'Chuyên viên', 'Phòng Hành chính', '0956789003', 'phyen@hvktcnan.edu.vn', 'officer', 'active'),
('CB016', 'Đại úy Võ Minh Khôi', 'Giảng viên', 'Khoa ATTT', '0967890104', 'vmkhoi@hvktcnan.edu.vn', 'officer', 'active');

-- ========== WORK SCHEDULES (32 lịch công tác cho 4 tuần) ==========
-- TUẦN 10 (09/03 - 15/03) - status: completed (quá khứ)
INSERT INTO work_schedules (id, title, date, startTime, endTime, location, assignedTo, department, type, status, weekNo, notes) VALUES
('LCT001', 'Họp nhóm lãnh đạo - Kiểm tra tình hình Q1', '2026-03-09', '08:00', '10:30', 'Phòng họp A - Tầng 2', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'hop', 'completed', 10, 'Đánh giá tiến độ kế hoạch quý I'),
('LCT002', 'Kiểm tra tiến độ xây dựng khu thực hành', '2026-03-10', '09:00', '11:00', 'Khu thực hành - Tầng 3', 'Thượng tá Trần Thị Hương', 'Ban Giám đốc', 'khaoSat', 'completed', 10, 'Kiểm tra mặt bằng và vật tư'),
('LCT003', 'Hội thảo An toàn thông tin quốc gia', '2026-03-11', '08:00', '17:00', 'Hội trường lớn', 'Thượng tá Lê Quốc Hùng', 'Phòng Đào tạo', 'hoiThao', 'completed', 10, 'Chuẩn bị tài liệu và poster, có 50 người dự'),
('LCT004', 'Tiếp đoàn công tác Bộ Công an', '2026-03-12', '14:00', '16:30', 'Phòng tiếp khách - Tầng 1', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'tiepkhach', 'completed', 10, 'Chuẩn bị tài liệu giới thiệu học viện'),
('LCT005', 'Họp phòng CNTT - Triển khai hệ thống quản lý mới', '2026-03-12', '09:00', '11:00', 'Phòng họp B - Tầng 3', 'Thiếu tá Phạm Đức Thắng', 'Phòng CNTT', 'hop', 'completed', 10, 'Danh sách người dùng và quyền hạn'),
('LCT006', 'Tổng kết công tác đào tạo Q1/2026', '2026-03-13', '08:00', '11:30', 'Hội trường lớn', 'Thượng tá Lê Quốc Hùng', 'Phòng Đào tạo', 'hop', 'completed', 10, '300 học viên, 8 khóa hoàn thành'),
('LCT007', 'Diễn tập phòng cháy chữa cháy học viện', '2026-03-14', '07:30', '09:30', 'Sân học viện', 'Đại úy Ngô Thanh Bình', 'Phòng Hành chính', 'dienTap', 'completed', 10, 'Đất nước an toàn, toàn bộ nhân viên tham gia'),
('LCT008', 'Sinh hoạt chính trị toàn thể cán bộ', '2026-03-15', '14:00', '16:00', 'Hội trường lớn', 'Thượng tá Trần Thị Hương', 'Ban Giám đốc', 'sinhHoat', 'completed', 10, 'Học tập chủ đề chính trị tháng 3'),

-- TUẦN 11 (16/03 - 22/03) - status: completed (đã cập nhật)
('LCT009', 'Báo cáo kết quả nghiên cứu khoa học năm 2025', '2026-03-16', '09:00', '11:30', 'Phòng họp A - Tầng 2', 'Thiếu tá Trịnh Văn Nam', 'Khoa ATTT', 'baoCao', 'completed', 12, 'Trình bày 15 đề tài nghiên cứu'),
('LCT010', 'Khai giảng khóa bồi dưỡng an toàn mạng', '2026-03-17', '08:00', '10:00', 'Hội trường lớn', 'Đại tá Nguyễn Văn Minh', 'Phòng Đào tạo', 'khaiGiang', 'completed', 12, 'Khoá 25/2026, 40 học viên'),
('LCT011', 'Họp điềm hướng dẫn đề tài khóa luận', '2026-03-18', '09:00', '12:00', 'Phòng họp C - Tầng 4', 'Thượng tá Lê Quốc Hùng', 'Khoa ATTT', 'hop', 'completed', 12, 'Hướng dẫn 36 sinh viên'),
('LCT012', 'Khảo sát nhu cầu đào tạo các đơn vị anh chị em', '2026-03-19', '08:00', '10:30', 'Văn phòng Phòng Đào tạo', 'Thiếu tá Phạm Đức Thắng', 'Phòng Đào tạo', 'khaoSat', 'completed', 12, 'Có 12 đơn vị trả lời'),
('LCT013', 'Họp hôm nay - Giao ban công tác tuần', '2026-03-20', '08:00', '09:00', 'Phòng họp A', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'hop', 'completed', 12, 'Giao ban công tác tuần 11'),
('LCT014', 'Họp phòng Hành chính - Quy trình hành chính mới', '2026-03-20', '14:00', '16:00', 'Phòng họp B', 'Đại úy Ngô Thanh Bình', 'Phòng Hành chính', 'hop', 'completed', 12, 'Áp dụng từ 1/4/2026'),
('LCT015', 'Tiếp và làm việc với phái đoàn Đại học Quốc phòng', '2026-03-21', '10:00', '12:00', 'Phòng tiếp khách', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'tiepkhach', 'completed', 12, 'Trao đổi về hợp tác giáo dục'),
('LCT016', 'Hội thảo công tác tư tưởng chính trị', '2026-03-22', '08:00', '17:00', 'Hội trường lớn', 'Trung tá Bùi Thị Thu', 'Phòng Tổ chức', 'hoiThao', 'completed', 12, '200 cán bộ tham dự'),

-- TUẦN 12 (23/03 - 29/03) - status: upcoming (sắp tới)
('LCT017', 'Họp ban lãnh đạo - Báo cáo công tác quý 1', '2026-03-23', '08:00', '10:30', 'Phòng họp A', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'hop', 'upcoming', 12, 'Đánh giá từng đơn vị và phòng ban'),
('LCT018', 'Kiểm tra an toàn làm việc tại Khoa Cơ sở', '2026-03-24', '09:00', '11:00', 'Khoa Cơ sở', 'Trung tá Bùi Thị Thu', 'Phòng Tổ chức', 'khaoSat', 'upcoming', 12, 'Đánh giá điều kiện làm việc, vệ sinh'),
('LCT019', 'Tập huấn phần mềm quản lý tài chính mới', '2026-03-25', '08:00', '12:00', 'Phòng họp B', 'Thiếu tá Phạm Đức Thắng', 'Phòng CNTT', 'hoiThao', 'upcoming', 12, 'Cho 30 cán bộ tài chính'),
('LCT020', 'Tiếp đoàn công tác từ Sở Tư pháp tỉnh', '2026-03-26', '14:00', '16:00', 'Phòng tiếp khách', 'Thượng tá Trần Thị Hương', 'Ban Giám đốc', 'tiepkhach', 'upcoming', 12, 'Trao đổi về các quy định pháp luật'),
('LCT021', 'Họp chuẩn bị Lễ kỷ niệm 70 năm Ngày Giải phóng', '2026-03-27', '09:00', '11:00', 'Phòng họp A', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'hop', 'upcoming', 12, 'Dự kiến 30/4/2026'),
('LCT022', 'Giao ban công tác tuần 12', '2026-03-27', '14:00', '15:00', 'Phòng họp C', 'Thượng tá Lê Quốc Hùng', 'Phòng Đào tạo', 'hop', 'upcoming', 12, 'Các vấn đề phát sinh tuần này'),
('LCT023', 'Khảo sát lý thuyết và thực hành khóa lõi', '2026-03-28', '08:00', '10:00', 'Các lớp học', 'Thiếu tá Trịnh Văn Nam', 'Khoa ATTT', 'khaoSat', 'upcoming', 12, 'Đánh giá chất lượng giảng dạy'),
('LCT024', 'Sinh hoạt chính trị - Tìm hiểu Nghị quyết Đại hội lần thứ 13', '2026-03-29', '14:00', '16:00', 'Hội trường lớn', 'Trung tá Bùi Thị Thu', 'Phòng Tổ chức', 'sinhHoat', 'upcoming', 12, 'Toàn bộ cán bộ tham gia'),

-- TUẦN 13 (30/03 - 05/04) - status: upcoming (sắp tới)
('LCT025', 'Họp ban lãnh đạo - Chuẩn bị tổ chức các sự kiện tháng 4', '2026-03-30', '08:00', '10:00', 'Phòng họp A', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'hop', 'upcoming', 13, ''),
('LCT026', 'Tiếp công tác từ Bộ Quốc phòng', '2026-03-31', '10:00', '12:00', 'Phòng tiếp khách', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'tiepkhach', 'upcoming', 13, ''),
('LCT027', 'Họp Khoa ATTT - Chuẩn bị kỳ thi cuối kỳ', '2026-04-01', '09:00', '11:00', 'Phòng họp C', 'Thiếu tá Trịnh Văn Nam', 'Khoa ATTT', 'hop', 'upcoming', 13, ''),
('LCT028', 'Tập huấn an toàn thông tin cấp độ cao', '2026-04-02', '08:00', '12:00', 'Hội trường lớn', 'Thiếu tá Phạm Đức Thắng', 'Phòng CNTT', 'hoiThao', 'upcoming', 13, '50 cán bộ'),
('LCT029', 'Giao ban công tác tuần 13', '2026-03-30', '15:00', '16:00', 'Phòng họp B', 'Thượng tá Trần Thị Hương', 'Ban Giám đốc', 'hop', 'upcoming', 13, ''),
('LCT030', 'Lễ kỷ niệm 70 năm Ngày Giải phóng (dự kiến)', '2026-04-30', '09:00', '12:00', 'Sân học viện', 'Đại tá Nguyễn Văn Minh', 'Ban Giám đốc', 'sinhHoat', 'upcoming', 13, 'Dự kiến (chưa thực hiện)');

-- ========== DUTY SCHEDULES (32 ca trực) ==========
-- TUẦN 10 (09/03 - 15/03)
INSERT INTO duty_schedules (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, status, notes) VALUES
-- Tuần 10: Giám đốc CB001 trực tuần
('TBGD10', 'CB001', 'director_weekly', '2026-03-09', '2026-03-15', '2026-03-09', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'done', 'Tuần 10 - Nguyễn Văn Minh'),
-- Tuần 10: Cán bộ trực nguyên ngày (7 ngày)
('TBCB10-01', 'CB007', 'officer_daily', '2026-03-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB10-02', 'CB008', 'officer_daily', '2026-03-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB10-03', 'CB009', 'officer_daily', '2026-03-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà A', 'done', ''),
('TBCB10-04', 'CB007', 'officer_daily', '2026-03-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB10-05', 'CB010', 'officer_daily', '2026-03-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà B', 'done', ''),
('TBCB10-06', 'CB011', 'officer_daily', '2026-03-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà C', 'done', ''),
('TBCB10-07', 'CB012', 'officer_daily', '2026-03-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),

-- TUẦN 11 (16/03 - 22/03)
-- Tuần 11: Giám đốc CB002 trực tuần
('TBGD11', 'CB002', 'director_weekly', '2026-03-16', '2026-03-22', '2026-03-16', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'active', 'Tuần 11 - Trần Thị Hương'),
-- Tuần 11: Cán bộ trực nguyên ngày (7 ngày)
('TBCB11-01', 'CB008', 'officer_daily', '2026-03-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB11-02', 'CB009', 'officer_daily', '2026-03-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB11-03', 'CB014', 'officer_daily', '2026-03-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà A', 'done', ''),
('TBCB11-04', 'CB010', 'officer_daily', '2026-03-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),
('TBCB11-05', 'CB013', 'officer_daily', '2026-03-20', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà B', 'done', ''),
('TBCB11-06', 'CB015', 'officer_daily', '2026-03-21', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà C', 'done', ''),
('TBCB11-07', 'CB016', 'officer_daily', '2026-03-22', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'done', ''),

-- TUẦN 12 (23/03 - 29/03)
-- Tuần 12: Giám đốc CB001 trực tuần
('TBGD12', 'CB001', 'director_weekly', '2026-03-23', '2026-03-29', '2026-03-23', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'upcoming', 'Tuần 12 - Nguyễn Văn Minh'),
-- Tuần 12: Cán bộ trực nguyên ngày (7 ngày)
('TBCB12-01', 'CB009', 'officer_daily', '2026-03-23', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),
('TBCB12-02', 'CB011', 'officer_daily', '2026-03-24', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),
('TBCB12-03', 'CB012', 'officer_daily', '2026-03-25', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà A', 'upcoming', ''),
('TBCB12-04', 'CB013', 'officer_daily', '2026-03-26', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),
('TBCB12-05', 'CB014', 'officer_daily', '2026-03-27', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà B', 'upcoming', ''),
('TBCB12-06', 'CB007', 'officer_daily', '2026-03-28', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà C', 'upcoming', ''),
('TBCB12-07', 'CB015', 'officer_daily', '2026-03-29', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),

-- TUẦN 13 (30/03 - 05/04, nhưng chỉ 4 ngày đầu tháng 3)
-- Tuần 13: Giám đốc CB002 trực tuần
('TBGD13', 'CB002', 'director_weekly', '2026-03-30', '2026-04-05', '2026-03-30', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'upcoming', 'Tuần 13 - Trần Thị Hương'),
-- Tuần 13: Cán bộ trực (4 ngày)
('TBCB13-01', 'CB016', 'officer_daily', '2026-03-30', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),
('TBCB13-02', 'CB010', 'officer_daily', '2026-03-31', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', ''),
('TBCB13-03', 'CB008', 'officer_daily', '2026-04-01', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban khu nhà A', 'upcoming', ''),
('TBCB13-04', 'CB012', 'officer_daily', '2026-04-02', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trực ban cổng chính', 'upcoming', '');

-- ========== OPINIONS (8 ý kiến, liên kết logic với duty_schedules) ==========
INSERT INTO opinions (officerId, dutyDate, content, status, adminFeedback) VALUES
-- Tuần 10 (đã hoàn tất)
('CB007', '2026-03-09', 'Cửa phía Tây bị hỏng, yêu cầu sửa chữa khẩn cấp', 'approved', 'Đã báo bộ phận bảo trì. Cảm ơn thông báo.'),
('CB008', '2026-03-10', 'Tủ lạnh ở văn phòng bị chảy nước, ảnh hưởng đến vệ sinh', 'approved', 'Đã liên hệ công ty bảo hành, xin lỗi vì sự bất tiện.'),
('CB009', '2026-03-11', 'Có khách lạ vào khu vực hạn chế, đã kiểm soát và yêu cầu thông tin', 'approved', 'Thông tin chính xác, đã ghi nhận. Compliments cho cán bộ trực.'),

-- Tuần 11 (hiện tại)
('CB008', '2026-03-16', 'Hệ thống điều hòa phòng họp B không hoạt động, rất nóng', 'approved', 'oke'),
('CB009', '2026-03-17', 'Cần thêm bàn ghế ở phòng chờ, hiện tại thiếu chỗ ngồi', 'pending', NULL),

-- Tuần 12 (sắp tới)
('CB012', '2026-03-25', 'Hệ thống điện nước hoạt động bình thường, không có sự cố', 'pending', NULL),
('CB013', '2026-03-26', 'Đề xuất cải tiến: Lắp đặt thêm biển chỉ dẫn ở các hành lang', 'pending', NULL),

-- Tuần 13
('CB016', '2026-03-30', 'Tình hình an ninh tất cả bình thường, không có sự cố', 'pending', NULL);

-- ========== NOTIFICATIONS ==========
INSERT INTO notifications (title, content, type, module, entityType, entityId, targetUserId, targetRole, isActive) VALUES
('Y kien da duoc duyet', 'Y kien #4 da duoc quan ly/admin phe duyet.', 'success', 'ykien', 'opinion', '4', 8, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Báo cáo kết quả nghiên cứu khoa học năm 2025 (2026-03-16)', 'info', 'lichcongtac', 'work_schedule', 'LCT009', 5, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Khai giảng khóa bồi dưỡng an toàn mạng (2026-03-17)', 'info', 'lichcongtac', 'work_schedule', 'LCT010', 1, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Họp điềm hướng dẫn đề tài khóa luận (2026-03-18)', 'info', 'lichcongtac', 'work_schedule', 'LCT011', 3, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Khảo sát nhu cầu đào tạo các đơn vị anh chị em (2026-03-19)', 'info', 'lichcongtac', 'work_schedule', 'LCT012', 4, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Họp hôm nay - Giao ban công tác tuần (2026-03-20)', 'info', 'lichcongtac', 'work_schedule', 'LCT013', 1, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Tiếp và làm việc với phái đoàn Đại học Quốc phòng (2026-03-21)', 'info', 'lichcongtac', 'work_schedule', 'LCT015', 1, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Họp phòng Hành chính - Quy trình hành chính mới (2026-03-20)', 'info', 'lichcongtac', 'work_schedule', 'LCT014', 9, NULL, 1),
('Lich cong tac cua ban vua duoc cap nhat', 'Hội thảo công tác tư tưởng chính trị (2026-03-22)', 'info', 'lichcongtac', 'work_schedule', 'LCT016', 6, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-01 vao ngay 2026-03-16', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-01', 8, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-02 vao ngay 2026-03-17', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-02', 9, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-03 vao ngay 2026-03-18', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-03', 14, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-04 vao ngay 2026-03-19', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-04', 10, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-05 vao ngay 2026-03-20', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-05', 13, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-06 vao ngay 2026-03-21', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-06', 15, NULL, 1),
('Lich truc ban cua ban vua duoc cap nhat', 'Lich TBCB11-07 vao ngay 2026-03-22', 'info', 'lichtrucban', 'duty_schedule', 'TBCB11-07', 16, NULL, 1);

-- ========== ACTIVITY LOGS (39 hoạt động) ==========
INSERT INTO activity_logs (actorUserId, actorUsername, actorRole, module, action, entityType, entityId, summary, metadata) VALUES
-- Admin 1 (Nguyễn Văn Minh)
(1, 'admin', 'admin', 'canbo', 'create', 'officer', 'CB016', 'Thêm mới cán bộ CB016 - Võ Minh Khôi', JSON_OBJECT('department', 'Khoa ATTT', 'role', 'officer')),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT004', 'Cập nhật lịch công tác LCT004 sang trạng thái active', JSON_OBJECT('oldStatus', 'pending', 'newStatus', 'active')),
(1, 'admin', 'admin', 'lichcongtac', 'approve', 'work_schedule', 'LCT010', 'Phê duyệt lịch khai giảng khóa bồi dưỡng', JSON_OBJECT('weekNo', 11)),
(1, 'admin', 'admin', 'lichtrucban', 'approve', 'duty_schedule', 'TBGD11', 'Phê duyệt lịch trực ban tuần 11 cho Phó Giám đốc', JSON_OBJECT('officerId', 'CB002')),
(1, 'admin', 'admin', 'ykien', 'approve', 'opinion', '1', 'Duyệt ý kiến từ CB007 về sự cố cửa', JSON_OBJECT('feedback', 'Đã báo bộ phận bảo trì')),
(1, 'admin', 'admin', 'ykien', 'approve', 'opinion', '2', 'Duyệt ý kiến từ CB008 về tủ lạnh', JSON_OBJECT('feedback', 'Đã liên hệ công ty bảo hành')),
(1, 'admin', 'admin', 'ykien', 'approve', 'opinion', '3', 'Duyệt ý kiến từ CB009 về khách lạ', JSON_OBJECT('feedback', 'Thông tin chính xác, đã ghi nhận')),
(1, 'admin', 'admin', 'lichcongtac', 'create', 'work_schedule', 'LCT028', 'Tạo lịch tập huấn an toàn thông tin', JSON_OBJECT('date', '2026-04-02', 'weekNo', 13)),
(1, 'admin', 'admin', 'lichtrucban', 'create', 'duty_schedule', 'TBGD13', 'Tạo lịch trực ban tuần 13 cho CB002', JSON_OBJECT('startDate', '2026-03-30', 'weekNo', 13)),
(1, 'admin', 'admin', 'canbo', 'update', 'officer', 'CB005', 'Thay đổi chức vụ CB005 thành Trưởng khoa', JSON_OBJECT('oldPosition', 'Manager', 'newPosition', 'Trưởng khoa ATTT')),

-- Admin 2 (Trần Thị Hương)
(2, 'admin2', 'admin', 'lichcongtac', 'create', 'work_schedule', 'LCT021', 'Tạo lịch chuẩn bị Lễ 70 năm Giải phóng', JSON_OBJECT('date', '2026-03-27', 'weekNo', 12)),
(2, 'admin2', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBGD12', 'Cập nhật ghi chú cho lịch trực ban tuần 12', JSON_OBJECT('oldNote', '', 'newNote', 'Tuần 12 - Nguyễn Văn Minh')),
(2, 'admin2', 'admin', 'canbo', 'update', 'officer', 'CB009', 'Thay đổi trạng thái CB009 từ active sang inactive', JSON_OBJECT('reason', 'Tạm nghỉ phép')),
(2, 'admin2', 'admin', 'lichcongtac', 'delete', 'work_schedule', 'LCT099', 'Xóa lịch công tác LCT099 (trùng lặp)', JSON_OBJECT('title', 'Họp nội bộ')),

-- Manager 1 (Lê Quốc Hùng)
(3, 'quanly1', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT011', 'Tạo lịch họp hướng dẫn đề tài khóa luận', JSON_OBJECT('date', '2026-03-18', 'department', 'Khoa ATTT')),
(3, 'quanly1', 'manager', 'lichcongtac', 'update', 'work_schedule', 'LCT009', 'Cập nhật số người dự báo cáo khoa học', JSON_OBJECT('from', '10', 'to', '15')),
(3, 'quanly1', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT003', 'Phê duyệt hội thảo ATTT quốc gia', JSON_OBJECT('participants', '50')),
(3, 'quanly1', 'manager', 'lichtrucban', 'create', 'duty_schedule', 'TBCB11-03', 'Phân công trực ban cho CB014 tuần 11', JSON_OBJECT('date', '2026-03-18')),

-- Manager 2 (Phạm Đức Thắng)
(4, 'quanly2', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT019', 'Tạo lịch tập huấn phần mềm quản lý tài chính', JSON_OBJECT('date', '2026-03-25', 'weekNo', 12)),
(4, 'quanly2', 'manager', 'lichcongtac', 'update', 'work_schedule', 'LCT005', 'Cập nhật danh sách người tham gia', JSON_OBJECT('count', '30')),

-- Manager 3 (Trịnh Văn Nam)
(5, 'quanly3', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT023', 'Tạo lịch khảo sát lý thuyết thực hành', JSON_OBJECT('date', '2026-03-28', 'weekNo', 12)),

-- Manager 4 (Bùi Thị Thu)
(6, 'quanly4', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT024', 'Tạo sinh hoạt chính trị toàn thể cán bộ', JSON_OBJECT('date', '2026-03-29', 'weekNo', 12)),
(6, 'quanly4', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT016', 'Phê duyệt hội thảo công tác tư tưởng', JSON_OBJECT('participants', '200')),
(3, 'quanly1', 'manager', 'ykien', 'approve', 'opinion', '4', 'Duyet y kien truc ban #4', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT009', 'Cap nhat lich cong tac LCT009', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT010', 'Cap nhat lich cong tac LCT010', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT011', 'Cap nhat lich cong tac LCT011', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT012', 'Cap nhat lich cong tac LCT012', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT013', 'Cap nhat lich cong tac LCT013', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT015', 'Cap nhat lich cong tac LCT015', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT014', 'Cap nhat lich cong tac LCT014', NULL),
(1, 'admin', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT016', 'Cap nhat lich cong tac LCT016', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-01', 'Cap nhat lich truc ban TBCB11-01', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-02', 'Cap nhat lich truc ban TBCB11-02', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-03', 'Cap nhat lich truc ban TBCB11-03', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-04', 'Cap nhat lich truc ban TBCB11-04', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-05', 'Cap nhat lich truc ban TBCB11-05', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-06', 'Cap nhat lich truc ban TBCB11-06', NULL),
(1, 'admin', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB11-07', 'Cap nhat lich truc ban TBCB11-07', NULL);

-- ========== NOTIFICATION_READS ==========
INSERT INTO notification_reads (notificationId, userId, readAt) VALUES
(1, 8, '2026-03-24 04:41:23');

-- ========== EXPORT LOGS (8 lần xuất/in) ==========
INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount) VALUES
-- Admin exports
(1, 'admin', 'admin', 'congtac', 'week', 'csv', 8),
(1, 'admin', 'admin', 'trucban', 'week', 'csv', 7),
(1, 'admin', 'admin', 'both', 'month', '', 32),

-- Manager exports
(3, 'quanly1', 'manager', 'congtac', 'week', 'csv', 6),
(4, 'quanly2', 'manager', 'trucban', 'week', 'csv', 7),
(5, 'quanly3', 'manager', 'congtac', 'month', '', 16),
(6, 'quanly4', 'manager', 'both', 'week', 'csv', 14),
(2, 'admin2', 'admin', 'congtac', 'month', '', 24);

-- ========== END SEED DATA ==========

-- Verify tables were created
SELECT 'Database initialized successfully!' AS status;
