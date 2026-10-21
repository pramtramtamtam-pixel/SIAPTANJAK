'use client';
import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export default function PasswordInput(props:React.InputHTMLAttributes<HTMLInputElement>){const [visible,setVisible]=useState(false);return <span className="password-field"><input {...props} type={visible?'text':'password'}/><button type="button" aria-label={visible?'Sembunyikan kata sandi':'Lihat kata sandi'} title={visible?'Sembunyikan kata sandi':'Lihat kata sandi'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span>}
