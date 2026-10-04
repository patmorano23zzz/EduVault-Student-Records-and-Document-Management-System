<?php
declare(strict_types=1);

function backupNextRun(string $frequency, string $runTime, int $dayOfWeek, int $dayOfMonth, ?DateTimeImmutable $after = null): DateTimeImmutable {
  $timezone=new DateTimeZone('Asia/Manila');
  $after=($after ?? new DateTimeImmutable('now',$timezone))->setTimezone($timezone);
  $time=DateTimeImmutable::createFromFormat('!H:i:s',$runTime,$timezone);
  if(!$time) throw new RuntimeException('Invalid backup time');
  $hour=(int)$time->format('H');
  $minute=(int)$time->format('i');
  $candidate=$after->setTime($hour,$minute,0);

  if($frequency==='daily') {
    if($candidate<=$after) $candidate=$candidate->modify('+1 day');
    return $candidate;
  }
  if($frequency==='weekly') {
    if($dayOfWeek<1 || $dayOfWeek>7) throw new RuntimeException('Invalid backup weekday');
    $days=($dayOfWeek-(int)$candidate->format('N')+7)%7;
    $candidate=$candidate->modify("+{$days} days");
    if($candidate<=$after) $candidate=$candidate->modify('+7 days');
    return $candidate;
  }
  if($frequency==='monthly') {
    if($dayOfMonth<1 || $dayOfMonth>31) throw new RuntimeException('Invalid backup day of month');
    $candidate=$candidate->setDate((int)$candidate->format('Y'),(int)$candidate->format('n'),min($dayOfMonth,(int)$candidate->format('t')));
    if($candidate<=$after) {
      $nextMonth=$after->modify('first day of next month');
      $candidate=$nextMonth->setTime($hour,$minute)->setDate((int)$nextMonth->format('Y'),(int)$nextMonth->format('n'),min($dayOfMonth,(int)$nextMonth->format('t')));
    }
    return $candidate;
  }
  throw new RuntimeException('Unsupported backup frequency');
}

function createBackupArchive(PDO $pdo, string $destination): void {
  if(!class_exists(ZipArchive::class)) throw new RuntimeException('ZIP backups are unavailable because the PHP Zip extension is disabled');
  $directory=dirname($destination);
  if(!is_dir($directory) && !mkdir($directory,0700,true) && !is_dir($directory)) throw new RuntimeException('Could not create backup directory');
  $temporary=tempnam($directory,'backup_');
  if($temporary===false) throw new RuntimeException('Could not allocate a temporary backup file');

  try {
    $zip=new ZipArchive();
    if($zip->open($temporary,ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true) throw new RuntimeException('Could not create backup archive');
    $rows=$pdo->query('SELECT d.*,dt.code document_type_code,dt.name document_type_name,s.lrn student_lrn,s.last_name student_last_name,s.first_name student_first_name FROM documents d LEFT JOIN document_types dt ON dt.id=d.type_id LEFT JOIN students s ON s.id=d.student_id ORDER BY d.created_at DESC')->fetchAll();
    $manifest=[];
    foreach($rows as $row) {
      $relativePath=trim(str_replace('\\','/',(string)$row['storage_path']),'/');
      if($relativePath==='' || str_contains($relativePath,'..') || !preg_match('#^[A-Za-z0-9._/-]+$#',$relativePath)) continue;
      $file=realpath(STORAGE_ROOT.'/'.$relativePath);
      $root=realpath(STORAGE_ROOT);
      if(!$file || !$root || !str_starts_with($file,$root.DIRECTORY_SEPARATOR) || !is_file($file)) continue;
      $clean=static fn(string $value): string => trim(preg_replace('/[^A-Za-z0-9._-]+/','_',$value),'._-') ?: 'unknown';
      $year=$clean((string)($row['school_year'] ?: 'unspecified'));
      $type=$clean((string)($row['document_type_code'] ?: 'OTHER'));
      $student=$clean(($row['student_last_name'] ?: 'unknown').'_'.($row['student_first_name'] ?: 'student').'_'.$row['student_lrn']);
      $name=$clean((string)$row['file_name']);
      $zipPath='documents/'.$year.'/'.$type.'/'.$student.'/'.$row['id'].'_'.$name;
      if(!$zip->addFile($file,$zipPath)) throw new RuntimeException('Could not add a document to backup archive');
      $manifest[]=$row;
    }
    if(!$zip->addFromString('manifest.json',json_encode(['created_at'=>(new DateTimeImmutable('now',new DateTimeZone('Asia/Manila')))->format(DATE_ATOM),'documents'=>$manifest],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES))) throw new RuntimeException('Could not add backup manifest');
    if(!$zip->close()) throw new RuntimeException('Could not finish backup archive');
    if(!rename($temporary,$destination)) throw new RuntimeException('Could not save completed backup archive');
  } finally {
    if(is_file($temporary)) unlink($temporary);
  }
}
