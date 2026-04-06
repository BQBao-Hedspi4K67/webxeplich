-- ========== HVKTCNAN Schedule Management System ==========
-- Database initialization script for MySQL
-- Date: April 2026
-- Encoding: UTF-8

-- Drop existing database if exists (be careful in production!)
DROP DATABASE IF EXISTS hvktcnan_schedule;

-- Create new database
CREATE DATABASE hvktcnan_schedule;
USE hvktcnan_schedule;

-- ========== TABLE: users ==========
-- Tai khoan nguoi dung
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
-- Danh sach can bo trong hoc vien (tach Chuc vu + Ten)
CREATE TABLE officers (
  id VARCHAR(10) PRIMARY KEY,
  userId INT UNIQUE NULL,
  fullName VARCHAR(150) NOT NULL,
  officerTitle VARCHAR(100) NOT NULL,
  officerName VARCHAR(100) NOT NULL,
  position VARCHAR(150),
  departmentId INT NULL,
  department VARCHAR(150),
  departmentGroup ENUM('ban_giam_doc', 'phong', 'khoa') DEFAULT 'phong',
  phone VARCHAR(20),
  email VARCHAR(100),
  role ENUM('leader', 'manager', 'officer') DEFAULT 'officer',
  status ENUM('active', 'inactive', 'studying') DEFAULT 'active',
  studyUntil DATE NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_department_id (departmentId),
  INDEX idx_department (department),
  INDEX idx_department_group (departmentGroup),
  INDEX idx_status (status),
  INDEX idx_role (role)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: departments ==========
-- Danh muc phong ban/khoa do Giam doc quan ly
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  departmentType ENUM('ban_giam_doc', 'phong', 'khoa') NOT NULL,
  headOfficerId VARCHAR(10) NULL,
  isActive TINYINT(1) DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (headOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  INDEX idx_department_type (departmentType),
  INDEX idx_head_officer (headOfficerId),
  INDEX idx_is_active (isActive)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE officers
ADD CONSTRAINT fk_officers_department
FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL;

-- ========== TABLE: holidays ==========
-- Lich nghi le/ky niem de hien thi tren lich thang
CREATE TABLE holidays (
  id INT PRIMARY KEY AUTO_INCREMENT,
  holidayDate DATE NOT NULL,
  holidayName VARCHAR(200) NOT NULL,
  holidayType ENUM('holiday', 'special_event', 'flag_ceremony') DEFAULT 'holiday',
  isRecurring TINYINT(1) DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_holiday_date_name (holidayDate, holidayName),
  INDEX idx_holiday_date (holidayDate),
  INDEX idx_holiday_type (holidayType)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: work_schedules ==========
-- Lich cong tac theo tuan (quan ly them, ban giam doc phe duyet)
CREATE TABLE work_schedules (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  startTime TIME,
  endTime TIME,
  location VARCHAR(200),
  department VARCHAR(150),
  departmentId INT NULL,
  type VARCHAR(50) NOT NULL,
  weekNo INT,
  notes TEXT,
  responsibleOfficerId VARCHAR(10),
  officer1Id VARCHAR(10),
  officer2Id VARCHAR(10),
  commanderOfficerId VARCHAR(10),
  participants JSON,
  approvalStatus ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  approvedByUserId INT NULL,
  approvedAt TIMESTAMP NULL,
  createdByUserId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (responsibleOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (officer1Id) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (officer2Id) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (commanderOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (approvedByUserId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (createdByUserId) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_weekNo (weekNo),
  INDEX idx_type (type),
  INDEX idx_department_id (departmentId),
  INDEX idx_responsible (responsibleOfficerId),
  INDEX idx_officer1 (officer1Id),
  INDEX idx_officer2 (officer2Id),
  INDEX idx_commander (commanderOfficerId),
  INDEX idx_approval_status (approvalStatus)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: duty_schedules ==========
-- Lich truc ban (2 loai: giam doc tuan + can bo nguyen ngay)
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
  location ENUM('Nhà hiệu bộ', 'Nhà xe', 'Trạm xá', 'Trực ban Giám đốc') NOT NULL,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  INDEX idx_officerId (officerId),
  INDEX idx_date (date),
  INDEX idx_dutyType (dutyType),
  UNIQUE KEY uq_daily_location (dutyType, date, location),
  UNIQUE KEY uq_director_week_start (weekStartDate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: leave_requests ==========
-- Yeu cau xin nghi tu can bo (khong phu thuoc ca truc)
CREATE TABLE leave_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  officerId VARCHAR(10) NOT NULL,
  dutyScheduleId VARCHAR(20) NOT NULL,
  leaveDate DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  adminFeedback TEXT,
  reviewedByOfficerId VARCHAR(10),
  reviewedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  FOREIGN KEY (dutyScheduleId) REFERENCES duty_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewedByOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  INDEX idx_officerId (officerId),
  INDEX idx_dutyScheduleId (dutyScheduleId),
  INDEX idx_status (status),
  INDEX idx_leaveDate (leaveDate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: notifications ==========
-- Thong bao he thong (chi schema ban dau, du lieu tao tu su kien runtime)
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
  exportFormat ENUM('pdf') DEFAULT 'pdf',
  itemCount INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_createdAt (createdAt),
  INDEX idx_exportType (exportType)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== SEED DATA ==========
-- Chi GIU schema-only cho 3 bang sau:
--   1) leave_requests
--   2) notifications
--   3) notification_reads
-- Cac bang con lai van co du lieu mau de demo.

-- ========== USERS ==========
-- Mat khau mac dinh cho tat ca tai khoan: 123456
-- bcrypt hash: $2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm
INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('giamdoc1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu tướng Lê Minh Thảo', 'lmthao@hvktcnan.edu.vn', 'admin', 'LT', 'active'),
('giamdoc2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Nguyễn Văn Căn', 'nvcan@hvktcnan.edu.vn', 'admin', 'NC', 'active'),
('giamdoc3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Nguyễn Mạnh Cường', 'nmcuong@hvktcnan.edu.vn', 'admin', 'NC', 'active'),
('giamdoc4', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Phạm Thị Thúy Hằng', 'pthhang@hvktcnan.edu.vn', 'admin', 'PH', 'active'),

('truongphong1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Văn Sơn', 'tvson@hvktcnan.edu.vn', 'manager', 'TS', 'active'),
('truongphong2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Thị Mai', 'ltmai@hvktcnan.edu.vn', 'manager', 'LM', 'active'),
('truongphong3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Quang Huy', 'pqhuy@hvktcnan.edu.vn', 'manager', 'PH', 'active'),
('truongphong4', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Hoàng Minh Đức', 'hmduc@hvktcnan.edu.vn', 'manager', 'HD', 'active'),
('truongphong5', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Nguyễn Thị Lan', 'ntlan@hvktcnan.edu.vn', 'manager', 'NL', 'active'),
('truongphong6', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Văn Nam', 'bvnam@hvktcnan.edu.vn', 'manager', 'BN', 'active'),
('truongphong7', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Đặng Thị Hương', 'dthuong@hvktcnan.edu.vn', 'manager', 'DH', 'active'),

('canbo1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Võ Thanh Long', 'vtlong@hvktcnan.edu.vn', 'officer', 'VL', 'active'),
('canbo2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Đức Anh', 'tdanh@hvktcnan.edu.vn', 'officer', 'TA', 'active'),
('canbo3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Gia Bảo', 'ngbao@hvktcnan.edu.vn', 'officer', 'NB', 'active'),
('canbo4', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Tuấn Kiệt', 'ltkiet@hvktcnan.edu.vn', 'officer', 'LK', 'active'),
('canbo5', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Hữu Đạt', 'phdat@hvktcnan.edu.vn', 'officer', 'PD', 'active'),
('canbo6', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Bùi Hải Nam', 'bhnam@hvktcnan.edu.vn', 'officer', 'BN', 'active'),
('canbo7', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Văn Tuấn', 'hvtuan@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('canbo8', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Minh Quân', 'dmquan@hvktcnan.edu.vn', 'officer', 'DQ', 'active'),
('canbo9', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trương Anh Vũ', 'tavu@hvktcnan.edu.vn', 'officer', 'TV', 'active'),
('canbo10', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Thị Yến', 'ntyen@hvktcnan.edu.vn', 'officer', 'NY', 'active'),
('canbo11', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đặng Ngọc Hà', 'dnha@hvktcnan.edu.vn', 'officer', 'DH', 'active'),
('canbo12', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Nguyễn Quốc Bình', 'nqbinh@hvktcnan.edu.vn', 'officer', 'NB', 'active'),
('canbo13', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Trần Mai Chi', 'tmchi@hvktcnan.edu.vn', 'officer', 'TC', 'active'),
('canbo14', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Lê Hoàng Nam', 'lhnam@hvktcnan.edu.vn', 'officer', 'LN', 'active');

-- ========== OFFICERS ==========
INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB001', 1, 'Thiếu tướng Lê Minh Thảo', 'Thiếu tướng', 'Lê Minh Thảo', 'Giám đốc Học viện', 'Ban Giám đốc', 'ban_giam_doc', '0911110001', 'lmthao@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB002', 2, 'Đại tá Nguyễn Văn Căn', 'Đại tá', 'Nguyễn Văn Căn', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110002', 'nvcan@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB003', 3, 'Đại tá Nguyễn Mạnh Cường', 'Đại tá', 'Nguyễn Mạnh Cường', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110003', 'nmcuong@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB004', 4, 'Đại tá Phạm Thị Thúy Hằng', 'Đại tá', 'Phạm Thị Thúy Hằng', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110004', 'pthhang@hvktcnan.edu.vn', 'leader', 'active', NULL),

('CB005', 5, 'Thượng tá Trần Văn Sơn', 'Thượng tá', 'Trần Văn Sơn', 'Trưởng phòng', 'Phòng hành chính tổng hợp', 'phong', '0911110005', 'tvson@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB006', 6, 'Thượng tá Lê Thị Mai', 'Thượng tá', 'Lê Thị Mai', 'Trưởng phòng', 'Phòng chính trị', 'phong', '0911110006', 'ltmai@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB007', 7, 'Thượng tá Phạm Quang Huy', 'Thượng tá', 'Phạm Quang Huy', 'Trưởng phòng', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110007', 'pqhuy@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB008', 8, 'Thượng tá Hoàng Minh Đức', 'Thượng tá', 'Hoàng Minh Đức', 'Trưởng phòng', 'Phòng ĐBCL đào tạo', 'phong', '0911110008', 'hmduc@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB009', 9, 'Thượng tá Nguyễn Thị Lan', 'Thượng tá', 'Nguyễn Thị Lan', 'Trưởng phòng', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110009', 'ntlan@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB010', 10, 'Thượng tá Bùi Văn Nam', 'Thượng tá', 'Bùi Văn Nam', 'Trưởng phòng', 'Phòng quản lý học viên', 'phong', '0911110010', 'bvnam@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB011', 11, 'Thượng tá Đặng Thị Hương', 'Thượng tá', 'Đặng Thị Hương', 'Trưởng phòng', 'Phòng hậu cần', 'phong', '0911110011', 'dthuong@hvktcnan.edu.vn', 'manager', 'active', NULL),

('CB012', 12, 'Đại úy Võ Thanh Long', 'Đại úy', 'Võ Thanh Long', 'Cán bộ tổng hợp', 'Phòng hành chính tổng hợp', 'phong', '0911110012', 'vtlong@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB013', 13, 'Đại úy Trần Đức Anh', 'Đại úy', 'Trần Đức Anh', 'Cán bộ tổng hợp', 'Phòng hành chính tổng hợp', 'phong', '0911110013', 'tdanh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB014', 14, 'Đại úy Nguyễn Gia Bảo', 'Đại úy', 'Nguyễn Gia Bảo', 'Cán bộ chính trị', 'Phòng chính trị', 'phong', '0911110014', 'ngbao@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB015', 15, 'Đại úy Lê Tuấn Kiệt', 'Đại úy', 'Lê Tuấn Kiệt', 'Cán bộ chính trị', 'Phòng chính trị', 'phong', '0911110015', 'ltkiet@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB016', 16, 'Đại úy Phạm Hữu Đạt', 'Đại úy', 'Phạm Hữu Đạt', 'Cán bộ đào tạo', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110016', 'phdat@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB017', 17, 'Đại úy Bùi Hải Nam', 'Đại úy', 'Bùi Hải Nam', 'Cán bộ đào tạo', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110017', 'bhnam@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB018', 18, 'Đại úy Hoàng Văn Tuấn', 'Đại úy', 'Hoàng Văn Tuấn', 'Cán bộ kiểm định', 'Phòng ĐBCL đào tạo', 'phong', '0911110018', 'hvtuan@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB019', 19, 'Đại úy Đỗ Minh Quân', 'Đại úy', 'Đỗ Minh Quân', 'Cán bộ kiểm định', 'Phòng ĐBCL đào tạo', 'phong', '0911110019', 'dmquan@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB020', 20, 'Đại úy Trương Anh Vũ', 'Đại úy', 'Trương Anh Vũ', 'Cán bộ nghiên cứu', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110020', 'tavu@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB021', 21, 'Đại úy Nguyễn Thị Yến', 'Đại úy', 'Nguyễn Thị Yến', 'Cán bộ nghiên cứu', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110021', 'ntyen@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB022', 22, 'Đại úy Đặng Ngọc Hà', 'Đại úy', 'Đặng Ngọc Hà', 'Cán bộ quản lý học viên', 'Phòng quản lý học viên', 'phong', '0911110022', 'dnha@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB023', 23, 'Thượng úy Nguyễn Quốc Bình', 'Thượng úy', 'Nguyễn Quốc Bình', 'Cán bộ quản lý học viên', 'Phòng quản lý học viên', 'phong', '0911110023', 'nqbinh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB024', 24, 'Thượng úy Trần Mai Chi', 'Thượng úy', 'Trần Mai Chi', 'Cán bộ hậu cần', 'Phòng hậu cần', 'phong', '0911110024', 'tmchi@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB025', 25, 'Thượng úy Lê Hoàng Nam', 'Thượng úy', 'Lê Hoàng Nam', 'Cán bộ hậu cần', 'Phòng hậu cần', 'phong', '0911110025', 'lhnam@hvktcnan.edu.vn', 'officer', 'active', NULL);

-- ========== DEPARTMENTS ==========
INSERT INTO departments (name, departmentType, headOfficerId, isActive) VALUES
('Ban Giám đốc', 'ban_giam_doc', 'CB001', 1),
('Phòng hành chính tổng hợp', 'phong', 'CB005', 1),
('Phòng chính trị', 'phong', 'CB006', 1),
('Phòng quản lý đào tạo và BDNC', 'phong', 'CB007', 1),
('Phòng ĐBCL đào tạo', 'phong', 'CB008', 1),
('Phòng quản lý nghiên cứu khoa học', 'phong', 'CB009', 1),
('Phòng quản lý học viên', 'phong', 'CB010', 1),
('Phòng hậu cần', 'phong', 'CB011', 1),
('Khoa Lý luận chính trị và KHXHNV', 'khoa', NULL, 1),
('Khoa Luật', 'khoa', NULL, 1),
('Khoa nghiệp vụ cơ bản', 'khoa', NULL, 1),
('Khoa khoa học cơ bản và ngoại ngữ', 'khoa', NULL, 1),
('Khoa quân sự, võ thuật, TDTT', 'khoa', NULL, 1),
('Khoa mật mã', 'khoa', NULL, 1),
('Khoa Công nghệ và ATTT', 'khoa', NULL, 1),
('Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', NULL, 1),
('Khoa Hồ sơ - Lưu trữ', 'khoa', NULL, 1),
('Khoa Hậu cần', 'khoa', NULL, 1),
('Khoa Y Dược', 'khoa', NULL, 1);

-- Dong bo khoa ngoai departmentId theo ten don vi cho du lieu seed
UPDATE officers o
JOIN departments d ON d.name = o.department
SET o.departmentId = d.id;

UPDATE work_schedules ws
JOIN departments d ON d.name = ws.department
SET ws.departmentId = d.id;

-- ========== HOLIDAYS ==========
INSERT INTO holidays (holidayDate, holidayName, holidayType, isRecurring) VALUES
('2026-04-06', 'Chào cờ đầu tuần', 'flag_ceremony', 1),
('2026-04-13', 'Chào cờ đầu tuần', 'flag_ceremony', 1),
('2026-04-20', 'Chào cờ đầu tuần', 'flag_ceremony', 1),
('2026-04-27', 'Chào cờ đầu tuần', 'flag_ceremony', 1),
('2026-04-30', 'Ngày Giải phóng miền Nam', 'holiday', 1),
('2026-05-01', 'Quốc tế Lao động', 'holiday', 1),
('2026-09-02', 'Quốc khánh', 'holiday', 1);

-- ========== WORK SCHEDULES ==========
INSERT INTO work_schedules (
  id, title, date, startTime, endTime, location, department, type, weekNo, notes,
  responsibleOfficerId,
  createdByUserId
) VALUES
('LCT001', 'Giao ban Ban Giám đốc', '2026-04-06', '08:00', '09:30', 'Phòng họp A', 'Ban Giám đốc', 'hop', 15, 'Họp giao ban đầu tuần', 'CB001', 1),
('LCT002', 'Họp triển khai công tác đào tạo', '2026-04-07', '14:00', '16:00', 'Phòng họp B', 'Phòng quản lý đào tạo và BDNC', 'hop', 15, 'Triển khai kế hoạch tháng 4', 'CB007', 7),
('LCT003', 'Khảo sát chất lượng đào tạo', '2026-04-08', '09:00', '11:00', 'Khoa Công nghệ và ATTT', 'Phòng ĐBCL đào tạo', 'khaoSat', 15, 'Đánh giá nội bộ', 'CB008', 8),
('LCT004', 'Hội thảo nghiên cứu khoa học', '2026-04-09', '08:30', '11:30', 'Hội trường lớn', 'Phòng quản lý nghiên cứu khoa học', 'hoiThao', 15, 'Báo cáo đề tài cấp cơ sở', 'CB009', 9),
('LCT005', 'Lớp bồi dưỡng chuyên môn', '2026-04-10', '13:30', '16:30', 'Phòng học C3', 'Khoa Luật', 'baoCao', 15, 'Nhóm cán bộ đang học', 'CB013', 10);

-- ========== DUTY SCHEDULES ==========
INSERT INTO duty_schedules (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, notes) VALUES
('TBGD015', 'CB001', 'director_weekly', '2026-04-06', '2026-04-12', '2026-04-06', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'Tuần 15'),
('TBCB015-01', 'CB012', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', ''),
('TBCB015-02', 'CB013', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà xe', ''),
('TBCB015-03', 'CB014', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trạm xá', ''),
('TBCB015-04', 'CB015', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', ''),
('TBCB015-05', 'CB016', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà xe', ''),
('TBCB015-06', 'CB018', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Trạm xá', ''),
('TBCB015-07', 'CB020', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', '');

-- ========== ACTIVITY LOGS ==========
INSERT INTO activity_logs (actorUserId, actorUsername, actorRole, module, action, entityType, entityId, summary, metadata) VALUES
(1, 'giamdoc1', 'admin', 'lichcongtac', 'create', 'work_schedule', 'LCT001', 'Tạo lịch công tác LCT001', JSON_OBJECT('note', 'Khởi tạo lịch')),
(7, 'truongphong3', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT002', 'Tạo lịch công tác LCT002', JSON_OBJECT('note', 'Khởi tạo lịch')),
(8, 'truongphong4', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT003', 'Tạo lịch công tác LCT003', JSON_OBJECT('note', 'Khởi tạo lịch')),
(2, 'giamdoc2', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT004', 'Cập nhật lịch công tác LCT004', JSON_OBJECT('note', 'Điều chỉnh lịch')),
(1, 'giamdoc1', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBGD015', 'Cập nhật lịch trực ban tuần 15', JSON_OBJECT('note', 'Điều chỉnh lịch'));

-- ========== EXPORT LOGS ==========
INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount) VALUES
(1, 'giamdoc1', 'admin', 'congtac', 'week', 'pdf', 5),
(2, 'giamdoc2', 'admin', 'both', 'week', 'pdf', 12),
(7, 'truongphong3', 'manager', 'congtac', 'week', 'pdf', 3);

-- Verify tables were created
SELECT 'Database initialized successfully (seeded, except leave_requests/notifications)!' AS status;
