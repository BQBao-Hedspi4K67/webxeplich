-- Migration script to fix username format
-- Format: lastname + initials (e.g., "Le Minh Thao" -> "thaolm")
-- Run this script against the database to update all usernames

-- First, let's see current usernames and their full names
SELECT id, username, fullName FROM users ORDER BY id;

-- Update usernames based on fullName pattern
-- Admin users (id 1-4)
UPDATE users SET username = 'thaolm' WHERE id = 1 AND fullName LIKE '%Lê Minh Thảo%';
UPDATE users SET username = 'cannv' WHERE id = 2 AND fullName LIKE '%Nguyễn Văn Căn%';
UPDATE users SET username = 'cuongnm' WHERE id = 3 AND fullName LIKE '%Nguyễn Mạnh Cường%';
UPDATE users SET username = 'hangptt' WHERE id = 4 AND fullName LIKE '%Phạm Thị Thúy Hằng%';

-- Manager users (id 5-11)
UPDATE users SET username = 'sontv' WHERE id = 5 AND fullName LIKE '%Trần Văn Sơn%';
UPDATE users SET username = 'mailt' WHERE id = 6 AND fullName LIKE '%Lê Thị Mai%';
UPDATE users SET username = 'huypq' WHERE id = 7 AND fullName LIKE '%Phạm Quang Huy%';
UPDATE users SET username = 'duchm' WHERE id = 8 AND fullName LIKE '%Hoàng Minh Đức%';
UPDATE users SET username = 'lannt' WHERE id = 9 AND fullName LIKE '%Nguyễn Thị Lan%';
UPDATE users SET username = 'nambv' WHERE id = 10 AND fullName LIKE '%Bùi Văn Nam%';
UPDATE users SET username = 'huongdt' WHERE id = 11 AND fullName LIKE '%Đặng Thị Hương%';

-- Officer users (id 12-31)
UPDATE users SET username = 'longvt' WHERE id = 12 AND fullName LIKE '%Võ Thanh Long%';
UPDATE users SET username = 'anhtd' WHERE id = 13 AND fullName LIKE '%Trần Đức Anh%';
UPDATE users SET username = 'baong' WHERE id = 14 AND fullName LIKE '%Nguyễn Gia Bảo%';
UPDATE users SET username = 'kietlt' WHERE id = 15 AND fullName LIKE '%Lê Tuấn Kiệt%';
UPDATE users SET username = 'datph' WHERE id = 16 AND fullName LIKE '%Phạm Hữu Đạt%';
UPDATE users SET username = 'nambh' WHERE id = 17 AND fullName LIKE '%Bùi Hải Nam%';
UPDATE users SET username = 'tuanhv' WHERE id = 18 AND fullName LIKE '%Hoàng Văn Tuấn%';
UPDATE users SET username = 'quandm' WHERE id = 19 AND fullName LIKE '%Đỗ Minh Quân%';
UPDATE users SET username = 'vuta' WHERE id = 20 AND fullName LIKE '%Trương Anh Vũ%';
UPDATE users SET username = 'yennt' WHERE id = 21 AND fullName LIKE '%Nguyễn Thị Yến%';
UPDATE users SET username = 'hadn' WHERE id = 22 AND fullName LIKE '%Đặng Ngọc Hà%';
UPDATE users SET username = 'binhnq' WHERE id = 23 AND fullName LIKE '%Nguyễn Quốc Bình%';
UPDATE users SET username = 'chitm' WHERE id = 24 AND fullName LIKE '%Trần Mai Chi%';
UPDATE users SET username = 'namlh' WHERE id = 25 AND fullName LIKE '%Lê Hoàng Nam%';

-- Driver team (id 26-28)
UPDATE users SET username = 'hungpq' WHERE id = 26 AND fullName LIKE '%Phạm Quốc Hùng%';
UPDATE users SET username = 'tamlv' WHERE id = 27 AND fullName LIKE '%Lê Văn Tâm%';
UPDATE users SET username = 'phucnm' WHERE id = 28 AND fullName LIKE '%Nguyễn Minh Phúc%';

-- Medic team (id 29-31)
UPDATE users SET username = 'khoanv' WHERE id = 29 AND fullName LIKE '%Nguyễn Văn Khoa%';
UPDATE users SET username = 'viettq' WHERE id = 30 AND fullName LIKE '%Trần Quốc Việt%';
UPDATE users SET username = 'hanhlt' WHERE id = 31 AND fullName LIKE '%Lê Thị Hạnh%';

-- Additional manager users (id 32-38)
UPDATE users SET username = 'huy nd' WHERE id = 32 AND fullName LIKE '%Nguyễn Đức Huy%';
UPDATE users SET username = 'minhtq' WHERE id = 33 AND fullName LIKE '%Trần Quang Minh%';
UPDATE users SET username = 'danglh' WHERE id = 34 AND fullName LIKE '%Lưu Hải Đăng%';
UPDATE users SET username = 'havt' WHERE id = 35 AND fullName LIKE '%Vũ Thị Thu Hà%';
UPDATE users SET username = 'tuanpm' WHERE id = 36 AND fullName LIKE '%Phan Minh Tuấn%';
UPDATE users SET username = 'trangnt' WHERE id = 37 AND fullName LIKE '%Nguyễn Thu Trang%';
UPDATE users SET username = 'binhdv' WHERE id = 38 AND fullName LIKE '%Đỗ Văn Bình%';

-- More users (id 39-50)
UPDATE users SET username = 'thanhtnd' WHERE id = 39 AND fullName LIKE '%Nguyễn Đức Thành%';
UPDATE users SET username = 'huongtt' WHERE id = 40 AND fullName LIKE '%Trần Thu Hương%';
UPDATE users SET username = 'hoapm' WHERE id = 41 AND fullName LIKE '%Phạm Minh Hòa%';
UPDATE users SET username = 'anh lq' WHERE id = 42 AND fullName LIKE '%Lê Quốc Anh%';

-- Verify the updates
SELECT id, username, fullName FROM users ORDER BY id;