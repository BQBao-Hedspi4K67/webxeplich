-- ========== HVKTCNAN Schedule Management System ==========
-- Database initialization script for MySQL
-- Date: April 2026
-- Encoding: UTF-8

SET NAMES utf8mb4;
SET character_set_client = utf8mb4;
SET character_set_results = utf8mb4;
SET character_set_connection = utf8mb4;

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
  role ENUM('superadmin', 'admin', 'leader', 'manager', 'officer') DEFAULT 'officer' NOT NULL,
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
  status ENUM('active', 'on_business_trip', 'inactive', 'studying') DEFAULT 'active',
  studyUntil DATE NULL,
  businessTripStartDate DATE NULL,
  businessTripEndDate DATE NULL,
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
-- Quyền lập/sửa lịch trực cấp riêng cho từng cán bộ (chỉ Giám đốc và Trưởng/Phó phòng Hành chính tổng hợp được cấp/thu hồi)
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
-- Quyền tạo/duyệt Lịch sự kiện cấp riêng cho từng cán bộ (chỉ Giám đốc và Trưởng/Phó phòng Hành chính tổng hợp được cấp/thu hồi)
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
-- Lịch sự kiện theo tuần (quản lý thêm, ban giám đốc phê duyệt)
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
-- Lịch trực ban (2 loại: giám đốc tuần + trực cán bộ)
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
('thaolm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu tướng Lê Minh Thảo', 'thaolm@hvktcnan.edu.vn', 'admin', 'LT', 'active'),
('cannv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Nguyễn Văn Căn', 'cannv@hvktcnan.edu.vn', 'admin', 'NC', 'active'),
('cuongnm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Nguyễn Mạnh Cường', 'cuongnm@hvktcnan.edu.vn', 'admin', 'NC', 'active'),
('hangptt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại tá Phạm Thị Thúy Hằng', 'hangptt@hvktcnan.edu.vn', 'admin', 'PH', 'active'),

('sontv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Văn Sơn', 'sontv@hvktcnan.edu.vn', 'manager', 'TS', 'active'),
('mailt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Thị Mai', 'mailt@hvktcnan.edu.vn', 'manager', 'LM', 'active'),
('huypq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Quang Huy', 'huypq@hvktcnan.edu.vn', 'manager', 'PH', 'active'),
('duchm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Hoàng Minh Đức', 'duchm@hvktcnan.edu.vn', 'manager', 'HD', 'active'),
('lannt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Nguyễn Thị Lan', 'lannt@hvktcnan.edu.vn', 'manager', 'NL', 'active'),
('nambv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Văn Nam', 'nambv@hvktcnan.edu.vn', 'manager', 'BN', 'active'),
('huongdt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Đặng Thị Hương', 'huongdt@hvktcnan.edu.vn', 'manager', 'DH', 'active'),

