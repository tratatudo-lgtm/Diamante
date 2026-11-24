import {useEffect,useState} from 'react';
import {calculateQuote} from '../../lib/purchase-pricing';
type Price={qualidade_id:string;centimos_por_grama:number;qualidades_metal:{nome:string;metal:string;toque:number;ativo:boolean}};
type Publication={id:string;publicacoes_precos_itens:Price[]};
type Piece={key:string;qualityId:string;type:string;description:string;weight:string};
const empty=():Piece=>({key:crypto.randomUUID(),qualityId:'',type:'',description:'',weight:''});
const money=(c:number)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(c/100);
async function api(path:string,init:RequestInit={}){
 const r=await fetch('/api/pricing'+path,{...init,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(sessionStorage.getItem('diamante_jwt_token')||'')}});
 if(!r.ok)throw new Error(r.status===409?'A sede alterou os preços. Atualize e reveja a proposta.':'Não foi possível concluir a operação.');
 return r.json();
}
export default function MultiItemQuoteForm({lojaId,clienteId,onCreated}:{lojaId:string;clienteId:string;onCreated:(id:string)=>void}){
 const [pieces,setPieces]=useState<Piece[]>(()=>[empty()]);
 const [publication,setPublication]=useState<Publication|null>(null);
 const [stale,setStale]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function refresh(){
 try{const r=await api('/prices');setPublication(r.publicacao);setStale(false);setMessage('');}
 catch{setStale(true);setMessage('Não foi possível validar os preços da sede.');}
 }
 useEffect(()=>{void refresh();},[lojaId]);
 useEffect(()=>{
 if(!publication)return;
 let live=true;
 const timer=setInterval(async()=>{try{const r=await api('/prices');if(live&&r.publicacao?.id!==publication.id)setStale(true);}catch{if(live)setStale(true);}},15000);
 return()=>{live=false;clearInterval(timer);};
 },[publication]);
 const prices=(publication?.publicacoes_precos_itens||[]).filter(p=>p.qualidades_metal?.ativo);
 const mg=(s:string)=>/^\d{1,5}([.,]\d{1,3})?$/.test(s)?Math.round(Number(s.replace(',','.'))*1000):0;
 let quote:ReturnType<typeof calculateQuote>|null=null;
 try{quote=calculateQuote(pieces.map(p=>({qualityId:p.qualityId,weightMilligrams:mg(p.weight)})),prices.map(p=>({qualityId:p.qualidade_id,centsPerGram:p.centimos_por_grama})));}catch{}
 const valid=!!quote&&!!clienteId&&!!lojaId&&pieces.every(p=>p.type.trim().length>0)&&!stale&&!busy;
 function change(key:string,patch:Partial<Piece>){setPieces(old=>old.map(p=>p.key===key?{...p,...patch}:p));}
 async function submit(){
 if(!valid||!publication)return;
 setBusy(true);setMessage('');
 try{const r=await api('/quotes',{method:'POST',body:JSON.stringify({lojaId,clienteId,publicacaoId:publication.id,pecas:pieces.map(p=>({qualidade_id:p.qualityId,tipo_peca:p.type.trim(),descricao:p.description,peso_miligramas:mg(p.weight)}))})});onCreated(r.id);}
 catch(e){setStale(true);setMessage(e instanceof Error?e.message:'Erro ao criar cotação.');}
 finally{setBusy(false);}
 }
 return <section className="space-y-4">
 <h2 className="text-xl font-semibold">Nova cotação</h2>
 <p>Adicione cada peça separadamente. Os preços são definidos pela sede.</p>
 {(!publication||stale)&&<p role="alert">Preços indisponíveis ou por atualizar.</p>}
 <button type="button" disabled={busy} onClick={()=>void refresh()}>Atualizar preços</button>
 {pieces.map((p,i)=><fieldset key={p.key} disabled={busy} className="space-y-2 rounded border p-3">
 <legend>Peça {i+1}</legend>
 <label className="block">Tipo de peça<input className="block w-full rounded border bg-transparent p-2" maxLength={100} value={p.type} onChange={e=>change(p.key,{type:e.target.value})}/></label>
 <label className="block">Quilatagem<select className="block w-full rounded border bg-transparent p-2" value={p.qualityId} onChange={e=>change(p.key,{qualityId:e.target.value})}><option value="">Selecionar</option>{prices.map(g=><option key={g.qualidade_id} value={g.qualidade_id}>{g.qualidades_metal.metal} {g.qualidades_metal.nome} — {money(g.centimos_por_grama)}/g</option>)}</select></label>
 <label className="block">Peso (g)<input className="block w-full rounded border bg-transparent p-2" inputMode="decimal" value={p.weight} onChange={e=>change(p.key,{weight:e.target.value})}/></label>
 <label className="block">Descrição<textarea className="block w-full rounded border bg-transparent p-2" maxLength={2000} value={p.description} onChange={e=>change(p.key,{description:e.target.value})}/></label>
 <p>Valor: {quote?money(quote.items[i].amountCents):'—'}</p>
 <button type="button" disabled={pieces.length===1} onClick={()=>setPieces(old=>old.filter(x=>x.key!==p.key))}>Remover peça</button>
 </fieldset>)}
 <button type="button" disabled={busy||pieces.length>=100} onClick={()=>setPieces(old=>[...old,empty()])}>+ Adicionar peça</button>
 <p className="text-xl font-semibold">Total: {quote?money(quote.totalCents):'—'}</p>
 <button type="button" disabled={!valid} onClick={()=>void submit()} className="rounded bg-[#D4AF37] px-4 py-2 text-black disabled:opacity-50">Criar cotação</button>
 <p role="status">{message}</p>
 </section>;
}
