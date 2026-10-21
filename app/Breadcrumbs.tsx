'use client';
import {ChevronRight} from 'lucide-react';
export type Crumb={label:string;onClick?:()=>void};
export default function Breadcrumbs({items}: {items:Crumb[]}){return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>{items.map((item,index)=><li key={index+'-'+item.label}>{index>0&&<ChevronRight size={13} aria-hidden="true"/>}{item.onClick?<button type="button" onClick={item.onClick}>{item.label}</button>:<span aria-current={index===items.length-1?'page':undefined}>{item.label}</span>}</li>)}</ol></nav>;}