('longvt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Võ Thanh Long', 'longvt@hvktcnan.edu.vn', 'officer', 'VL', 'active'),
('anhtd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Đức Anh', 'anhtd@hvktcnan.edu.vn', 'officer', 'TA', 'active'),
('baong', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Gia Bảo', 'baong@hvktcnan.edu.vn', 'officer', 'NB', 'active'),
('kietlt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Tuấn Kiệt', 'kietlt@hvktcnan.edu.vn', 'officer', 'LK', 'active'),
('datph', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Hữu Đạt', 'datph@hvktcnan.edu.vn', 'officer', 'PD', 'active'),
('nambh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Bùi Hải Nam', 'nambh@hvktcnan.edu.vn', 'officer', 'BN', 'active'),
('tuanhv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Văn Tuấn', 'tuanhv@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('quandm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Minh Quân', 'quandm@hvktcnan.edu.vn', 'officer', 'DQ', 'active'),
('vuta', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trương Anh Vũ', 'vuta@hvktcnan.edu.vn', 'officer', 'TV', 'active'),
('yennt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Thị Yến', 'yennt@hvktcnan.edu.vn', 'officer', 'NY', 'active'),
('hadn', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đặng Ngọc Hà', 'hadn@hvktcnan.edu.vn', 'officer', 'DH', 'active'),
('binhnq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Nguyễn Quốc Bình', 'binhnq@hvktcnan.edu.vn', 'officer', 'NB', 'active'),
('chitm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Trần Mai Chi', 'chitm@hvktcnan.edu.vn', 'officer', 'TC', 'active'),
('namlh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Lê Hoàng Nam', 'namlh@hvktcnan.edu.vn', 'officer', 'LN', 'active'),
('hungpq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Phạm Quốc Hùng', 'hungpq@hvktcnan.edu.vn', 'officer', 'PH', 'active'),
('tamlv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Lê Văn Tâm', 'tamlv@hvktcnan.edu.vn', 'officer', 'LT', 'active'),
('phucnm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Nguyễn Minh Phúc', 'phucnm@hvktcnan.edu.vn', 'officer', 'NP', 'active'),
('khoanv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Nguyễn Văn Khoa', 'khoanv@hvktcnan.edu.vn', 'officer', 'NK', 'active'),
('viettq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Trần Quốc Việt', 'viettq@hvktcnan.edu.vn', 'officer', 'TV', 'active'),
('hanhlt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu úy Lê Thị Hạnh', 'hanhlt@hvktcnan.edu.vn', 'officer', 'LH', 'active');

INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('huynd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Đức Huy', 'huynd@hvktcnan.edu.vn', 'manager', 'NH', 'active'),
('minhtq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Quang Minh', 'minhtq@hvktcnan.edu.vn', 'manager', 'TM', 'active'),
('danglh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Lưu Hải Đăng', 'danglh@hvktcnan.edu.vn', 'manager', 'LD', 'active'),
('havtt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Vũ Thị Thu Hà', 'havtt@hvktcnan.edu.vn', 'manager', 'VH', 'active'),
('tuanpm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Phan Minh Tuấn', 'tuanpm@hvktcnan.edu.vn', 'manager', 'PT', 'active'),
('trangnt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thu Trang', 'trangnt@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('binhdv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Đỗ Văn Bình', 'binhdv@hvktcnan.edu.vn', 'manager', 'DB', 'active'),

('thanhnd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Nguyễn Đức Thành', 'thanhnd@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('huongtt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Thu Hương', 'huongtt@hvktcnan.edu.vn', 'manager', 'TH', 'active'),
('hoapm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Minh Hòa', 'hoapm@hvktcnan.edu.vn', 'officer', 'PH', 'active'),
('anhlq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Quốc Anh', 'anhlq@hvktcnan.edu.vn', 'officer', 'LA', 'active'),

('vinhbq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Quang Vinh', 'vinhbq@hvktcnan.edu.vn', 'manager', 'BV', 'active'),
('minhnt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thị Minh', 'minhnt@hvktcnan.edu.vn', 'manager', 'NM', 'active'),
('kiendt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Trọng Kiên', 'kiendt@hvktcnan.edu.vn', 'officer', 'DK', 'active'),
('quynhp', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Quỳnh', 'quynhp@hvktcnan.edu.vn', 'officer', 'PQ', 'active'),

('sonlm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lý Minh Sơn', 'sonlm@hvktcnan.edu.vn', 'manager', 'LS', 'active'),
('hunghn', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Hà Ngọc Hùng', 'hunghn@hvktcnan.edu.vn', 'manager', 'HH', 'active'),
('bacht', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Bách', 'bacht@hvktcnan.edu.vn', 'officer', 'TB', 'active'),
('maind', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Diệu Mai', 'maind@hvktcnan.edu.vn', 'officer', 'NM', 'active'),

('sontq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Quốc Sơn', 'sontq@hvktcnan.edu.vn', 'manager', 'TS', 'active'),
('tampt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Phạm Thị Tâm', 'tampt@hvktcnan.edu.vn', 'manager', 'PT', 'active'),
('tienhv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Văn Tiến', 'tienhv@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('vudc', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Dương Công Vũ', 'vudc@hvktcnan.edu.vn', 'officer', 'DV', 'active'),

('linhlh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Hải Linh', 'linhlh@hvktcnan.edu.vn', 'manager', 'LL', 'active'),
('ducnm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Minh Đức', 'ducnm@hvktcnan.edu.vn', 'manager', 'ND', 'active'),
('ngadt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Thùy Nga', 'ngadt@hvktcnan.edu.vn', 'officer', 'DN', 'active'),
('manhqt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Quách Tuấn Mạnh', 'manhqt@hvktcnan.edu.vn', 'officer', 'QM', 'active'),

('hieupv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Văn Hiếu', 'hieupv@hvktcnan.edu.vn', 'manager', 'PH', 'active'),
('anhnt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Tùng Anh', 'anhnt@hvktcnan.edu.vn', 'manager', 'NA', 'active'),
('phongvh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Vũ Hải Phong', 'phongvh@hvktcnan.edu.vn', 'officer', 'VP', 'active'),
('namlm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lương Minh Nam', 'namlm@hvktcnan.edu.vn', 'officer', 'LN', 'active'),

('linhtt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Trần Thùy Linh', 'linhtt@hvktcnan.edu.vn', 'manager', 'TL', 'active'),
('phuongn', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Ngô Phương', 'phuongn@hvktcnan.edu.vn', 'manager', 'NP', 'active'),
('thangpd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Đức Thắng', 'thangpd@hvktcnan.edu.vn', 'officer', 'PT', 'active'),
('havv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hoàng Vũ Hà', 'havv@hvktcnan.edu.vn', 'officer', 'HH', 'active'),

('duongbt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Bùi Trọng Dương', 'duongbt@hvktcnan.edu.vn', 'manager', 'BD', 'active'),
('phucnt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Thành Phúc', 'phucnt@hvktcnan.edu.vn', 'manager', 'NF', 'active'),
('thanhhd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hà Đức Thành', 'thanhhd@hvktcnan.edu.vn', 'officer', 'HT', 'active'),
('khanhlm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Minh Khánh', 'khanhlm@hvktcnan.edu.vn', 'officer', 'LK', 'active'),

('quangd', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Đinh Quang', 'quangd@hvktcnan.edu.vn', 'manager', 'DQ', 'active'),
('haott', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Trần Thị Hảo', 'haott@hvktcnan.edu.vn', 'manager', 'TH', 'active'),
('vinhnv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Vũ Vinh', 'vinhnv@hvktcnan.edu.vn', 'officer', 'NV', 'active'),
('gianglh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Hồng Giang', 'gianglh@hvktcnan.edu.vn', 'officer', 'LG', 'active'),

('ngapt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Phạm Thu Nga', 'ngapt@hvktcnan.edu.vn', 'manager', 'PN', 'active'),
('ngocbt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Bùi Thị Ngọc', 'ngocbt@hvktcnan.edu.vn', 'manager', 'BN', 'active'),
('ducnv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Văn Đức', 'ducnv@hvktcnan.edu.vn', 'officer', 'ND', 'active'),
('hientq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Quốc Hiền', 'hientq@hvktcnan.edu.vn', 'officer', 'TH', 'active'),

('tuanlt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng tá Lê Thanh Tuấn', 'tuanlt@hvktcnan.edu.vn', 'manager', 'LT', 'active'),
('trangnh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Hà Trang', 'trangnh@hvktcnan.edu.vn', 'manager', 'NT', 'active'),
('ngocdm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Dương Minh Ngọc', 'ngocdm@hvktcnan.edu.vn', 'officer', 'DN', 'active'),
('minhpt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Trí Minh', 'minhpt@hvktcnan.edu.vn', 'officer', 'PM', 'active');

INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('admin1', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Super Admin 1', 'admin1@hvktcnan.edu.vn', 'superadmin', 'A1', 'active'),
('admin2', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Super Admin 2', 'admin2@hvktcnan.edu.vn', 'superadmin', 'A2', 'active');

INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('anlv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Lê Văn An', 'anlv@hvktcnan.edu.vn', 'manager', 'AL', 'active'),
('binhnv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Nguyễn Văn Bình', 'binhnv@hvktcnan.edu.vn', 'manager', 'NB', 'active'),
('dunglv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung tá Lê Văn Dũng', 'dunglv@hvktcnan.edu.vn', 'manager', 'LD', 'active'),
('hantt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thiếu tá Trần Thị Hạnh', 'hantt@hvktcnan.edu.vn', 'manager', 'HT', 'active');

-- ========== OFFICERS ==========
INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB001', 1, 'Thiếu tướng Lê Minh Thảo', 'Thiếu tướng', 'Lê Minh Thảo', 'Giám đốc Học viện', 'Ban Giám đốc', 'ban_giam_doc', '0911110001', 'thaolm@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB002', 2, 'Đại tá Nguyễn Văn Căn', 'Đại tá', 'Nguyễn Văn Căn', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110002', 'cannv@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB003', 3, 'Đại tá Nguyễn Mạnh Cường', 'Đại tá', 'Nguyễn Mạnh Cường', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110003', 'cuongnm@hvktcnan.edu.vn', 'leader', 'active', NULL),
('CB004', 4, 'Đại tá Phạm Thị Thúy Hằng', 'Đại tá', 'Phạm Thị Thúy Hằng', 'Phó Giám đốc', 'Ban Giám đốc', 'ban_giam_doc', '0911110004', 'hangptt@hvktcnan.edu.vn', 'leader', 'active', NULL),

('CB005', 5, 'Thượng tá Trần Văn Sơn', 'Thượng tá', 'Trần Văn Sơn', 'Trưởng phòng', 'Phòng hành chính tổng hợp', 'phong', '0911110005', 'sontv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB006', 6, 'Thượng tá Lê Thị Mai', 'Thượng tá', 'Lê Thị Mai', 'Trưởng phòng', 'Phòng chính trị', 'phong', '0911110006', 'mailt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB007', 7, 'Thượng tá Phạm Quang Huy', 'Thượng tá', 'Phạm Quang Huy', 'Trưởng phòng', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110007', 'huypq@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB008', 8, 'Thượng tá Hoàng Minh Đức', 'Thượng tá', 'Hoàng Minh Đức', 'Trưởng phòng', 'Phòng ĐBCL đào tạo', 'phong', '0911110008', 'duchm@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB009', 9, 'Thượng tá Nguyễn Thị Lan', 'Thượng tá', 'Nguyễn Thị Lan', 'Trưởng phòng', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110009', 'lannt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB010', 10, 'Thượng tá Bùi Văn Nam', 'Thượng tá', 'Bùi Văn Nam', 'Trưởng phòng', 'Phòng quản lý học viên', 'phong', '0911110010', 'nambv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB011', 11, 'Thượng tá Đặng Thị Hương', 'Thượng tá', 'Đặng Thị Hương', 'Trưởng phòng', 'Phòng hậu cần', 'phong', '0911110011', 'huongdt@hvktcnan.edu.vn', 'manager', 'active', NULL),

('CB012', 12, 'Đại úy Võ Thanh Long', 'Đại úy', 'Võ Thanh Long', 'Cán bộ tổng hợp', 'Phòng hành chính tổng hợp', 'phong', '0911110012', 'longvt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB013', 13, 'Đại úy Trần Đức Anh', 'Đại úy', 'Trần Đức Anh', 'Cán bộ tổng hợp', 'Phòng hành chính tổng hợp', 'phong', '0911110013', 'anhtd@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB014', 14, 'Đại úy Nguyễn Gia Bảo', 'Đại úy', 'Nguyễn Gia Bảo', 'Cán bộ chính trị', 'Phòng chính trị', 'phong', '0911110014', 'baong@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB015', 15, 'Đại úy Lê Tuấn Kiệt', 'Đại úy', 'Lê Tuấn Kiệt', 'Cán bộ chính trị', 'Phòng chính trị', 'phong', '0911110015', 'kietlt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB016', 16, 'Đại úy Phạm Hữu Đạt', 'Đại úy', 'Phạm Hữu Đạt', 'Cán bộ đào tạo', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110016', 'datph@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB017', 17, 'Đại úy Bùi Hải Nam', 'Đại úy', 'Bùi Hải Nam', 'Cán bộ đào tạo', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110017', 'nambh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB018', 18, 'Đại úy Hoàng Văn Tuấn', 'Đại úy', 'Hoàng Văn Tuấn', 'Cán bộ kiểm định', 'Phòng ĐBCL đào tạo', 'phong', '0911110018', 'tuanhv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB019', 19, 'Đại úy Đỗ Minh Quân', 'Đại úy', 'Đỗ Minh Quân', 'Cán bộ kiểm định', 'Phòng ĐBCL đào tạo', 'phong', '0911110019', 'quandm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB020', 20, 'Đại úy Trương Anh Vũ', 'Đại úy', 'Trương Anh Vũ', 'Cán bộ nghiên cứu', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110020', 'vuta@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB021', 21, 'Đại úy Nguyễn Thị Yến', 'Đại úy', 'Nguyễn Thị Yến', 'Cán bộ nghiên cứu', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110021', 'yennt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB022', 22, 'Đại úy Đặng Ngọc Hà', 'Đại úy', 'Đặng Ngọc Hà', 'Cán bộ quản lý học viên', 'Phòng quản lý học viên', 'phong', '0911110022', 'hadn@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB023', 23, 'Thượng úy Nguyễn Quốc Bình', 'Thượng úy', 'Nguyễn Quốc Bình', 'Cán bộ quản lý học viên', 'Phòng quản lý học viên', 'phong', '0911110023', 'binhnq@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB024', 24, 'Thượng úy Trần Mai Chi', 'Thượng úy', 'Trần Mai Chi', 'Cán bộ hậu cần', 'Phòng hậu cần', 'phong', '0911110024', 'chitm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB025', 25, 'Thượng úy Lê Hoàng Nam', 'Thượng úy', 'Lê Hoàng Nam', 'Cán bộ hậu cần', 'Phòng hậu cần', 'phong', '0911110025', 'namlh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB026', 26, 'Trung úy Phạm Quốc Hùng', 'Trung úy', 'Phạm Quốc Hùng', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110026', 'hungpq@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB027', 27, 'Trung úy Nguyễn Văn Khoa', 'Trung úy', 'Nguyễn Văn Khoa', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110027', 'khoanv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB028', 28, 'Thượng úy Lê Văn Tâm', 'Thượng úy', 'Lê Văn Tâm', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110028', 'tamlv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB029', 29, 'Thiếu úy Nguyễn Minh Phúc', 'Thiếu úy', 'Nguyễn Minh Phúc', 'Cán bộ lái xe', 'Đội lái xe', 'doi', '0911110029', 'phucnm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB030', 30, 'Thượng úy Trần Quốc Việt', 'Thượng úy', 'Trần Quốc Việt', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110030', 'viettq@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB031', 31, 'Thiếu úy Lê Thị Hạnh', 'Thiếu úy', 'Lê Thị Hạnh', 'Cán bộ quân y', 'Đội bệnh xá', 'doi', '0911110031', 'hanhlt@hvktcnan.edu.vn', 'officer', 'active', NULL);

INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB032', 32, 'Trung tá Nguyễn Đức Huy', 'Trung tá', 'Nguyễn Đức Huy', 'Phó trưởng phòng', 'Phòng hành chính tổng hợp', 'phong', '0911110032', 'huynd@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB033', 33, 'Trung tá Trần Quang Minh', 'Trung tá', 'Trần Quang Minh', 'Phó trưởng phòng', 'Phòng chính trị', 'phong', '0911110033', 'minhtq@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB034', 34, 'Trung tá Lưu Hải Đăng', 'Trung tá', 'Lưu Hải Đăng', 'Phó trưởng phòng', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110034', 'danglh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB035', 35, 'Trung tá Vũ Thị Thu Hà', 'Trung tá', 'Vũ Thị Thu Hà', 'Phó trưởng phòng', 'Phòng ĐBCL đào tạo', 'phong', '0911110035', 'havtt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB036', 36, 'Trung tá Phan Minh Tuấn', 'Trung tá', 'Phan Minh Tuấn', 'Phó trưởng phòng', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110036', 'tuanpm@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB037', 37, 'Trung tá Nguyễn Thu Trang', 'Trung tá', 'Nguyễn Thu Trang', 'Phó trưởng phòng', 'Phòng quản lý học viên', 'phong', '0911110037', 'trangnt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB038', 38, 'Trung tá Đỗ Văn Bình', 'Trung tá', 'Đỗ Văn Bình', 'Phó trưởng phòng', 'Phòng hậu cần', 'phong', '0911110038', 'binhdv@hvktcnan.edu.vn', 'manager', 'active', NULL),

('CB039', 39, 'Thượng tá Nguyễn Đức Thành', 'Thượng tá', 'Nguyễn Đức Thành', 'Trưởng khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110039', 'thanhnd@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB040', 40, 'Trung tá Trần Thu Hương', 'Trung tá', 'Trần Thu Hương', 'Phó trưởng khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110040', 'huongtt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB041', 41, 'Đại úy Phạm Minh Hòa', 'Đại úy', 'Phạm Minh Hòa', 'Cán bộ khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110041', 'hoapm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB042', 42, 'Đại úy Lê Quốc Anh', 'Đại úy', 'Lê Quốc Anh', 'Cán bộ khoa', 'Khoa Lý luận chính trị và KHXHNV', 'khoa', '0911110042', 'anhlq@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB043', 43, 'Thượng tá Bùi Quang Vinh', 'Thượng tá', 'Bùi Quang Vinh', 'Trưởng khoa', 'Khoa Luật', 'khoa', '0911110043', 'vinhbq@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB044', 44, 'Trung tá Nguyễn Thị Minh', 'Trung tá', 'Nguyễn Thị Minh', 'Phó trưởng khoa', 'Khoa Luật', 'khoa', '0911110044', 'minhnt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB045', 45, 'Đại úy Đỗ Trọng Kiên', 'Đại úy', 'Đỗ Trọng Kiên', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110045', 'kiendt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB046', 46, 'Đại úy Phạm Quỳnh', 'Đại úy', 'Phạm Quỳnh', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110046', 'quynhp@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB047', 47, 'Thượng tá Lý Minh Sơn', 'Thượng tá', 'Lý Minh Sơn', 'Trưởng khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110047', 'sonlm@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB048', 48, 'Trung tá Hà Ngọc Hùng', 'Trung tá', 'Hà Ngọc Hùng', 'Phó trưởng khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110048', 'hunghn@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB049', 49, 'Đại úy Trần Bách', 'Đại úy', 'Trần Bách', 'Cán bộ khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110049', 'bacht@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB050', 50, 'Đại úy Nguyễn Diệu Mai', 'Đại úy', 'Nguyễn Diệu Mai', 'Cán bộ khoa', 'Khoa nghiệp vụ cơ bản', 'khoa', '0911110050', 'maind@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB051', 51, 'Thượng tá Trần Quốc Sơn', 'Thượng tá', 'Trần Quốc Sơn', 'Trưởng khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110051', 'sontq@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB052', 52, 'Trung tá Phạm Thị Tâm', 'Trung tá', 'Phạm Thị Tâm', 'Phó trưởng khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110052', 'tampt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB053', 53, 'Đại úy Hoàng Văn Tiến', 'Đại úy', 'Hoàng Văn Tiến', 'Cán bộ khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110053', 'tienhv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB054', 54, 'Đại úy Dương Công Vũ', 'Đại úy', 'Dương Công Vũ', 'Cán bộ khoa', 'Khoa khoa học cơ bản và ngoại ngữ', 'khoa', '0911110054', 'vudc@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB055', 55, 'Thượng tá Lê Hải Linh', 'Thượng tá', 'Lê Hải Linh', 'Trưởng khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110055', 'linhlh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB056', 56, 'Trung tá Nguyễn Minh Đức', 'Trung tá', 'Nguyễn Minh Đức', 'Phó trưởng khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110056', 'ducnm@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB057', 57, 'Đại úy Đỗ Thùy Nga', 'Đại úy', 'Đỗ Thùy Nga', 'Cán bộ khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110057', 'ngadt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB058', 58, 'Đại úy Quách Tuấn Mạnh', 'Đại úy', 'Quách Tuấn Mạnh', 'Cán bộ khoa', 'Khoa quân sự, võ thuật, TDTT', 'khoa', '0911110058', 'manhqt@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB059', 59, 'Thượng tá Phạm Văn Hiếu', 'Thượng tá', 'Phạm Văn Hiếu', 'Trưởng khoa', 'Khoa mật mã', 'khoa', '0911110059', 'hieupv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB060', 60, 'Trung tá Nguyễn Tùng Anh', 'Trung tá', 'Nguyễn Tùng Anh', 'Phó trưởng khoa', 'Khoa mật mã', 'khoa', '0911110060', 'anhnt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB061', 61, 'Đại úy Vũ Hải Phong', 'Đại úy', 'Vũ Hải Phong', 'Cán bộ khoa', 'Khoa mật mã', 'khoa', '0911110061', 'phongvh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB062', 62, 'Đại úy Lương Minh Nam', 'Đại úy', 'Lương Minh Nam', 'Cán bộ khoa', 'Khoa mật mã', 'khoa', '0911110062', 'namlm@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB063', 63, 'Thượng tá Trần Thùy Linh', 'Thượng tá', 'Trần Thùy Linh', 'Trưởng khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110063', 'linhtt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB064', 64, 'Trung tá Ngô Phương', 'Trung tá', 'Ngô Phương', 'Phó trưởng khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110064', 'phuongn@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB065', 65, 'Đại úy Phạm Đức Thắng', 'Đại úy', 'Phạm Đức Thắng', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110065', 'thangpd@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB066', 66, 'Đại úy Hoàng Vũ Hà', 'Đại úy', 'Hoàng Vũ Hà', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110066', 'havv@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB067', 67, 'Thượng tá Bùi Trọng Dương', 'Thượng tá', 'Bùi Trọng Dương', 'Trưởng khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110067', 'duongbt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB068', 68, 'Trung tá Nguyễn Thành Phúc', 'Trung tá', 'Nguyễn Thành Phúc', 'Phó trưởng khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110068', 'phucnt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB069', 69, 'Đại úy Hà Đức Thành', 'Đại úy', 'Hà Đức Thành', 'Cán bộ khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110069', 'thanhhd@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB070', 70, 'Đại úy Lê Minh Khánh', 'Đại úy', 'Lê Minh Khánh', 'Cán bộ khoa', 'Khoa Điện tử viễn thông và kỹ thuật nghiệp vụ', 'khoa', '0911110070', 'khanhlm@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB071', 71, 'Thượng tá Đinh Quang', 'Thượng tá', 'Đinh Quang', 'Trưởng khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110071', 'quangd@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB072', 72, 'Trung tá Trần Thị Hảo', 'Trung tá', 'Trần Thị Hảo', 'Phó trưởng khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110072', 'haott@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB073', 73, 'Đại úy Nguyễn Vũ Vinh', 'Đại úy', 'Nguyễn Vũ Vinh', 'Cán bộ khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110073', 'vinhnv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB074', 74, 'Đại úy Lê Hồng Giang', 'Đại úy', 'Lê Hồng Giang', 'Cán bộ khoa', 'Khoa Hồ sơ - Lưu trữ', 'khoa', '0911110074', 'gianglh@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB075', 75, 'Thượng tá Phạm Thu Nga', 'Thượng tá', 'Phạm Thu Nga', 'Trưởng khoa', 'Khoa Hậu cần', 'khoa', '0911110075', 'ngapt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB076', 76, 'Trung tá Bùi Thị Ngọc', 'Trung tá', 'Bùi Thị Ngọc', 'Phó trưởng khoa', 'Khoa Hậu cần', 'khoa', '0911110076', 'ngocbt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB077', 77, 'Đại úy Nguyễn Văn Đức', 'Đại úy', 'Nguyễn Văn Đức', 'Cán bộ khoa', 'Khoa Hậu cần', 'khoa', '0911110077', 'ducnv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB078', 78, 'Đại úy Trần Quốc Hiền', 'Đại úy', 'Trần Quốc Hiền', 'Cán bộ khoa', 'Khoa Hậu cần', 'khoa', '0911110078', 'hientq@hvktcnan.edu.vn', 'officer', 'active', NULL),

('CB079', 79, 'Thượng tá Lê Thanh Tuấn', 'Thượng tá', 'Lê Thanh Tuấn', 'Trưởng khoa', 'Khoa Y Dược', 'khoa', '0911110079', 'tuanlt@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB080', 80, 'Trung tá Nguyễn Hà Trang', 'Trung tá', 'Nguyễn Hà Trang', 'Phó trưởng khoa', 'Khoa Y Dược', 'khoa', '0911110080', 'trangnh@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB081', 81, 'Đại úy Dương Minh Ngọc', 'Đại úy', 'Dương Minh Ngọc', 'Cán bộ khoa', 'Khoa Y Dược', 'khoa', '0911110081', 'ngocdm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB082', 82, 'Đại úy Phạm Trí Minh', 'Đại úy', 'Phạm Trí Minh', 'Cán bộ khoa', 'Khoa Y Dược', 'khoa', '0911110082', 'minhpt@hvktcnan.edu.vn', 'officer', 'active', NULL);

INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB083', 85, 'Trung tá Lê Văn An', 'Trung tá', 'Lê Văn An', 'Trưởng đội', 'Đội lái xe', 'doi', '0911110083', 'anlv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB084', 86, 'Trung tá Nguyễn Văn Bình', 'Trung tá', 'Nguyễn Văn Bình', 'Phó đội', 'Đội lái xe', 'doi', '0911110084', 'binhnv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB085', 87, 'Trung tá Lê Văn Dũng', 'Trung tá', 'Lê Văn Dũng', 'Trưởng đội', 'Đội bệnh xá', 'doi', '0911110085', 'dunglv@hvktcnan.edu.vn', 'manager', 'active', NULL),
('CB086', 88, 'Thiếu tá Trần Thị Hạnh', 'Thiếu tá', 'Trần Thị Hạnh', 'Phó đội', 'Đội bệnh xá', 'doi', '0911110086', 'hantt@hvktcnan.edu.vn', 'manager', 'active', NULL);

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



-- Dong bo username theo email noi bo (vd: le van an -> anlv)
UPDATE users
SET username = LOWER(SUBSTRING_INDEX(email, '@', 1))
WHERE email IS NOT NULL
  AND email <> '';

-- Chuan hoa chuc vu: tat ca role can bo se de la "Cán bộ"
UPDATE officers
SET position = 'Cán bộ'
WHERE role = 'officer';

-- ============================================================
-- 1) DUTY SCHEDULE PERMISSIONS
--    Chỉ manager thuộc: Phòng hành chính tổng hợp, Đội lái xe, Đội bệnh xá
-- ============================================================
INSERT INTO duty_schedule_permissions (officerId, canManageDutySchedules, grantedByUserId)
SELECT o.id, 1, 1
FROM officers o
JOIN users u ON u.id = o.userId
WHERE u.role = 'manager'
  AND o.department IN ('Phòng hành chính tổng hợp', 'Đội lái xe', 'Đội bệnh xá')
ON DUPLICATE KEY UPDATE
  canManageDutySchedules = 1,
  grantedByUserId = VALUES(grantedByUserId),
  updatedAt = CURRENT_TIMESTAMP;

-- ============================================================
-- 2) WORK SCHEDULE PERMISSIONS
--    canCreate  : admin + manager (tất cả)
--    canApprove : chỉ admin
-- ============================================================
INSERT INTO work_schedule_permissions (officerId, canCreateWorkSchedules, canApproveWorkSchedules, grantedByUserId)
SELECT o.id,
  1 AS canCreateWorkSchedules,
  CASE WHEN u.role = 'admin' THEN 1 ELSE 0 END AS canApproveWorkSchedules,
  1
FROM officers o
JOIN users u ON u.id = o.userId
WHERE u.role IN ('admin', 'manager')
ON DUPLICATE KEY UPDATE
  canCreateWorkSchedules  = VALUES(canCreateWorkSchedules),
  canApproveWorkSchedules = VALUES(canApproveWorkSchedules),
  grantedByUserId         = VALUES(grantedByUserId),
  updatedAt               = CURRENT_TIMESTAMP;

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
  WHEN 'Đội lái xe' THEN 'CB083'
  WHEN 'Đội bệnh xá' THEN 'CB085'
  ELSE headOfficerId
END
WHERE departmentType IN ('khoa', 'doi');

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
(1, 'thaolm', 'admin', 'lichcongtac', 'create', 'work_schedule', 'LCT001', 'Tạo Lịch sự kiện LCT001', JSON_OBJECT('note', 'Khởi tạo lịch')),
(7, 'huypq', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT002', 'Tạo Lịch sự kiện LCT002', JSON_OBJECT('note', 'Khởi tạo lịch')),
(8, 'duchm', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT003', 'Tạo Lịch sự kiện LCT003', JSON_OBJECT('note', 'Khởi tạo lịch')),
(2, 'cannv', 'admin', 'lichcongtac', 'update', 'work_schedule', 'LCT004', 'Cập nhật Lịch sự kiện LCT004', JSON_OBJECT('note', 'Điều chỉnh lịch')),
(1, 'thaolm', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBGD015', 'Cập nhật lịch trực ban tuần 15', JSON_OBJECT('note', 'Điều chỉnh lịch')),
(1, 'thaolm', 'admin', 'lichtrucban', 'update', 'duty_schedule', 'TBCB109', 'Cập nhật lịch trực ban TBCB109', NULL),
(1, 'thaolm', 'admin', 'lichtrucban', 'create', 'duty_schedule', 'TBCB111,TBCB112,TBCB113,TBCB114,TBCB115,TBCB116,TB', 'Tự động xếp officer_daily (25 lịch)', NULL),
(1, 'thaolm', 'admin', 'lichtrucban', 'create', 'duty_schedule', 'TBCB136,TBCB137,TBCB138,TBCB139,TBCB140,TBCB141,TB', 'Tự động xếp officer_daily (35 lịch)', NULL),
(12, 'longvt', 'officer', 'lichcongtac', 'create', 'work_schedule', 'LCT006', 'Thêm mới Lịch sự kiện LCT006 - a', NULL),
(5, 'sontv', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT006', 'Duyệt Lịch sự kiện LCT006', NULL),
(5, 'sontv', 'manager', 'lichcongtac', 'create', 'work_schedule', 'LCT007', 'Thêm mới Lịch sự kiện LCT007 - a', NULL),
(5, 'sontv', 'manager', 'lichcongtac', 'approve', 'work_schedule', 'LCT007', 'Duyệt Lịch sự kiện LCT007', NULL);

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
('Có Lịch sự kiện chờ duyệt', 'a (2026-04-02)', 'warning', 'lichcongtac', 'work_schedule', 'LCT006', NULL, 'admin', 1),
('Lịch sự kiện đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT006', 12, NULL, 1),
('Lịch sự kiện đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT006', 17, NULL, 1),
('Có Lịch sự kiện chờ duyệt', 'a (2026-04-02)', 'warning', 'lichcongtac', 'work_schedule', 'LCT007', NULL, 'admin', 1),
('Lịch sự kiện đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT007', 5, NULL, 1),
('Lịch sự kiện đã được duyệt', 'a (2026-04-02)', 'success', 'lichcongtac', 'work_schedule', 'LCT007', 19, NULL, 1);

-- ========== ADDITIONAL USERS FOR NEW OFFICERS ==========
INSERT INTO users (username, passwordHash, fullName, email, role, avatar, status) VALUES
('huynm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Minh Huy', 'huynm@hvktcnan.edu.vn', 'officer', 'NH', 'active'),
('tiendt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Đỗ Thành Tiến', 'tiendt@hvktcnan.edu.vn', 'officer', 'DT', 'active'),
('anhtt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Trần Thanh Anh', 'anhtt@hvktcnan.edu.vn', 'officer', 'TA', 'active'),
('trongnv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Văn Trọng', 'trongnv@hvktcnan.edu.vn', 'officer', 'NV', 'active'),
('minhlh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Hữu Minh', 'minhlh@hvktcnan.edu.vn', 'officer', 'LM', 'active'),
('dung0', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Dương Văn Dũng', 'dung0@hvktcnan.edu.vn', 'officer', 'DV', 'active'),
('hoanh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Hoàng Quốc Hoan', 'hoanh@hvktcnan.edu.vn', 'officer', 'HH', 'active'),
('hangtt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Tạ Thị Hằng', 'hangtt@hvktcnan.edu.vn', 'officer', 'TH', 'active'),
('thuannv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Nguyễn Văn Thuận', 'thuannv@hvktcnan.edu.vn', 'officer', 'NV', 'active'),
('linkn', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Kiều Nữ Linh', 'linkn@hvktcnan.edu.vn', 'officer', 'KN', 'active'),
('phongpv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Văn Phong', 'phongpv@hvktcnan.edu.vn', 'officer', 'PV', 'active'),
('tuongnm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Nguyễn Minh Tường', 'tuongnm@hvktcnan.edu.vn', 'officer', 'NM', 'active'),
('vanhq', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Hà Quốc Vân', 'vanhq@hvktcnan.edu.vn', 'officer', 'HQ', 'active'),
('huonglm', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Minh Hương', 'huonglm@hvktcnan.edu.vn', 'officer', 'LH', 'active'),
('phanmn', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Phạm Minh Nhật', 'phanmn@hvktcnan.edu.vn', 'officer', 'PM', 'active'),
('duonglh', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Đại úy Lê Hồng Dương', 'duonglh@hvktcnan.edu.vn', 'officer', 'LH', 'active'),
('vaongb', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Ngô Bá Vân', 'vaongb@hvktcnan.edu.vn', 'officer', 'NV', 'active'),
('thiepv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Thượng úy Phạm Văn Thiệp', 'thiepv@hvktcnan.edu.vn', 'officer', 'PV', 'active'),
('tunglv', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Lê Văn Tùng', 'tunglv@hvktcnan.edu.vn', 'officer', 'LV', 'active'),
('thanhnt', '$2a$10$L5HCYjV52HxB2ZYQe4UR3O.IAxNqis9rcghnE1wazFvRFjI0FUdHm', 'Trung úy Nguyễn Thạch Thanh', 'thanhnt@hvktcnan.edu.vn', 'officer', 'NT', 'active');

-- ========== ADDITIONAL OFFICERS ==========
INSERT INTO officers (id, userId, fullName, officerTitle, officerName, position, department, departmentGroup, phone, email, role, status, studyUntil) VALUES
('CB087', 89, 'Đại úy Nguyễn Minh Huy', 'Đại úy', 'Nguyễn Minh Huy', 'Cán bộ', 'Phòng hành chính tổng hợp', 'phong', '0911110087', 'huynm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB088', 90, 'Đại úy Đỗ Thành Tiến', 'Đại úy', 'Đỗ Thành Tiến', 'Cán bộ', 'Phòng hành chính tổng hợp', 'phong', '0911110088', 'tiendt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB089', 91, 'Đại úy Trần Thanh Anh', 'Đại úy', 'Trần Thanh Anh', 'Cán bộ', 'Phòng chính trị', 'phong', '0911110089', 'anhtt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB090', 92, 'Đại úy Nguyễn Văn Trọng', 'Đại úy', 'Nguyễn Văn Trọng', 'Cán bộ', 'Phòng chính trị', 'phong', '0911110090', 'trongnv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB091', 93, 'Đại úy Lê Hữu Minh', 'Đại úy', 'Lê Hữu Minh', 'Cán bộ', 'Phòng quản lý đào tạo và BDNC', 'phong', '0911110091', 'minhlh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB092', 94, 'Thượng úy Dương Văn Dũng', 'Thượng úy', 'Dương Văn Dũng', 'Cán bộ', 'Phòng ĐBCL đào tạo', 'phong', '0911110092', 'dung0@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB093', 95, 'Thượng úy Hoàng Quốc Hoan', 'Thượng úy', 'Hoàng Quốc Hoan', 'Cán bộ', 'Phòng ĐBCL đào tạo', 'phong', '0911110093', 'hoanh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB094', 96, 'Thượng úy Tạ Thị Hằng', 'Thượng úy', 'Tạ Thị Hằng', 'Cán bộ', 'Phòng quản lý nghiên cứu khoa học', 'phong', '0911110094', 'hangtt@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB095', 97, 'Trung úy Nguyễn Văn Thuận', 'Trung úy', 'Nguyễn Văn Thuận', 'Cán bộ', 'Phòng quản lý học viên', 'phong', '0911110095', 'thuannv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB096', 98, 'Trung úy Kiều Nữ Linh', 'Trung úy', 'Kiều Nữ Linh', 'Cán bộ', 'Phòng hậu cần', 'phong', '0911110096', 'linkn@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB097', 99, 'Đại úy Phạm Văn Phong', 'Đại úy', 'Phạm Văn Phong', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110097', 'phongpv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB098', 100, 'Đại úy Nguyễn Minh Tường', 'Đại úy', 'Nguyễn Minh Tường', 'Cán bộ khoa', 'Khoa Công nghệ và ATTT', 'khoa', '0911110098', 'tuongnm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB099', 101, 'Đại úy Hà Quốc Vân', 'Đại úy', 'Hà Quốc Vân', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110099', 'vanhq@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB100', 102, 'Đại úy Lê Minh Hương', 'Đại úy', 'Lê Minh Hương', 'Cán bộ khoa', 'Khoa Luật', 'khoa', '0911110100', 'huonglm@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB101', 103, 'Đại úy Phạm Minh Nhật', 'Đại úy', 'Phạm Minh Nhật', 'Cán bộ khoa', 'Khoa Hậu cần', 'khoa', '0911110101', 'phanmn@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB102', 104, 'Đại úy Lê Hồng Dương', 'Đại úy', 'Lê Hồng Dương', 'Cán bộ khoa', 'Khoa Y Dược', 'khoa', '0911110102', 'duonglh@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB103', 105, 'Thượng úy Ngô Bá Vân', 'Thượng úy', 'Ngô Bá Vân', 'Cán bộ', 'Đội lái xe', 'doi', '0911110103', 'vaongb@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB104', 106, 'Thượng úy Phạm Văn Thiệp', 'Thượng úy', 'Phạm Văn Thiệp', 'Cán bộ', 'Đội lái xe', 'doi', '0911110104', 'thiepv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB105', 107, 'Trung úy Lê Văn Tùng', 'Trung úy', 'Lê Văn Tùng', 'Cán bộ', 'Đội bệnh xá', 'doi', '0911110105', 'tunglv@hvktcnan.edu.vn', 'officer', 'active', NULL),
('CB106', 108, 'Trung úy Nguyễn Thạch Thanh', 'Trung úy', 'Nguyễn Thạch Thanh', 'Cán bộ', 'Đội bệnh xá', 'doi', '0911110106', 'thanhnt@hvktcnan.edu.vn', 'officer', 'active', NULL);

-- ========== EXTENDED WORK SCHEDULES (May-June 2026) ==========
INSERT INTO work_schedules (
  id, title, date, startTime, endTime, location, department, type, weekNo, notes,
  responsibleOfficerId,
  createdByUserId,
  createdByOfficerId
) VALUES
('LCT008', 'Giao ban Ban Giám đốc tuần 2', '2026-04-20', '08:00', '09:30', 'Phòng họp A', 'Ban Giám đốc', 'hop', 16, 'Họp giao ban định kỳ', 'CB001', 1, 'CB001'),
('LCT009', 'Họp triển khai công tác đào tạo tuần 2', '2026-04-21', '14:00', '16:00', 'Phòng họp B', 'Phòng quản lý đào tạo và BDNC', 'hop', 16, 'Triển khai kế hoạch tháng 4 tuần 2', 'CB007', 7, 'CB007'),
('LCT010', 'Khảo sát chất lượng đào tạo', '2026-04-27', '09:00', '11:00', 'Khoa Công nghệ và ATTT', 'Phòng ĐBCL đào tạo', 'khaoSat', 17, 'Đánh giá nội bộ tuần thứ 3', 'CB008', 8, 'CB008'),
('LCT011', 'Hội thảo nghiên cứu khoa học', '2026-05-04', '08:30', '11:30', 'Hội trường lớn', 'Phòng quản lý nghiên cứu khoa học', 'hoiThao', 18, 'Báo cáo đề tài cấp học viện', 'CB009', 9, 'CB009'),
('LCT012', 'Lớp bồi dưỡng chuyên môn tháng 5', '2026-05-11', '13:30', '16:30', 'Phòng học C3', 'Khoa Luật', 'baoCao', 19, 'Cập nhật luật pháp mới', 'CB013', 13, 'CB013'),
('LCT013', 'Thăm viếng cơ sở đào tạo', '2026-05-18', '10:00', '12:00', 'Khoa Hậu cần', 'Ban Giám đốc', 'khaoSat', 20, 'Kiểm tra cơ sở vật chất', 'CB002', 2, 'CB002'),
('LCT014', 'Họp quy hoạch kế hoạch 2027', '2026-05-25', '08:00', '11:00', 'Phòng họp A', 'Ban Giám đốc', 'hop', 21, 'Lập kế hoạch năm tới', 'CB001', 1, 'CB001'),
('LCT015', 'Kiểm tra công tác hành chính', '2026-06-01', '09:00', '11:00', 'Phòng hành chính tổng hợp', 'Phòng hành chính tổng hợp', 'khaoSat', 22, 'Kiểm tra công tác hành chính', 'CB005', 5, 'CB005'),
('LCT016', 'Hội thảo kế hoạch đào tạo 2027', '2026-06-08', '14:00', '16:00', 'Hội trường lớn', 'Phòng quản lý đào tạo và BDNC', 'hoiThao', 23, 'Lập kế hoạch đào tạo năm 2027', 'CB007', 7, 'CB007'),
('LCT017', 'Họp đánh giá hoạt động tháng 6', '2026-06-15', '10:00', '12:00', 'Phòng họp A', 'Ban Giám đốc', 'hop', 24, 'Đánh giá hoạt động tháng 6', 'CB001', 1, 'CB001'),
('LCT018', 'Tổng kết công tác nửa năm', '2026-06-22', '08:00', '11:00', 'Hội trường lớn', 'Ban Giám đốc', 'baoCao', 25, 'Tổng kết hoạt động nửa năm', 'CB001', 1, 'CB001'),
('LCT019', 'Hội nghị lập kế hoạch Q3', '2026-06-29', '14:00', '16:00', 'Phòng họp A', 'Ban Giám đốc', 'hop', 26, 'Lập kế hoạch quý III', 'CB002', 2, 'CB002');

-- ========== EXTENDED DUTY SCHEDULES (May-June 2026) ==========
INSERT INTO duty_schedules (id, officerId, dutyType, date, endDate, weekStartDate, shift, startTime, endTime, location, dutyRole, slotNo, assignmentGroup, notes) VALUES
('TBGD020', 'CB001', 'director_weekly', '2026-05-04', '2026-05-10', '2026-05-04', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 18'),
('TBGD021', 'CB001', 'director_weekly', '2026-05-11', '2026-05-17', '2026-05-11', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 19'),
('TBGD022', 'CB001', 'director_weekly', '2026-05-18', '2026-05-24', '2026-05-18', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 20'),
('TBGD023', 'CB001', 'director_weekly', '2026-05-25', '2026-05-31', '2026-05-25', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 21'),
('TBGD024', 'CB001', 'director_weekly', '2026-06-01', '2026-06-07', '2026-06-01', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 22'),
('TBGD025', 'CB001', 'director_weekly', '2026-06-08', '2026-06-14', '2026-06-08', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 23'),
('TBGD026', 'CB001', 'director_weekly', '2026-06-15', '2026-06-21', '2026-06-15', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 24'),
('TBGD027', 'CB001', 'director_weekly', '2026-06-22', '2026-06-28', '2026-06-22', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 25'),
('TBGD028', 'CB001', 'director_weekly', '2026-06-29', '2026-06-30', '2026-06-29', 'tuan', '00:00', '23:59', 'Trực ban Giám đốc', 'commander', 1, NULL, 'Tuần 26');

-- ========== EXPORT LOGS ==========
INSERT INTO export_logs (userId, username, role, exportType, exportScope, exportFormat, itemCount) VALUES
(1, 'thaolm', 'admin', 'congtac', 'week', 'pdf', 5),
(2, 'cannv', 'admin', 'both', 'week', 'pdf', 12),
(7, 'huypq', 'manager', 'congtac', 'week', 'pdf', 3),
(1, 'thaolm', 'admin', 'trucban', 'week', 'pdf', 36),
(1, 'thaolm', 'admin', 'both', 'week', 'pdf', 41),
(5, 'sontv', 'manager', 'trucban', 'week', 'pdf', 36),
(5, 'sontv', 'manager', 'trucban', 'week', 'pdf', 36);



-- Verify tables were created
SELECT 'Database initialized successfully (seeded, except leave_requests/notification_reads)!' AS status;
