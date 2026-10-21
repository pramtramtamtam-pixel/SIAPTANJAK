'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
/** Top-layer dialog keeps the proposal table's width and scroll position unchanged. */
export default function CompanyFilterDialog({children,onClose,className="",labelledBy="company-filter-title"}:{children:ReactNode;onClose:()=>void;className?:string;labelledBy?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
 if(typeof document==='undefined')return null;
 return createPortal(<dialog ref={ref} className={"company-filter-dialog "+className} aria-labelledby={labelledBy} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>{children}</dialog>,document.body);
}
