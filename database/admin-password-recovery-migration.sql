-- Run once in phpMyAdmin for databases created before email recovery was added.
-- Select the project's database before importing this migration.

ALTER TABLE profiles
  ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS admin_recovery_settings (
  admin_id CHAR(32) PRIMARY KEY,
  recovery_email VARCHAR(190),
  verified_at DATETIME,
  pending_email VARCHAR(190),
  verification_token_hash CHAR(64),
  verification_expires_at DATETIME,
  FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(32) PRIMARY KEY,
  profile_id CHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX password_reset_profile_created_idx (profile_id, created_at),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
