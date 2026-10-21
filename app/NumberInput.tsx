'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {InputHTMLAttributes} from 'react';
import {numberDraft,numberDisplay,numberError} from '../lib/number-input';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'onChange'> & {decimal?:boolean;maxDigits?:number;onChange?:(event:any)=>void};
export default function NumberInput({name,value,defaultValue,min,max,step='any',decimal=true,maxDigits=15,onChange,onBlur,disabled,...props}:Props){
 const [display,setDisplay]=useState(()=>numberDisplay(value??defaultValue??'')),ref=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 const raw=numberDraft(display,decimal,maxDigits).raw;
 useEffect(()=>{if(value!==undefined&&Number(value)!==Number(raw)||value===''&&display!=='')setDisplay(numberDisplay(value));},[value]);
 useLayoutEffect(()=>{ref.current?.setCustomValidity(numberError(raw,min,max,step));if(caret.current!==null){ref.current?.setSelectionRange(caret.current,caret.current);caret.current=null;}},[display,min,max,step]);
 return <><input {...props} ref={ref} type="text" inputMode={decimal?'decimal':'numeric'} value={display} disabled={disabled} onChange={event=>{
  const meaningful=event.target.value.slice(0,event.target.selectionStart??event.target.value.length).replace(/\./g,'').length;
  const draft=numberDraft(event.target.value,decimal,maxDigits);let position=0,count=0;while(position<draft.display.length&&count<meaningful){if(draft.display[position]!=='.')count++;position++;}
  caret.current=position;setDisplay(draft.display);onChange?.({...event,target:{...event.target,name,value:draft.raw},currentTarget:{...event.currentTarget,name,value:draft.raw}});
 }} onBlur={event=>{if(raw&&raw!=='-')setDisplay(numberDisplay(raw));onBlur?.(event);}}/>{name&&<input type="hidden" name={name} value={raw} disabled={disabled}/>}</>;
}
