export default function InstitutionPicFields({profile={}}:{profile?:{pic_name?:string;phone?:string}}){
 return <div className="formgrid"><label className="field"><span>Nama PIC</span><input name="pic_name" defaultValue={profile.pic_name||''} required maxLength={200} autoComplete="name"/></label><label className="field"><span>No. HP</span><input name="phone" type="tel" defaultValue={profile.phone||''} required maxLength={50} autoComplete="tel"/></label></div>;
}
