<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
if (isset($_SERVER['HTTP_ORIGIN']) && preg_match('#^https?://localhost(?::\d+)?$#', $_SERVER['HTTP_ORIGIN'])) {
  header('Access-Control-Allow-Origin: '.$_SERVER['HTTP_ORIGIN']);
  header('Access-Control-Allow-Credentials: true');
  header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
setcookie('csrf', $_SESSION['csrf'], ['secure'=>!empty($_SERVER['HTTPS']), 'httponly'=>false, 'samesite'=>'Lax', 'path'=>'/']);
if (is_file(__DIR__.'/config.local.php')) require __DIR__.'/config.local.php'; else require __DIR__.'/config.php';
$pdo = null;
try { $pdo = new PDO('mysql:host='.DB_HOST.';port='.DB_PORT.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); } catch (Throwable $e) { error_log('Database connection failed: '.$e->getMessage()); http_response_code(503); echo json_encode(['error'=>'Database connection failed. Check api/config.local.php and the MySQL service.']); exit; }
function out(mixed $data, int $code=200): never { http_response_code($code); echo json_encode($data); exit; }
function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function user(): ?array { $current=$_SESSION['user']??null; if(is_array($current)) unset($current['password_hash']); return $current; }
function requireAuth(?string $role=null): array { $u=user(); if (!$u) out(['error'=>'Authentication required'],401); if ($role && $u['role']!=='admin' && $u['role']!==$role) out(['error'=>'Forbidden'],403); return $u; }
function uuid(): string { return bin2hex(random_bytes(16)); }
function referenceCode(): string { return strtoupper(substr(bin2hex(random_bytes(6)), 0, 10)); }
function safeStoragePath(string $path): string {
  $path = trim(str_replace('\\', '/', $path), '/');
  if ($path === '' || str_contains($path, '..') || !preg_match('#^[A-Za-z0-9._/-]+$#', $path)) out(['error'=>'Invalid storage path'], 422);
  return $path;
}
function filters(array $f, array &$where, array &$args): void { foreach ($f as $key=>$value) if (str_starts_with((string)$key,'eq[')) { $col=substr($key,3,-1); if (preg_match('/^[a-z_]+$/',$col)) { $where[]="`$col` = ?"; $args[]=$value; } } }
$method=$_SERVER['REQUEST_METHOD']; $input=body(); $action=$_GET['action']??($input['action']??null);
if ($method==='POST' && !in_array($action, ['login','logout','admin_recovery'], true) && (($input['rpc']??'') !== 'get_login_email') && (($_SERVER['HTTP_X_CSRF_TOKEN']??'') !== $_SESSION['csrf'])) out(['error'=>'Invalid CSRF token'],419);
if ($action==='backup_download') {
  requireAuth('admin');
  if (!class_exists('ZipArchive')) out(['error'=>'ZIP backups are not available because the PHP Zip extension is disabled'],503);
  $zipPath=tempnam(sys_get_temp_dir(), 'erecords_');
  $zip=new ZipArchive();
  if ($zipPath===false || $zip->open($zipPath, ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true) out(['error'=>'Could not create backup archive'],500);
  $rows=$pdo->query('SELECT d.*,dt.code document_type_code,dt.name document_type_name,s.lrn student_lrn,s.last_name student_last_name,s.first_name student_first_name FROM documents d LEFT JOIN document_types dt ON dt.id=d.type_id LEFT JOIN students s ON s.id=d.student_id ORDER BY d.created_at DESC')->fetchAll();
  $manifest=[];
  foreach ($rows as $row) {
    $file=realpath(STORAGE_ROOT.'/'.safeStoragePath($row['storage_path']));
    if (!$file || !is_file($file)) continue;
    $cleanBackup=static fn(string $value): string => trim(preg_replace('/[^A-Za-z0-9._-]+/', '_', $value), '._-') ?: 'unknown';
    $archiveYear=$cleanBackup((string)($row['school_year'] ?: 'unspecified'));
    $archiveType=$cleanBackup((string)($row['document_type_code'] ?: 'OTHER'));
    $archiveStudent=$cleanBackup(($row['student_last_name'] ?: 'unknown').'_'.($row['student_first_name'] ?: 'student').'_'.$row['student_lrn']);
    $archiveName=$cleanBackup((string)$row['file_name']);
    $archivePath='documents/'.$archiveYear.'/'.$archiveType.'/'.$archiveStudent.'/'.$row['id'].'_'.$archiveName;
    $zip->addFile($file, $archivePath);
    $manifest[]=$row;
  }
  $zip->addFromString('manifest.json', json_encode(['created_at'=>date(DATE_ATOM),'documents'=>$manifest], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
  $zip->close();
  header('Content-Type: application/zip');
  header('Content-Disposition: attachment; filename="e-records-backup-'.date('Y-m-d').'.zip"');
  header('Content-Length: '.filesize($zipPath));
  readfile($zipPath);
  unlink($zipPath);
  exit;
}
if ($action==='upload' && !empty($_FILES['file']) && isset($_POST['student_id'], $_POST['type_id'])) {
  requireAuth('admin');
  if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) out(['error'=>'File upload failed'],422);
  if ((int)$_FILES['file']['size'] > 10 * 1024 * 1024) out(['error'=>'Maximum file size is 10 MB on shared hosting'],422);
  $student=$pdo->prepare('SELECT lrn,last_name,first_name FROM students WHERE id=?');
  $student->execute([$_POST['student_id']]);
  $student=$student->fetch();
  $type=$pdo->prepare('SELECT code FROM document_types WHERE id=?');
  $type->execute([$_POST['type_id']]);
  $typeCode=$type->fetchColumn();
  if (!$student || !$typeCode) out(['error'=>'Student or document type not found'],422);
  $clean=static fn(string $value): string => trim(preg_replace('/[^A-Za-z0-9._-]+/', '_', $value), '._-') ?: 'unknown';
  $year=$clean((string)($_POST['school_year']??'' ?: 'unspecified'));
  $folder=$clean($student['last_name'].'_'.$student['first_name'].'_'.$student['lrn']);
  $name=$clean(basename((string)$_FILES['file']['name']));
  $path=safeStoragePath($year.'/'.$clean((string)$typeCode).'/'.$folder.'/'.date('Ymd_His').'_'.bin2hex(random_bytes(3)).'_'.$name);
  $target=STORAGE_ROOT.'/'.$path;
  if (!is_dir(dirname($target)) && !mkdir(dirname($target),0700,true)) out(['error'=>'Could not create storage directory'],500);
  if (!move_uploaded_file($_FILES['file']['tmp_name'],$target)) out(['error'=>'Could not save file'],500);
  out(['data'=>['path'=>$path]]);
}
if ($action==='session') out(['user'=>user(),'session'=>user()?['user'=>user()]:null]);
if ($action==='download') { $u=requireAuth(); $path=safeStoragePath($_GET['path']??''); $stmt=$pdo->prepare('SELECT storage_path,file_name,mime_type FROM documents WHERE storage_path=?'); $stmt->execute([$path]); $doc=$stmt->fetch(); if(!$doc) out(['error'=>'Not found'],404); if($u['role']!=='admin') { $q=$pdo->prepare('SELECT 1 FROM documents d JOIN students s ON s.id=d.student_id JOIN teacher_assignments a ON a.teacher_id=? AND a.grade_level=s.grade_level AND COALESCE(a.section,"")=COALESCE(s.section,"") WHERE d.storage_path=? AND d.is_classified=0'); $q->execute([$u['id'], $path]); if(!$q->fetchColumn()) out(['error'=>'Forbidden'],403); } $file=realpath(STORAGE_ROOT.'/'.$path); $root=realpath(STORAGE_ROOT); if(!$file || !$root || !str_starts_with($file, $root.DIRECTORY_SEPARATOR) || !is_file($file)) out(['error'=>'Not found'],404); header('Content-Type: '.($doc['mime_type'] ?: 'application/octet-stream')); header('Content-Disposition: attachment; filename="'.basename($doc['file_name']).'"'); readfile($file); exit; }
if ($action==='upload') { requireAuth('admin'); if(empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) out(['error'=>'File upload failed'],422); if((int)$_FILES['file']['size'] > 10 * 1024 * 1024) out(['error'=>'Maximum file size is 10 MB on shared hosting'],422); $requested=$_POST['path']??(uuid().'/'.basename($_FILES['file']['name'])); $requested=str_replace('\\','/',(string)$requested); $parts=explode('/',trim($requested,'/')); $fileName=preg_replace('/[^A-Za-z0-9._-]/','_',basename(end($parts))); $parts[count($parts)-1]=$fileName; $path=safeStoragePath(implode('/',$parts)); $target=STORAGE_ROOT.'/'.$path; if(!is_dir(dirname($target)) && !mkdir(dirname($target),0700,true)) out(['error'=>'Could not create storage directory'],500); if(!move_uploaded_file($_FILES['file']['tmp_name'],$target)) out(['error'=>'Could not save file'],500); out(['data'=>['path'=>$path]]); }
if ($action==='logout') { session_destroy(); out(['data'=>true]); }
if ($action==='admin_recovery') {
  $staffId=strtoupper(trim((string)($input['staff_id']??'')));
  $secret=(string)($input['secret']??'');
  if (!defined('ADMIN_RECOVERY_SECRET') || ADMIN_RECOVERY_SECRET==='' || !hash_equals(ADMIN_RECOVERY_SECRET, $secret)) out(['error'=>'Recovery details were not accepted'],422);
  if (!preg_match('/^[A-Z0-9-]{2,50}$/', $staffId)) out(['error'=>'Enter a valid staff ID'],422);
  $temporaryPassword='EduVault-'.bin2hex(random_bytes(5)).'!';
  $s=$pdo->prepare("UPDATE profiles SET password_hash=?, is_active=1 WHERE staff_id=? AND role='admin'");
  $s->execute([password_hash($temporaryPassword,PASSWORD_DEFAULT),$staffId]);
  if ($s->rowCount()!==1) out(['error'=>'Recovery details were not accepted'],422);
  out(['data'=>['staff_id'=>$staffId,'temporary_password'=>$temporaryPassword]]);
}
if ($action==='delete_file') { requireAuth('admin'); foreach (($input['paths']??[]) as $path) { $file=STORAGE_ROOT.'/'.safeStoragePath((string)$path); if (is_file($file)) unlink($file); } out(['data'=>true]); }
if ($action==='reset_teacher_password') { requireAuth('admin'); $teacherId=(string)($input['teacher_id']??''); $password=(string)($input['password']??''); if ($teacherId==='' || strlen($password)<8) out(['error'=>'A teacher and a password of at least 8 characters are required'],422); $s=$pdo->prepare("UPDATE profiles SET password_hash=? WHERE id=? AND role='teacher'"); $s->execute([password_hash($password,PASSWORD_DEFAULT),$teacherId]); if ($s->rowCount()!==1) out(['error'=>'Teacher account not found'],404); out(['data'=>true]); }
if ($action==='create_teacher' || $action==='create-teacher') { requireAuth('admin'); $staffId=strtoupper(trim((string)($input['staff_id']??($input['user_metadata']['staff_id']??'')))); $email=trim((string)($input['email']??'')); $password=(string)($input['password']??''); $name=trim((string)($input['full_name']??($input['user_metadata']['full_name']??''))); if(!preg_match('/^[A-Z0-9-]{2,50}$/',$staffId)||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8||$name==='') out(['error'=>'Valid staff ID, email, name, and password (8+ characters) are required'],422); $id=bin2hex(random_bytes(16)); try { $s=$pdo->prepare("INSERT INTO profiles (id,staff_id,email,password_hash,full_name,role,is_active) VALUES (?,?,?,?,?,'teacher',1)"); $s->execute([$id,$staffId,$email,password_hash($password,PASSWORD_DEFAULT),$name]); } catch (PDOException $e) { if ((int)$e->errorInfo[1]===1062) out(['error'=>'That staff ID or email is already registered'],409); throw $e; } out(['data'=>['user'=>['id'=>$id,'email'=>$email,'staff_id'=>$staffId]]]); }
if ($method==='POST' && ($action==='login' || ($input['action']??null)==='login')) { $s=$pdo->prepare('SELECT * FROM profiles WHERE email=? AND is_active=1 LIMIT 1'); $s->execute([$input['email']??'']); $p=$s->fetch(); if(!$p || !password_verify($input['password']??'',$p['password_hash'])) out(['error'=>'Invalid credentials'],401); unset($p['password_hash']); $_SESSION['user']=$p; out(['user'=>['id'=>$p['id'],'email'=>$p['email']],'profile'=>$p]); }
if (isset($input['rpc']) && $input['rpc']==='submit_public_request') { $a=$input['args']??[]; $code=referenceCode(); $s=$pdo->prepare('INSERT INTO access_requests (id,reference_code,requester_name,relationship,contact,student_lrn,student_last_name,document_type_id,purpose,source,status) VALUES (?,?,?,?,?,?,?,?,?,"web","pending")'); $s->execute([uuid(),$code,$a['p_requester_name']??'', $a['p_relationship']??null,$a['p_contact']??null,$a['p_student_lrn']??'',$a['p_student_last_name']??'',$a['p_document_type_id']??null,$a['p_purpose']??null]); out(['data'=>[['reference_code'=>$code]]]); }
if (isset($input['rpc'])) { $fn=$input['rpc']; $a=$input['args']??[]; if($fn==='get_login_email'){ $s=$pdo->prepare('SELECT email FROM profiles WHERE UPPER(staff_id)=UPPER(?) AND is_active=1'); $s->execute([$a['p_staff_id']??'']); out(['data'=>$s->fetchColumn()?:null]); } if($fn==='get_my_profile'){ requireAuth(); out(['data'=>user()]); } if($fn==='list_teacher_accounts'){ requireAuth('admin'); $r=$pdo->query("SELECT id,staff_id,email,full_name,is_active,role,created_at FROM profiles WHERE role='teacher' ORDER BY full_name")->fetchAll(); out(['data'=>$r]); } if($fn==='list_admin_documents'){ requireAuth('admin'); $r=$pdo->query('SELECT d.*,dt.code document_type_code,dt.name document_type_name,s.last_name student_last_name,s.first_name student_first_name,s.lrn student_lrn,s.grade_level student_grade_level,s.section student_section,p.full_name uploader_name FROM documents d LEFT JOIN document_types dt ON dt.id=d.type_id LEFT JOIN students s ON s.id=d.student_id LEFT JOIN profiles p ON p.id=d.uploaded_by ORDER BY d.created_at DESC')->fetchAll(); out(['data'=>$r]); } if($fn==='track_request'){ $s=$pdo->prepare('SELECT ar.reference_code,ar.status,dt.name document_type,ar.requester_name,ar.created_at,ar.decided_at,ar.release_note FROM access_requests ar LEFT JOIN document_types dt ON dt.id=ar.document_type_id WHERE UPPER(ar.reference_code)=UPPER(?) AND LOWER(ar.student_last_name)=LOWER(?)'); $s->execute([$a['p_code']??'',$a['p_last_name']??'']); out(['data'=>$s->fetchAll()]); } out(['data'=>[]]); }
if ($method==='GET') {
  $table=(string)($_GET['table']??'');
  $allowed=['students','documents','document_types','access_requests','teacher_assignments','profiles','audit_logs'];
  if(!in_array($table,$allowed,true)) out(['error'=>'Invalid table'],400);
  $u=null;
  if($table!=='document_types') $u=requireAuth();
  if(in_array($table,['profiles','audit_logs'],true)) requireAuth('admin');
  $where=[];$args=[];filters($_GET,$where,$args);
  if($u && $u['role']==='teacher') {
    if($table==='students') {
      $where[]='EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id=? AND ta.grade_level=students.grade_level AND COALESCE(ta.section,"")=COALESCE(students.section,""))';
      $args[]=$u['id'];
    } elseif($table==='documents') {
      $where[]='documents.is_classified=0 AND EXISTS (SELECT 1 FROM students s JOIN teacher_assignments ta ON ta.grade_level=s.grade_level AND COALESCE(ta.section,"")=COALESCE(s.section,"") WHERE s.id=documents.student_id AND ta.teacher_id=?)';
      $args[]=$u['id'];
    } elseif($table==='teacher_assignments') {
      $where[]='teacher_assignments.teacher_id=?';
      $args[]=$u['id'];
    } elseif($table==='access_requests') {
      $where[]='access_requests.requester_id=? AND access_requests.source="teacher"';
      $args[]=$u['id'];
    } else {
      out(['error'=>'Forbidden'],403);
    }
  }
  $defaultOrder=['document_types'=>'name','teacher_assignments'=>'id','students'=>'last_name','access_requests'=>'created_at','documents'=>'created_at','profiles'=>'full_name','audit_logs'=>'created_at'][$table];
  $requestedOrder=$_GET['order']??$defaultOrder; $order=preg_match('/^[a-z_]+$/',$requestedOrder)?$requestedOrder:$defaultOrder;
  $select=$table==='profiles'?'id,staff_id,email,full_name,role,is_active,created_at':'*';
  $sql='SELECT '.$select.' FROM `'.$table.'`'.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY `'.$order.'` '.(($_GET['direction']??'desc')==='asc'?'ASC':'DESC');
  $s=$pdo->prepare($sql);$s->execute($args);$rows=$s->fetchAll();
  if($table==='documents') foreach($rows as &$row) { $q=$pdo->prepare('SELECT code,name FROM document_types WHERE id=?'); $q->execute([$row['type_id']]); $row['document_types']=$q->fetch() ?: null; $q=$pdo->prepare('SELECT full_name FROM profiles WHERE id=?'); $q->execute([$row['uploaded_by']]); $row['profiles']=$q->fetch() ?: null; }
  if($table==='access_requests') foreach($rows as &$row) { $q=$pdo->prepare('SELECT code,name FROM document_types WHERE id=?'); $q->execute([$row['document_type_id']]); $row['document_types']=$q->fetch() ?: null; $q=$pdo->prepare('SELECT last_name,first_name,lrn FROM students WHERE id=?'); $q->execute([$row['student_id']]); $row['students']=$q->fetch() ?: null; $q=$pdo->prepare('SELECT full_name FROM profiles WHERE id=?'); $q->execute([$row['requester_id']]); $row['profiles']=$q->fetch() ?: null; }
  unset($row);
  if(($_GET['head']??'')==='1') out(['data'=>null,'count'=>count($rows)]);
  if(($_GET['single']??'')==='1') out(['data'=>$rows[0]??null]);
  out(['data'=>$rows]);
}
if ($method==='POST' && isset($input['table'])) {
  $u=requireAuth();
  $table=(string)$input['table'];
  $allowed=['profiles','students','document_types','documents','teacher_assignments','access_requests','audit_logs'];
  if(!in_array($table,$allowed,true)) out(['error'=>'Invalid table'],400);
  $action=(string)($input['action']??'');
  $data=$input['data']??[];
  $filtersInput=$input['filters']??[];
  if(!is_array($data)) out(['error'=>'Invalid table data'],422);
  $isTeacherRequest=$u['role']==='teacher' && $table==='access_requests' && $action==='insert';
  if($u['role']!=='admin' && !$isTeacherRequest) out(['error'=>'Forbidden'],403);
  if($isTeacherRequest) {
    $studentId=(string)($data['student_id']??'');
    $assignment=$pdo->prepare('SELECT s.lrn,s.last_name,s.grade_level,s.section FROM students s JOIN teacher_assignments ta ON ta.grade_level=s.grade_level AND COALESCE(ta.section,"")=COALESCE(s.section,"") WHERE s.id=? AND ta.teacher_id=?');
    $assignment->execute([$studentId,$u['id']]);
    $student=$assignment->fetch();
    if(!$student) out(['error'=>'You are not assigned to this student'],403);
    $documentTypeId=$data['document_type_id']??null;
    if($documentTypeId!==null && $documentTypeId!=='') {
      $typeCheck=$pdo->prepare('SELECT id FROM document_types WHERE id=?');
      $typeCheck->execute([$documentTypeId]);
      if(!$typeCheck->fetchColumn()) out(['error'=>'Document type not found'],422);
    } else {
      $documentTypeId=null;
    }
    $requestData=[
      'id'=>uuid(),
      'reference_code'=>referenceCode(),
      'requester_id'=>$u['id'],
      'requester_name'=>$u['full_name'],
      'relationship'=>null,
      'contact'=>null,
      'student_id'=>$studentId,
      'student_lrn'=>$student['lrn'],
      'student_last_name'=>$student['last_name'],
      'document_type_id'=>$documentTypeId,
      'purpose'=>trim((string)($data['purpose']??'')),
      'source'=>'teacher',
      'status'=>'pending',
    ];
    $columns=array_keys($requestData);
    $sql='INSERT INTO access_requests (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')';
    $pdo->prepare($sql)->execute(array_values($requestData));
    out(['data'=>['reference_code'=>$requestData['reference_code']]]);
  }
  $columnsByTable=[
    'profiles'=>['is_active'],
    'students'=>['id','lrn','last_name','first_name','middle_name','birth_date','sex','grade_level','section','guardian_name','status'],
    'document_types'=>['code','name','description'],
    'documents'=>['id','student_id','type_id','title','school_year','grade_level','storage_path','file_name','mime_type','file_size','uploaded_by','is_classified'],
    'teacher_assignments'=>['teacher_id','grade_level','section'],
    'access_requests'=>['id','reference_code','requester_id','requester_name','relationship','contact','student_id','student_lrn','student_last_name','document_type_id','purpose','status','source','decided_by','decided_at','release_note'],
    'audit_logs'=>['actor_id','action','entity','entity_id','details'],
  ];
  if(($action!=='delete' && ($data===[] || array_diff(array_keys($data),$columnsByTable[$table])))) out(['error'=>'Invalid table data'],422);
  if($action==='insert' || $action==='upsert') {
    $columns=array_keys($data);
    $quotedColumns='`'.implode('`,`',$columns).'`';
    $placeholders=implode(',',array_fill(0,count($columns),'?'));
    $sql='INSERT INTO `'.$table.'` ('.$quotedColumns.') VALUES ('.$placeholders.')';
    if($action==='upsert') {
      $updates=array_filter($columns,static fn(string $column): bool => $column!=='id');
      if($updates) $sql.=' ON DUPLICATE KEY UPDATE '.implode(',',array_map(static fn(string $column): string => '`'.$column.'`=VALUES(`'.$column.'`)', $updates));
    }
    $pdo->prepare($sql)->execute(array_values($data));
    out(['data'=>$data]);
  }
  $where=[];$args=[];filters(is_array($filtersInput)?$filtersInput:[],$where,$args);
  if(!$where) out(['error'=>'A filter is required for update or delete'],422);
  if($action==='delete') {
    $pdo->prepare('DELETE FROM `'.$table.'` WHERE '.implode(' AND ',$where))->execute($args);
  } elseif($action==='update') {
    $columns=array_keys($data);
    $pdo->prepare('UPDATE `'.$table.'` SET '.implode(',',array_map(static fn(string $column): string => '`'.$column.'`=?', $columns)).' WHERE '.implode(' AND ',$where))->execute([...array_values($data),...$args]);
  } else {
    out(['error'=>'Invalid table action'],400);
  }
  out(['data'=>true]);
}
out(['error'=>'Unsupported request'],400);
