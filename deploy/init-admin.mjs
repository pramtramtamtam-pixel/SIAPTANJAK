import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {Writable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';

if(!process.stdin.isTTY)throw Error('Jalankan melalui terminal interaktif; kata sandi tidak diterima dari argumen/environment.');
if(!process.env.SIAP_DATA_DIR)throw Error('Isi SIAP_DATA_DIR melalui file environment terlebih dahulu.');
const root=path.resolve(process.env.SIAP_DATA_DIR),migrations=path.resolve(process.env.SIAP_MIGRATIONS_DIR||'./drizzle');
fs.mkdirSync(root,{recursive:true,mode:0o700});
const file=path.join(root,'siaptanjak.sqlite'),db=new DatabaseSync(file);
let hidden=false;
const output=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk,encoding);done();}});
const prompt=readline.createInterface({input:process.stdin,output,terminal:true});
try{
 db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS lighthouse_migrations(name TEXT PRIMARY KEY,applied TEXT NOT NULL)');
 for(const name of fs.readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort()){
  if(db.prepare('SELECT name FROM lighthouse_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN IMMEDIATE');try{db.exec(fs.readFileSync(path.join(migrations,name),'utf8'));db.prepare('INSERT INTO lighthouse_migrations VALUES(?,?)').run(name,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 if(db.prepare("SELECT id FROM users WHERE role='Administrator' LIMIT 1").get())throw Error('Administrator sudah ada. Tidak ada akun yang diubah.');
 const name=(await prompt.question('Nama administrator: ')).trim(),email=(await prompt.question('Email administrator: ')).trim().toLowerCase();
 if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>180)throw Error('Nama/email tidak valid.');
 async function secret(label){process.stdout.write(label);hidden=true;try{return await prompt.question('');}finally{hidden=false;process.stdout.write('\n');}}
 let password=await secret('Kata sandi baru (minimal 12 karakter): '),confirmation=await secret('Ulangi kata sandi: ');
 if(password.length<12||bcrypt.truncates(password)||password!==confirmation)throw Error('Kata sandi tidak cocok atau panjangnya tidak sesuai (12 karakter sampai 72 byte UTF-8).');
 const hash=await bcrypt.hash(password,12);password='';confirmation='';
 const master=JSON.parse(fs.readFileSync(new URL('./master-data.json',import.meta.url),'utf8'));
 db.exec('BEGIN IMMEDIATE');try{
  if(db.prepare("SELECT id FROM users WHERE role='Administrator' LIMIT 1").get())throw Error('Administrator telah dibuat proses lain.');
  const id=randomUUID();
  db.prepare('INSERT INTO users(id,name,email,password,role,instansi,wilayah,bidang,active) VALUES(?,?,?,?,?,?,?,?,1)').run(id,name,email,hash,'Administrator','Bappeda Provinsi Sumatera Selatan','Sumatera Selatan','Semua');
  for(const [type,values] of Object.entries(master))for(const [i,value] of values.entries()){
   if(!db.prepare('SELECT id FROM master WHERE type=? AND name=?').get(type,value))db.prepare('INSERT INTO master(id,type,name,active) VALUES(?,?,?,1)').run('deploy-init-'+type+'-'+i,type,value);
  }
  db.prepare('INSERT INTO audit_log(id,user_id,action,entity,created) VALUES(?,?,?,?,?)').run(randomUUID(),id,'Aktivasi administrator melalui terminal server','users',new Date().toISOString());
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 fs.chmodSync(file,0o600);
 console.log('Administrator pertama dan data master dasar berhasil dibuat. Silakan masuk melalui halaman login.');
}finally{prompt.close();db.close();}
