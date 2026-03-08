import React, { useState, useMemo } from "react";

// Цвета и стили (совместимы с App.tsx)
const C = {
  bg:"#f8fafc",w:"#fff",bdr:"#e2e8f0",lt:"#f1f5f9",tx:"#0f172a",md:"#475569",mu:"#94a3b8",
  or:"#ea580c",orBg:"#fff7ed",orBd:"#fed7aa",gn:"#16a34a",gnBg:"#f0fdf4",gnBd:"#bbf7d0",
  rd:"#dc2626",rdBg:"#fef2f2",rdBd:"#fecaca",bl:"#2563eb",blBg:"#eff6ff",blBd:"#bfdbfe",
  am:"#b45309",amBg:"#fffbeb",amBd:"#fde68a",pu:"#7c3aed",puBg:"#f5f3ff",puBd:"#ddd6fe"
};
const I = (ex={}) => ({background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,borderRadius:6,padding:"6px 9px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,width:"100%",...ex});
const TH = ({ch}:{ch:string}) => <th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.mu,letterSpacing:"0.5px",textTransform:"uppercase",whiteSpace:"nowrap",background:C.lt,borderBottom:`1px solid ${C.bdr}`}}>{ch}</th>;
const TD = ({ch,s={}}:{ch:any,s?:any}) => <td style={{padding:"8px 10px",fontSize:12,borderBottom:"1px solid #f1f5f9",...s}}>{ch}</td>;
const Bdg = ({c,bg,bd,ch}:{c:string,bg:string,bd:string,ch:string}) => <span style={{background:bg,border:`1px solid ${bd}`,color:c,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{ch}</span>;
const fmt = (n:number) => Math.round(n).toLocaleString();
const fullName = (e:any) => e ? [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ") : "";
const shortName = (e:any) => e ? [e.last_name, e.first_name?e.first_name[0]+".":""].filter(Boolean).join(" ") : "";

const DEBT_TABS = [
  {k:"list", l:"📋 Текущие долги"},
  {k:"moves", l:"📜 Движения"},
  {k:"summary", l:"📊 Свод по месяцам"},
];

interface DebtModuleProps {
  sb: any;
  emps: any[];
  stores: any[];
  debts: any[];
  setDebts: (d:any) => void;
  debtMoves: any[];
  setDebtMoves: (d:any) => void;
}

export default function DebtModule({ sb, emps, stores, debts, setDebts, debtMoves, setDebtMoves }: DebtModuleProps) {
  const [tab, setTab] = useState("list");
  const [addDebtM, setAddDebtM] = useState(false);
  const [addMoveM, setAddMoveM] = useState<any>(null); // debt to add move to
  const [detailDebt, setDetailDebt] = useState<any>(null);
  const [summaryMo, setSummaryMo] = useState(new Date().toISOString().slice(0,7));
  const [saving, setSaving] = useState(false);

  // Form state
  const [ndebt, setNdebt] = useState({emp_id:"", store_id:"", initial_amount:"", reason:"Ущерб", note:""});
  const [nmove, setNmove] = useState({date:new Date().toISOString().slice(0,10), move_type:"charge", amount:"", comment:""});

  // Helpers
  const sn = (id:any) => stores.find((s:any)=>s.id===id)?.name || "";
  const empObj = (id:any) => emps.find((e:any)=>e.id===id);

  // Calculate current balance for a debt
  const balance = (debtId:number, initialAmount:number) => {
    const charges = debtMoves.filter(m=>m.debt_id===debtId && m.move_type==="charge").reduce((s,m)=>s+Number(m.amount),0);
    const repays = debtMoves.filter(m=>m.debt_id===debtId && m.move_type==="repay").reduce((s,m)=>s+Number(m.amount),0);
    return Number(initialAmount) + charges - repays;
  };

  // Enriched debts with balance
  const enrichedDebts = useMemo(() => 
    debts.map((d:any) => ({...d, balance: balance(d.id, d.initial_amount)})),
    [debts, debtMoves]
  );

  const activeDebts = enrichedDebts.filter((d:any) => d.status === "active");
  const closedDebts = enrichedDebts.filter((d:any) => d.status === "closed");
  const totalDebt = activeDebts.reduce((s:number,d:any) => s + d.balance, 0);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function createDebt() {
    if (!ndebt.emp_id || !ndebt.store_id || !ndebt.initial_amount) return;
    setSaving(true);
    const { data, error } = await sb.from("debts").insert({
      emp_id: +ndebt.emp_id,
      store_id: +ndebt.store_id,
      initial_amount: +ndebt.initial_amount,
      reason: ndebt.reason || "Ущерб",
      note: ndebt.note || "",
      status: "active",
    }).select().single();
    if (!error && data) setDebts([...debts, data]);
    setSaving(false);
    setAddDebtM(false);
    setNdebt({emp_id:"", store_id:"", initial_amount:"", reason:"Ущерб", note:""});
  }

  async function addMove() {
    if (!addMoveM || !nmove.amount) return;
    setSaving(true);
    const { data, error } = await sb.from("debt_moves").insert({
      debt_id: addMoveM.id,
      date: nmove.date,
      move_type: nmove.move_type,
      amount: +nmove.amount,
      comment: nmove.comment || "",
    }).select().single();
    if (!error && data) {
      setDebtMoves([data, ...debtMoves]);
      // Auto-close debt if balance becomes 0 or negative
      const newBal = balance(addMoveM.id, addMoveM.initial_amount) + 
        (nmove.move_type === "charge" ? +nmove.amount : -Number(nmove.amount));
      if (newBal <= 0 && addMoveM.status === "active") {
        await sb.from("debts").update({status:"closed"}).eq("id", addMoveM.id);
        setDebts(debts.map((d:any) => d.id === addMoveM.id ? {...d, status:"closed"} : d));
      }
    }
    setSaving(false);
    setAddMoveM(null);
    setNmove({date:new Date().toISOString().slice(0,10), move_type:"charge", amount:"", comment:""});
  }

  async function reopenDebt(debt:any) {
    await sb.from("debts").update({status:"active"}).eq("id", debt.id);
    setDebts(debts.map((d:any) => d.id === debt.id ? {...d, status:"active"} : d));
  }

  async function closeDebt(debt:any) {
    await sb.from("debts").update({status:"closed"}).eq("id", debt.id);
    setDebts(debts.map((d:any) => d.id === debt.id ? {...d, status:"closed"} : d));
  }

  async function deleteMove(moveId:number) {
    await sb.from("debt_moves").delete().eq("id", moveId);
    setDebtMoves(debtMoves.filter((m:any) => m.id !== moveId));
  }

  // ── SUMMARY: Monthly breakdown ──────────────────────────────────────────
  const summaryData = useMemo(() => {
    // Get all months from moves + current month
    const months = new Set<string>();
    debtMoves.forEach((m:any) => months.add(m.date.slice(0,7)));
    months.add(summaryMo);
    const sortedMonths = Array.from(months).sort();

    return enrichedDebts.filter((d:any) => d.status === "active" || d.balance > 0).map((debt:any) => {
      const emp = empObj(debt.emp_id);
      const monthData = sortedMonths.map(mo => {
        const moMoves = debtMoves.filter((m:any) => m.debt_id === debt.id && m.date.startsWith(mo));
        const charged = moMoves.filter((m:any)=>m.move_type==="charge").reduce((s:number,m:any)=>s+Number(m.amount),0);
        const repaid = moMoves.filter((m:any)=>m.move_type==="repay").reduce((s:number,m:any)=>s+Number(m.amount),0);
        return { month: mo, charged, repaid };
      });
      return { debt, emp, monthData };
    });
  }, [enrichedDebts, debtMoves, summaryMo]);

  // ── SUB-TAB STYLE ─────────────────────────────────────────────────────────
  const subTabBtn = (active:boolean) => ({
    background:active?C.w:"none", border:`1px solid ${active?C.bdr:"transparent"}`,
    borderRadius:7, cursor:"pointer", padding:"6px 14px", fontSize:11, fontWeight:600,
    fontFamily:"inherit", color:active?C.or:C.mu, boxShadow:active?"0 1px 3px rgba(0,0,0,.07)":"none",
  });

  // ── RENDER: Список долгов ─────────────────────────────────────────────────
  function renderList() {
    return (<div>
      {/* Итого карточка */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:14}}>
        <div style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:C.rd,fontWeight:700,marginBottom:4}}>ОБЩИЙ ДОЛГ</div>
          <div style={{fontSize:22,fontWeight:800,color:C.rd}}>{fmt(totalDebt)} ₸</div>
        </div>
        <div style={{background:C.orBg,border:`1px solid ${C.orBd}`,borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:C.or,fontWeight:700,marginBottom:4}}>АКТИВНЫХ ДОЛГОВ</div>
          <div style={{fontSize:22,fontWeight:800,color:C.or}}>{activeDebts.length}</div>
        </div>
        <div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:9,color:C.gn,fontWeight:700,marginBottom:4}}>ЗАКРЫТЫХ</div>
          <div style={{fontSize:22,fontWeight:800,color:C.gn}}>{closedDebts.length}</div>
        </div>
      </div>

      {/* Таблица */}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        {activeDebts.length === 0 && closedDebts.length === 0
          ? <div style={{padding:40,textAlign:"center",color:C.mu}}><div style={{fontSize:28,marginBottom:8}}>📋</div><div style={{fontSize:13,fontWeight:600}}>Нет задолженностей</div></div>
          : <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead><tr>
              <TH ch="Сотрудник"/>
              <TH ch="Магазин"/>
              <TH ch="Причина"/>
              <TH ch="Первонач."/>
              <TH ch="Начислено"/>
              <TH ch="Удержано"/>
              <TH ch="Остаток"/>
              <TH ch="Статус"/>
              <TH ch=""/>
            </tr></thead>
            <tbody>
              {[...activeDebts, ...closedDebts].map((d:any, i:number) => {
                const emp = empObj(d.emp_id);
                const charges = debtMoves.filter((m:any)=>m.debt_id===d.id&&m.move_type==="charge").reduce((s:number,m:any)=>s+Number(m.amount),0);
                const repays = debtMoves.filter((m:any)=>m.debt_id===d.id&&m.move_type==="repay").reduce((s:number,m:any)=>s+Number(m.amount),0);
                const isActive = d.status === "active";
                const isFired = emp && !emp.active;
                return (
                  <tr key={d.id} style={{background:i%2===0?C.w:"#fafbfc", opacity:isActive?1:0.6}}>
                    <TD ch={<div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontWeight:700,color:C.bl}}>{emp ? shortName(emp) : "?"}</span>
                      {isFired && <Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="уволен"/>}
                    </div>}/>
                    <TD ch={<span style={{fontSize:11,color:C.md}}>{sn(d.store_id)}</span>}/>
                    <TD ch={<span style={{fontSize:11,color:C.md}}>{d.reason||"—"}</span>}/>
                    <TD ch={<span style={{color:C.md}}>{fmt(d.initial_amount)} ₸</span>}/>
                    <TD ch={charges>0?<span style={{color:C.rd,fontWeight:600}}>+{fmt(charges)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
                    <TD ch={repays>0?<span style={{color:C.gn,fontWeight:600}}>−{fmt(repays)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
                    <TD ch={<span style={{fontWeight:800,fontSize:13,color:d.balance>0?C.rd:C.gn}}>{fmt(d.balance)} ₸</span>}/>
                    <TD ch={isActive
                      ? <Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="Активен"/>
                      : <Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Закрыт"/>
                    }/>
                    <TD ch={<div style={{display:"flex",gap:3}}>
                      <button onClick={()=>{setAddMoveM(d);setNmove({date:new Date().toISOString().slice(0,10),move_type:"charge",amount:"",comment:""});}} style={{background:C.orBg,border:`1px solid ${C.orBd}`,color:C.or,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontWeight:600}}>+ Движение</button>
                      <button onClick={()=>setDetailDebt(d)} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer"}}>📜</button>
                      {isActive
                        ? <button onClick={()=>closeDebt(d)} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer"}}>✓ Закрыть</button>
                        : <button onClick={()=>reopenDebt(d)} style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer"}}>↺ Открыть</button>
                      }
                    </div>}/>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:C.rdBg}}>
                <td colSpan={6} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.rd,borderTop:`2px solid ${C.rdBd}`}}>ИТОГО АКТИВНЫХ</td>
                <td style={{padding:"8px 10px",fontWeight:800,fontSize:14,color:C.rd,borderTop:`2px solid ${C.rdBd}`}}>{fmt(totalDebt)} ₸</td>
                <td colSpan={2} style={{borderTop:`2px solid ${C.rdBd}`}}></td>
              </tr>
            </tfoot>
          </table>
        }
      </div>
    </div>);
  }

  // ── RENDER: Все движения ──────────────────────────────────────────────────
  function renderMoves() {
    const sorted = [...debtMoves].sort((a:any,b:any) => b.date.localeCompare(a.date) || b.id - a.id);
    return (<div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        {sorted.length === 0
          ? <div style={{padding:40,textAlign:"center",color:C.mu}}><div style={{fontSize:28,marginBottom:8}}>📜</div><div style={{fontSize:13,fontWeight:600}}>Нет движений</div></div>
          : <table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
            <thead><tr>
              <TH ch="Дата"/><TH ch="Сотрудник"/><TH ch="Магазин"/><TH ch="Тип"/><TH ch="Сумма"/><TH ch="Комментарий"/><TH ch=""/>
            </tr></thead>
            <tbody>
              {sorted.map((m:any, i:number) => {
                const debt = debts.find((d:any)=>d.id===m.debt_id);
                const emp = debt ? empObj(debt.emp_id) : null;
                const isCharge = m.move_type === "charge";
                return (
                  <tr key={m.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
                    <TD ch={<span style={{fontSize:11,color:C.md}}>{m.date}</span>}/>
                    <TD ch={emp ? <span style={{fontWeight:600,color:C.bl}}>{shortName(emp)}</span> : "?"}/>
                    <TD ch={debt ? <span style={{fontSize:11,color:C.md}}>{sn(debt.store_id)}</span> : "—"}/>
                    <TD ch={isCharge
                      ? <Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="Начисление"/>
                      : <Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Удержание"/>
                    }/>
                    <TD ch={<span style={{fontWeight:700,color:isCharge?C.rd:C.gn}}>
                      {isCharge?"+":"−"}{fmt(Number(m.amount))} ₸
                    </span>}/>
                    <TD ch={<span style={{fontSize:11,color:C.mu}}>{m.comment||"—"}</span>}/>
                    <TD ch={<button onClick={()=>deleteMove(m.id)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"2px 6px",borderRadius:4,fontSize:10,cursor:"pointer"}}>✕</button>}/>
                  </tr>
                );
              })}
            </tbody>
          </table>
        }
      </div>
    </div>);
  }

  // ── RENDER: Свод по месяцам ───────────────────────────────────────────────
  function renderSummary() {
    // Collect all months with data
    const allMonths = new Set<string>();
    debtMoves.forEach((m:any) => allMonths.add(m.date.slice(0,7)));
    const months = Array.from(allMonths).sort();
    if (months.length === 0) months.push(summaryMo);

    return (<div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <div style={{padding:"10px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>
          Свод по месяцам — аналог Google Таблицы
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead>
            <tr>
              <TH ch="Сотрудник"/>
              <TH ch="Магазин"/>
              <TH ch="Первонач."/>
              {months.map(mo => (
                <th key={mo} colSpan={3} style={{padding:"6px 4px",textAlign:"center",fontSize:9,fontWeight:700,color:C.or,letterSpacing:"0.5px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,borderLeft:`2px solid ${C.bdr}`}}>{mo}</th>
              ))}
              <TH ch="Остаток"/>
            </tr>
            <tr>
              <th colSpan={3} style={{borderBottom:`1px solid ${C.bdr}`}}></th>
              {months.map(mo => (
                <React.Fragment key={mo+"h"}>
                  <th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.rd,background:C.rdBg,borderBottom:`1px solid ${C.bdr}`,borderLeft:`2px solid ${C.bdr}`,fontWeight:600}}>Начисл.</th>
                  <th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.gn,background:C.gnBg,borderBottom:`1px solid ${C.bdr}`,fontWeight:600}}>Удерж.</th>
                  <th style={{padding:"4px 3px",textAlign:"center",fontSize:8,color:C.md,background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontWeight:600}}>Остаток</th>
                </React.Fragment>
              ))}
              <th style={{borderBottom:`1px solid ${C.bdr}`}}></th>
            </tr>
          </thead>
          <tbody>
            {enrichedDebts.filter(d=>d.status==="active"||d.balance>0).map((d:any, i:number) => {
              const emp = empObj(d.emp_id);
              let runBal = Number(d.initial_amount);
              return (
                <tr key={d.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
                  <TD ch={<span style={{fontWeight:600,fontSize:11,color:C.bl}}>{emp?shortName(emp):"?"}{emp&&!emp.active?" (ув.)":""}</span>}/>
                  <TD ch={<span style={{fontSize:10,color:C.md}}>{sn(d.store_id)}</span>}/>
                  <TD ch={<span style={{fontSize:11,color:C.md}}>{fmt(d.initial_amount)}</span>}/>
                  {months.map(mo => {
                    const moMoves = debtMoves.filter((m:any) => m.debt_id===d.id && m.date.startsWith(mo));
                    const charged = moMoves.filter((m:any)=>m.move_type==="charge").reduce((s:number,m:any)=>s+Number(m.amount),0);
                    const repaid = moMoves.filter((m:any)=>m.move_type==="repay").reduce((s:number,m:any)=>s+Number(m.amount),0);
                    runBal = runBal + charged - repaid;
                    return (
                      <React.Fragment key={mo}>
                        <td style={{padding:"6px 4px",textAlign:"center",fontSize:10,borderBottom:"1px solid #f1f5f9",borderLeft:`2px solid ${C.bdr}`,color:charged>0?C.rd:C.mu}}>{charged>0?fmt(charged):"—"}</td>
                        <td style={{padding:"6px 4px",textAlign:"center",fontSize:10,borderBottom:"1px solid #f1f5f9",color:repaid>0?C.gn:C.mu}}>{repaid>0?fmt(repaid):"—"}</td>
                        <td style={{padding:"6px 4px",textAlign:"center",fontSize:10,fontWeight:600,borderBottom:"1px solid #f1f5f9",color:runBal>0?C.tx:C.gn}}>{fmt(runBal)}</td>
                      </React.Fragment>
                    );
                  })}
                  <TD ch={<span style={{fontWeight:800,fontSize:12,color:d.balance>0?C.rd:C.gn}}>{fmt(d.balance)} ₸</span>}/>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>);
  }

  // ── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{marginBottom:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>💳 Задолженности сотрудников</h2>
          <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>
            {DEBT_TABS.map(t => <button key={t.k} onClick={()=>setTab(t.k)} style={subTabBtn(tab===t.k)}>{t.l}</button>)}
          </div>
        </div>
        <button onClick={()=>{
          setAddDebtM(true);
          setNdebt({emp_id:emps[0]?.id||"", store_id:stores[0]?.id||"", initial_amount:"", reason:"Ущерб", note:""});
        }} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + Новая задолженность
        </button>
      </div>

      {tab==="list" && renderList()}
      {tab==="moves" && renderMoves()}
      {tab==="summary" && renderSummary()}

      {/* МОДАЛ: Новая задолженность */}
      {addDebtM && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:400,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Новая задолженность</div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СОТРУДНИК</div>
                <select value={ndebt.emp_id} onChange={e=>setNdebt({...ndebt,emp_id:e.target.value})} style={I()}>
                  <option value="">— выберите —</option>
                  {emps.map((e:any)=><option key={e.id} value={e.id}>{fullName(e)}{!e.active?" (уволен)":""}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН (где возник долг)</div>
                <select value={ndebt.store_id} onChange={e=>setNdebt({...ndebt,store_id:e.target.value})} style={I()}>
                  {stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПЕРВОНАЧАЛЬНАЯ СУММА (₸)</div>
                <input type="number" value={ndebt.initial_amount} onChange={e=>setNdebt({...ndebt,initial_amount:e.target.value})} placeholder="0" style={I()}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПРИЧИНА</div>
                <input type="text" value={ndebt.reason} onChange={e=>setNdebt({...ndebt,reason:e.target.value})} placeholder="Ущерб, недостача..." style={I()}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПРИМЕЧАНИЕ</div>
                <input type="text" value={ndebt.note} onChange={e=>setNdebt({...ndebt,note:e.target.value})} style={I()}/>
              </div>
            </div>
            <div style={{display:"flex",gap:7,marginTop:14}}>
              <button onClick={()=>setAddDebtM(false)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
              <button onClick={createDebt} disabled={saving||!ndebt.emp_id||!ndebt.initial_amount} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!ndebt.emp_id||!ndebt.initial_amount)?0.5:1}}>Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛ: Добавить движение */}
      {addMoveM && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:400,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Добавить движение</div>
            <div style={{fontSize:11,color:C.mu,marginBottom:14}}>
              {fullName(empObj(addMoveM.emp_id))} · {sn(addMoveM.store_id)} · Остаток: <strong style={{color:C.rd}}>{fmt(balance(addMoveM.id, addMoveM.initial_amount))} ₸</strong>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div>
                <input type="date" value={nmove.date} onChange={e=>setNmove({...nmove,date:e.target.value})} style={I()}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТИП</div>
                <div style={{display:"flex",gap:6}}>
                  {[["charge","🔴 Начисление ущерба"],["repay","🟢 Удержание"]].map(([val,label])=>(
                    <button key={val} onClick={()=>setNmove({...nmove,move_type:val})}
                      style={{flex:1,padding:"8px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                        background:nmove.move_type===val?(val==="charge"?C.rdBg:C.gnBg):C.lt,
                        border:`2px solid ${nmove.move_type===val?(val==="charge"?C.rdBd:C.gnBd):C.bdr}`,
                        color:nmove.move_type===val?(val==="charge"?C.rd:C.gn):C.mu
                      }}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА (₸)</div>
                <input type="number" value={nmove.amount} onChange={e=>setNmove({...nmove,amount:e.target.value})} placeholder="0" style={I()}/>
              </div>
              <div>
                <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>КОММЕНТАРИЙ</div>
                <input type="text" value={nmove.comment} onChange={e=>setNmove({...nmove,comment:e.target.value})} style={I()}/>
              </div>
            </div>
            <div style={{display:"flex",gap:7,marginTop:14}}>
              <button onClick={()=>setAddMoveM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
              <button onClick={addMove} disabled={saving||!nmove.amount} style={{flex:1,background:nmove.move_type==="charge"?C.rd:C.gn,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:!nmove.amount?0.5:1}}>
                {nmove.move_type==="charge"?"Начислить":"Удержать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛ: Детализация по долгу */}
      {detailDebt && (()=>{
        const debt = enrichedDebts.find((d:any)=>d.id===detailDebt.id) || detailDebt;
        const emp = empObj(debt.emp_id);
        const moves = debtMoves.filter((m:any)=>m.debt_id===debt.id).sort((a:any,b:any)=>a.date.localeCompare(b.date));
        let running = Number(debt.initial_amount);
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:24,width:560,maxWidth:"96vw",boxShadow:"0 24px 60px rgba(0,0,0,.18)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:15}}>{emp?fullName(emp):"?"}</div>
                <div style={{fontSize:11,color:C.mu,marginTop:2}}>{sn(debt.store_id)} · {debt.reason} · Создан: {debt.created_at}</div>
              </div>
              <button onClick={()=>setDetailDebt(null)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
            </div>

            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <div style={{flex:1,background:C.lt,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.mu,fontWeight:700}}>Первоначальный</div>
                <div style={{fontSize:16,fontWeight:800,color:C.tx}}>{fmt(debt.initial_amount)} ₸</div>
              </div>
              <div style={{flex:1,background:C.rdBg,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.rd,fontWeight:700}}>Остаток</div>
                <div style={{fontSize:16,fontWeight:800,color:C.rd}}>{fmt(debt.balance)} ₸</div>
              </div>
            </div>

            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><TH ch="Дата"/><TH ch="Операция"/><TH ch="Сумма"/><TH ch="Остаток"/><TH ch="Комментарий"/></tr></thead>
              <tbody>
                <tr style={{background:C.lt}}>
                  <TD ch={<span style={{fontSize:10,color:C.mu}}>{debt.created_at}</span>}/>
                  <TD ch={<span style={{fontSize:10,fontWeight:600,color:C.md}}>Первоначальный долг</span>}/>
                  <TD ch={<span style={{fontWeight:700,color:C.rd}}>{fmt(debt.initial_amount)} ₸</span>}/>
                  <TD ch={<span style={{fontWeight:700}}>{fmt(debt.initial_amount)} ₸</span>}/>
                  <TD ch="—"/>
                </tr>
                {moves.map((m:any) => {
                  const isCharge = m.move_type === "charge";
                  running = running + (isCharge ? Number(m.amount) : -Number(m.amount));
                  return (
                    <tr key={m.id}>
                      <TD ch={<span style={{fontSize:10,color:C.md}}>{m.date}</span>}/>
                      <TD ch={isCharge
                        ? <Bdg c={C.rd} bg={C.rdBg} bd={C.rdBd} ch="Начисление"/>
                        : <Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Удержание"/>
                      }/>
                      <TD ch={<span style={{fontWeight:600,color:isCharge?C.rd:C.gn}}>{isCharge?"+":"−"}{fmt(Number(m.amount))} ₸</span>}/>
                      <TD ch={<span style={{fontWeight:700,color:running>0?C.tx:C.gn}}>{fmt(running)} ₸</span>}/>
                      <TD ch={<span style={{fontSize:10,color:C.mu}}>{m.comment||"—"}</span>}/>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>);
      })()}
    </div>
  );
}
