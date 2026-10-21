import bcrypt from 'bcryptjs';
export const passwordNeedsUpgrade=(stored:string)=>!/^\$2[aby]\$12\$/.test(stored);
export async function hash(password:string){
 if(bcrypt.truncates(password))throw Object.assign(new Error('Kata sandi terlalu panjang. Maksimal 72 byte UTF-8.'),{status:400});
 return bcrypt.hash(password,12);
}
export async function verifyPassword(password:string,stored:string){
 if(/^\$2[aby]\$\d{2}\$/.test(stored))return !bcrypt.truncates(password)&&bcrypt.compare(password,stored);
 const [salt,digest]=stored.split(':');if(!salt||!/^[a-f0-9]{64}$/.test(digest||''))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 const actual=Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');let difference=0;for(let i=0;i<digest.length;i++)difference|=actual.charCodeAt(i)^digest.charCodeAt(i);return difference===0;
}
export const canUpgradePassword=(password:string)=>!bcrypt.truncates(password);
