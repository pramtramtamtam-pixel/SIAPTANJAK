/** Current data is available to every authorized printer; archives follow each role's stage. */
export function canPrintPhase(role:string,phase:string){
 if(phase==='all')return true;
 if(['Administrator','Bappeda Provinsi'].includes(role))return /^[0-2]$/.test(phase)||/^legacy[0-3]$/.test(phase);
 return phase===({'Perusahaan':'2','Bappeda Kab/Kota':'0','Perangkat Daerah':'1','POKJA Forum CSR':'1'} as Record<string,string>)[role];
}
