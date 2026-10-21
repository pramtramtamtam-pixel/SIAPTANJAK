'use client';
import {useState} from 'react';
import {Check,MapPin,RotateCcw,Wallet,X} from 'lucide-react';
import {money} from '../lib/data';
import type {CommitmentFilters,OfficeOption,ProposalLocation} from '../lib/commitment-filters';
import {commitmentDraft,commitmentLimits,selectedReferenceOffice,emptyCommitmentFilters} from '../lib/commitment-filters';
import CompanyOfficeMapPicker from './CompanyOfficeMapPicker';
type Props={proposals:ProposalLocation[];offices:OfficeOption[];value:CommitmentFilters;onApply:(value:CommitmentFilters)=>void;onClose?:()=>void};
export default function CompanyCommitmentFilters({offices,value,proposals,onApply,onClose}:Props){
 const [draft,setDraft]=useState(()=>({...value}));
 const office=selectedReferenceOffice(offices,draft);
 const [showOfficeMap,setShowOfficeMap]=useState(false);
 const limits=commitmentLimits(proposals,office),bounded=commitmentDraft(draft,limits);
 const radius=bounded.radiusKm??0;
 const budgetFloor=Math.min(limits.budgetMin,draft.minBudget??limits.budgetMin,draft.maxBudget??limits.budgetMin),budgetCeiling=Math.max(limits.budgetMax,draft.minBudget??limits.budgetMax,draft.maxBudget??limits.budgetMax);
 const budgetMin=draft.minBudget??budgetFloor,budgetMax=draft.maxBudget??budgetCeiling;
 const budgetSpan=budgetCeiling-budgetFloor,budgetStart=budgetSpan?(budgetMin-budgetFloor)/budgetSpan*100:0,budgetEnd=budgetSpan?(budgetMax-budgetFloor)/budgetSpan*100:100;
 const budgetDisabled=!limits.hasBudgets||budgetFloor===budgetCeiling;
 const validBudget=(draft.minBudget==null||Number.isFinite(draft.minBudget)&&draft.minBudget>=0)&&(draft.maxBudget===null||Number.isFinite(draft.maxBudget)&&draft.maxBudget>=0)&&(draft.minBudget==null||draft.maxBudget===null||draft.minBudget<=draft.maxBudget);
 const km=(n:number)=>n.toLocaleString("id-ID",{maximumFractionDigits:2})+" km";
 return <section id="company-commitment-filter-panel" className="company-commitment-filters" aria-label="Filter jarak dan estimasi biaya kegiatan">
  <div className="company-filter-heading"><strong id="company-filter-title">Filter lokasi dan biaya kegiatan</strong><div className="company-filter-header-actions"><button type="button" className="textbutton" onClick={()=>{setDraft({...emptyCommitmentFilters});onApply({...emptyCommitmentFilters});}}><RotateCcw size={14}/>Reset filter</button>{onClose&&<button type="button" className="iconbutton" aria-label="Tutup filter tanpa menerapkan" onClick={onClose}><X size={18}/></button>}</div></div>
  <div className="company-filter-fields">
   <div className="field"><span><MapPin size={15}/>Kantor acuan jarak</span><button type="button" className="company-office-picker" aria-haspopup="dialog" onClick={()=>setShowOfficeMap(true)}><MapPin size={17}/><span>{office?office.type+(office.wilayah?' — '+office.wilayah:''):'Belum ada kantor berkoordinat'}<small>Pilih kantor di peta</small></span></button><small>{office?.address||'Lengkapi koordinat kantor untuk memakai filter radius.'}</small></div>
   <label className="field"><span>Radius maksimum dari kantor</span><output htmlFor="commitment-radius">{limits.hasDistances?km(radius):'Belum ada lokasi kegiatan'}</output><input id="commitment-radius" aria-valuetext={radius+' kilometer'} aria-label="Radius maksimum kegiatan dalam kilometer" type="range" min={limits.radiusMin} max={limits.radiusMax} step={limits.radiusStep} value={radius} disabled={!limits.hasDistances||limits.radiusMin===limits.radiusMax} onChange={event=>setDraft({...draft,radiusKm:Number(event.target.value)})}/><small className="company-range-scale"><span>Terdekat {km(limits.radiusMin)}</span><span>Terjauh {km(limits.radiusMax)}</span></small></label>
   <div className="field"><span><Wallet size={15}/>Rentang estimasi biaya kegiatan</span><div className="budget-range-values"><label htmlFor="commitment-budget-min">Biaya minimum<strong>{money(budgetMin)}</strong></label><label htmlFor="commitment-budget">Biaya maksimum<strong>{money(budgetMax)}</strong></label></div><div className={'budget-range-slider'+(budgetDisabled?' is-disabled':'')} role="group" aria-label="Rentang estimasi biaya kegiatan"><div className="budget-range-track" aria-hidden="true"><i style={{left:budgetStart+'%',width:Math.max(0,budgetEnd-budgetStart)+'%'}}/></div><input id="commitment-budget-min" type="range" min={budgetFloor} max={budgetCeiling} step="1" aria-label="Estimasi biaya minimum kegiatan dalam rupiah" aria-valuetext={money(budgetMin)} value={budgetMin} disabled={budgetDisabled} style={{zIndex:budgetStart>50?4:3}} onChange={event=>setDraft({...draft,minBudget:Math.min(Number(event.target.value),budgetMax)})}/><input id="commitment-budget" type="range" min={budgetFloor} max={budgetCeiling} step="1" aria-label="Estimasi biaya maksimum kegiatan dalam rupiah" aria-valuetext={money(budgetMax)} value={budgetMax} disabled={budgetDisabled} style={{zIndex:budgetStart>50?3:4}} onChange={event=>setDraft({...draft,maxBudget:Math.max(Number(event.target.value),budgetMin)})}/></div><small className="company-range-scale"><span>Terendah {money(budgetFloor)}</span><span>Tertinggi {money(budgetCeiling)}</span></small></div>
  </div>
  <div className="company-filter-actions"><p>Jarak garis lurus dihitung dari satu kantor yang dipilih. Klik Terapkan untuk memperbarui daftar. Usulan tanpa koordinat tidak ditampilkan saat filter radius aktif.</p><button type="button" className="primary" disabled={!validBudget} onClick={()=>{if(!validBudget)return;const chosen=commitmentDraft(draft,limits);onApply({...chosen,minBudget:draft.minBudget??null,maxBudget:draft.maxBudget,officeKey:office?.key||'',radiusKm:office?chosen.radiusKm:null});}}><Check size={16}/>Terapkan</button></div>
  {showOfficeMap&&<CompanyOfficeMapPicker offices={offices} selectedKey={office?.key||''} customOffice={draft.customOffice} onClose={()=>setShowOfficeMap(false)} onChoose={chosen=>{setDraft({...draft,officeKey:chosen.key,customOffice:chosen.key==='custom-map-point'?chosen:null,radiusKm:null});setShowOfficeMap(false);}}/>}
 </section>;
}
