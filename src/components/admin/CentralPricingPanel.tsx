import { useEffect,useState } from 'react';
type Grade={id:string;nome:string;metal:string;toque:number;ativo:boolean};
type Publication={id:string;publicado_em:string;publicacoes_precos_itens:{qualidade_id:string;centimos_por_grama:number}[]};
async function api(path:string,init:RequestInit={}){
 const token=sessionStorage.getItem('diamante_jwt_token');
 const res=await fetch('/api/pricing'+path,{...init,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')}});
 if(!res.ok) throw new Error(res.status===409?'Outro administrador alterou os preços. Atualize antes de publicar.':'Não foi possível concluir a operação.');
 return res.json();
}
export default function CentralPricingPanel(){
 const [grades,setGrades]=useState<Grade[]>([]);
 const [publication,setPublication]=useState<Publication|null>(null);
 const [values,setValues]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(true);
 const [ready,setReady]=useState(false);
 const [message,setMessage]=useState('');
 async function load(){
 setBusy(true);setReady(false);setMessage('');
 try{
 const [catalog,prices]=await Promise.all([api('/qualities'),api('/prices')]);
 setGrades(catalog.qualidades);
 setPublication(prices.publicacao);
 setValues(Object.fromEntries((prices.publicacao?.publicacoes_precos_itens||[]).map((p:{qualidade_id:string;centimos_por_grama:number})=>[p.qualidade_id,(p.centimos_por_grama/100).toFixed(2)])));
 setReady(true);
 }catch(e){setMessage(e instanceof Error?e.message:'Erro ao carregar preços.');}
 finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 const active=grades.filter(g=>g.ativo);
 const cents=(s:string)=>/^\d{1,6}([.,]\d{1,2})?$/.test(s||'')?Math.round(Number(s.replace(',','.'))*100):0;
 const valid=active.length>0&&active.every(g=>cents(values[g.id])>0&&cents(values[g.id])<=10000000);
 async function publish(){
 if(!ready||!valid||busy)return;
 setBusy(true);setMessage('');
 try{
 await api('/prices',{method:'POST',body:JSON.stringify({publicacaoAnterior:publication?.id??null,precos:active.map(g=>({qualidade_id:g.id,centimos_por_grama:cents(values[g.id])}))})});
 await load();setMessage('Preços publicados com sucesso.');
 }catch(e){setMessage(e instanceof Error?e.message:'Erro ao publicar.');}
 finally{setBusy(false);}
 }
 return <section className="space-y-4">
 <h2 className="text-xl font-semibold">Preços de compra — Sede</h2>
 <p>Introduza o preço final por grama. Não será aplicada uma segunda margem.</p>
 <p>{publication?'Última publicação: '+new Date(publication.publicado_em).toLocaleString('pt-PT'):'Sem publicação carregada'}</p>
 <button type="button" disabled={busy} onClick={()=>void load()}>Atualizar tabela</button>
 {grades.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
 <label htmlFor={'price-'+g.id}>{g.metal} {g.nome} ({g.toque}‰){!g.ativo?' — Inativa':''}</label>
 <div><input id={'price-'+g.id} inputMode="decimal" disabled={busy||!g.ativo} value={values[g.id]||''} onChange={e=>setValues(v=>({...v,[g.id]:e.target.value}))} className="w-28 rounded border bg-transparent p-2" /> €/g</div>
 </div>)}
 <button type="button" disabled={!ready||!valid||busy} onClick={()=>void publish()} className="rounded bg-[#D4AF37] px-4 py-2 text-black disabled:opacity-50">Publicar preços para todas as lojas</button>
 <p role="status">{message}</p>
 </section>;
}
