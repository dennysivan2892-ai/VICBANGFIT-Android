const DAY=86400000;
export const actions={maintain:'Mantener el plan y observar',redistribute:'Revisar distribución y saciedad',sweet:'Valorar una opción dulce planificada',review_deficit:'Revisar si conviene un déficit menor',lighter:'Revisar carga o descanso',refer:'Recomendar valoración sanitaria'};
export function days(a,b){return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/DAY)}
export function validateEntry(r,today){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)||!Number.isFinite(Date.parse(r.entry_date))||r.entry_date>today)throw Error('Revisa la fecha del registro.');
 if(r.period_start&&(r.period_start>r.entry_date||days(r.entry_date,r.period_start)>120))throw Error('Revisa el inicio de la última menstruación (máximo 120 días).');
 if(r.period_end&&(!r.period_start||r.period_end<r.period_start||r.period_end>r.entry_date))throw Error('Revisa las fechas de la menstruación.');
 for(const k of ['bloating','pain','cravings','hunger','energy']){const min=['hunger','energy'].includes(k)?1:0,max=min?5:3;if(!Number.isInteger(r[k])||r[k]<min||r[k]>max)throw Error('Completa las escalas de síntomas.');}
 for(const [k,min,max] of [['weight_kg',20,400],['waist_cm',30,250]])if(r[k]!=null&&(!Number.isFinite(r[k])||r[k]<min||r[k]>max))throw Error('Revisa peso y cintura.');
 if(r.notes.length>1000)throw Error('Las observaciones admiten hasta 1000 caracteres.');
 return r;
}
export function summarize(rows){
 const sorted=[...rows].sort((a,b)=>b.entry_date.localeCompare(a.entry_date)),latest=sorted[0];if(!latest)return null;
 const avg=rs=>{const xs=rs.filter(r=>Number.isFinite(Number(r.weight_kg))&&r.weight_kg!=null);return xs.length?xs.reduce((s,r)=>s+Number(r.weight_kg),0)/xs.length:null};
 const recent=sorted.filter(r=>days(latest.entry_date,r.entry_date)<7),previous=sorted.filter(r=>{const d=days(latest.entry_date,r.entry_date);return d>=7&&d<14});
 const starts=[...new Set(sorted.map(r=>r.period_start).filter(Boolean))].sort();
 const day=latest.period_start?days(latest.entry_date,latest.period_start):null;
 const comparable=day==null?[]:sorted.filter(r=>r.period_start&&r.period_start!==latest.period_start&&Math.abs(days(r.entry_date,r.period_start)-day)<=2);
 const rising=avg(recent)!=null&&avg(previous)!=null&&avg(recent)>avg(previous);
 const suggestions=['maintain'];if(latest.hunger>=4)suggestions.push('redistribute','review_deficit');if(latest.cravings>=2)suggestions.push('sweet');if(latest.pain>=2||latest.energy<=2)suggestions.push('lighter');if(latest.pain===3||latest.bloating===3)suggestions.push('refer');
 return {latest,recentAverage:avg(recent),recentCount:recent.filter(r=>r.weight_kg!=null).length,previousAverage:avg(previous),comparableAverage:starts.length>=2?avg(comparable):null,comparableCount:comparable.filter(r=>r.weight_kg!=null).length,possibleFluid:latest.bloating>=1&&(rising||latest.weight_kg!=null),suggestions:[...new Set(suggestions)]};
}
