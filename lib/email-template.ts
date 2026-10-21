import {registrationWelcomeEmail} from './registration-email';
export const emailSettingsDefaults={
 fromEmail:'siaptanjak@gmail.com',fromName:'Tim Pengelola SIAP-TANJAK',replyTo:'siaptanjak@gmail.com',
 supportEmail:'siaptanjak@gmail.com',supportPhone:'085822222262',
 subject:'Terima Kasih atas Pendaftaran Perusahaan di SIAP-TANJAK',
 body:registrationWelcomeEmail({name:'{{nama_perusahaan}}',payload:{pic:'{{nama_kontak}}',offices:[{address:'{{alamat_perusahaan}}'}]}},'{{tautan_konfirmasi}}').replaceAll('siaptanjak@gmail.com','{{email_bantuan}}').replaceAll('085822222262','{{telepon_bantuan}}')
};
export const emailVariables=['nama_perusahaan','nama_kontak','alamat_perusahaan','tautan_konfirmasi','email_bantuan','telepon_bantuan'];
export function renderEmail(template:string,values:Record<string,string>){return template.replace(/\{\{\s*(\w+)\s*\}\}/g,(_match,key)=>values[key]??'');}
export function registrationEmailValues(company:any,link:string,settings:any){
 const p=company.payload||{},office=p.offices?.find((o:any)=>o.type==='Kantor pusat')||p.offices?.[0];
 return {nama_perusahaan:company.name,nama_kontak:p.pic||'Pimpinan Perusahaan',alamat_perusahaan:office?[office.address,office.wilayah].filter(Boolean).join(', '):p.pusat||p.operasional||'',tautan_konfirmasi:link,email_bantuan:settings.supportEmail,telepon_bantuan:settings.supportPhone};
}
