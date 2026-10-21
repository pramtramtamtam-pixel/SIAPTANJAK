'use client';
import {useEffect,useState} from 'react';
import {api} from './Portal';
export default function ProposalContact({proposalId,companyId}:{proposalId:string;companyId?:string}){
 const [result,setResult]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setResult(null);setError('');api('proposal-contact/'+encodeURIComponent(proposalId)).then(r=>{if(alive)setResult(r.contact);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[proposalId,companyId]);
 if(error)return <p role="alert">Kontak PIC belum dapat dimuat: {error}</p>;
 if(!result)return <p className="muted">Memuat kontak PIC…</p>;
 const number=String(result.phone||'').replace(/[^+\d]/g,'');
 return <section className="proposal-contact"><h3>{result.kind==='perusahaan'?'PIC perusahaan pelaksana':'PIC instansi pengusul'}</h3><div className="detailgrid"><div><small>Instansi / perusahaan</small><strong>{result.institution||'Belum diisi'}</strong></div><div><small>Nama PIC</small><strong>{result.name||'Belum diisi'}</strong></div><div><small>No. HP PIC</small><strong>{number?<a href={'tel:'+number}>{result.phone}</a>:'Belum diisi pada profil'}</strong></div></div></section>;
}
