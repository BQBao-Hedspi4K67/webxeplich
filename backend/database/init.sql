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
  militaryRank VARCHAR(100) NULL,
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
-- Danh sách cán bộ trong học viện (tách Chức vụ + Tên)
CREATE TABLE officers (
  id VARCHAR(10) PRIMARY KEY,
  userId INT UNIQUE NULL,
  fullName VARCHAR(150) NOT NULL,
  officerTitle VARCHAR(100) NOT NULL,
  officerName VARCHAR(100) NOT NULL,
  position VARCHAR(150),
  departmentId INT NULL,
  department VARCHAR(150),
  departmentGroup ENUM('ban_giam_doc', 'phong', 'khoa', 'doi') DEFAULT 'phong',
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

-- ========== TABLE: duty_schedule_permissions ==========
-- Quyền lập/sửa lịch trực cấp riêng cho từng cán bộ
CREATE TABLE duty_schedule_permissions (
  officerId VARCHAR(10) PRIMARY KEY,
  canManageDutySchedules TINYINT(1) NOT NULL DEFAULT 1,
  grantedByUserId INT NULL,
  grantedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  FOREIGN KEY (grantedByUserId) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_canManageDutySchedules (canManageDutySchedules),
  INDEX idx_grantedByUserId (grantedByUserId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: work_schedule_permissions ==========
-- Quyền tạo/duyệt lịch công tác cấp riêng cho từng cán bộ
CREATE TABLE work_schedule_permissions (
  officerId VARCHAR(10) PRIMARY KEY,
  canCreateWorkSchedules TINYINT(1) NOT NULL DEFAULT 1,
  canApproveWorkSchedules TINYINT(1) NOT NULL DEFAULT 1,
  grantedByUserId INT NULL,
  grantedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  FOREIGN KEY (grantedByUserId) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_canCreateWorkSchedules (canCreateWorkSchedules),
  INDEX idx_canApproveWorkSchedules (canApproveWorkSchedules),
  INDEX idx_work_schedule_grantedByUserId (grantedByUserId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: departments ==========
-- Danh mục phòng ban/khoa do Giám đốc quản lý
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  departmentType ENUM('ban_giam_doc', 'phong', 'khoa', 'doi') NOT NULL,
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
-- Lịch nghỉ lễ/kỷ niệm để hiển thị trên lịch tháng
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
-- Lịch công tác theo tuần (quản lý thêm, ban giám đốc phê duyệt)
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
  createdByOfficerId VARCHAR(10) NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (responsibleOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (officer1Id) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (officer2Id) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (commanderOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (approvedByUserId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (createdByUserId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (createdByOfficerId) REFERENCES officers(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_weekNo (weekNo),
  INDEX idx_type (type),
  INDEX idx_department_id (departmentId),
  INDEX idx_responsible (responsibleOfficerId),
  INDEX idx_officer1 (officer1Id),
  INDEX idx_officer2 (officer2Id),
  INDEX idx_commander (commanderOfficerId),
  INDEX idx_approval_status (approvalStatus),
  INDEX idx_created_by_officer (createdByOfficerId)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: duty_schedules ==========
-- Lịch trực ban (2 loại: giám đốc tuần + cán bộ nguyên ngày)
CREATE TABLE duty_schedules (
  id VARCHAR(20) PRIMARY KEY,
  officerId VARCHAR(10) NOT NULL,
  dutyType ENUM('director_weekly', 'officer_daily', 'holiday_daily') NOT NULL,
  date DATE NOT NULL,
  endDate DATE,
  weekStartDate DATE NULL,
  shift VARCHAR(50),
  startTime TIME DEFAULT '00:00',
  endTime TIME DEFAULT '23:59',
  location ENUM('Nhà hiệu bộ', 'Lái xe', 'Bệnh xá', 'Trực ban Giám đốc') NOT NULL,
  dutyRole ENUM('officer', 'commander') DEFAULT 'officer' NOT NULL,
  slotNo TINYINT UNSIGNED DEFAULT 1 NOT NULL,
  assignmentGroup ENUM('weekday', 'weekend', 'holiday') NULL,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (officerId) REFERENCES officers(id) ON DELETE CASCADE,
  INDEX idx_officerId (officerId),
  INDEX idx_date (date),
  INDEX idx_dutyType (dutyType),
  INDEX idx_assignment_group (assignmentGroup),
  UNIQUE KEY uq_duty_slot (dutyType, date, location, dutyRole, slotNo),
  UNIQUE KEY uq_director_week_start (weekStartDate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== TABLE: leave_requests ==========
-- Yêu cầu xin nghỉ từ cán bộ (không phụ thuộc ca trực)
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
-- Thông báo hệ thống (chỉ schema ban đầu, dữ liệu tạo từ sự kiện runtime)
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
-- Lịch sử xuất/in lịch
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

-- ========== TABLE: auto_schedule_logs ==========
-- Lưu log auto schedule để tránh xếp lịch 2 lần cho 1 tuần
CREATE TABLE auto_schedule_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  weekStartDate DATE NOT NULL,
  scheduleType ENUM('officer_daily', 'holiday_daily') NOT NULL,
  createdByUserId INT,
  createdByUsername VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auto_schedule (weekStartDate, scheduleType),
  FOREIGN KEY (createdByUserId) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_weekStartDate (weekStartDate),
  INDEX idx_scheduleType (scheduleType),
  INDEX idx_createdAt (createdAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ========== SEED DATA ==========
-- Chi GIU schema-only cho 2 bang sau:
--   1) leave_requests
--   2) notification_reads
-- Các bảng còn lại vẫn có dữ liệu mẫu để demo.

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
('canbo14', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Lê Hoàng Nam', 'lhnam@hvktcnan.edu.vn', 'officer', 'LN', 'active'),
('laixe1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Phạm Quốc Hùng', 'pqhung@hvktcnan.edu.vn', 'officer', 'PH', 'active'),
('laixe2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Lê Văn Tâm', 'lvtam@hvktcnan.edu.vn', 'officer', 'LT', 'active'),
('laixe3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Nguyễn Minh Phúc', 'nmphuc@hvktcnan.edu.vn', 'officer', 'NP', 'active'),
('benhxa1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Nguyễn Văn Khoa', 'nvkhoa@hvktcnan.edu.vn', 'officer', 'NK', 'active'),
('benhxa2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Trần Quốc Việt', 'tqviet@hvktcnan.edu.vn', 'officer', 'TV', 'active'),
('benhxa3', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Lê Thị Hạnh', 'lthanh@hvktcnan.edu.vn', 'officer', 'LH', 'active');

-- Bo sung user cho Pho truong phong va nhan su cac khoa
INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('ndhuy', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Đức Huy', 'ndhuy@hvktcnan.edu.vn', 'manager', 'NH', 'active'),
('tqminh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Quang Minh', 'tqminh@hvktcnan.edu.vn', 'manager', 'TM', 'active'),
('lhdang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Lưu Hải Đăng', 'lhdang@hvktcnan.edu.vn', 'manager', 'LD', 'active'),
('vttha', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Vũ Thị Thu Hà', 'vttha@hvktcnan.edu.vn', 'manager', 'VH', 'active'),
('pmtuan', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Phan Minh Tuấn', 'pmtuan@hvktcnan.edu.vn', 'manager', 'PT', 'active'),
('nttrang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thu Trang', 'nttrang@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('dvbinh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Đỗ Văn Bình', 'dvbinh@hvktcnan.edu.vn', 'manager', 'DB', 'active'),

('ndthanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Nguyễn Đức Thành', 'ndthanh@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('tthuong', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Thu Hương', 'tthuong@hvktcnan.edu.vn', 'manager', 'TH', 'active'),
('pmhoa', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Minh Hòa', 'pmhoa@hvktcnan.edu.vn', 'officer', 'PH', 'active'),
('lqanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Quốc Anh', 'lqanh@hvktcnan.edu.vn', 'officer', 'LA', 'active'),

('bqvinh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Quang Vinh', 'bqvinh@hvktcnan.edu.vn', 'manager', 'BV', 'active'),
('ntminh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thị Minh', 'ntminh@hvktcnan.edu.vn', 'manager', 'NM', 'active'),
('dtkien', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Trọng Kiên', 'dtkien@hvktcnan.edu.vn', 'officer', 'DK', 'active'),
('pquynh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Quỳnh', 'pquynh@hvktcnan.edu.vn', 'officer', 'PQ', 'active'),

('lmson', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lý Minh Sơn', 'lmson@hvktcnan.edu.vn', 'manager', 'LS', 'active'),
('hnhung', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Hà Ngọc Hùng', 'hnhung@hvktcnan.edu.vn', 'manager', 'HH', 'active'),
('tbach', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Bách', 'tbach@hvktcnan.edu.vn', 'officer', 'TB', 'active'),
('ndmai', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Diệu Mai', 'ndmai@hvktcnan.edu.vn', 'officer', 'NM', 'active'),

('tqson', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Quốc Sơn', 'tqson@hvktcnan.edu.vn', 'manager', 'TS', 'active'),
('pttam', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Phạm Thị Tâm', 'pttam@hvktcnan.edu.vn', 'manager', 'PT', 'active'),
('hvtien', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Văn Tiến', 'hvtien@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('dcvu', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Dương Công Vũ', 'dcvu@hvktcnan.edu.vn', 'officer', 'DV', 'active'),

('lhlinh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Hải Linh', 'lhlinh@hvktcnan.edu.vn', 'manager', 'LL', 'active'),
('nmduc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Minh Đức', 'nmduc@hvktcnan.edu.vn', 'manager', 'ND', 'active'),
('dtnga', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Thùy Nga', 'dtnga@hvktcnan.edu.vn', 'officer', 'DN', 'active'),
('qtmanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Quách Tuấn Mạnh', 'qtmanh@hvktcnan.edu.vn', 'officer', 'QM', 'active'),

('pvhieu', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Văn Hiếu', 'pvhieu@hvktcnan.edu.vn', 'manager', 'PH', 'active'),
('ntanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Tùng Anh', 'ntanh@hvktcnan.edu.vn', 'manager', 'NA', 'active'),
('vhphong', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Vũ Hải Phong', 'vhphong@hvktcnan.edu.vn', 'officer', 'VP', 'active'),
('lmnam', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lương Minh Nam', 'lmnam@hvktcnan.edu.vn', 'officer', 'LN', 'active'),

('ttlinh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Thùy Linh', 'ttlinh@hvktcnan.edu.vn', 'manager', 'TL', 'active'),
('nphuong', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Ngô Phương', 'nphuong@hvktcnan.edu.vn', 'manager', 'NP', 'active'),
('pdthang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Đức Thắng', 'pdthang@hvktcnan.edu.vn', 'officer', 'PT', 'active'),
('hvha', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Vũ Hà', 'hvha@hvktcnan.edu.vn', 'officer', 'HH', 'active'),

('btduong', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Trọng Dương', 'btduong@hvktcnan.edu.vn', 'manager', 'BD', 'active'),
('ntphuc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thành Phúc', 'ntphuc@hvktcnan.edu.vn', 'manager', 'NF', 'active'),
('hdthanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hà Đức Thành', 'hdthanh@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('lmkhanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Minh Khánh', 'lmkhanh@hvktcnan.edu.vn', 'officer', 'LK', 'active'),

('dquang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Đinh Quang', 'dquang@hvktcnan.edu.vn', 'manager', 'DQ', 'active'),
('tthao', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Thị Hảo', 'tthao@hvktcnan.edu.vn', 'manager', 'TH', 'active'),
('nvvinh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Vũ Vinh', 'nvvinh@hvktcnan.edu.vn', 'officer', 'NV', 'active'),
('lhgiang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Hồng Giang', 'lhgiang@hvktcnan.edu.vn', 'officer', 'LG', 'active'),

('ptnga', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Thu Nga', 'ptnga@hvktcnan.edu.vn', 'manager', 'PN', 'active'),
('btngoc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Bùi Thị Ngọc', 'btngoc@hvktcnan.edu.vn', 'manager', 'BN', 'active'),
('nvduc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Văn Đức', 'nvduc@hvktcnan.edu.vn', 'officer', 'ND', 'active'),
('tqhien', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Quốc Hiền', 'tqhien@hvktcnan.edu.vn', 'officer', 'TH', 'active'),

('lttuan', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Thanh Tuấn', 'lttuan@hvktcnan.edu.vn', 'manager', 'LT', 'active'),
('nhtrang', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Hà Trang', 'nhtrang@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('dmngoc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Dương Minh Ngọc', 'dmngoc@hvktcnan.edu.vn', 'officer', 'DN', 'active'),
('ptminh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Trí Minh', 'ptminh@hvktcnan.edu.vn', 'officer', 'PM', 'active');

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
('CB025', 25, 'Thượng úy Lê Hoàng Nam', 'Thượng úy', 'Lê Hoàng Nam', 'Cán bộ hậu cần', 'Phòng hậu cần', 'phong', '0911110025', 'lhnam@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB026', 26, 'Trung úy Phạm Quốc Hùng', 'Trung úy', 'Phạm Quốc Hùng', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110026', 'pqhung@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB027', 27, 'Trung úy Nguyễn Văn Khoa', 'Trung úy', 'Nguyễn Văn Khoa', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110027', 'nvkhoa@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB028', 28, 'Thượng úy Lê Văn Tâm', 'Thượng úy', 'Lê Văn Tâm', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110028', 'lvtam@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB029', 29, 'Thiếu úy Nguyễn Minh Phúc', 'Thiếu úy', 'Nguyễn Minh Phúc', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110029', 'nmphuc@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB030', 30, 'Thượng úy Trần Quốc Việt', 'Thượng úy', 'Trần Quốc Việt', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110030', 'tqviet@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB031', 31, 'Thiếu úy Lê Thị Hạnh', 'Thiếu úy', 'Lê Thị Hạnh', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110031', 'lthanh@hvktcnan.edu.vn', 'officer', 'active', NULL);

INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB032', 32, 'Trung tá Nguyễn Đức Huy', 'Trung tá', 'Nguyễn Đức Huy', 'Phó trưởng phòng', 'Phòng hành chính tổng hợp', 'phong', '0911110032', 'ndhuy@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB033', 33, 'Trung tá Trần Quang Minh', 'Trung tá', 'Trần Quang Minh', 'Phó trưởng phòng', 'Phòng chính trị', 'phong', '0911110033', 'tqminh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB034', 34, 'Trung tá Lưu Hải Đăng', 'Trung tá', 'Lưu Hải Đăng', 'Phó trưởng phòng', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110034', 'lhdang@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB035', 35, 'Trung tá Vũ Thị Thu Hà', 'Trung tá', 'Vũ Thị Thu Hà', 'Phó trưởng phòng', 'Phòng ĐBCL đào tạo', 'phong', '0911110035', 'vttha@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB036', 36, 'Trung tá Phan Minh Tuấn', 'Trung tá', 'Phan Minh Tuấn', 'Phó trưởng phòng', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110036', 'pmtuan@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB037', 37, 'Trung tá Nguyễn Thu Trang', 'Trung tá', 'Nguyễn Thu Trang', 'Phó trưởng phòng', 'Phòng quản lý học viên', 'phong', '0911110037', 'nttrang@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB038', 38, 'Trung tá Đỗ Văn Bình', 'Trung tá', 'Đỗ Văn Bình', 'Phó trưởng phòng', 'Phòng hậu cần', 'phong', '0911110038', 'dvbinh@hvktcnan.edu.vn', 'manager', 'active', NULL),

('CB039', 39, 'Thượng tá Nguyễn Đức Thành', 'Thượng tá', 'Nguyễn Đức Thành', 'Trưởng khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110039', 'ndthanh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB040', 40, 'Trung tá Trần Thu Hương', 'Trung tá', 'Trần Thu Hương', 'Phó trưởng khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110040', 'tthuong@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB041', 41, 'Đại úy Phạm Minh Hòa', 'Đại úy', 'Phạm Minh Hòa', 'Cán bộ khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110041', 'pmhoa@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB042', 42, 'Đại úy Lê Quốc Anh', 'Đại úy', 'Lê Quốc Anh', 'Cán bộ khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110042', 'lqanh@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB043', 43, 'Thượng tá Bùi Quang Vinh', 'Thượng tá', 'Bùi Quang Vinh', 'Trưởng khoa', 'Khoa Luật', 'khoa', '0911110043', 'bqvinh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB044', 44, 'Trung tá Nguyễn Thị Minh', 'Trung tá', 'Nguyễn Thị Minh', 'Phó trưởng khoa', 'Khoa Luật', 'khoa', '0911110044', 'ntminh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB045', 45, 'Đại úy Đỗ Trọng Kiên', 'Đại úy', 'Đỗ Trọng Kiên', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110045', 'dtkien@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB046', 46, 'Đại úy Phạm Quỳnh', 'Đại úy', 'Phạm Quỳnh', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110046', 'pquynh@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB047', 47, 'Thượng tá Lý Minh Sơn', 'Thượng tá', 'Lý Minh Sơn', 'Trưởng khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110047', 'lmson@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB048', 48, 'Trung tá Hà Ngọc Hùng', 'Trung tá', 'Hà Ngọc Hùng', 'Phó trưởng khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110048', 'hnhung@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB049', 49, 'Đại úy Trần Bách', 'Đại úy', 'Trần Bách', 'Cán bộ khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110049', 'tbach@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB050', 50, 'Đại úy Nguyễn Diệu Mai', 'Đại úy', 'Nguyễn Diệu Mai', 'Cán bộ khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110050', 'ndmai@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB051', 51, 'Thượng tá Trần Quốc Sơn', 'Thượng tá', 'Trần Quốc Sơn', 'Trưởng khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110051', 'tqson@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB052', 52, 'Trung tá Phạm Thị Tâm', 'Trung tá', 'Phạm Thị Tâm', 'Phó trưởng khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110052', 'pttam@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB053', 53, 'Đại úy Hoàng Văn Tiến', 'Đại úy', 'Hoàng Văn Tiến', 'Cán bộ khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110053', 'hvtien@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB054', 54, 'Đại úy Dương Công Vũ', 'Đại úy', 'Dương Công Vũ', 'Cán bộ khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110054', 'dcvu@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB055', 55, 'Thượng tá Lê Hải Linh', 'Thượng tá', 'Lê Hải Linh', 'Trưởng khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110055', 'lhlinh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB056', 56, 'Trung tá Nguyễn Minh Đức', 'Trung tá', 'Nguyễn Minh Đức', 'Phó trưởng khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110056', 'nmduc@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB057', 57, 'Đại úy Đỗ Thùy Nga', 'Đại úy', 'Đỗ Thùy Nga', 'Cán bộ khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110057', 'dtnga@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB058', 58, 'Đại úy Quách Tuấn Mạnh', 'Đại úy', 'Quách Tuấn Mạnh', 'Cán bộ khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110058', 'qtmanh@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB059', 59, 'Thượng tá Phạm Văn Hiếu', 'Thượng tá', 'Phạm Văn Hiếu', 'Trưởng khoa', 'Khoa mật mã', 'khoa', '0911110059', 'pvhieu@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB060', 60, 'Trung tá Nguyễn Tùng Anh', 'Trung tá', 'Nguyễn Tùng Anh', 'Phó trưởng khoa', 'Khoa mật mã', 'khoa', '0911110060', 'ntanh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB061', 61, 'Đại úy Vũ Hải Phong', 'Đại úy', 'Vũ Hải Phong', 'Cán bộ khoa', 'Khoa mật mã', 'khoa', '0911110061', 'vhphong@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB062', 62, 'Đại úy Lương Minh Nam', 'Đại úy', 'Lương Minh Nam', 'Cán bộ khoa', 'Khoa mật mã', 'khoa', '0911110062', 'lmnam@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB063', 63, 'Thượng tá Trần Thùy Linh', 'Thượng tá', 'Trần Thùy Linh', 'Trưởng khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110063', 'ttlinh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB064', 64, 'Trung tá Ngô Phương', 'Trung tá', 'Ngô Phương', 'Phó trưởng khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110064', 'nphuong@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB065', 65, 'Đại úy Phạm Đức Thắng', 'Đại úy', 'Phạm Đức Thắng', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110065', 'pdthang@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB066', 66, 'Đại úy Hoàng Vũ Hà', 'Đại úy', 'Hoàng Vũ Hà', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110066', 'hvha@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB067', 67, 'Thượng tá Bùi Trọng Dương', 'Thượng tá', 'Bùi Trọng Dương', 'Trưởng khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110067', 'btduong@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB068', 68, 'Trung tá Nguyễn Thành Phúc', 'Trung tá', 'Nguyễn Thành Phúc', 'Phó trưởng khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110068', 'ntphuc@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB069', 69, 'Đại úy Hà Đức Thành', 'Đại úy', 'Hà Đức Thành', 'Cán bộ khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110069', 'hdthanh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB070', 70, 'Đại úy Lê Minh Khánh', 'Đại úy', 'Lê Minh Khánh', 'Cán bộ khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110070', 'lmkhanh@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB071', 71, 'Thượng tá Đinh Quang', 'Thượng tá', 'Đinh Quang', 'Trưởng khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110071', 'dquang@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB072', 72, 'Trung tá Trần Thị Hảo', 'Trung tá', 'Trần Thị Hảo', 'Phó trưởng khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110072', 'tthao@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB073', 73, 'Đại úy Nguyễn Vũ Vinh', 'Đại úy', 'Nguyễn Vũ Vinh', 'Cán bộ khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110073', 'nvvinh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB074', 74, 'Đại úy Lê Hồng Giang', 'Đại úy', 'Lê Hồng Giang', 'Cán bộ khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110074', 'lhgiang@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB075', 75, 'Thượng tá Phạm Thu Nga', 'Thượng tá', 'Phạm Thu Nga', 'Trưởng khoa', 'Khoa Hậu cần', 'khoa', '0911110075', 'ptnga@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB076', 76, 'Trung tá Bùi Thị Ngọc', 'Trung tá', 'Bùi Thị Ngọc', 'Phó trưởng khoa', 'Khoa Hậu cần', 'khoa', '0911110076', 'btngoc@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB077', 77, 'Đại úy Nguyễn Văn Đức', 'Đại úy', 'Nguyễn Văn Đức', 'Cán bộ khoa', 'Khoa Hậu cần', 'khoa', '0911110077', 'nvduc@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB078', 78, 'Đại úy Trần Quốc Hiền', 'Đại úy', 'Trần Quốc Hiền', 'Cán bộ khoa', 'Khoa Hậu cần', 'khoa', '0911110078', 'tqhien@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB079', 79, 'Thượng tá Lê Thanh Tuấn', 'Thượng tá', 'Lê Thanh Tuấn', 'Trưởng khoa', 'Khoa Y Dược', 'khoa', '0911110079', 'lttuan@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB080', 80, 'Trung tá Nguyễn Hà Trang', 'Trung tá', 'Nguyễn Hà Trang', 'Phó trưởng khoa', 'Khoa Y Dược', 'khoa', '0911110080', 'nhtrang@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB081', 81, 'Đại úy Dương Minh Ngọc', 'Đại úy', 'Dương Minh Ngọc', 'Cán bộ khoa', 'Khoa Y Dược', 'khoa', '0911110081', 'dmngoc@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB082', 82, 'Đại úy Phạm Trí Minh', 'Đại úy', 'Phạm Trí Minh', 'Cán bộ khoa', 'Khoa Y Dược', 'khoa', '0911110082', 'ptminh@hvktcnan.edu.vn', 'officer', 'active', NULL);

-- Chuan hoa du lieu ten: tach quan ham khoi fullName neu du lieu cu dang gop chung
UPDATE officers
SET fullName = TRIM(REPLACE(fullName, CONCAT(officerTitle, ' '), ''))
WHERE officerTitle IS NOT NULL
  AND officerTitle <> ''
  AND fullName LIKE CONCAT(officerTitle, ' %');

UPDATE users u
LEFT JOIN officers o ON o.userId = u.id
SET
  u.militaryRank = COALESCE(NULLIF(u.militaryRank, ''), o.officerTitle),
  u.fullName = CASE
    WHEN COALESCE(NULLIF(u.militaryRank, ''), o.officerTitle) IS NOT NULL
         AND u.fullName LIKE CONCAT(COALESCE(NULLIF(u.militaryRank, ''), o.officerTitle), ' %')
      THEN TRIM(REPLACE(u.fullName, CONCAT(COALESCE(NULLIF(u.militaryRank, ''), o.officerTitle), ' '), ''))
    ELSE u.fullName
  END;

-- Chuan hoa username theo quy tac viet tat tu ho ten (vd: Bui Quoc Bao -> bqbao)
UPDATE users
SET username = CASE id
  WHEN 1 THEN 'lmthao'
  WHEN 2 THEN 'nvcan'
  WHEN 3 THEN 'nmcuong'
  WHEN 4 THEN 'ptthang'
  WHEN 5 THEN 'tvson'
  WHEN 6 THEN 'ltmai'
  WHEN 7 THEN 'pqhuy'
  WHEN 8 THEN 'hmduc'
  WHEN 9 THEN 'ntlan'
  WHEN 10 THEN 'bvnam'
  WHEN 11 THEN 'dthuong'
  WHEN 12 THEN 'vtlong'
  WHEN 13 THEN 'tdanh'
  WHEN 14 THEN 'ngbao'
  WHEN 15 THEN 'ltkiet'
  WHEN 16 THEN 'phdat'
  WHEN 17 THEN 'bhnam'
  WHEN 18 THEN 'hvtuan'
  WHEN 19 THEN 'dmquan'
  WHEN 20 THEN 'tavu'
  WHEN 21 THEN 'ntyen'
  WHEN 22 THEN 'dnha'
  WHEN 23 THEN 'nqbinh'
  WHEN 24 THEN 'tmchi'
  WHEN 25 THEN 'lhnam'
  WHEN 26 THEN 'pqhung'
  WHEN 27 THEN 'nvkhoa'
  WHEN 28 THEN 'lvtam'
  WHEN 29 THEN 'nmphuc'
  WHEN 30 THEN 'tqviet'
  WHEN 31 THEN 'lthanh'
  ELSE username
END;

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
('Khoa Y Dược', 'khoa', NULL, 1),
('Đội lái xe', 'doi', NULL, 1),
('Đội bệnh xá', 'doi', NULL, 1);

-- Dong bo khoa ngoai departmentId theo ten don vi cho du lieu seed
UPDATE officers o
JOIN departments d ON d.name = o.department
SET o.departmentId = d.id;

UPDATE departments
SET headOfficerId = CASE name
  WHEN 'Khoa Lý luận chính trị và KHXHNV' THEN 'CB039'
  WHEN 'Khoa Luật' THEN 'CB043'
  WHEN 'Khoa nghiệp vụ cơ bản' THEN 'CB047'
  WHEN 'Khoa khoa học cơ bản và ngoại ngữ' THEN 'CB051'
  WHEN 'Khoa quân sự, võ thuật, TDTT' THEN 'CB055'
  WHEN 'Khoa mật mã' THEN 'CB059'
  WHEN 'Khoa Công nghệ và ATTT' THEN 'CB063'
  WHEN 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ' THEN 'CB067'
  WHEN 'Khoa Hồ sơ - Lưu trữ' THEN 'CB071'
  WHEN 'Khoa Hậu cần' THEN 'CB075'
  WHEN 'Khoa Y Dược' THEN 'CB079'
  ELSE headOfficerId
END
WHERE departmentType = 'khoa';

UPDATE work_schedules ws
JOIN departments d ON d.name = ws.department
SET ws.departmentId = d.id;

-- ========== HOLIDAYS ==========
INSERT INTO holidays (holidayDate, holidayName, holidayType, isRecurring) VALUES
('2026-01-01', 'Tết Dương lịch', 'holiday', 1),
('2026-02-17', 'Tết Nguyên đán', 'holiday', 0),
('2026-02-18', 'Tết Nguyên đán', 'holiday', 0),
('2026-02-19', 'Tết Nguyên đán', 'holiday', 0),
('2026-02-20', 'Tết Nguyên đán', 'holiday', 0),
('2026-02-21', 'Tết Nguyên đán', 'holiday', 0),
('2026-02-22', 'Tết Nguyên đán', 'holiday', 0),
('2026-04-26', 'Giỗ Tổ Hùng Vương', 'holiday', 0),
('2026-04-30', 'Ngày Giải phóng miền Nam', 'holiday', 1),
('2026-05-01', 'Quốc tế Lao động', 'holiday', 1),
('2026-09-02', 'Quốc khánh', 'holiday', 1);

-- ========== WORK SCHEDULES ==========
INSERT INTO work_schedules (
  id, title, date, startTime, endTime, location, department, type, weekNo, notes,
  responsibleOfficerId,
  createdByUserId,
  createdByOfficerId
) VALUES
('LCT001', 'Giao ban Ban Giám đốc', '2026-04-06', '08:00', '09:30', 'Phòng họp A', 'Ban Giám đốc', 'hop', 15, 'Họp giao ban đầu tuần', 'CB001', 1, 'CB001'),
('LCT002', 'Họp triển khai công tác đào tạo', '2026-04-07', '14:00', '16:00', 'Phòng họp B', 'Phòng quản lý đào tạo và BDNC', 'hop', 15, 'Triển khai kế hoạch tháng 4', 'CB007', 7, 'CB007'),
('LCT003', 'Khảo sát chất lượng đào tạo', '2026-04-08', '09:00', '11:00', 'Khoa Công nghệ và ATTT', 'Phòng ĐBCL đào tạo', 'khaoSat', 15, 'Đánh giá nội bộ', 'CB008', 8, 'CB008'),
('LCT004', 'Hội thảo nghiên cứu khoa học', '2026-04-09', '08:30', '11:30', 'Hội trường lớn', 'Phòng quản lý nghiên cứu khoa học', 'hoiThao', 15, 'Báo cáo đề tài cấp cơ sở', 'CB009', 9, 'CB009'),
('LCT005', 'Lớp bồi dưỡng chuyên môn', '2026-04-10', '13:30', '16:30', 'Phòng học C3', 'Khoa Luật', 'baoCao', 15, 'Nhóm cán bộ đang học', 'CB013', 10, 'CB010'),
('LCT006', 'a', '2026-04-02', '08:00', '10:00', 'a', 'Ban Giám đốc, Phòng hậu cần, Phòng hành chính tổng hợp', 'tiepkhach', 14, '', 'CB017', 12, 'CB012'),
('LCT007', 'a', '2026-04-02', '00:00', '13:04', 'a', 'Phòng chính trị, Khoa Công nghệ và ATTT', 'hop', 14, '', 'CB019', 5, 'CB005');

-- Dong bo departmentId sau khi seed work_schedules
UPDATE work_schedules ws
JOIN departments d ON d.name = ws.department
SET ws.departmentId = d.id
WHERE ws.departmentId IS NULL;

-- ========== DUTY SCHEDULES ==========
INSERT INTO duty_schedules (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, dutyRole, slotNo, assignmentGroup, notes) VALUES
('TBGD015', 'CB001', 'director_weekly', '2026-04-06', '2026-04-12', '2026-04-06', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 15'),
('TBCB101', 'CB012', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', ''),
('TBCB102', 'CB013', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', ''),
('TBCB103', 'CB005', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', ''),
('TBCB104', 'CB026', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', ''),
('TBCB105', 'CB027', 'officer_daily', '2026-04-06', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', ''),
('TBCB106', 'CB014', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', ''),
('TBCB107', 'CB015', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', ''),
('TBCB108', 'CB006', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', ''),
('TBCB109', 'CB028', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', ''),
('TBCB110', 'CB027', 'officer_daily', '2026-04-07', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', ''),
('TBCB111', 'CB020', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB112', 'CB024', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB113', 'CB010', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB114', 'CB029', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB115', 'CB031', 'officer_daily', '2026-04-08', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB116', 'CB016', 'officer_daily', '2026-04-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB117', 'CB019', 'officer_daily', '2026-04-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB118', 'CB008', 'officer_daily', '2026-04-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB119', 'CB026', 'officer_daily', '2026-04-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB120', 'CB030', 'officer_daily', '2026-04-09', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB121', 'CB022', 'officer_daily', '2026-04-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB122', 'CB021', 'officer_daily', '2026-04-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB123', 'CB011', 'officer_daily', '2026-04-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB124', 'CB028', 'officer_daily', '2026-04-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB125', 'CB031', 'officer_daily', '2026-04-10', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB126', 'CB020', 'officer_daily', '2026-04-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB127', 'CB012', 'officer_daily', '2026-04-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB128', 'CB010', 'officer_daily', '2026-04-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB129', 'CB026', 'officer_daily', '2026-04-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB130', 'CB027', 'officer_daily', '2026-04-11', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB131', 'CB015', 'officer_daily', '2026-04-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB132', 'CB016', 'officer_daily', '2026-04-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB133', 'CB005', 'officer_daily', '2026-04-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB134', 'CB028', 'officer_daily', '2026-04-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB135', 'CB031', 'officer_daily', '2026-04-12', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB136', 'CB019', 'officer_daily', '2026-04-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB137', 'CB017', 'officer_daily', '2026-04-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB138', 'CB009', 'officer_daily', '2026-04-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB139', 'CB029', 'officer_daily', '2026-04-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB140', 'CB030', 'officer_daily', '2026-04-13', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB141', 'CB024', 'officer_daily', '2026-04-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB142', 'CB025', 'officer_daily', '2026-04-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB143', 'CB007', 'officer_daily', '2026-04-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB144', 'CB026', 'officer_daily', '2026-04-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB145', 'CB027', 'officer_daily', '2026-04-14', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB146', 'CB021', 'officer_daily', '2026-04-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB147', 'CB023', 'officer_daily', '2026-04-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB148', 'CB008', 'officer_daily', '2026-04-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB149', 'CB028', 'officer_daily', '2026-04-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB150', 'CB031', 'officer_daily', '2026-04-15', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB151', 'CB015', 'officer_daily', '2026-04-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB152', 'CB012', 'officer_daily', '2026-04-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB153', 'CB011', 'officer_daily', '2026-04-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB154', 'CB029', 'officer_daily', '2026-04-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB155', 'CB030', 'officer_daily', '2026-04-16', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB156', 'CB023', 'officer_daily', '2026-04-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB157', 'CB020', 'officer_daily', '2026-04-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB158', 'CB009', 'officer_daily', '2026-04-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB159', 'CB026', 'officer_daily', '2026-04-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB160', 'CB027', 'officer_daily', '2026-04-17', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekday', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB161', 'CB019', 'officer_daily', '2026-04-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB162', 'CB015', 'officer_daily', '2026-04-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB163', 'CB008', 'officer_daily', '2026-04-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB164', 'CB029', 'officer_daily', '2026-04-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB165', 'CB030', 'officer_daily', '2026-04-18', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB166', 'CB021', 'officer_daily', '2026-04-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB167', 'CB023', 'officer_daily', '2026-04-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'officer', 2, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB168', 'CB009', 'officer_daily', '2026-04-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Nhà hiệu bộ', 'commander', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB169', 'CB028', 'officer_daily', '2026-04-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Lái xe', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)'),
('TBCB170', 'CB031', 'officer_daily', '2026-04-19', NULL, NULL, 'nguyenday', '00:00', '23:59', 'Bệnh xá', 'officer', 1, 'weekend', 'Tự động xếp theo vòng công bằng (ngày thường/cuối tuần tách riêng)');

-- ========== ACTIVITY LOGS ==========
INSERT INTO activity_logs (actorUserId, actorUsername, actorRole, module, action, entityType, entityId, summary, metadata) VALUES
(1, 'lmthao', 'admin', 'lichcongtac', 'create', 'work_schedule', 'LCT001', 'Tạo lịch công tác LCT001', JSON_OBJECT('note', 'Khởi tạo lịch')),
(7, 'pqhuy', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT002', 'Tạo lịch công tác LCT002', JSON_OBJECT('note', 'Khởi tạo lịch')),
(8, 'hmduc', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT003', 'Tạo lịch công tác LCT003', JSON_OBJECT('note', 'Khởi tạo lịch')),
(2, 'nvcan', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT004', 'Cập nhật lịch công tác LCT004', JSON_OBJECT('note', 'Điều chỉnh lịch')),
(1, 'lmthao', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBGD015', 'Cập nhật lịch trực ban tuần 15', JSON_OBJECT('note', 'Điều chỉnh lịch')),
(1, 'lmthao', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB109', 'Cập nhật lịch trực ban TBCB109', NULL),
(1, 'lmthao', 'admin', 'lichtrucban', 'create', 'duty_schedule', 'TBCB111,TBCB112,TBCB113,TBCB114,TBCB115,TBCB116,TB', 'Tự động xếp officer_daily (25 lịch)', NULL),
(1, 'lmthao', 'admin', 'lichtrucban', 'create', 'duty_schedule', 'TBCB136,TBCB137,TBCB138,TBCB139,TBCB140,TBCB141,TB', 'Tự động xếp officer_daily (35 lịch)', NULL),
(12, 'vtlong', 'officer', 'lichcongtac', 'create', 'work_schedule', 'LCT006', 'Thêm mới lịch công tác LCT006 - a', NULL),
(5, 'tvson', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT006', 'Duyệt lịch công tác LCT006', NULL),
(5, 'tvson', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT007', 'Thêm mới lịch công tác LCT007 - a', NULL),
(5, 'tvson', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT007', 'Duyệt lịch công tác LCT007', NULL);

-- ========== NOTIFICATIONS ==========
INSERT INTO notifications (title, content, type, module, entityType, entityId, targetUserId, targetRole, isActive) VALUES
('Lịch trực ban của bạn vừa được cập nhật', 'Lịch TBCB109 vào ngày 2026-04-07', 'info', 'lichtrucban', 'duty_schedule', 'TBCB109', 27, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-08 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB111', 20, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-08 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB112', 24, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-08 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB113', 10, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-08 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB114', 28, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-08 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB115', 31, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-09 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB116', 16, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-09 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB117', 19, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-09 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB118', 8, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-09 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB119', 26, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-09 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB120', 30, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-10 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB121', 22, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-10 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB122', 21, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-10 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB123', 11, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-10 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB124', 27, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-10 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB125', 31, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-11 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB126', 20, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-11 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB127', 12, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-11 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB128', 10, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-11 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB129', 26, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-11 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB130', 29, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-12 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB131', 15, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-12 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB132', 16, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-12 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB133', 5, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-12 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB134', 27, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-12 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB135', 31, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-13 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB136', 19, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-13 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB137', 17, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-13 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB138', 9, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-13 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB139', 28, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-13 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB140', 30, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-14 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB141', 24, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-14 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB142', 25, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-14 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB143', 7, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-14 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB144', 26, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-14 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB145', 29, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-15 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB146', 21, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-15 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB147', 23, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-15 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB148', 8, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-15 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB149', 27, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-15 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB150', 31, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-16 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB151', 15, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-16 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB152', 12, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-16 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB153', 11, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-16 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB154', 28, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-16 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB155', 30, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-17 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB156', 23, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-17 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB157', 20, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-17 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB158', 9, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-17 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB159', 26, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-17 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB160', 29, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-18 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB161', 19, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-18 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB162', 15, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-18 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB163', 8, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-18 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB164', 28, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-18 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB165', 30, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-19 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB166', 21, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-19 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB167', 23, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-19 - Nhà hiệu bộ', 'info', 'lichtrucban', 'duty_schedule', 'TBCB168', 9, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-19 - Lái xe', 'info', 'lichtrucban', 'duty_schedule', 'TBCB169', 27, NULL, 1),
('Bạn được phân công lịch trực ban', '2026-04-19 - Bệnh xá', 'info', 'lichtrucban', 'duty_schedule', 'TBCB170', 31, NULL, 1),
('Có lịch công tác chờ duyệt', 'a (2026-04-02)', 'warning', 'lichcongtac', 'work_schedule', 'LCT006', NULL, 'admin', 1),
('Lịch công tác đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT006', 12, NULL, 1),
('Lịch công tác đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT006', 17, NULL, 1),
('Có lịch công tác chờ duyệt', 'a (2026-04-02)', 'warning', 'lichcongtac', 'work_schedule', 'LCT007', NULL, 'admin', 1),
('Lịch công tác đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT007', 5, NULL, 1),
('Lịch công tác đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT007', 19, NULL, 1);

-- ========== EXPORT LOGS ==========
INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount) VALUES
(1, 'lmthao', 'admin', 'congtac', 'week', 'pdf', 5),
(2, 'nvcan', 'admin', 'both', 'week', 'pdf', 12),
(7, 'pqhuy', 'manager', 'congtac', 'week', 'pdf', 3),
(1, 'lmthao', 'admin', 'trucban', 'week', 'pdf', 36),
(1, 'lmthao', 'admin', 'both', 'week', 'pdf', 41),
(5, 'tvson', 'manager', 'trucban', 'week', 'pdf', 36),
(5, 'tvson', 'manager', 'trucban', 'week', 'pdf', 36);

-- Verify tables were created
SELECT 'Database initialized successfully (seeded, except leave_requests/notification_reads)!' AS status;
