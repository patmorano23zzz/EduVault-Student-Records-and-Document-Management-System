-- Run once in phpMyAdmin for an existing EduVault database.
-- Select the project's database before importing this migration.

CREATE TABLE IF NOT EXISTS backup_schedule (
  id TINYINT UNSIGNED PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  frequency ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'weekly',
  run_time TIME NOT NULL DEFAULT '02:00:00',
  day_of_week TINYINT UNSIGNED NOT NULL DEFAULT 1,
  day_of_month TINYINT UNSIGNED NOT NULL DEFAULT 1,
  next_run_at DATETIME,
  last_run_at DATETIME,
  last_file VARCHAR(255),
  last_error VARCHAR(500),
  updated_by CHAR(32),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO backup_schedule (id) VALUES (1);
