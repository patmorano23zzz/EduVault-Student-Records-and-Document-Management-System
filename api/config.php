<?php

declare(strict_types=1);

// Local XAMPP defaults. For InfinityFree/Hostinger, copy this file to
// config.local.php and replace all four DB values with the control-panel
// values. Never upload this file with production credentials.
const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'abes_db';
const DB_USER = 'root';
const DB_PASS = '';
const STORAGE_ROOT = __DIR__ . '/../storage';
const APP_BASE_URL = 'https://abes-eduvault.com';
const SMTP_HOST = 'smtp.hostinger.com';
const SMTP_PORT = '465';
const SMTP_USER = 'atel-batang@abes-eduvault.com';
const SMTP_PASS = '';
const SMTP_SECURE = 'ssl';
const SMTP_FROM_EMAIL = 'atel-batang@abes-eduvault.com';
const SMTP_FROM_NAME = 'EduVault';
