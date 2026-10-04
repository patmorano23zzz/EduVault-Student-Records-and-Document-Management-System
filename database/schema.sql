-- Hostinger/InfinityFree MySQL schema.
-- Import this file into the database created in the hosting control panel.
-- This schema seeds the initial admin with a PHP password_hash() hash.

CREATE TABLE profiles (
  id CHAR(32) PRIMARY KEY,
  staff_id VARCHAR(64) UNIQUE,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  role ENUM('admin', 'teacher') NOT NULL DEFAULT 'teacher',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  auth_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_recovery_settings (
  admin_id CHAR(32) PRIMARY KEY,
  recovery_email VARCHAR(190),
  verified_at DATETIME,
  pending_email VARCHAR(190),
  verification_token_hash CHAR(64),
  verification_expires_at DATETIME,
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  id CHAR(32) PRIMARY KEY,
  profile_id CHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX password_reset_profile_created_idx (profile_id, created_at),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  id CHAR(32) PRIMARY KEY,
  lrn VARCHAR(64) UNIQUE NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  birth_date DATE,
  sex ENUM('M', 'F'),
  grade_level VARCHAR(32) NOT NULL,
  section VARCHAR(100),
  guardian_name VARCHAR(190),
  status ENUM('enrolled', 'transferred', 'graduated', 'dropped') NOT NULL DEFAULT 'enrolled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(190) NOT NULL,
  description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE documents (
  id CHAR(32) PRIMARY KEY,
  student_id CHAR(32) NOT NULL,
  type_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  school_year VARCHAR(32),
  grade_level VARCHAR(32),
  storage_path VARCHAR(255) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT UNSIGNED,
  uploaded_by CHAR(32),
  is_classified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX documents_student_idx (student_id),
  INDEX documents_type_idx (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teacher_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id CHAR(32) NOT NULL,
  grade_level VARCHAR(32) NOT NULL,
  section VARCHAR(100),
  UNIQUE KEY teacher_assignment_unique (teacher_id, grade_level, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE access_requests (
  id CHAR(32) PRIMARY KEY,
  reference_code VARCHAR(32) UNIQUE NOT NULL,
  requester_id CHAR(32),
  requester_name VARCHAR(190) NOT NULL,
  relationship VARCHAR(100),
  contact VARCHAR(190),
  student_id CHAR(32),
  student_lrn VARCHAR(64),
  student_last_name VARCHAR(100),
  document_type_id INT UNSIGNED,
  purpose TEXT,
  status ENUM('pending', 'approved', 'denied', 'released', 'cancelled') NOT NULL DEFAULT 'pending',
  source ENUM('web', 'teacher') NOT NULL DEFAULT 'web',
  decided_by CHAR(32),
  decided_at DATETIME,
  release_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX requests_status_idx (status),
  INDEX requests_reference_idx (reference_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id CHAR(32),
  action VARCHAR(32) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id CHAR(32),
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_created_idx (created_at),
  INDEX audit_actor_idx (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial administrator. The password is stored as a PHP password_hash() hash.
-- Login staff ID: ADM-001
INSERT INTO profiles (
  id,
  staff_id,
  email,
  password_hash,
  full_name,
  role,
  is_active
) VALUES (
  '6cf458a1b80d4e88a9202772f00c0001',
  'ADM-001',
  'admin@abes.page.gd',
  '$2y$10$QfCxVTyo31/Y1DRrMP.glOGJr3KJB2pEFIALcrdeD6NEU1YrsTybW',
  'System Administrator',
  'admin',
  1
);

INSERT INTO document_types (code, name, description) VALUES
  ('SF10', 'School Form 10 (Form 137)', 'Permanent record'),
  ('SF9', 'School Form 9 (Form 138)', 'Report card'),
  ('COE', 'Certificate of Enrollment', 'Proof of current enrollment'),
  ('COG', 'Certificate of Graduation', 'Proof of graduation'),
  ('PSA_BC', 'PSA Birth Certificate', 'Birth certificate'),
  ('GM', 'General Average / Moving Up Certificate', 'End-of-year certification'),
  ('GOOD', 'Certificate of Good Moral', 'Character reference'),
  ('CARD', 'Learner''s ID', 'School-issued identification'),
  ('MED', 'Medical / Health Records', 'Health records'),
  ('OTHER', 'Other Document', 'Miscellaneous document');
