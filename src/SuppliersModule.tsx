import React, { useState, useMemo } from "react";

const C = {
  bg:"#f8fafc",w:"#fff",bdr:"#e2e8f0",lt:"#f1f5f9",tx:"#0f172a",md:"#475569",mu:"#94a3b8",
  or:"#ea580c",orBg:"#fff7ed",orBd:"#fed7aa",gn:"#16a34a",gnBg:"#f0fdf4",gnBd:"#bbf7d0",
  rd:"#dc2626",rdBg:"#fef2f2",rdBd:"#fecaca",bl:"#2563eb",blBg:"#eff6ff",blBd:"#bfdbfe",
  am:"#b45309",amBg:"#fffbeb",amBd:"#fde68a",pu:"#7c3aed",puBg:"#f5f3ff",puBd:"#ddd6fe"
};
const I = (ex:any={}) => ({background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,borderRadius:6,padding:"6px 9px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,width:"100%",...ex});
const TH = ({ch}:{ch:string}) => <th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.mu,letterSpacing:"0.5px",textTransform:"uppercase",whiteSpace:"nowrap",background:C.lt,borderBottom:`1px solid ${C.bdr}`}}>{ch}</th>;
const TD = ({ch,s={}}:{ch:any,s?:any}) => <td style={{padding:"8px 10px",fontSize:12,borderBottom:"1px solid #f1f5f9",...s}}>{ch}</td>;
const Bdg = ({c,bg,bd,ch}:{c:string,bg:string,bd:string,ch:string}) => <span style={{background:bg,border:`1px solid ${bd}`,color:c,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{ch}</span>;
const fmt = (n:number) => Math.round(n).toLocaleString();
const fmtDate = (d:string) => { try { return new Date(d+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"}); } catch(e){ return d; } };
const todayStr = () => new Date().toISOString().slice(0,10);

const CATEGORIES = ["Молочка","Мясо","Бакалея","Овощи/Фрукты","Напитки","Заморозка","Хлеб","Бытовая химия","Другое"];
const STATUS_CFG:{[k:string]:{label:string,c:string,bg:string,bd:string}} = {
  pending:   {label:"Ожидает",   c:C.am,bg:C.amBg,bd:C.amBd},
  delivered: {label:"Получено",  c:C.bl,bg:C.blBg,bd:C.blBd},
  paid:      {label:"Оплачено",  c:C.gn,bg:C.gnBg,bd:C.gnBd},
  overdue:   {label:"Просрочено",c:C.rd,bg:C.rdBg,bd:C.rdBd},
};
const SUP_TABS = [{k:"suppliers",l:"👥 Поставщики"},{k:"purchases",l:"📦 Закупки"},{k:"payments",l:"💳 Оплаты"}];

interface Supplier { id:number;name:string;category:string;contact:string;phone:string;email:string;inn:string;payment_terms:number;active:boolean; }
interface Purchase { id:number;date:string;supplier_id:number;store_id:number|null;amount:number;status:string;invoice:string;comment:string; }
interface Payment  { id:number;date:string;purchase_id:number;supplier_id:number;amount:number;method:string;note:string; }
interface Props { sb:any;stores:any[];suppliers:Supplier[];setSuppliers:(d:any)=>void;purchases:Purchase[];setPurchases:(d:any)=>void;payments:Payment[];setPayments:(d:any)=>void; }

export default function SuppliersModule({sb,stores,suppliers,setSuppliers,purchases,setPurchases,payments,setPayments}:Props) {
  const [tab,setTab] = useState("suppliers");
  const [saving,setSaving] = useState(false);
  const [supModal,setSupModal] = useState<null|"add"|Supplier>(null);
  const [supF,setSupF] = useState<Partial<Supplier>>({});
  const [catFilter,setCatFilter] = useState("all");
  const [showInactive,setShowInactive] = useState(false);
  const [purModal,setPurModal] = useState<null|"add"|Purchase>(null);
  const [purF,setPurF] = useState<Partial<Purchase>>({});
  const [storeFilter,setStoreFilter] = useState("all");
  const [statusFilter,setStatusFilter] = useState("all");
  const [payModal,setPayModal] = useState(false);
  const [payF,setPayF] = useState<Partial<Payment>>({});

  const sn = (id:any) => stores.find((s:any)=>s.id===id)?.name||"";

  const supSummary = useMemo(()=>suppliers.map(sup=>({
    ...sup,
    debt: Math.max(0, purchases.filter(p=>p.supplier_id===sup.id).reduce((s,p)=>s+Number(p.amount),0) - payments.filter(p=>p.supplier_id===sup.id).reduce((s,p)=>s+Number(p.amount),0)),
  })),[suppliers,purchases,payments]);

  const totalDebt   = supSummary.reduce((s,x)=>s+x.debt,0);
  const totalBought = purchases.reduce((s,p)=>s+Number(p.amount),0);
  const totalPaid   = payments.reduce((s,p)=>s+Number(p.amount),0);
  const overdueCount= purchases.filter(p=>p.status==="overdue").length;

  const subTabBtn = (active:boolean) => ({background:active?C.w:"none",border:`1px solid ${active?C.bdr:"transparent"}`,borderRadius:7,cursor:"pointer" as const,padding:"6px 14px",fontSize:11,fontWeight:600,fontFamily:"inherit",color:active?C.or:C.mu,boxShadow:active?"0 1px 3px rgba(0,0,0,.07)":"none"});

  async function saveSupplier() {
    if(!supF.name?.trim())return; setSaving(true);
    if(supModal==="add"){const{data}=await sb.from("suppliers").insert({...supF}).select().single();if(data)setSuppliers([...suppliers,data]);}
    else{const{data}=await sb.from("suppliers").update({...supF}).eq("id",(supF as Supplier).id).select().single();if(data)setSuppliers(suppliers.map((s:Supplier)=>s.id===data.id?data:s));}
    setSaving(false);setSupModal(null);
  }
  async function toggleActive(sup:Supplier){const{data}=await sb.from("suppliers").update({active:!sup.active}).eq("id",sup.id).select().single();if(data)setSuppliers(suppliers.map((s:Supplier)=>s.id===data.id?data:s));}

  async function savePurchase() {
    if(!purF.supplier_id||!purF.amount)return; setSaving(true);
    const payload={...purF,amount:Number(purF.amount),store_id:purF.store_id||null};
    if(purModal==="add"){const{data}=await sb.from("purchases").insert(payload).select().single();if(data)setPurchases([data,...purchases]);}
    else{const{data}=await sb.from("purchases").update(payload).eq("id",(purF as Purchase).id).select().single();if(data)setPurchases(purchases.map((p:Purchase)=>p.id===data.id?data:p));}
    setSaving(false);setPurModal(null);
  }

  async function savePayment() {
    if(!payF.supplier_id||!payF.amount)return; setSaving(true);
    const{data}=await sb.from("supplier_payments").insert({...payF,amount:Number(payF.amount)}).select().single();
    if(data){
      setPayments([data,...payments]);
      if(payF.purchase_id){
        const pur=purchases.find((p:Purchase)=>p.id===Number(payF.purchase_id));
        if(pur){
          const alreadyPaid=payments.filter((p:Payment)=>p.purchase_id===pur.id).reduce((s:number,p:Payment)=>s+Number(p.amount),0);
          if(alreadyPaid+Number(payF.amount)>=Number(pur.amount)){
            await sb.from("purchases").update({status:"paid"}).eq("id",pur.id);
            setPurchases(purchases.map((p:Purchase)=>p.id===pur.id?{...p,status:"paid"}:p));
          }
        }
      }
    }
    setSaving(false);setPayModal(false);
  }

  function renderSuppliers(){
    const filtered=supSummary.filter(s=>(!showInactive&&!s.active?false:true)&&(catFilter==="all"||s.category===catFilter));
    return(<div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>{setSupF({category:"Молочка",payment_terms:14,active:true});setSupModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Поставщик</button>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={I({width:"auto"})}><option value="all">Все категории</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.mu,cursor:"pointer"}}><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Показать неактивных</label>
        <span style={{marginLeft:"auto",fontSize:11,color:C.mu}}>{filtered.length} поставщиков</span>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
          <thead><tr><TH ch="Поставщик"/><TH ch="Категория"/><TH ch="Контакт"/><TH ch="Отсрочка"/><TH ch="Долг"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{filtered.map((s,i)=>(
            <tr key={s.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:s.active?1:0.55}}>
              <TD ch={<div><div style={{fontWeight:600,fontSize:12}}>{s.name}</div><div style={{fontSize:10,color:C.mu}}>{s.inn}</div></div>}/>
              <TD ch={<Bdg c={C.pu} bg={C.puBg} bd={C.puBd} ch={s.category}/>}/>
              <TD ch={<div><div style={{fontSize:12}}>{s.contact}</div><div style={{fontSize:10,color:C.mu}}>{s.phone}</div></div>}/>
              <TD ch={<span style={{fontSize:12,color:C.md}}>{s.payment_terms} дн.</span>}/>
              <TD ch={<span style={{fontWeight:700,fontSize:12,color:s.debt>0?C.rd:C.gn}}>{s.debt>0?fmt(s.debt)+" ₸":"✓ Нет"}</span>}/>
              <TD ch={<Bdg c={s.active?C.gn:C.mu} bg={s.active?C.gnBg:C.lt} bd={s.active?C.gnBd:C.bdr} ch={s.active?"Активен":"Неактивен"}/>}/>
              <TD ch={<div style={{display:"flex",gap:4}}>
                <button onClick={()=>{setSupF({...s});setSupModal(s as Supplier);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                <button onClick={()=>toggleActive(s as Supplier)} style={{background:s.active?C.rdBg:C.gnBg,border:`1px solid ${s.active?C.rdBd:C.gnBd}`,color:s.active?C.rd:C.gn,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>{s.active?"Откл":"Вкл"}</button>
              </div>}/>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>);
  }

  function renderPurchases(){
    const filtered=purchases.filter((p:Purchase)=>{
      if(storeFilter==="central"&&p.store_id!==null)return false;
      if(storeFilter!=="all"&&storeFilter!=="central"&&String(p.store_id)!==storeFilter)return false;
      if(statusFilter!=="all"&&p.status!==statusFilter)return false;
      return true;
    });
    return(<div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>{setPurF({date:todayStr(),status:"pending",store_id:null,invoice:"",comment:""});setPurModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Закупка</button>
        <select value={storeFilter} onChange={e=>setStoreFilter(e.target.value)} style={I({width:"auto"})}><option value="all">Все магазины</option>{stores.map((s:any)=><option key={s.id} value={String(s.id)}>{s.name}</option>)}<option value="central">Централизованно</option></select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={I({width:"auto"})}><option value="all">Все статусы</option>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
        <span style={{marginLeft:"auto",fontSize:11,color:C.mu}}>Итого: <strong style={{color:C.tx}}>{fmt(filtered.reduce((s,p)=>s+Number(p.amount),0))} ₸</strong></span>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик"/><TH ch="Магазин"/><TH ch="Накладная"/><TH ch="Сумма"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{filtered.map((p:Purchase,i:number)=>{
            const sup=suppliers.find((s:Supplier)=>s.id===p.supplier_id);
            const st=STATUS_CFG[p.status]||STATUS_CFG.pending;
            return(<tr key={p.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(p.date)}</span>}/>
              <TD ch={<div><div style={{fontWeight:600,fontSize:12}}>{sup?.name||"—"}</div><div style={{fontSize:10,color:C.mu}}>{p.comment}</div></div>}/>
              <TD ch={<span style={{fontSize:11,color:C.md}}>{p.store_id?sn(p.store_id):<span style={{color:C.mu,fontStyle:"italic"}}>Центр</span>}</span>}/>
              <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.md}}>{p.invoice||"—"}</span>}/>
              <TD ch={<strong style={{fontSize:12}}>{fmt(Number(p.amount))} ₸</strong>}/>
              <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.label}/>}/>
              <TD ch={<div style={{display:"flex",gap:4}}>
                <button onClick={()=>{setPurF({...p});setPurModal(p);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                {p.status!=="paid"&&<button onClick={()=>{setPayF({date:todayStr(),method:"bank",purchase_id:p.id,supplier_id:p.supplier_id,amount:p.amount,note:`Оплата по ${p.invoice||"накладной"}`});setPayModal(true);}} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>💳</button>}
              </div>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>);
  }

  function renderPayments(){
    const debtors=supSummary.filter(s=>s.debt>0);
    return(<div>
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
        <button onClick={()=>{setPayF({date:todayStr(),method:"bank"});setPayModal(true);}} style={{background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Оплата</button>
        <span style={{marginLeft:"auto",fontSize:11,color:C.mu}}>Оплачено всего: <strong style={{color:C.gn}}>{fmt(totalPaid)} ₸</strong></span>
      </div>
      {debtors.length>0&&<div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        {debtors.map(s=><div key={s.id} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,borderRadius:10,padding:"9px 14px",flex:"1 1 180px"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.tx,marginBottom:2}}>{s.name}</div>
          <div style={{fontSize:17,fontWeight:800,color:C.rd}}>{fmt(s.debt)} ₸</div>
          <div style={{fontSize:10,color:C.mu,marginTop:2}}>Отсрочка: {s.payment_terms} дн.</div>
        </div>)}
      </div>}
      {debtors.length===0&&payments.length>0&&<div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.gn,fontWeight:600,marginBottom:14}}>✅ Долгов перед поставщиками нет</div>}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик"/><TH ch="Накладная"/><TH ch="Способ"/><TH ch="Сумма"/><TH ch="Примечание"/></tr></thead>
          <tbody>{payments.map((pay:Payment,i:number)=>{
            const sup=suppliers.find((s:Supplier)=>s.id===pay.supplier_id);
            const pur=purchases.find((p:Purchase)=>p.id===pay.purchase_id);
            return(<tr key={pay.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(pay.date)}</span>}/>
              <TD ch={<span style={{fontWeight:600,fontSize:12}}>{sup?.name||"—"}</span>}/>
              <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.md}}>{pur?.invoice||"—"}</span>}/>
              <TD ch={pay.method==="bank"?<Bdg c={C.bl} bg={C.blBg} bd={C.blBd} ch="🏦 Банк"/>:<Bdg c={C.am} bg={C.amBg} bd={C.amBd} ch="💵 Нал"/>}/>
              <TD ch={<strong style={{fontSize:12,color:C.gn}}>{fmt(Number(pay.amount))} ₸</strong>}/>
              <TD ch={<span style={{fontSize:11,color:C.mu}}>{pay.note||"—"}</span>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>);
  }

  return(<div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14}}>
      <div>
        <h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>🏭 Поставщики и закупки</h2>
        <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>{SUP_TABS.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={subTabBtn(tab===t.k)}>{t.l}</button>)}</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:90}}><div style={{fontSize:16,fontWeight:800,color:C.tx}}>{suppliers.filter((s:Supplier)=>s.active).length}</div><div style={{fontSize:9,color:C.mu,fontWeight:700}}>ПОСТАВЩИКОВ</div></div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:110}}><div style={{fontSize:16,fontWeight:800,color:C.tx}}>{fmt(totalBought)} ₸</div><div style={{fontSize:9,color:C.mu,fontWeight:700}}>ЗАКУПОК</div></div>
        <div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:110}}><div style={{fontSize:16,fontWeight:800,color:C.gn}}>{fmt(totalPaid)} ₸</div><div style={{fontSize:9,color:C.gn,fontWeight:700}}>ОПЛАЧЕНО</div></div>
        <div style={{background:totalDebt>0?C.rdBg:C.gnBg,border:`1px solid ${totalDebt>0?C.rdBd:C.gnBd}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:110}}><div style={{fontSize:16,fontWeight:800,color:totalDebt>0?C.rd:C.gn}}>{fmt(totalDebt)} ₸</div><div style={{fontSize:9,color:totalDebt>0?C.rd:C.gn,fontWeight:700}}>ДОЛГ</div></div>
        {overdueCount>0&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:80}}><div style={{fontSize:16,fontWeight:800,color:C.am}}>{overdueCount}</div><div style={{fontSize:9,color:C.am,fontWeight:700}}>ПРОСРОЧ.</div></div>}
      </div>
    </div>

    {tab==="suppliers"&&renderSuppliers()}
    {tab==="purchases"&&renderPurchases()}
    {tab==="payments"&&renderPayments()}

    {supModal&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:440,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{supModal==="add"?"Новый поставщик":"Редактировать поставщика"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {([["НАИМЕНОВАНИЕ","name"],["ИИН/БИН","inn"],["КОНТАКТНОЕ ЛИЦО","contact"],["ТЕЛЕФОН","phone"],["EMAIL","email"]] as [string,keyof Supplier][]).map(([lbl,key])=>(
            <div key={key}><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>{lbl}</div><input type="text" value={(supF[key] as string)||""} onChange={e=>setSupF({...supF,[key]:e.target.value})} style={I()}/></div>
          ))}
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>КАТЕГОРИЯ</div><select value={supF.category||""} onChange={e=>setSupF({...supF,category:e.target.value})} style={I()}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОТСРОЧКА ПЛАТЕЖА (ДНЕЙ)</div><input type="number" value={supF.payment_terms||""} onChange={e=>setSupF({...supF,payment_terms:+e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setSupModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveSupplier} disabled={saving||!supF.name?.trim()} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>)}

    {purModal&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{purModal==="add"?"Новая закупка":"Редактировать закупку"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div><input type="date" value={purF.date||""} onChange={e=>setPurF({...purF,date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div><select value={purF.supplier_id||""} onChange={e=>setPurF({...purF,supplier_id:+e.target.value})} style={I()}><option value="">— Выбрать —</option>{suppliers.filter((s:Supplier)=>s.active).map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН (или централизованно)</div><select value={purF.store_id||""} onChange={e=>setPurF({...purF,store_id:e.target.value?+e.target.value:null})} style={I()}><option value="">Централизованно</option>{stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НОМЕР НАКЛАДНОЙ</div><input type="text" value={purF.invoice||""} onChange={e=>setPurF({...purF,invoice:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА (₸)</div><input type="number" value={purF.amount||""} onChange={e=>setPurF({...purF,amount:+e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СОСТАВ / КОММЕНТАРИЙ</div><input type="text" value={purF.comment||""} onChange={e=>setPurF({...purF,comment:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СТАТУС</div><select value={purF.status||"pending"} onChange={e=>setPurF({...purF,status:e.target.value})} style={I()}>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setPurModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={savePurchase} disabled={saving||!purF.supplier_id||!purF.amount} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>)}

    {payModal&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:400,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Регистрация оплаты</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div><input type="date" value={payF.date||""} onChange={e=>setPayF({...payF,date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div><select value={payF.supplier_id||""} onChange={e=>setPayF({...payF,supplier_id:+e.target.value,purchase_id:undefined})} style={I()}><option value="">— Выбрать —</option>{suppliers.map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ЗАКУПКА (НАКЛАДНАЯ)</div><select value={payF.purchase_id||""} onChange={e=>{const pur=purchases.find((p:Purchase)=>p.id===+e.target.value);setPayF({...payF,purchase_id:+e.target.value,amount:pur?.amount});}} style={I()}><option value="">— Выбрать —</option>{purchases.filter((p:Purchase)=>p.status!=="paid"&&(!payF.supplier_id||p.supplier_id===Number(payF.supplier_id))).map((p:Purchase)=><option key={p.id} value={p.id}>{p.invoice||"б/н"} — {fmt(Number(p.amount))} ₸</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА ОПЛАТЫ (₸)</div><input type="number" value={payF.amount||""} onChange={e=>setPayF({...payF,amount:+e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СПОСОБ ОПЛАТЫ</div>
            <div style={{display:"flex",gap:6}}>
              {([["bank","🏦 Безналичный"],["cash","💵 Наличные"]] as const).map(([val,label])=>(
                <button key={val} onClick={()=>setPayF({...payF,method:val})} style={{flex:1,padding:"7px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:payF.method===val?(val==="bank"?C.blBg:C.amBg):C.lt,border:`2px solid ${payF.method===val?(val==="bank"?C.blBd:C.amBd):C.bdr}`,color:payF.method===val?(val==="bank"?C.bl:C.am):C.mu}}>{label}</button>
              ))}
            </div>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПРИМЕЧАНИЕ</div><input type="text" value={payF.note||""} onChange={e=>setPayF({...payF,note:e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setPayModal(false)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={savePayment} disabled={saving||!payF.supplier_id||!payF.amount} style={{flex:1,background:C.gn,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>💳 Провести</button>
        </div>
      </div>
    </div>)}
  </div>);
}
