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
const fullName = (e:any) => e ? [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ") : "";
const shortName = (e:any) => e ? [e.last_name, e.first_name?e.first_name[0]+".":""].filter(Boolean).join(" ") : "";

const DEBT_TABS = [{k:"list",l:"📋 Текущие долги"},{k:"moves",l:"📜 Движения"},{k:"summary",l:"📊 Свод по месяцам"}];

async function loadXLSX() {
  if ((window as any).XLSX) return (window as any).XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve((window as any).XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

interface DebtModuleProps { sb:any; emps:any[]; stores:any[]; debts:any[]; setDebts:(d:any)=>void; debtMoves:any[]; setDebtMoves:(d:any)=>void; }

export default function DebtModule({ sb, emps, stores, debts, setDebts, debtMoves, setDebtMoves }: DebtModuleProps) {
  const [tab, setTab] = useState("list");
  const [addMoveM, setAddMoveM] = useState<any>(null);
  const [detailEmp, setDetailEmp] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [nmove, setNmove] = useState({date:new Date().toISOString().slice(0,10),move_type:"charge",amount:"",comment:"",store_id:""});

  const sn = (id:any) => stores.find((s:any)=>s.id===id)?.name||"";
  const empObj = (id:any) => emps.find((e:any)=>e.id===id);

  const empSummary = useMemo(() => {
    const empIds = [...new Set(debts.map((d:any)=>d.emp_id))];
    return empIds.map(empId => {
      const emp = empObj(empId);
      const empDebts = debts.filter((d:any)=>d.emp_id===empId);
      const empDebtIds = empDebts.map((d:any)=>d.id);
      const empMoves = debtMoves.filter((m:any)=>empDebtIds.includes(m.debt_id));
      const initialTotal = empDebts.reduce((s:number,d:any)=>s+Number(d.initial_amount),0);
      const charges = empMoves.filter((m:any)=>m.move_type==="charge").reduce((s:number,m:any)=>s+Number(m.amount),0);
      const repays = empMoves.filter((m:any)=>m.move_type==="repay").reduce((s:number,m:any)=>s+Number(m.amount),0);
      const balance = initialTotal+charges-repays;
      return {empId,emp,empDebts,empMoves,initialTotal,charges,repays,balance,isFired:emp&&!emp.active};
    }).sort((a,b)=>b.balance-a.balance);
  },[debts,debtMoves,emps]);

  const totalDebt = empSummary.reduce((s:number,e:any)=>s+Math.max(0,e.balance),0);

  function openAddMove(empId:any) {
    const emp = empObj(empId);
    setNmove({date:new Date().toISOString().slice(0,10),move_type:"charge",amount:"",comment:"",store_id:String(emp?.default_store||stores[0]?.id||"")});
    setAddMoveM({empId});
  }

  async function addMove() {
    if(!addMoveM||!nmove.amount) return;
    setSaving(true);
    const empId=addMoveM.empId;
    const storeId=+nmove.store_id||stores[0]?.id;
    let debt=debts.find((d:any)=>d.emp_id===empId&&d.store_id===storeId&&d.status==="active");
    if(!debt){
      const{data,error}=await sb.from("debts").insert({emp_id:empId,store_id:storeId,initial_amount:0,reason:"Ущерб",status:"active"}).select().single();
      if(error||!data){setSaving(false);return;}
      debt=data;
      setDebts([...debts,data]);
    }
    const{data:moveData,error:moveErr}=await sb.from("debt_moves").insert({debt_id:debt.id,date:nmove.date,move_type:nmove.move_type,amount:+nmove.amount,comment:nmove.comment||""}).select().single();
    if(!moveErr&&moveData) setDebtMoves([moveData,...debtMoves]);
    setSaving(false);
    setAddMoveM(null);
  }

  async function deleteMove(moveId:number) {
    await sb.from("debt_moves").delete().eq("id",moveId);
    setDebtMoves(debtMoves.filter((m:any)=>m.id!==moveId));
  }

  async function exportStatement(empId:any) {
    const XLSX=await loadXLSX();
    const emp=empObj(empId);
    if(!emp)return;
    const summary=empSummary.find(e=>e.empId===empId);
    if(!summary)return;
    const wb=XLSX.utils.book_new();
    const rows:any[]=[];
    let running=0;
    summary.empDebts.forEach((d:any)=>{if(Number(d.initial_amount)>0){running+=Number(d.initial_amount);rows.push({date:d.created_at||"—",type:"Первоначальный долг",store:sn(d.store_id),amount:Number(d.initial_amount),running,comment:d.reason||""});}});
    [...summary.empMoves].sort((a:any,b:any)=>a.date.localeCompare(b.date)).forEach((m:any)=>{
      const ic=m.move_type==="charge";const debt=debts.find((d:any)=>d.id===m.debt_id);
      running+=ic?Number(m.amount):-Number(m.amount);
      rows.push({date:m.date,type:ic?"Начисление ущерба":"Удержание",store:debt?sn(debt.store_id):"—",amount:ic?Number(m.amount):-Number(m.amount),running,comment:m.comment||""});
    });
    const data=[[`ВЫПИСКА ПО ЗАДОЛЖЕННОСТИ: ${fullName(emp)}`],[`Дата: ${new Date().toLocaleDateString("ru-RU")}  |  Долг: ${fmt(summary.balance)} ₸`],[],["Дата","Операция","Магазин","Сумма (₸)","Остаток (₸)","Комментарий"],...rows.map(r=>[r.date,r.type,r.store,Math.round(r.amount),Math.round(r.running),r.comment])];
    const ws=XLSX.utils.aoa_to_sheet(data);
    ws['!cols']=[{wch:12},{wch:22},{wch:20},{wch:14},{wch:14},{wch:30}];
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}},{s:{r:1,c:0},e:{r:1,c:5}}];
    XLSX.utils.book_append_sheet(wb,ws,"Выписка");
    XLSX.writeFile(wb,`Выписка_${fullName(emp)}.xlsx`);
  }

  const subTabBtn=(active:boolean)=>({background:active?C.w:"none",border:`1px solid ${active?C.bdr:"transparent"}`,borderRadius:7,cursor:"pointer",padding:"6px 14px",fontSize:11,fontWeight:600,fontFamily:"inherit",color:active?C.or:C.mu,boxShadow:active?"0 1px 3px rgba(0,0,0,.07)":"none"});

  function renderList() {
    return(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:14}}>
        <div style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:9,color:C.rd,fontWeight:700,marginBottom:4}}>ОБЩИЙ ДОЛГ</div><div style={{fontSize:22,fontWeight:800,color:C.rd}}>{fmt(totalDebt)} ₸</div></div>
        <div style={{background:C.orBg,border:`1px solid ${C.orBd}`,borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:9,color:C.or,fontWeight:700,marginBottom:4}}>С ДОЛГОМ</div><div style={{fontSize:22,fontWeight:800,color:C.or}}>{empSummary.filter(e=>e.balance>0).length}</div></div>
        <div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:10,padding:"12px 16px"}}><div style={{fontSize:9,color:C.gn,fontWeight:700,marginBottom:4}}>БЕЗ ДОЛГА</div><div style={{fontSize:22,fontWeight:800,color:C.gn}}>{empSummary.filter(e=>e.balance<=0).length}</div></div>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        {empSummary.length===0
          ?<div style={{padding:40,textAlign:"center",color:C.mu}}><div style={{fontSize:28,marginBottom:8}}>📋</div><div style={{fontSize:13,fontWeight:600}}>Нет задолженностей</div></div>
          :<table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
            <thead><tr><TH ch="Сотрудник"/><TH ch="Первонач."/><TH ch="Начислено"/><TH ch="Удержано"/><TH ch="Остаток"/><TH ch=""/></tr></thead>
            <tbody>{empSummary.map((row:any,i:number)=>(<tr key={row.empId} style={{background:i%2===0?C.w:"#fafbfc",opacity:row.balance>0?1:0.6}}>
              <TD ch={<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,color:C.bl}}>{row.emp?shortName(row.emp):"?"}</span>{row.isFired&&<Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="уволен"/>}</div>}/>
              <TD ch={<span style={{color:C.md}}>{fmt(row.initialTotal)} ₸</span>}/>
              <TD ch={row.charges>0?<span style={{color:C.rd,fontWeight:600}}>+{fmt(row.charges)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
              <TD ch={row.repays>0?<span style={{color:C.gn,fontWeight:600}}>−{fmt(row.repays)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
              <TD ch={<span style={{fontWeight:800,fontSize:13,color:row.balance>0?C.rd:C.gn}}>{fmt(row.balance)} ₸</span>}/>
              <TD ch={<div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                <button onClick={()=>openAddMove(row.empId)} style={{background:C.orBg,border:`1px solid ${C.orBd}`,color:C.or,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontWeight:600}}>+ Движение</button>
                <button onClick={()=>setDetailEmp(row.empId)} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer"}}>📜 История</button>
                <button onClick={()=>exportStatement(row.empId)} style={{background:C.puBg,border:`1px solid ${C.puBd}`,color:C.pu,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer"}}>📥 Выписка</button>
              </div>}/>
            </tr>))}</tbody>
            <tfoot><tr style={{background:C.rdBg}}><td colSpan={4} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.rd,borderTop:`2px solid ${C.rdBd}`}}>ИТОГО</td><td style={{padding:"8px 10px",fontWeight:800,fontSize:14,color:C.rd,borderTop:`2px solid ${C.rdBd}`}}>{fmt(totalDebt)} ₸</td><td style={{borderTop:`2px solid ${C.rdBd}`}}></td></tr></tfoot>
          </table>}
      </div>
    </div>);
  }

  function renderMoves() {
    const sorted=[...debtMoves].sort((a:any,b:any)=>b.date.localeCompare(a.date)||b.id-a.id);
    return(<div>
      <div style={{marginBottom:12,display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>{const first=empSummary[0]?.empId||emps[0]?.id;if(first)openAddMove(first);}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Новое движение</button>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        {sorted.length===0?<div style={{padding:40,textAlign:"center",color:C.mu}}><div style={{fontSize:28,marginBottom:8}}>📜</div><div style={{fontSize:13,fontWeight:600}}>Нет движений</div></div>
        :<table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
          <thead><tr><TH ch="Дата"/><TH ch="Сотрудник"/><TH ch="Магазин"/><TH ch="Тип"/><TH ch="Сумма"/><TH ch="Комментарий"/><TH ch=""/></tr></thead>
          <tbody>{sorted.map((m:any,i:number)=>{const debt=debts.find((d:any)=>d.id===m.debt_id);const emp=debt?empObj(debt.emp_id):null;const ic=m.move_type==="charge";return(<tr key={m.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
            <TD ch={<span style={{fontSize:11,color:C.md}}>{m.date}</span>}/>
            <TD ch={emp?<span style={{fontWeight:600,color:C.bl}}>{shortName(emp)}</span>:"?"}/>
            <TD ch={debt?<span style={{fontSize:11,color:C.md}}>{sn(debt.store_id)}</span>:"—"}/>
            <TD ch={ic?<Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="Начисление"/>:<Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Удержание"/>}/>
            <TD ch={<span style={{fontWeight:700,color:ic?C.rd:C.gn}}>{ic?"+":"−"}{fmt(Number(m.amount))} ₸</span>}/>
            <TD ch={<span style={{fontSize:11,color:C.mu}}>{m.comment||"—"}</span>}/>
            <TD ch={<button onClick={()=>deleteMove(m.id)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"2px 6px",borderRadius:4,fontSize:10,cursor:"pointer"}}>✕</button>}/>
          </tr>);})}</tbody>
        </table>}
      </div>
    </div>);
  }

  function renderSummary() {
    const allMonths=new Set<string>();debtMoves.forEach((m:any)=>allMonths.add(m.date.slice(0,7)));
    const months=Array.from(allMonths).sort();if(months.length===0)months.push(new Date().toISOString().slice(0,7));
    return(<div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <div style={{padding:"10px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>Свод по месяцам</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead>
            <tr><TH ch="Сотрудник"/><TH ch="Первонач."/>{months.map(mo=><th key={mo} colSpan={3} style={{padding:"6px 4px",textAlign:"center",fontSize:9,fontWeight:700,color:C.or,background:C.lt,borderBottom:`1px solid ${C.bdr}`,borderLeft:`2px solid ${C.bdr}`}}>{mo}</th>)}<TH ch="Остаток"/></tr>
            <tr><th colSpan={2} style={{borderBottom:`1px solid ${C.bdr}`}}></th>{months.map(mo=><React.Fragment key={mo+"h"}><th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.rd,background:C.rdBg,borderBottom:`1px solid ${C.bdr}`,borderLeft:`2px solid ${C.bdr}`,fontWeight:600}}>Начисл.</th><th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.gn,background:C.gnBg,borderBottom:`1px solid ${C.bdr}`,fontWeight:600}}>Удерж.</th><th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.md,background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontWeight:600}}>Остаток</th></React.Fragment>)}<th style={{borderBottom:`1px solid ${C.bdr}`}}></th></tr>
          </thead>
          <tbody>{empSummary.filter(r=>r.balance>0||r.empMoves.length>0).map((row:any,i:number)=>{let rb=row.initialTotal;return(<tr key={row.empId} style={{background:i%2===0?C.w:"#fafbfc"}}>
            <TD ch={<span style={{fontWeight:600,fontSize:11,color:C.bl}}>{row.emp?shortName(row.emp):"?"}{row.isFired?" (ув.)":""}</span>}/>
            <TD ch={<span style={{fontSize:11,color:C.md}}>{fmt(row.initialTotal)}</span>}/>
            {months.map(mo=>{const mm=row.empMoves.filter((m:any)=>m.date.startsWith(mo));const ch=mm.filter((m:any)=>m.move_type==="charge").reduce((s:number,m:any)=>s+Number(m.amount),0);const rp=mm.filter((m:any)=>m.move_type==="repay").reduce((s:number,m:any)=>s+Number(m.amount),0);rb=rb+ch-rp;return(<React.Fragment key={mo}><td style={{padding:"6px 4px",textAlign:"center",fontSize:10,borderBottom:"1px solid #f1f5f9",borderLeft:`2px solid ${C.bdr}`,color:ch>0?C.rd:C.mu}}>{ch>0?fmt(ch):"—"}</td><td style={{padding:"6px 4px",textAlign:"center",fontSize:10,borderBottom:"1px solid #f1f5f9",color:rp>0?C.gn:C.mu}}>{rp>0?fmt(rp):"—"}</td><td style={{padding:"6px 4px",textAlign:"center",fontSize:10,fontWeight:600,borderBottom:"1px solid #f1f5f9",color:rb>0?C.tx:C.gn}}>{fmt(rb)}</td></React.Fragment>);})}
            <TD ch={<span style={{fontWeight:800,fontSize:12,color:row.balance>0?C.rd:C.gn}}>{fmt(row.balance)} ₸</span>}/>
          </tr>);})}</tbody>
        </table>
      </div>
    </div>);
  }

  return(<div>
    <div style={{marginBottom:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div><h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>💳 Задолженности сотрудников</h2>
        <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>{DEBT_TABS.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={subTabBtn(tab===t.k)}>{t.l}</button>)}</div>
      </div>
    </div>
    {tab==="list"&&renderList()}
    {tab==="moves"&&renderMoves()}
    {tab==="summary"&&renderSummary()}

    {addMoveM&&(()=>{const emp=empObj(addMoveM.empId);const summary=empSummary.find(e=>e.empId===addMoveM.empId);return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Добавить движение</div>
        <div style={{fontSize:11,color:C.mu,marginBottom:14}}>{emp?fullName(emp):"?"} · Долг: <strong style={{color:C.rd}}>{fmt(summary?.balance||0)} ₸</strong></div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СОТРУДНИК</div>
            <select value={addMoveM.empId} onChange={e=>{const id=+e.target.value;const em=empObj(id);setAddMoveM({empId:id});setNmove({...nmove,store_id:String(em?.default_store||stores[0]?.id||"")});}} style={I()}>{emps.map((e:any)=><option key={e.id} value={e.id}>{fullName(e)}{!e.active?" (уволен)":""}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div>
            <select value={nmove.store_id} onChange={e=>setNmove({...nmove,store_id:e.target.value})} style={I()}>{stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div><input type="date" value={nmove.date} onChange={e=>setNmove({...nmove,date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТИП</div>
            <div style={{display:"flex",gap:6}}>{([["charge","🔴 Начисление"],["repay","🟢 Удержание"]] as const).map(([val,label])=><button key={val} onClick={()=>setNmove({...nmove,move_type:val})} style={{flex:1,padding:"8px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:nmove.move_type===val?(val==="charge"?C.rdBg:C.gnBg):C.lt,border:`2px solid ${nmove.move_type===val?(val==="charge"?C.rdBd:C.gnBd):C.bdr}`,color:nmove.move_type===val?(val==="charge"?C.rd:C.gn):C.mu}}>{label}</button>)}</div></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА (₸)</div><input type="number" value={nmove.amount} onChange={e=>setNmove({...nmove,amount:e.target.value})} placeholder="0" style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>КОММЕНТАРИЙ</div><input type="text" value={nmove.comment} onChange={e=>setNmove({...nmove,comment:e.target.value})} placeholder="Ревизия, касса..." style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setAddMoveM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={addMove} disabled={saving||!nmove.amount} style={{flex:1,background:nmove.move_type==="charge"?C.rd:C.gn,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:!nmove.amount?0.5:1}}>{nmove.move_type==="charge"?"Начислить":"Удержать"}</button>
        </div>
      </div>
    </div>);})()}

    {detailEmp&&(()=>{const summary=empSummary.find(e=>e.empId===detailEmp);if(!summary)return null;const emp=summary.emp;
      const history:{date:string,type:string,store:string,amount:number,running:number,comment:string}[]=[];let running=0;
      summary.empDebts.forEach((d:any)=>{if(Number(d.initial_amount)>0){running+=Number(d.initial_amount);history.push({date:d.created_at||"—",type:"Первоначальный долг",store:sn(d.store_id),amount:Number(d.initial_amount),running,comment:d.reason||""});}});
      [...summary.empMoves].sort((a:any,b:any)=>a.date.localeCompare(b.date)).forEach((m:any)=>{const ic=m.move_type==="charge";const debt=debts.find((d:any)=>d.id===m.debt_id);running+=ic?Number(m.amount):-Number(m.amount);history.push({date:m.date,type:ic?"Начисление ущерба":"Удержание",store:debt?sn(debt.store_id):"—",amount:ic?Number(m.amount):-Number(m.amount),running,comment:m.comment||""});});
      return(
      <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:24,width:620,maxWidth:"96vw",boxShadow:"0 24px 60px rgba(0,0,0,.18)",maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div><div style={{fontWeight:800,fontSize:15}}>{emp?fullName(emp):"?"}</div><div style={{fontSize:11,color:C.mu,marginTop:2}}>История задолженности</div></div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={()=>exportStatement(detailEmp)} style={{background:C.puBg,border:`1px solid ${C.puBd}`,color:C.pu,padding:"5px 12px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>📥 Скачать Excel</button>
              <button onClick={()=>setDetailEmp(null)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <div style={{flex:1,background:C.lt,borderRadius:8,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:9,color:C.mu,fontWeight:700}}>Первоначальный</div><div style={{fontSize:16,fontWeight:800,color:C.tx}}>{fmt(summary.initialTotal)} ₸</div></div>
            <div style={{flex:1,background:C.rdBg,borderRadius:8,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:9,color:C.rd,fontWeight:700}}>Текущий долг</div><div style={{fontSize:16,fontWeight:800,color:C.rd}}>{fmt(summary.balance)} ₸</div></div>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH ch="Дата"/><TH ch="Операция"/><TH ch="Магазин"/><TH ch="Сумма"/><TH ch="Остаток"/><TH ch="Комм."/></tr></thead>
            <tbody>{history.map((h,idx)=>{const ip=h.amount>0;return(<tr key={idx} style={{background:idx%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:10,color:C.md}}>{h.date}</span>}/>
              <TD ch={h.type==="Первоначальный долг"?<span style={{fontSize:10,fontWeight:600,color:C.md}}>{h.type}</span>:ip?<Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="Начисление"/>:<Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Удержание"/>}/>
              <TD ch={<span style={{fontSize:10,color:C.md}}>{h.store}</span>}/>
              <TD ch={<span style={{fontWeight:600,color:ip?C.rd:C.gn}}>{ip?"+":"−"}{fmt(Math.abs(h.amount))} ₸</span>}/>
              <TD ch={<span style={{fontWeight:700,color:h.running>0?C.tx:C.gn}}>{fmt(h.running)} ₸</span>}/>
              <TD ch={<span style={{fontSize:10,color:C.mu}}>{h.comment||"—"}</span>}/>
            </tr>);})}</tbody>
          </table>
        </div>
      </div>);})()}
  </div>);
}
