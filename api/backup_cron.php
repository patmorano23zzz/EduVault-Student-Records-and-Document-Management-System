<?php
declare(strict_types=1);

if(PHP_SAPI!=='cli') {
  http_response_code(404);
  exit;
}

if(is_file(__DIR__.'/config.local.php')) require_once __DIR__.'/config.local.php';
else require_once __DIR__.'/config.php';
require_once __DIR__.'/backup.php';

date_default_timezone_set('Asia/Manila');
$pdo=new PDO(
  'mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4',
  DB_USER,
  DB_PASS,
  [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC],
);

$lockAcquired=(int)$pdo->query("SELECT GET_LOCK('eduvault_backup_schedule',0)")->fetchColumn()===1;
if(!$lockAcquired) {
  fwrite(STDOUT,"Backup scheduler is already running.\n");
  exit(0);
}

try {
  $schedule=$pdo->query('SELECT * FROM backup_schedule WHERE id=1')->fetch();
  if(!$schedule || !(int)$schedule['enabled'] || !$schedule['next_run_at']) {
    fwrite(STDOUT,"No enabled backup schedule.\n");
    exit(0);
  }
  $timezone=new DateTimeZone('Asia/Manila');
  $now=new DateTimeImmutable('now',$timezone);
  $dueAt=new DateTimeImmutable($schedule['next_run_at'],$timezone);
  if($dueAt>$now) {
    fwrite(STDOUT,"Backup is not due yet.\n");
    exit(0);
  }

  $nextRun=backupNextRun($schedule['frequency'],$schedule['run_time'],(int)$schedule['day_of_week'],(int)$schedule['day_of_month'],$now);
  $destination=STORAGE_ROOT.'/backups/latest.zip';
  createBackupArchive($pdo,$destination);
  $pdo->prepare('UPDATE backup_schedule SET next_run_at=?,last_run_at=?,last_file=?,last_error=NULL WHERE id=1')
    ->execute([$nextRun->format('Y-m-d H:i:s'),$now->format('Y-m-d H:i:s'),'backups/latest.zip']);
  fwrite(STDOUT,"Scheduled backup completed.\n");
} catch(Throwable $error) {
  try {
    $retryAt=(new DateTimeImmutable('now',new DateTimeZone('Asia/Manila')))->modify('+5 minutes');
    $pdo->prepare('UPDATE backup_schedule SET next_run_at=?,last_error=? WHERE id=1')
      ->execute([$retryAt->format('Y-m-d H:i:s'),substr($error->getMessage(),0,500)]);
  } catch(Throwable $stateError) {
    error_log('Could not record backup scheduler error: '.$stateError->getMessage());
  }
  error_log('Scheduled backup failed: '.$error->getMessage());
  fwrite(STDERR,'Scheduled backup failed: '.$error->getMessage()."\n");
  exit(1);
} finally {
  $pdo->query("SELECT RELEASE_LOCK('eduvault_backup_schedule')");
}
