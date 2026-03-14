import React, { useState, useEffect, useCallback, useMemo } from "react";

const C = {
  bg:"#f8fafc",w:"#fff",bdr:"#e2e8f0",lt:"#f1f5f9",tx:"#0f172a",md:"#475569",mu:"#94a3b8",
  or:"#ea580c",orBg:"#fff7ed",orBd:"#fed7aa",gn:"#16a34a",gnBg:"#f0fdf4",gnBd:"#bbf7d0",
  rd:"#dc2626",rdBg:"#fef2f2",rdBd:"#fecaca",bl:"#2563eb",blBg:"#eff6ff",blBd:"#bfdbfe",
  am:"#b45309",amBg:"#fffbeb",amBd:"#fde68a",pu:"#7c3aed",puBg:"#f5f3ff",puBd:"#ddd6fe"
};
const I = (ex:any={}) => ({background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,borderRadius:6,padding:"6px 9px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,width:"100%",...ex});
const TH = ({ch}:{ch:any}) => <th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.mu,letterSpacing:"0.5px",textTransform:"uppercase",whiteSpace:"nowrap",background:C.lt,borderBottom:`1px solid ${C.bdr}`}}>{ch}</th>;
const TD = ({ch,s={}}:{ch:any,s?:any}) => <td style={{padding:"8px 10px",fontSize:12,borderBottom:"1px solid #f1f5f9",...s}}>{ch}</td>;
const Bdg = ({c,bg,bd,ch}:{c:string,bg:string,bd:string,ch:any}) => <span style={{background:bg,border:`1px solid ${bd}`,color:c,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{ch}</span>;
const fmt = (n:number) => Math.round(n||0).toLocaleString();
const fmtDate = (d:string) => { try{return new Date(d+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}catch(e){return d} };
const todayStr = () => new Date().toISOString().slice(0,10);
const DAY = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const DAYS_FULL = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];

const STATUS_ORDER:{[k:string]:{l:string,c:string,bg:string,bd:string}} = {
  draft:     {l:"Черновик",    c:C.mu, bg:C.lt,    bd:C.bdr},
  sent:      {l:"Отправлен",   c:C.bl, bg:C.blBg,  bd:C.blBd},
  delivered: {l:"Доставлен",   c:C.gn, bg:C.gnBg,  bd:C.gnBd},
  cancelled: {l:"Отменён",     c:C.rd, bg:C.rdBg,  bd:C.rdBd},
  skipped:   {l:"⏭ Пропущен", c:C.mu, bg:C.lt,    bd:C.bdr},
  no_show:   {l:"⚠️ Не пришло",c:C.am, bg:C.amBg,  bd:C.amBd},
};
const STATUS_DELIV:{[k:string]:{l:string,c:string,bg:string,bd:string}} = {
  pending:     {l:"Ожидается",     c:C.am, bg:C.amBg, bd:C.amBd},
  received:    {l:"Принято",       c:C.gn, bg:C.gnBg, bd:C.gnBd},
  discrepancy: {l:"Расхождение",   c:C.rd, bg:C.rdBg, bd:C.rdBd},
};

interface Props { sb:any; stores:any[]; appUser:any; }

export default function SuppliersModule({sb,stores,appUser}:Props) {
  // ── data state ──────────────────────────────────────────────────────────
  const [suppliers,  setSuppliers]  = useState<any[]>([]);
  const [packages,   setPackages]   = useState<any[]>([]);
  const [schedules,  setSchedules]  = useState<any[]>([]);
  const [orders,     setOrders]     = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [payments,   setPayments]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  // ── ui state ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("schedule");
  const [selDow,     setSelDow]     = useState(new Date().getDay()||1);
  const [refTab,     setRefTab]     = useState("sup");
  const [schedFStore,setSchedFStore] = useState(0);
  const [schedFSup,  setSchedFSup]   = useState(0);
  const [schedFPkg,  setSchedFPkg]   = useState(0);

  // ── modals ────────────────────────────────────────────────────────────────
  const [supModal,   setSupModal]   = useState<null|"add"|any>(null);
  const [pkgModal,   setPkgModal]   = useState<null|"add"|any>(null);
  const [schedModal, setSchedModal] = useState<null|"add"|any>(null);
  const [orderModal, setOrderModal] = useState<null|"add"|any>(null);
  const [recvModal,  setRecvModal]  = useState<null|any>(null);
  const [payModal,   setPayModal]   = useState(false);
  const [delSupM,    setDelSupM]    = useState<null|any>(null);
  const [delPkgM,    setDelPkgM]    = useState<null|any>(null);
  const [delOrdM,    setDelOrdM]    = useState<null|any>(null);
  const [delDelvM,   setDelDelvM]   = useState<null|any>(null);
  const [delPayM,    setDelPayM]    = useState<null|any>(null);
  const [invoiceModal,setInvoiceModal] = useState<null|"add"|any>(null);
  const [invoiceF,   setInvoiceF]   = useState<any>({});
  const [delInvM,    setDelInvM]    = useState<null|any>(null);
  const [invoices,    setInvoices]    = useState<any[]>([]);
  const [agents,     setAgents]     = useState<any[]>([]);
  const [agentPkgs,  setAgentPkgs]  = useState<any[]>([]);
  const [agentModal, setAgentModal] = useState<null|"add"|any>(null);
  const [agentF,     setAgentF]     = useState<any>({});
  const [delAgentM,  setDelAgentM]  = useState<null|any>(null);
  const [delSchedM,  setDelSchedM]  = useState<null|any>(null);
  const [agentPkgSel,setAgentPkgSel] = useState<number[]>([]);

  // ── forms ─────────────────────────────────────────────────────────────────
  const [supF,   setSupF]   = useState<any>({});
  const [pkgF,   setPkgF]   = useState<any>({});
  const [schedF, setSchedF] = useState<any>({order_days:[],delivery_days:[]});
  const [orderF, setOrderF] = useState<any>({});
  const [recvF,  setRecvF]  = useState<any>({});
  const [payF,   setPayF]   = useState<any>({});
  const [paySupFilter, setPaySupFilter] = useState(0);
  const [ordersStoreFilter, setOrdersStoreFilter] = useState(0);

  // ── отчёт по поставщику ──────────────────────────────────────────────────
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const [repSupId, setRepSupId] = useState(0);
  const [repFrom, setRepFrom] = useState(firstOfMonth.toISOString().slice(0,10));
  const [repTo,   setRepTo]   = useState(new Date().toISOString().slice(0,10));

  // ── role / permissions (единая система) ──────────────────────────────────
  const role             = appUser?.role || "admin";
  const isOwnerOrManager = role === "owner" || role === "manager";

  // Магазины пользователя: пустой массив = все магазины
  const myStoreIds: number[] = Array.isArray(appUser?.store_ids) ? appUser.store_ids : [];

  const p = appUser?.permissions || {};
  const _pv = (k: string) => isOwnerOrManager || (p[k] || 0) >= 1;
  const _pe = (k: string) => isOwnerOrManager || (p[k] || 0) >= 2;

  // Права по новым ключам
  const canSeeOrders      = _pv("sup_orders");
  const canEditOrders     = _pe("sup_orders");
  const canSeeDeliveries  = _pv("sup_receiving");
  const canEditDeliveries = _pe("sup_receiving");
  const canSeePayments    = _pv("sup_payments");
  const canEditPayments   = _pe("sup_payments");
  // График — все у кого есть доступ к приёмке или заказам (чтобы видеть план)
  const canSeeSchedule    = isOwnerOrManager || _pv("sup_receiving") || _pv("sup_orders");
  // Справочники поставщиков — owner/manager + закупщик (sup_refs >= 1)
  const canSeeRefs        = isOwnerOrManager || _pv("sup_refs");
  const canEditRefs       = isOwnerOrManager || _pe("sup_refs");
  // Начальный долг — только owner/manager/accountant
  const canEditInitialBalance = isOwnerOrManager || role === "accountant";

  // ── load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async()=>{
    setLoading(true);
    const [s,p,sc,o,d,py,ag,ap,inv] = await Promise.all([
      sb.from("sup_suppliers").select("*").order("name"),
      sb.from("sup_packages").select("*").order("name"),
      sb.from("sup_schedules").select("*"),
      sb.from("sup_orders").select("*").order("order_date",{ascending:false}),
      sb.from("sup_deliveries").select("*").order("delivery_date",{ascending:false}),
      sb.from("sup_payments").select("*").order("date",{ascending:false}),
      sb.from("sup_agents").select("*").order("name"),
      sb.from("sup_agent_packages").select("*"),
      sb.from("sup_invoices").select("*").order("invoice_date",{ascending:false}),
    ]);
    if(s.data) setSuppliers(s.data);
    if(p.data) setPackages(p.data);
    if(sc.data) setSchedules(sc.data);
    if(o.data) setOrders(o.data);
    if(d.data) setDeliveries(d.data);
    if(py.data) setPayments(py.data);
    if(ag.data) setAgents(ag.data);
    if(ap.data) setAgentPkgs(ap.data);
    if(inv.data) setInvoices(inv.data);
    setLoading(false);
  },[]);
  useEffect(()=>{loadAll();},[loadAll]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const sn     = (id:any) => stores.find((s:any)=>s.id===id)?.name||"—";
  const pkgObj = (id:any) => packages.find(p=>p.id===id);
  const supObj = (id:any) => suppliers.find(s=>s.id===id);
  const supByPkg = (pkgId:any) => { const p=pkgObj(pkgId); return p?supObj(p.supplier_id):null; };
  const pkgLabel = (pkgId:any) => { const p=pkgObj(pkgId); return p?`${supByPkg(pkgId)?.name||"?"} › ${p.name}`:"—"; };
  const isPrepay  = (pkgId:any) => !!pkgObj(pkgId)?.prepayment;
  const PrepayBadge = () => <span style={{background:"#fdf4ff",border:"1px solid #e9d5ff",color:"#7c3aed",padding:"1px 6px",borderRadius:20,fontSize:9,fontWeight:700,marginLeft:5}}>💳 ПРЕДОПЛАТА</span>;

  // долг по каждому поставщику (начальный остаток + bank deliveries − оплаты)
  const debtBySup = useMemo(()=>{
    const map:{[id:number]:{total:number,initial:number,deliveries_sum:number,payments_sum:number,delivs:any[]}} = {};
    suppliers.forEach(s=>{
      const init = Number(s.initial_balance)||0;
      map[s.id]={total:init, initial:init, deliveries_sum:0, payments_sum:0, delivs:[]};
    });
    deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy")).forEach(d=>{
      const p=pkgObj(d.package_id); if(!p)return;
      if(!map[p.supplier_id]) map[p.supplier_id]={total:0,initial:0,deliveries_sum:0,payments_sum:0,delivs:[]};
      const amt = Number(d.amount_invoiced);
      map[p.supplier_id].total += amt;
      map[p.supplier_id].deliveries_sum += amt;
      map[p.supplier_id].delivs.push(d);
    });
    payments.filter(p=>!p.invoice_id).forEach(p=>{
      if(map[p.supplier_id]){
        const amt = Number(p.amount);
        map[p.supplier_id].total -= amt;
        map[p.supplier_id].payments_sum += amt;
      }
    });
    return map;
  },[suppliers,deliveries,payments,packages]);

  const totalDebt = Object.values(debtBySup).reduce((s:number,v:any)=>s+Math.max(0,v.total),0);
  const today = todayStr();
  const overdueDelivs = deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&d.status==="received"&&d.payment_due_date&&d.payment_due_date<today);

  const subBtn = (a:boolean)=>({background:a?C.w:"none",border:`1px solid ${a?C.bdr:"transparent"}`,borderRadius:7,cursor:"pointer" as const,padding:"6px 14px",fontSize:11,fontWeight:600,fontFamily:"inherit",color:a?C.or:C.mu,boxShadow:a?"0 1px 3px rgba(0,0,0,.07)":"none"});
  const pendingInvoicesCount = invoices.filter(inv=>inv.status==="awaiting_payment").length;
  const TABS = [
    canSeeSchedule&&{k:"schedule",l:"📅 График"},
    canSeeOrders&&  {k:"orders",  l:"📦 Заказы"},
    canSeeDeliveries&&{k:"deliveries",l:"🚚 Поставки"},
    canSeePayments&&{k:"payments",l:`💰 Оплаты${pendingInvoicesCount>0?" ("+pendingInvoicesCount+")":""}`},
    (isOwnerOrManager||canSeePayments||canSeeDeliveries||canSeeOrders)&&{k:"report",l:"📊 Отчёт"},
    canSeeRefs&&{k:"refs",l:"⚙️ Справочник"},
  ].filter(Boolean) as any[];

  // ════════════════════════════════════════════════════════════════
  // TAB: ГРАФИК
  // ════════════════════════════════════════════════════════════════
  async function skipOrder(packageId:number, storeId:number, dateStr:string){
    const{data,error}=await sb.from("sup_orders").insert({
      package_id:packageId, store_id:storeId, order_date:dateStr,
      status:"skipped", amount_ordered:0, notes:"Пропущен вручную",
      expected_delivery_date:null, created_by_role:"purchaser"
    }).select().single();
    if(data) setOrders(prev=>[data,...prev]);
    if(error) console.error("skipOrder error:", error);
  }
  // Магазины которые видит пользователь в расписании
  const visibleStoresInSchedule = isOwnerOrManager
    ? stores
    : stores.filter((s:any) => myStoreIds.length===0 || myStoreIds.includes(s.id));

  function renderSchedule(){
    const schedStores = visibleStoresInSchedule;
    const todayDate = new Date();
    const todayDow  = todayDate.getDay(); // 0=Вс
    const todayStr2 = todayDate.toISOString().slice(0,10);

    // Генерируем 7 дней начиная с сегодня
    const week7 = Array.from({length:7},(_,i)=>{
      const d = new Date(todayDate); d.setDate(d.getDate()+i);
      return { dateStr: d.toISOString().slice(0,10), dow: d.getDay(), label: i===0?"Сегодня":i===1?"Завтра":DAY[d.getDay()]+", "+d.getDate(), isToday: i===0 };
    });

    // Фильтруем расписания
    const filtered = schedules.filter(sc=>{
      const pkg=pkgObj(sc.package_id); if(!pkg||!pkg.active) return false;
      const sup=supObj(pkg.supplier_id); if(!sup||!sup.active) return false;
      if(!sc.active) return false;
      // Для admin — только свои магазины
      if(!isOwnerOrManager && myStoreIds.length>0 && !myStoreIds.includes(sc.store_id)) return false;
      if(schedFStore && sc.store_id!==schedFStore) return false;
      if(schedFSup   && pkg.supplier_id!==schedFSup) return false;
      if(schedFPkg   && sc.package_id!==schedFPkg) return false;
      return true;
    });

    // Группируем по дням недели
    const byDay = week7.map(day=>{
      const dow = day.dow;
      const items = filtered.filter(sc=>{
        const od:number[]=Array.isArray(sc.order_days)?sc.order_days:[];
        return od.includes(dow);
      });
      return {...day, items};
    });

    const totalToday = byDay[0].items.length;
    const totalWeek  = byDay.reduce((s,d)=>s+d.items.length,0);

    // Пропущенные заказы — прошедшие 7 дней где были дни заказа но заказ не создан
    const missedItems:{dateStr:string,label:string,sc:any}[] = [];
    for(let i=7;i>=1;i--){
      const d = new Date(todayDate); d.setDate(d.getDate()-i);
      const dateStr = d.toISOString().slice(0,10);
      const dow = d.getDay();
      filtered.forEach(sc=>{
        const od:number[]=Array.isArray(sc.order_days)?sc.order_days:[];
        if(!od.includes(dow)) return;
        const hasOrder=orders.some(o=>o.package_id===sc.package_id&&o.store_id===sc.store_id&&o.order_date===dateStr&&o.status!=="skipped");
        const isSkipped=orders.some(o=>o.package_id===sc.package_id&&o.store_id===sc.store_id&&o.order_date===dateStr&&o.status==="skipped");
        if(!hasOrder&&!isSkipped) missedItems.push({dateStr, label:`${DAY[dow]}, ${d.getDate()} ${d.toLocaleDateString("ru-RU",{month:"short"})}`, sc});
      });
    }

    return(<div>
      {/* ── Пропущенные заказы ── */}
      {missedItems.length>0&&canSeeOrders&&<div style={{background:"#fffbf5",border:`1px solid ${C.amBd}`,borderRadius:12,padding:"10px 14px",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:C.am,marginBottom:8}}>⚠️ Пропущенные заказы по расписанию ({missedItems.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {missedItems.map((m,idx)=>{
            const pkg=pkgObj(m.sc.package_id);
            const sup=supByPkg(m.sc.package_id);
            return(<div key={idx} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",background:C.w,borderRadius:8,border:`1px solid ${C.bdr}`,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:C.am,fontWeight:700,whiteSpace:"nowrap",minWidth:60}}>{m.label}</span>
              <span style={{fontSize:11,color:C.md,flex:1}}>{sup?.name||"?"} › {pkg?.name||"?"}</span>
              <span style={{fontSize:10,color:C.mu}}>🏪 {sn(m.sc.store_id)}</span>
              {canEditOrders&&<button onClick={()=>{
                setOrderF({package_id:m.sc.package_id,store_id:m.sc.store_id,
                  order_date:m.dateStr,status:"sent",expected_delivery_date:"",amount_ordered:"",notes:""});
                setOrderModal("add");
              }} style={{background:"none",border:`1px solid ${C.amBd}`,color:C.am,padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                + Заказать
              </button>}
              {canEditOrders&&<button onClick={()=>skipOrder(m.sc.package_id,m.sc.store_id,m.dateStr)}
                style={{background:"none",border:`1px solid ${C.bdr}`,color:C.mu,padding:"3px 10px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                ⏭ Пропустить
              </button>}
            </div>);
          })}
        </div>
      </div>}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={schedFStore||""} onChange={e=>setSchedFStore(e.target.value?+e.target.value:0)} style={I({width:"auto"})}>
          <option value="">🏪 {isOwnerOrManager?"Все магазины":"Мои магазины"}</option>
          {schedStores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={schedFSup||""} onChange={e=>{setSchedFSup(e.target.value?+e.target.value:0);setSchedFPkg(0);}} style={I({width:"auto"})}>
          <option value="">🏭 Все поставщики</option>
          {suppliers.filter((s:any)=>s.active).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={schedFPkg||""} onChange={e=>setSchedFPkg(e.target.value?+e.target.value:0)} style={I({width:"auto"})}>
          <option value="">📦 Все пакеты</option>
          {packages.filter((p:any)=>p.active&&(!schedFSup||p.supplier_id===schedFSup)).map((p:any)=><option key={p.id} value={p.id}>{supObj(p.supplier_id)?.name} › {p.name}</option>)}
        </select>
        {(schedFStore||schedFSup||schedFPkg)&&<button onClick={()=>{setSchedFStore(0);setSchedFSup(0);setSchedFPkg(0);}} style={{background:"none",border:`1px solid ${C.bdr}`,color:C.mu,padding:"5px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕ Сбросить</button>}
        <div style={{marginLeft:"auto",display:"flex",gap:10}}>
          <div style={{background:C.orBg,border:`1px solid ${C.orBd}`,borderRadius:8,padding:"5px 12px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.or}}>{totalToday}</div>
            <div style={{fontSize:9,color:C.or,fontWeight:700}}>СЕГОДНЯ</div>
          </div>
          <div style={{background:C.lt,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"5px 12px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:C.tx}}>{totalWeek}</div>
            <div style={{fontSize:9,color:C.mu,fontWeight:700}}>ЗА НЕДЕЛЮ</div>
          </div>
        </div>
      </div>

      {/* ── 7 дней ── */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {byDay.map(day=>{
          if(!day.isToday && day.items.length===0) return null;
          return(
            <div key={day.dateStr}>
              {/* День — заголовок */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{
                  background: day.isToday ? "linear-gradient(135deg,#f97316,#ea580c)" : C.lt,
                  color: day.isToday ? "#fff" : C.md,
                  borderRadius:8, padding:"4px 14px", fontSize:12, fontWeight:700,
                }}>
                  {day.label}
                </div>
                <div style={{fontSize:11,color:C.mu}}>{day.dateStr}</div>
                {day.items.length>0&&<div style={{fontSize:11,color:C.mu}}>{day.items.length} пакетов</div>}
                <div style={{flex:1,height:1,background:C.bdr}}/>
              </div>

              {/* Карточки пакетов */}
              {day.items.length===0
                ?<div style={{background:C.lt,borderRadius:8,padding:"10px 16px",fontSize:12,color:C.mu}}>Нет заказов по расписанию</div>
                :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {day.items.map((sc:any)=>{
                    const pkg=pkgObj(sc.package_id);
                    const sup=supByPkg(sc.package_id);
                    const delivDays:number[]=Array.isArray(sc.delivery_days)?sc.delivery_days:[];
                    const hasOrder=orders.some(o=>o.package_id===sc.package_id&&o.store_id===sc.store_id&&o.order_date===day.dateStr&&o.status!=="skipped");
                    const isSkipped=orders.some(o=>o.package_id===sc.package_id&&o.store_id===sc.store_id&&o.order_date===day.dateStr&&o.status==="skipped");
                    // Агенты этого пакета
                    const pkgAgents=agentPkgs.filter((ap:any)=>ap.package_id===sc.package_id).map((ap:any)=>agents.find((a:any)=>a.id===ap.agent_id)).filter(Boolean);
                    return(
                      <div key={sc.id} style={{
                        background: hasOrder ? C.gnBg : isSkipped ? C.lt : C.w,
                        border: `1px solid ${hasOrder?C.gnBd:isSkipped?C.bdr:C.bdr}`,
                        borderRadius:10, padding:"10px 16px",
                        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
                        opacity: isSkipped ? 0.6 : 1,
                      }}>
                        <div style={{flex:1,minWidth:200}}>
                          <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>
                            {sup?.name||"?"}
                            <span style={{color:C.mu,fontWeight:400}}> › {pkg?.name||"?"}</span>
                            {pkg?.prepayment&&<PrepayBadge/>}
                          </div>
                          <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:C.mu}}>
                            <span>🏪 {sn(sc.store_id)}</span>
                            {delivDays.length>0&&<span>🚚 {delivDays.map((d:number)=>DAY[d]).join(", ")}</span>}
                            {!delivDays.length&&sc.lead_days&&<span>🚚 через {sc.lead_days} дн.</span>}
                            {pkg?.payment_days>0&&!pkg?.prepayment&&<span>⏱ {pkg.payment_days} дн.</span>}
                            {pkgAgents.length>0&&<span>👤 {pkgAgents.map((a:any)=>a.name).join(", ")}</span>}
                          </div>
                        </div>
                        {hasOrder
                          ?<Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="✓ Заказ создан"/>
                          :isSkipped
                          ?<Bdg c={C.mu} bg={C.lt} bd={C.bdr} ch="⏭ Пропущен"/>
                          :<div style={{display:"flex",gap:6}}>
                            {canEditOrders&&<button onClick={()=>{
                              // Вычисляем ожидаемую дату поставки
                              let expectedDate = "";
                              const orderDateObj = new Date(day.dateStr+"T00:00:00");
                              if(sc.lead_days) {
                                // Режим "через N дней"
                                const d = new Date(orderDateObj);
                                d.setDate(d.getDate() + sc.lead_days);
                                expectedDate = d.toISOString().slice(0,10);
                              } else if(Array.isArray(sc.delivery_days) && sc.delivery_days.length>0) {
                                // Режим "конкретные дни" — ближайший день поставки после заказа
                                const delivDow = sc.delivery_days;
                                const d = new Date(orderDateObj);
                                for(let i=1;i<=14;i++){
                                  d.setDate(d.getDate()+1);
                                  if(delivDow.includes(d.getDay())){ expectedDate=d.toISOString().slice(0,10); break; }
                                }
                              }
                              setOrderF({package_id:sc.package_id,store_id:sc.store_id,
                                order_date:day.dateStr,status:"sent",
                                expected_delivery_date:expectedDate,amount_ordered:"",notes:""});
                              setOrderModal("add");
                            }} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                              + Заказать
                            </button>}
                            {canEditOrders&&<button onClick={()=>skipOrder(sc.package_id,sc.store_id,day.dateStr)}
                              style={{background:"none",border:`1px solid ${C.bdr}`,color:C.mu,padding:"7px 12px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}
                              title="Пропустить этот заказ — товар не нужен">
                              ⏭ Пропустить
                            </button>}
                          </div>
                        }
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          );
        })}
        {totalWeek===0&&<div style={{background:C.lt,borderRadius:12,padding:40,textAlign:"center",color:C.mu}}>
          <div style={{fontSize:28,marginBottom:8}}>✅</div>
          <div style={{fontSize:13,fontWeight:600}}>
            {schedFStore||schedFSup||schedFPkg?"Ничего не найдено по выбранным фильтрам":"На ближайшую неделю заказов нет"}
          </div>
        </div>}
      </div>
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: ЗАКАЗЫ
  // ════════════════════════════════════════════════════════════════
  function renderOrders(){
    const storeIds:number[] = isOwnerOrManager ? stores.map((s:any)=>s.id) : myStoreIds.length>0 ? myStoreIds : stores.map((s:any)=>s.id);
    const activeStoreFilter = ordersStoreFilter;
    const vis = orders
      .filter(o=>!!pkgObj(o.package_id)&&o.status!=="skipped")
      .filter(o=>{
        if(activeStoreFilter) return o.store_id===activeStoreFilter;
        if(isOwnerOrManager) return true;
        // для admin/других — показываем только магазины из store_ids
        if(storeIds.length>0) return storeIds.includes(o.store_id);
        return true;
      });

    const noShowCount = vis.filter(o=>o.status==="no_show").length;

    return(<div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {canEditOrders&&(isOwnerOrManager||role==="buyer")&&<button onClick={()=>{setOrderF({order_date:today,status:"sent",amount_ordered:"",expected_delivery_date:"",notes:"",created_by_role:"purchaser"});setOrderModal("add");}}
          style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + Заказ
        </button>}
        {!isOwnerOrManager&&storeIds.length>1&&<select value={ordersStoreFilter||""} onChange={e=>setOrdersStoreFilter(e.target.value?+e.target.value:0)} style={I({width:"auto"})}>
          <option value="">🏪 Все мои магазины</option>
          {stores.filter(s=>storeIds.includes(s.id)).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>}
        {isOwnerOrManager&&<select value={ordersStoreFilter||""} onChange={e=>setOrdersStoreFilter(e.target.value?+e.target.value:0)} style={I({width:"auto"})}>
          <option value="">🏪 Все магазины</option>
          {stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>}
        {noShowCount>0&&<span style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>⚠️ Не пришло: {noShowCount}</span>}
        <span style={{marginLeft:"auto",fontSize:11,color:C.mu}}>{vis.length} заказов</span>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик › Пакет"/><TH ch="Магазин"/><TH ch="Сумма заказа"/><TH ch="Ожид. поставка"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{vis.map((o:any,i:number)=>{
            const st=STATUS_ORDER[o.status]||STATUS_ORDER.sent;
            const isNoShow = o.status==="no_show";
            return(<tr key={o.id} style={{background:isNoShow?C.amBg:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(o.order_date)}</span>}/>
              <TD ch={<div><div style={{fontWeight:600,fontSize:12}}>{pkgLabel(o.package_id)}{isPrepay(o.package_id)&&<PrepayBadge/>}</div>{o.notes&&o.notes!=="Пропущен вручную"&&<div style={{fontSize:10,color:C.mu}}>{o.notes}</div>}</div>}/>
              <TD ch={<span style={{fontSize:11,color:C.md}}>{o.store_id?sn(o.store_id):<span style={{color:C.mu,fontStyle:"italic"}}>Все</span>}</span>}/>
              <TD ch={<strong style={{fontSize:12}}>{o.amount_ordered?fmt(o.amount_ordered)+" ₸":"—"}</strong>}/>
              <TD ch={<span style={{fontSize:11,color:C.md}}>{o.expected_delivery_date?fmtDate(o.expected_delivery_date):"—"}</span>}/>
              <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.l}/>}/>
              <TD ch={<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {canEditOrders&&<button onClick={()=>{setOrderF({...o});setOrderModal(o);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>}
                {o.status==="sent"&&(()=>{
                  const pkg=pkgObj(o.package_id);
                  if(pkg?.prepayment){
                    const existInv=invoices.find((inv:any)=>inv.order_id===o.id);
                    if(existInv){
                      const isPaid=existInv.status==="paid";
                      if(isPaid) return <span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>✅ Счёт оплачен</span>;
                      return <span style={{background:C.puBg,border:`1px solid ${C.puBd}`,color:C.pu,padding:"3px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>⏳ Ожидает оплаты</span>;
                    }
                    if(isOwnerOrManager||canEditOrders) return <button onClick={()=>{
                      setInvoiceF({order_id:o.id,package_id:o.package_id,supplier_id:pkg.supplier_id,
                        store_id:o.store_id||"",invoice_date:today,invoice_number:"",
                        amount:o.amount_ordered||"",notes:"",status:"awaiting_payment"});
                      setInvoiceModal("add");
                    }} style={{background:C.puBg,border:`1px solid ${C.puBd}`,color:C.pu,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      📋 Выставить счёт
                    </button>;
                    return null;
                  }
                  const daysToAdd=pkg?.payment_days||0;
                  const due=new Date(); due.setDate(due.getDate()+daysToAdd);
                  if(!canEditDeliveries) return null;
                  return <button onClick={()=>{
                    setRecvF({order_id:o.id,package_id:o.package_id,store_id:o.store_id,delivery_date:today,
                      invoice_number:"",amount_invoiced:o.amount_ordered||"",
                      payment_due_date:due.toISOString().slice(0,10),
                      payment_type:pkg?.payment_type||"bank",status:"received",notes:""});
                    setRecvModal(o);
                  }} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                    🚚 Принять
                  </button>;
                })()}
                {o.status==="sent"&&canEditDeliveries&&<button onClick={async()=>{
                  await sb.from("sup_orders").update({status:"no_show"}).eq("id",o.id);
                  setOrders(orders.map((x:any)=>x.id===o.id?{...x,status:"no_show"}:x));
                }} style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}
                  title="Товар не пришёл">
                  ⚠️ Не пришло
                </button>}
                {o.status==="no_show"&&canEditOrders&&<button onClick={async()=>{
                  await sb.from("sup_orders").update({status:"sent"}).eq("id",o.id);
                  setOrders(orders.map((x:any)=>x.id===o.id?{...x,status:"sent"}:x));
                }} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}
                  title="Вернуть в статус Отправлен">
                  ↩ Вернуть
                </button>}
                {canEditOrders&&<button onClick={()=>setDelOrdM(o)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>}
              </div>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: ПОСТАВКИ
  // ════════════════════════════════════════════════════════════════
  function renderDeliveries(){
    const storeIds:number[] = isOwnerOrManager ? stores.map((s:any)=>s.id) : myStoreIds.length>0 ? myStoreIds : stores.map((s:any)=>s.id);
    const vis = isOwnerOrManager ? deliveries : deliveries.filter((d:any)=>myStoreIds.length===0||myStoreIds.includes(d.store_id));
    const bank = vis.filter((d:any)=>d.payment_type==="bank"&&!d.invoice_id);
    const cash = vis.filter((d:any)=>d.payment_type==="cash"&&!d.invoice_id);

    // ── Для администратора: заказы которые ожидают прихода ──────────
    if(!isOwnerOrManager) {
      const pendingOrders = orders.filter((o:any)=>
        o.status==="sent" &&
        (myStoreIds.length===0 || myStoreIds.includes(o.store_id))
      );
      const myDeliveries = vis;

      return(<div>
        {/* Блок: предоплата ожидает оплаты */}
        {(()=>{
          const pendingPrepay = invoices.filter((inv:any)=>
            inv.status==="awaiting_payment" &&
            !!pkgObj(inv.package_id) &&
            (myStoreIds.length===0 || myStoreIds.includes(inv.store_id))
          );
          if(!pendingPrepay.length) return null;
          return(<div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:C.pu,marginBottom:10}}>⏳ Ожидает оплаты бухгалтером ({pendingPrepay.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {pendingPrepay.map((inv:any)=>{
                const pkg=pkgObj(inv.package_id);
                const sup=pkg?supObj(pkg.supplier_id):null;
                return(<div key={inv.id} style={{background:C.w,border:"1px solid #e9d5ff",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:12}}>{sup?.name||"?"} › {pkg?.name||"?"} <PrepayBadge/></div>
                    <div style={{fontSize:11,color:C.mu,marginTop:2}}>
                      Счёт №{inv.invoice_number||"—"} · {fmtDate(inv.invoice_date)}
                      {inv.store_id&&<span> · 🏪 {sn(inv.store_id)}</span>}
                      · <strong style={{color:C.pu}}>{fmt(inv.amount)} ₸</strong>
                    </div>
                  </div>
                  <span style={{background:"#fdf4ff",border:"1px solid #e9d5ff",color:C.pu,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>⏳ Ожидает оплаты</span>
                </div>);
              })}
            </div>
          </div>);
        })()}

        {/* Блок: предоплата оплачена — товар скоро привезут */}
        {(()=>{
          const paidPrepay = invoices.filter((inv:any)=>{
            if(inv.status!=="paid") return false;
            if(!pkgObj(inv.package_id)) return false;
            if(myStoreIds.length>0 && !myStoreIds.includes(inv.store_id)) return false;
            // Ещё не принят товар
            const hasDelivery = deliveries.some((d:any)=>d.invoice_id===inv.id);
            return !hasDelivery;
          });
          if(!paidPrepay.length) return null;
          return(<div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:C.gn,marginBottom:10}}>✅ Оплачено — ожидается приход товара ({paidPrepay.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {paidPrepay.map((inv:any)=>{
                const pkg=pkgObj(inv.package_id);
                const sup=pkg?supObj(pkg.supplier_id):null;
                return(<div key={inv.id} style={{background:C.w,border:`1px solid ${C.gnBd}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:12}}>{sup?.name||"?"} › {pkg?.name||"?"} <PrepayBadge/></div>
                    <div style={{fontSize:11,color:C.mu,marginTop:2}}>
                      Счёт №{inv.invoice_number||"—"} · {fmtDate(inv.invoice_date)}
                      {inv.store_id&&<span> · 🏪 {sn(inv.store_id)}</span>}
                      · <strong style={{color:C.gn}}>{fmt(inv.amount)} ₸</strong>
                    </div>
                  </div>
                  <span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>✅ Оплачено</span>
                  {canEditDeliveries&&<button onClick={()=>{
                    setRecvF({invoice_id:inv.id,order_id:inv.order_id,package_id:inv.package_id,
                      store_id:inv.store_id||"",delivery_date:today,invoice_number:inv.invoice_number||"",
                      amount_invoiced:inv.amount,payment_type:"bank",status:"received",notes:""});
                    setRecvModal("prepay");
                  }} style={{background:C.gn,border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    🚚 Принять товар
                  </button>}
                </div>);
              })}
            </div>
          </div>);
        })()}

        {/* Блок: ожидается поставка */}
        {pendingOrders.length>0&&<div style={{background:C.blBg,border:`1px solid ${C.blBd}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.bl,marginBottom:10}}>📦 Ожидается поставка ({pendingOrders.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pendingOrders.map((o:any)=>{
              const pkg=pkgObj(o.package_id);
              const sup=pkg?supObj(pkg.supplier_id):null;
              return(<div key={o.id} style={{background:C.w,border:`1px solid ${C.blBd}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:180}}>
                  <div style={{fontWeight:700,fontSize:13}}>{sup?.name||"?"} › {pkg?.name||"?"}</div>
                  <div style={{fontSize:11,color:C.mu,marginTop:2}}>
                    🏪 {sn(o.store_id)} · 📅 Заказ: {fmtDate(o.order_date)}
                    {o.expected_delivery_date&&<span> · ⏰ Ожид.: {fmtDate(o.expected_delivery_date)}</span>}
                    {o.amount_ordered&&<span> · <strong>{fmt(o.amount_ordered)} ₸</strong></span>}
                  </div>
                </div>
                {canEditDeliveries&&<button onClick={()=>{
                  setRecvF({order_id:o.id,package_id:o.package_id,store_id:o.store_id||"",
                    delivery_date:today,status:"received",payment_type:"bank",
                    payment_due_date:"",invoice_number:"",amount_invoiced:o.amount_ordered||"",notes:""});
                  setRecvModal("new");
                }} style={{background:C.gn,border:"none",color:"#fff",padding:"7px 16px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  🚚 Принять товар
                </button>}
                {canEditDeliveries&&<button onClick={()=>{
                  if(!window.confirm(`Отметить «${pkgObj(o.package_id)?.name||"заказ"}» как НЕ ПРИШЕДШИЙ?\n\nЗакупщик увидит это в списке заказов.`)) return;
                  (sb as any).from("sup_orders").update({status:"no_show"}).eq("id",o.id).then(()=>{
                    setOrders((prev:any[])=>prev.map((x:any)=>x.id===o.id?{...x,status:"no_show"}:x));
                  });
                }} style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"7px 12px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  ⚠️ Не пришло
                </button>}
              </div>);
            })}
          </div>
        </div>}

        {pendingOrders.length===0&&myDeliveries.length===0&&<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,padding:"44px",textAlign:"center",color:C.mu}}>
          <div style={{fontSize:28,marginBottom:8}}>📦</div>
          <div style={{fontSize:13,fontWeight:600}}>Нет ожидаемых поставок</div>
        </div>}

        {/* История принятых поставок */}
        {myDeliveries.length>0&&<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
          <div style={{padding:"8px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>📋 История поставок</div>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead><tr><TH ch="Дата"/><TH ch="Поставщик › Пакет"/><TH ch="Накладная"/><TH ch="Сумма"/><TH ch="Статус"/></tr></thead>
            <tbody>{myDeliveries.map((d:any,i:number)=>{
              const st=STATUS_DELIV[d.status]||STATUS_DELIV.received;
              return(<tr key={d.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
                <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(d.delivery_date)}</span>}/>
                <TD ch={<div style={{fontWeight:600,fontSize:12}}>{pkgLabel(d.package_id)}</div>}/>
                <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.mu}}>{d.invoice_number||"—"}</span>}/>
                <TD ch={<strong style={{fontSize:12}}>{fmt(d.amount_invoiced)} ₸</strong>}/>
                <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.l}/>}/>
              </tr>);
            })}</tbody>
          </table>
        </div>}
      </div>);
    }
    // Оплаченные счета ожидающие прихода
    const paidInvoiceIds = new Set(invoices.filter(inv=>inv.status==="paid").map((inv:any)=>inv.id));
    const prepayDeliveries = deliveries.filter(d=>d.invoice_id);
    const paidPendingInvoices = invoices.filter((inv:any)=>{
      if(inv.status!=="paid") return false;
      if(!pkgObj(inv.package_id)) return false; // пакет удалён — не показываем
      const hasDelivery = prepayDeliveries.some((d:any)=>d.invoice_id===inv.id);
      if(hasDelivery) return false;
      if(!isOwnerOrManager&&myStoreIds.length>0){ const invStoreId=inv.store_id; return !invStoreId||myStoreIds.includes(invStoreId); }
      return true;
    });
    const prepayReceived = !isOwnerOrManager&&myStoreIds.length>0
      ? prepayDeliveries.filter((d:any)=>myStoreIds.includes(d.store_id))
      : prepayDeliveries;
    return(<div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {canEditDeliveries&&isOwnerOrManager&&<button onClick={()=>{setRecvF({delivery_date:today,status:"received",payment_type:"bank",payment_due_date:"",invoice_number:"",amount_invoiced:"",notes:""});setRecvModal("new");}}
          style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + Поставка
        </button>}
      </div>
      {/* Секция предоплаты - оплачено, ожидает прихода */}
      {paidPendingInvoices.length>0&&<div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.pu,marginBottom:10}}>💜 Оплачено — ожидает прихода товара ({paidPendingInvoices.length})</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {paidPendingInvoices.map((inv:any)=>{
            const pkg=pkgObj(inv.package_id);
            const sup=supObj(inv.supplier_id);
            return(<div key={inv.id} style={{background:C.w,border:"1px solid #e9d5ff",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontWeight:700,fontSize:12}}>{sup?.name||"?"} › {pkg?.name||"?"}<PrepayBadge/></div>
                <div style={{fontSize:11,color:C.mu,marginTop:2}}>Счёт №{inv.invoice_number||"—"} · {fmtDate(inv.invoice_date)} · <strong>{fmt(inv.amount)} ₸</strong></div>
                {inv.store_id&&<div style={{fontSize:10,color:C.mu}}>🏪 {sn(inv.store_id)}</div>}
              </div>
              <button onClick={()=>{
                setRecvF({invoice_id:inv.id,order_id:inv.order_id,package_id:inv.package_id,
                  store_id:inv.store_id||"",delivery_date:today,invoice_number:inv.invoice_number||"",
                  amount_invoiced:inv.amount,payment_type:"bank",status:"received",notes:""});
                setRecvModal("prepay");
              }} style={{background:C.pu,border:"none",color:"#fff",padding:"6px 14px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                🚚 Принять товар
              </button>
            </div>);
          })}
        </div>
      </div>}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto",marginBottom:16}}>
        <div style={{padding:"8px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>🏦 Безналичные поставки</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик › Пакет"/><TH ch="Магазин"/><TH ch="Накладная"/><TH ch="Сумма"/><TH ch="Оплатить до"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{bank.length===0?<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.mu,fontSize:12}}>Нет поставок</td></tr>:bank.map((d:any,i:number)=>{
            const st=STATUS_DELIV[d.status]||STATUS_DELIV.pending;
            const isOverdue=d.payment_due_date&&d.payment_due_date<today&&d.status!=="pending";
            return(<tr key={d.id} style={{background:isOverdue?"#fff5f5":i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(d.delivery_date)}</span>}/>
              <TD ch={<div style={{fontWeight:600,fontSize:12}}>{pkgLabel(d.package_id)}</div>}/>
              <TD ch={<span style={{fontSize:11}}>{sn(d.store_id)}</span>}/>
              <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.md}}>{d.invoice_number||"—"}</span>}/>
              <TD ch={<strong style={{fontSize:12}}>{fmt(d.amount_invoiced)} ₸</strong>}/>
              <TD ch={d.payment_due_date?<span style={{fontSize:11,fontWeight:600,color:isOverdue?C.rd:C.md}}>{isOverdue?"⚠️ ":""}{fmtDate(d.payment_due_date)}</span>:<span style={{color:C.mu,fontSize:11}}>—</span>}/>
              <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.l}/>}/>
              <TD ch={<button onClick={()=>setDelDelvM(d)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>
      {prepayReceived.length>0&&<div style={{background:C.w,border:"1px solid #e9d5ff",borderRadius:12,overflow:"auto",marginBottom:16}}>
        <div style={{padding:"8px 14px",background:"#fdf4ff",borderBottom:"1px solid #e9d5ff",fontSize:11,fontWeight:700,color:C.pu}}>💜 Предоплата — принятые поставки</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик › Пакет"/><TH ch="Магазин"/><TH ch="Накладная"/><TH ch="Оплачено"/><TH ch="Получено"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{prepayReceived.map((d:any,i:number)=>{
            const inv=invoices.find((inv:any)=>inv.id===d.invoice_id);
            const diff=inv?Number(d.amount_invoiced)-Number(inv.amount):0;
            const st=STATUS_DELIV[d.status]||STATUS_DELIV.received;
            return(<tr key={d.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(d.delivery_date)}</span>}/>
              <TD ch={<div style={{fontWeight:600,fontSize:12}}>{pkgLabel(d.package_id)}<PrepayBadge/></div>}/>
              <TD ch={<span style={{fontSize:11}}>{sn(d.store_id)}</span>}/>
              <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.md}}>{d.invoice_number||"—"}</span>}/>
              <TD ch={<span style={{fontSize:11,color:C.mu}}>{inv?fmt(inv.amount)+" ₸":"—"}</span>}/>
              <TD ch={<span style={{fontWeight:700,fontSize:12,color:Math.abs(diff)>1?C.am:C.gn}}>{fmt(d.amount_invoiced)} ₸{Math.abs(diff)>1&&<span style={{fontSize:10,marginLeft:4}}>({diff>0?"+":""}{fmt(diff)})</span>}</span>}/>
              <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.l}/>}/>
              <TD ch={<button onClick={()=>setDelDelvM(d)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <div style={{padding:"8px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>💵 Наличные поставки</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик › Пакет"/><TH ch="Магазин"/><TH ch="Накладная"/><TH ch="Сумма"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{cash.length===0?<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.mu,fontSize:12}}>Нет поставок</td></tr>:cash.map((d:any,i:number)=>{
            const st=STATUS_DELIV[d.status]||STATUS_DELIV.pending;
            return(<tr key={d.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(d.delivery_date)}</span>}/>
              <TD ch={<div style={{fontWeight:600,fontSize:12}}>{pkgLabel(d.package_id)}</div>}/>
              <TD ch={<span style={{fontSize:11}}>{sn(d.store_id)}</span>}/>
              <TD ch={<span style={{fontFamily:"monospace",fontSize:11,color:C.md}}>{d.invoice_number||"—"}</span>}/>
              <TD ch={<strong style={{fontSize:12}}>{fmt(d.amount_invoiced)} ₸</strong>}/>
              <TD ch={<Bdg c={st.c} bg={st.bg} bd={st.bd} ch={st.l}/>}/>
              <TD ch={<button onClick={()=>setDelDelvM(d)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>}/>
            </tr>);
          })}</tbody>
        </table>
      </div>
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: ОПЛАТЫ (бухгалтер)
  // ════════════════════════════════════════════════════════════════
  function renderPayments(){
    const week = new Date(); week.setDate(week.getDate()+7);
    const weekStr = week.toISOString().slice(0,10);
    const overdue = deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy")&&d.payment_due_date&&d.payment_due_date<today);
    const dueWeek = deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy")&&d.payment_due_date&&d.payment_due_date>=today&&d.payment_due_date<=weekStr);
    const upcoming= deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy")&&(!d.payment_due_date||d.payment_due_date>weekStr));
    const awaitingPayment = invoices.filter((inv:any)=>inv.status==="awaiting_payment"&&!!pkgObj(inv.package_id));
    return(<div>
      {/* ══ СЧЕТА НА ПРЕДОПЛАТУ ══ */}
      {awaitingPayment.length>0&&<div style={{background:"#fdf4ff",border:"2px solid #c4b5fd",borderRadius:14,padding:"14px 16px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{fontSize:16,fontWeight:800,color:C.pu}}>💜 Счета к оплате (предоплата)</div>
          <span style={{background:C.pu,color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{awaitingPayment.length}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {awaitingPayment.map((inv:any)=>{
            const pkg=pkgObj(inv.package_id);
            const sup=supObj(inv.supplier_id);
            return(<div key={inv.id} style={{background:C.w,border:"1px solid #e9d5ff",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontWeight:700,fontSize:13}}>{sup?.name||"?"} › {pkg?.name||"?"}</div>
                <div style={{fontSize:11,color:C.mu,marginTop:2}}>
                  Счёт №<strong>{inv.invoice_number||"—"}</strong> от {fmtDate(inv.invoice_date)}
                  {inv.store_id&&<span> · 🏪 {sn(inv.store_id)}</span>}
                  {inv.notes&&<span> · {inv.notes}</span>}
                </div>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:C.pu,whiteSpace:"nowrap"}}>{fmt(inv.amount)} ₸</div>
              <div style={{display:"flex",gap:6}}>
                {canEditPayments&&<button onClick={async()=>{
                  setSaving(true);
                  await sb.from("sup_invoices").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",inv.id);
                  const{data:pay}=await sb.from("sup_payments").insert({
                    supplier_id:inv.supplier_id,date:today,amount:inv.amount,
                    note:`Предоплата: счёт №${inv.invoice_number||inv.id}`,invoice_id:inv.id
                  }).select().single();
                  setInvoices(invoices.map((x:any)=>x.id===inv.id?{...x,status:"paid",paid_at:new Date().toISOString()}:x));
                  if(pay) setPayments([pay,...payments]);
                  setSaving(false);
                }} disabled={saving} style={{background:C.pu,border:"none",color:"#fff",padding:"7px 16px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",opacity:saving?0.7:1}}>
                  💳 Оплатить
                </button>}
                {(isOwnerOrManager||canEditPayments)&&<button onClick={()=>setDelInvM(inv)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"7px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>}
              </div>
            </div>);
          })}
        </div>
      </div>}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {canEditPayments&&isOwnerOrManager&&<button onClick={()=>{setPayF({date:today,amount:"",note:""});setPayModal(true);}}
          style={{background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + Оплата поставщику
        </button>}
        <select value={paySupFilter||""} onChange={e=>setPaySupFilter(e.target.value?+e.target.value:0)} style={I({width:"auto"})}>
          <option value="">🏭 Все поставщики</option>
          {suppliers.filter((s:any)=>s.active).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {paySupFilter>0&&<button onClick={()=>setPaySupFilter(0)} style={{background:"none",border:`1px solid ${C.bdr}`,color:C.mu,padding:"5px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕ Сбросить</button>}
        <span style={{marginLeft:"auto",fontSize:11,color:C.mu}}>
          Общий долг: <strong style={{color:totalDebt>0?C.rd:C.gn}}>{fmt(totalDebt)} ₸</strong>
        </span>
      </div>

      {/* ══ ДАШБОРД ПО ПОСТАВЩИКАМ ══ */}
      {(()=>{
        // Все непогашенные поставки (без предоплатных) сортируем по дате оплаты
        const allPending = deliveries
          .filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy"))
          .sort((a:any,b:any)=>(a.payment_due_date||"9999")>(b.payment_due_date||"9999")?1:-1);

        // Считаем баланс по каждому поставщику (оплачено минус накладные) — исключаем предоплатные платежи
        const balanceBySup:{[id:number]:number} = {};
        suppliers.forEach((s:any)=>{ balanceBySup[s.id]=0; });
        payments.filter((p:any)=>!p.invoice_id).forEach((p:any)=>{ if(balanceBySup[p.supplier_id]!==undefined) balanceBySup[p.supplier_id]+=Number(p.amount); });
        deliveries.filter(d=>d.payment_type==="bank"&&!d.invoice_id&&(d.status==="received"||d.status==="discrepancy"))
          .forEach((d:any)=>{ const p=pkgObj(d.package_id); if(p&&balanceBySup[p.supplier_id]!==undefined) balanceBySup[p.supplier_id]-=Number(d.amount_invoiced); });

        // Для каждой поставки определяем покрыта ли она — идём по поставщику, применяем оплаты к накладным в порядке срока
        const coveredIds = new Set<number>();
        const supDelivs:{[id:number]:any[]} = {};
        allPending.forEach((d:any)=>{ const p=pkgObj(d.package_id); if(p){ if(!supDelivs[p.supplier_id])supDelivs[p.supplier_id]=[]; supDelivs[p.supplier_id].push(d); } });
        Object.keys(supDelivs).forEach(sid=>{
          const supId=+sid;
          let running = payments.filter((p:any)=>p.supplier_id===supId&&!p.invoice_id).reduce((s:number,p:any)=>s+Number(p.amount),0);
          supDelivs[supId].forEach((d:any)=>{
            if(running>=Number(d.amount_invoiced)){ coveredIds.add(d.id); running-=Number(d.amount_invoiced); }
            else running=0;
          });
        });

        const activeSups = suppliers.filter((s:any)=>
          allPending.some((d:any)=>{ const p=pkgObj(d.package_id); return p?.supplier_id===s.id; }) &&
          (!paySupFilter || s.id===paySupFilter)
        );
        if(activeSups.length===0&&overdue.length===0) return null;

        return(<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {activeSups.map((sup:any)=>{
            const supDelivsList = allPending.filter((d:any)=>pkgObj(d.package_id)?.supplier_id===sup.id);
            const totalInvoiced = supDelivsList.reduce((s:number,d:any)=>s+Number(d.amount_invoiced),0);
            const totalPaid = payments.filter((p:any)=>p.supplier_id===sup.id&&!p.invoice_id).reduce((s:number,p:any)=>s+Number(p.amount),0);
            const remaining = totalInvoiced - totalPaid;
            const surplus = totalPaid - totalInvoiced;
            const allCovered = supDelivsList.every((d:any)=>coveredIds.has(d.id));

            return(<div key={sup.id} style={{background:C.w,border:`2px solid ${allCovered?C.gnBd:remaining>0?C.amBd:C.bdr}`,borderRadius:12,overflow:"hidden"}}>
              {/* Шапка поставщика */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:allCovered?C.gnBg:remaining>0?C.amBg:C.lt,flexWrap:"wrap",gap:8}}>
                <div style={{fontWeight:700,fontSize:13,color:C.tx}}>{sup.name}</div>
                <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{fontSize:11,color:C.mu}}>Накладных: <strong style={{color:C.tx}}>{fmt(totalInvoiced)} ₸</strong></div>
                  <div style={{fontSize:11,color:C.mu}}>Оплачено: <strong style={{color:C.gn}}>{fmt(totalPaid)} ₸</strong></div>
                  {allCovered
                    ? <span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>✅ Всё закрыто{surplus>1&&` · остаток ${fmt(surplus)} ₸`}</span>
                    : <span style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>⚠️ Осталось {fmt(remaining)} ₸</span>
                  }
                </div>
              </div>
              {/* Список накладных */}
              <div style={{padding:"8px 16px",display:"flex",flexDirection:"column",gap:6}}>
                {supDelivsList.map((d:any)=>{
                  const isCovered = coveredIds.has(d.id);
                  const isOverdueD = d.payment_due_date&&d.payment_due_date<today;
                  const isThisWeek = d.payment_due_date&&d.payment_due_date>=today&&d.payment_due_date<=weekStr;
                  const tag = isOverdueD?"⚠️ Просрочено":isThisWeek?"📅 На этой неделе":"📆 Предстоящее";
                  const tagColor = isOverdueD?C.rd:isThisWeek?C.am:C.mu;
                  return(<div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.lt}`,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:150}}>
                      <div style={{fontSize:12,fontWeight:600,color:isCovered?C.mu:C.tx,textDecoration:isCovered?"line-through":"none"}}>{pkgLabel(d.package_id)}</div>
                      <div style={{fontSize:10,color:C.mu,marginTop:1}}>{sn(d.store_id)}{d.payment_due_date&&<span style={{color:tagColor}}> · до {fmtDate(d.payment_due_date)}</span>}</div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:isCovered?C.mu:C.tx,textDecoration:isCovered?"line-through":"none"}}>{fmt(d.amount_invoiced)} ₸</div>
                    {isCovered
                      ? <span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>✅ Покрыто</span>
                      : <span style={{background:isOverdueD?C.rdBg:isThisWeek?C.amBg:C.lt,border:`1px solid ${isOverdueD?C.rdBd:isThisWeek?C.amBd:C.bdr}`,color:tagColor,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{tag}</span>
                    }
                  </div>);
                })}
              </div>
            </div>);
          })}
        </div>);
      })()}

      {/* Таблица долга по поставщикам */}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <div style={{padding:"8px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>Долги по поставщикам</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH ch="Поставщик"/><TH ch="Общий долг"/><TH ch="Поставок не оплачено"/><TH ch=""/></tr></thead>
          <tbody>{suppliers.map((s:any,i:number)=>{
            const d=debtBySup[s.id]||{total:0,delivs:[]};
            const debt=Math.max(0,d.total);
            if(debt===0&&d.delivs.length===0) return null;
            return(<tr key={s.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontWeight:600,fontSize:12}}>{s.name}</span>}/>
              <TD ch={<span style={{fontWeight:700,fontSize:13,color:debt>0?C.rd:C.gn}}>{fmt(debt)} ₸</span>}/>
              <TD ch={<span style={{fontSize:11,color:C.md}}>{d.delivs.length} накладных</span>}/>
              <TD ch={debt>0&&<button onClick={()=>{setPayF({date:today,supplier_id:s.id,amount:debt,note:`Оплата ${s.name}`});setPayModal(true);}} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>💳 Оплатить</button>}/>
            </tr>);
          }).filter(Boolean)}</tbody>
        </table>
      </div>

      {/* История оплат */}
      {payments.length>0&&<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto",marginTop:16}}>
        <div style={{padding:"8px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>История оплат</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
          <thead><tr><TH ch="Дата"/><TH ch="Поставщик"/><TH ch="Сумма"/><TH ch="Примечание"/><TH ch=""/></tr></thead>
          <tbody>{payments.map((pay:any,i:number)=>(
            <tr key={pay.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{fmtDate(pay.date)}</span>}/>
              <TD ch={<span style={{fontWeight:600,fontSize:12}}>{suppliers.find((s:any)=>s.id===pay.supplier_id)?.name||"—"}</span>}/>
              <TD ch={<strong style={{fontSize:12,color:C.gn}}>{fmt(pay.amount)} ₸</strong>}/>
              <TD ch={<span style={{fontSize:11,color:C.mu}}>{pay.note||"—"}</span>}/>
              <TD ch={<button onClick={()=>setDelPayM(pay)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>}/>
            </tr>
          ))}</tbody>
        </table>
      </div>}
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: СПРАВОЧНИК (owner/manager)
  // ════════════════════════════════════════════════════════════════
  function renderRefs(){
    const REF_TABS=[{k:"sup",l:"🏢 Поставщики"},{k:"agents",l:"🧑‍💼 Агенты"},{k:"pkg",l:"📦 Пакеты"},{k:"sched",l:"📅 Расписание"}];
    return(<div>
      <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2,marginBottom:16}}>
        {REF_TABS.map(t=><button key={t.k} onClick={()=>setRefTab(t.k)} style={subBtn(refTab===t.k)}>{t.l}</button>)}
      </div>

      {refTab==="sup"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>{setSupF({active:true});setSupModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Поставщик</button>
        </div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH ch="Поставщик"/><TH ch="Контакт"/><TH ch="Нач. долг"/><TH ch="Пакетов"/><TH ch="Статус"/><TH ch=""/></tr></thead>
            <tbody>{suppliers.map((s:any,i:number)=>(
              <tr key={s.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:s.active?1:0.55}}>
                <TD ch={<div><div style={{fontWeight:600,fontSize:12}}>{s.name}</div>{s.notes&&<div style={{fontSize:10,color:C.mu}}>{s.notes}</div>}</div>}/>
                <TD ch={<div style={{fontSize:11}}>{s.contact}<br/><span style={{color:C.mu}}>{s.phone}</span></div>}/>
                <TD ch={Number(s.initial_balance)>0
                  ? <div>
                      <span style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{fmt(s.initial_balance)} ₸</span>
                      {s.initial_balance_date&&<div style={{fontSize:10,color:C.mu,marginTop:2}}>на {fmtDate(s.initial_balance_date)}</div>}
                    </div>
                  : <span style={{color:C.mu,fontSize:11}}>—</span>
                }/>
                <TD ch={<span style={{fontSize:12}}>{packages.filter(p=>p.supplier_id===s.id).length}</span>}/>
                <TD ch={<Bdg c={s.active?C.gn:C.mu} bg={s.active?C.gnBg:C.lt} bd={s.active?C.gnBd:C.bdr} ch={s.active?"Активен":"Неактивен"}/>}/>
                <TD ch={<div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{setSupF({...s});setSupModal(s);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                  <button onClick={()=>setDelSupM(s)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>
                </div>}/>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>}

      {refTab==="agents"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>{setAgentF({active:true});setAgentPkgSel([]);setAgentModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Агент</button>
        </div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead><tr><TH ch="Агент"/><TH ch="Поставщик"/><TH ch="Телефон"/><TH ch="Пакеты"/><TH ch=""/></tr></thead>
            <tbody>{agents.map((a:any,i:number)=>{
              const sup=supObj(a.supplier_id);
              const aPkgs=agentPkgs.filter((ap:any)=>ap.agent_id===a.id).map((ap:any)=>pkgObj(ap.package_id)).filter(Boolean);
              return(<tr key={a.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:a.active?1:0.55}}>
                <TD ch={<div><div style={{fontWeight:600,fontSize:12}}>{a.name}</div>{a.email&&<div style={{fontSize:10,color:C.mu}}>{a.email}</div>}</div>}/>
                <TD ch={<span style={{fontSize:11,color:C.md}}>{sup?.name||"—"}</span>}/>
                <TD ch={<span style={{fontSize:12}}>{a.phone||"—"}</span>}/>
                <TD ch={<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {aPkgs.length===0?<span style={{fontSize:11,color:C.mu}}>—</span>:aPkgs.map((p:any)=>(
                    <span key={p.id} style={{background:C.puBg,border:`1px solid ${C.puBd}`,color:C.pu,padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:600}}>{p.name}</span>
                  ))}
                </div>}/>
                <TD ch={<div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{
                    setAgentF({...a});
                    setAgentPkgSel(agentPkgs.filter((ap:any)=>ap.agent_id===a.id).map((ap:any)=>ap.package_id));
                    setAgentModal(a);
                  }} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                  <button onClick={()=>setDelAgentM(a)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>
                </div>}/>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>}

      {refTab==="pkg"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>{setPkgF({active:true,payment_type:"bank",payment_days:14});setPkgModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Пакет</button>
        </div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead><tr><TH ch="Поставщик"/><TH ch="Пакет"/><TH ch="Оплата"/><TH ch="Отсрочка"/><TH ch="Условия"/><TH ch="Агенты"/><TH ch=""/></tr></thead>
            <tbody>{packages.map((p:any,i:number)=>{
              const sup=supObj(p.supplier_id);
              return(<tr key={p.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:p.active?1:0.55}}>
                <TD ch={<span style={{fontSize:11,color:C.md}}>{sup?.name||"—"}</span>}/>
                <TD ch={<span style={{fontWeight:600,fontSize:12}}>{p.name}</span>}/>
                <TD ch={<div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>{p.payment_type==="bank"?<Bdg c={C.bl} bg={C.blBg} bd={C.blBd} ch="🏦 Банк"/>:<Bdg c={C.am} bg={C.amBg} bd={C.amBd} ch="💵 Нал"/>}{p.prepayment&&<PrepayBadge/>}</div>}/>
                <TD ch={<span style={{fontSize:12}}>{p.payment_type==="bank"?`${p.payment_days} дн.`:"—"}</span>}/>
                <TD ch={<span style={{fontSize:11,color:C.mu}}>{p.notes||"—"}</span>}/>
                <TD ch={<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {agentPkgs.filter((ap:any)=>ap.package_id===p.id).map((ap:any)=>{const ag=agents.find((a:any)=>a.id===ap.agent_id);return ag?<span key={ap.id} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"1px 6px",borderRadius:20,fontSize:10}}>{ag.name}</span>:null;}).filter(Boolean)}
                  {agentPkgs.filter((ap:any)=>ap.package_id===p.id).length===0&&<span style={{fontSize:10,color:C.mu}}>—</span>}
                </div>}/>
                <TD ch={<div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{setPkgF({...p});setPkgModal(p);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                  <button onClick={()=>setDelPkgM(p)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>
                </div>}/>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>}

      {refTab==="sched"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button onClick={()=>{setSchedF({active:true,order_days:[],delivery_days:[],lead_days:1});setSchedModal("add");}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Расписание</button>
        </div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
            <thead><tr><TH ch="Пакет"/><TH ch="Магазин"/><TH ch="Дни заказа"/><TH ch="Дни поставки"/><TH ch="Статус"/><TH ch=""/></tr></thead>
            <tbody>{schedules.map((sc:any,i:number)=>{
              const od:number[]=Array.isArray(sc.order_days)?sc.order_days:[];
              const dd:number[]=Array.isArray(sc.delivery_days)?sc.delivery_days:[];
              return(<tr key={sc.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:sc.active?1:0.55}}>
                <TD ch={<span style={{fontWeight:600,fontSize:12}}>{pkgLabel(sc.package_id)}</span>}/>
                <TD ch={<span style={{fontSize:11}}>{sn(sc.store_id)}</span>}/>
                <TD ch={<span style={{fontSize:11,color:C.bl}}>{od.map((d:number)=>DAY[d]).join(", ")||"—"}</span>}/>
                <TD ch={<span style={{fontSize:11,color:C.gn}}>
                  {dd.length>0 ? dd.map((d:number)=>DAY[d]).join(", ") : sc.lead_days ? `⏱ через ${sc.lead_days} дн.` : "—"}
                </span>}/>
                <TD ch={<Bdg c={sc.active?C.gn:C.mu} bg={sc.active?C.gnBg:C.lt} bd={sc.active?C.gnBd:C.bdr} ch={sc.active?"Активно":"Откл."}/>}/>
                <TD ch={<div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{
                    const dd=Array.isArray(sc.delivery_days)?sc.delivery_days:[];
                    const mode = dd.length>0 ? "days" : "lead";
                    setSchedF({...sc,order_days:od,delivery_days:dd,delivery_mode:mode});
                    setSchedModal(sc);
                  }} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✎</button>
                  <button onClick={()=>setDelSchedM(sc)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑</button>
                </div>}/>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>}
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // CRUD FUNCTIONS
  // ════════════════════════════════════════════════════════════════
  async function saveSupplier(){
    if(!supF.name?.trim())return; setSaving(true);
    const supPayload={
      name: supF.name.trim(),
      contact: supF.contact||"",
      phone: supF.phone||"",
      inn: supF.inn||"",
      notes: supF.notes||"",
      active: supF.active!==false,
      report_hidden: !!supF.report_hidden,
      initial_balance: Number(supF.initial_balance)||0,
      initial_balance_date: supF.initial_balance_date||null,
    };
    if(supModal==="add"){const{data}=await sb.from("sup_suppliers").insert(supPayload).select().single();if(data)setSuppliers([...suppliers,data]);}
    else{const{data,error}=await sb.from("sup_suppliers").update(supPayload).eq("id",supF.id).select().single();if(data)setSuppliers(suppliers.map((s:any)=>s.id===data.id?data:s));if(error)console.error("saveSup:",error);}
    setSaving(false);setSupModal(null);
  }
  async function savePackage(){
    if(!pkgF.name?.trim()||!pkgF.supplier_id)return; setSaving(true);
    const pkgPayload={
      supplier_id: pkgF.supplier_id,
      name: pkgF.name?.trim(),
      payment_type: pkgF.payment_type||"bank",
      payment_days: pkgF.payment_type==="bank" ? (Number(pkgF.payment_days)||14) : null,
      prepayment: !!pkgF.prepayment,
      notes: pkgF.notes||"",
      active: pkgF.active!==false,
    };
    if(pkgModal==="add"){const{data}=await sb.from("sup_packages").insert(pkgPayload).select().single();if(data)setPackages([...packages,data]);}
    else{const{data,error}=await sb.from("sup_packages").update(pkgPayload).eq("id",pkgF.id).select().single();if(data)setPackages(packages.map((p:any)=>p.id===data.id?data:p));if(error)console.error("savePkg error:",error);}
    setSaving(false);setPkgModal(null);
  }
  async function deleteSup(sup:any){
    const hasPkgs = packages.some((p:any)=>p.supplier_id===sup.id);
    if(hasPkgs){
      // есть пакеты — просто деактивируем
      const{data}=await sb.from("sup_suppliers").update({active:false}).eq("id",sup.id).select().single();
      if(data) setSuppliers(suppliers.map((s:any)=>s.id===data.id?data:s));
    } else {
      await sb.from("sup_suppliers").delete().eq("id",sup.id);
      setSuppliers(suppliers.filter((s:any)=>s.id!==sup.id));
    }
    setDelSupM(null);
  }
  async function deletePkg(pkg:any){
    const hasOrders    = orders.some((o:any)=>o.package_id===pkg.id);
    const hasDeliveries= deliveries.some((d:any)=>d.package_id===pkg.id);
    if(hasOrders||hasDeliveries){
      const{data}=await sb.from("sup_packages").update({active:false}).eq("id",pkg.id).select().single();
      if(data) setPackages(packages.map((p:any)=>p.id===data.id?data:p));
    } else {
      await sb.from("sup_schedules").delete().eq("package_id",pkg.id);
      await sb.from("sup_packages").delete().eq("id",pkg.id);
      setPackages(packages.filter((p:any)=>p.id!==pkg.id));
      setSchedules(schedules.filter((s:any)=>s.package_id!==pkg.id));
    }
    setDelPkgM(null);
  }
  async function deleteOrder(o:any){
    // Удаляем связанный счёт если он не оплачен
    const linkedInv = invoices.find((inv:any)=>inv.order_id===o.id);
    if(linkedInv){
      await sb.from("sup_invoices").delete().eq("id",linkedInv.id);
      setInvoices(invoices.filter((inv:any)=>inv.id!==linkedInv.id));
    }
    await sb.from("sup_orders").delete().eq("id",o.id);
    setOrders(orders.filter((x:any)=>x.id!==o.id));
    setDelOrdM(null);
  }
  async function deleteDelivery(d:any){
    await sb.from("sup_deliveries").delete().eq("id",d.id);
    setDeliveries(deliveries.filter((x:any)=>x.id!==d.id));
    // Если предоплатная поставка — возвращаем счёт в статус "ожидает прихода"
    if(d.invoice_id){
      await sb.from("sup_invoices").update({status:"paid"}).eq("id",d.invoice_id);
      setInvoices(invoices.map((inv:any)=>inv.id===d.invoice_id?{...inv,status:"paid"}:inv));
    }
    setDelDelvM(null);
  }
  async function deletePayment(p:any){
    // Если оплата была по счёту — возвращаем счёт в "awaiting_payment"
    if(p.invoice_id){
      await sb.from("sup_invoices").update({status:"awaiting_payment",paid_at:null}).eq("id",p.invoice_id);
      setInvoices(invoices.map((inv:any)=>inv.id===p.invoice_id?{...inv,status:"awaiting_payment",paid_at:null}:inv));
    }
    await sb.from("sup_payments").delete().eq("id",p.id);
    setPayments(payments.filter((x:any)=>x.id!==p.id));
    setDelPayM(null);
  }
  async function saveAgent(){
    if(!agentF.name?.trim()||!agentF.supplier_id) return; setSaving(true);
    let agentId = agentF.id;
    if(agentModal==="add"){
      const{data}=await sb.from("sup_agents").insert({name:agentF.name,supplier_id:agentF.supplier_id,phone:agentF.phone||"",email:agentF.email||"",notes:agentF.notes||"",active:true}).select().single();
      if(data){setAgents([...agents,data]);agentId=data.id;}
    } else {
      const{data}=await sb.from("sup_agents").update({name:agentF.name,phone:agentF.phone||"",email:agentF.email||"",notes:agentF.notes||""}).eq("id",agentF.id).select().single();
      if(data) setAgents(agents.map((a:any)=>a.id===data.id?data:a));
    }
    // Save package links
    if(agentId){
      await sb.from("sup_agent_packages").delete().eq("agent_id",agentId);
      if(agentPkgSel.length>0){
        await sb.from("sup_agent_packages").insert(agentPkgSel.map(pkgId=>({agent_id:agentId,package_id:pkgId})));
      }
      const{data:ap}=await sb.from("sup_agent_packages").select("*");
      if(ap) setAgentPkgs(ap);
    }
    setSaving(false); setAgentModal(null);
  }
  async function deleteAgent(a:any){
    await sb.from("sup_agent_packages").delete().eq("agent_id",a.id);
    await sb.from("sup_agents").delete().eq("id",a.id);
    setAgents(agents.filter((x:any)=>x.id!==a.id));
    setAgentPkgs(agentPkgs.filter((x:any)=>x.agent_id!==a.id));
    setDelAgentM(null);
  }
  async function saveSchedule(){
    if(!schedF.package_id||!schedF.store_id)return; setSaving(true);
    const isLeadMode = schedF.delivery_mode === "lead";
    const payload = {
      package_id: schedF.package_id,
      store_id: schedF.store_id,
      order_days: schedF.order_days || [],
      delivery_days: isLeadMode ? [] : (schedF.delivery_days || []),
      lead_days: isLeadMode ? (schedF.lead_days || 1) : null,
      active: schedF.active !== false,
    };
    if(schedModal==="add"){const{data}=await sb.from("sup_schedules").insert(payload).select().single();if(data)setSchedules([...schedules,data]);}
    else{const{data}=await sb.from("sup_schedules").update(payload).eq("id",schedF.id).select().single();if(data)setSchedules(schedules.map((s:any)=>s.id===data.id?data:s));}
    setSaving(false);setSchedModal(null);
  }
  async function deleteSchedule(sc:any){
    await sb.from("sup_schedules").delete().eq("id",sc.id);
    setSchedules(schedules.filter((s:any)=>s.id!==sc.id));
    setDelSchedM(null);
  }
  async function saveOrder(){
    if(!orderF.package_id)return; setSaving(true);
    const payload={
      package_id: orderF.package_id,
      store_id: orderF.store_id||null,
      order_date: orderF.order_date,
      expected_delivery_date: orderF.expected_delivery_date||null,
      amount_ordered: Number(orderF.amount_ordered)||0,
      status: orderF.status||"sent",
      notes: orderF.notes||"",
      created_by_role: orderF.created_by_role||"purchaser",
    };
    if(orderModal==="add"){const{data}=await sb.from("sup_orders").insert(payload).select().single();if(data)setOrders([data,...orders]);}
    else{const{data,error}=await sb.from("sup_orders").update(payload).eq("id",orderF.id).select().single();if(data)setOrders(orders.map((o:any)=>o.id===data.id?data:o));if(error)console.error("saveOrder error:",error);}
    setSaving(false);setOrderModal(null);
  }
  async function saveDelivery(){
    if(!recvF.package_id||!recvF.store_id)return; setSaving(true);
    const payload={
      package_id: recvF.package_id,
      store_id: recvF.store_id,
      delivery_date: recvF.delivery_date,
      invoice_number: recvF.invoice_number||"",
      amount_invoiced: Number(recvF.amount_invoiced)||0,
      payment_type: recvF.payment_type||"bank",
      payment_due_date: recvF.payment_due_date||null,
      status: recvF.status||"received",
      notes: recvF.notes||"",
      order_id: recvF.order_id||null,
      invoice_id: recvF.invoice_id||null,
    };
    const{data,error}=await sb.from("sup_deliveries").insert(payload).select().single();
    if(data){
      setDeliveries((prev:any[])=>[data,...prev]);
    }
    // Всегда обновляем статус заказа если он был привязан
    if(recvF.order_id){
      await sb.from("sup_orders").update({status:"delivered"}).eq("id",recvF.order_id);
      setOrders((prev:any[])=>prev.map((o:any)=>o.id===recvF.order_id?{...o,status:"delivered"}:o));
    }
    if(error) console.error("saveDelivery error:", error);
    setSaving(false);setRecvModal(null);
  }
  async function savePayment(){
    if(!payF.supplier_id||!payF.amount)return; setSaving(true);
    const{data}=await sb.from("sup_payments").insert({...payF,amount:Number(payF.amount)}).select().single();
    if(data) setPayments([data,...payments]);
    setSaving(false);setPayModal(false);
  }
  async function saveInvoice(){
    if(!invoiceF.package_id||!invoiceF.supplier_id||!invoiceF.amount)return; setSaving(true);
    const payload={...invoiceF,amount:Number(invoiceF.amount),store_id:invoiceF.store_id||null,order_id:invoiceF.order_id||null};
    const{data}=await sb.from("sup_invoices").insert(payload).select().single();
    if(data){
      setInvoices([data,...invoices]);
      // Обновляем статус заказа если привязан
      if(invoiceF.order_id){
        await sb.from("sup_orders").update({status:"sent"}).eq("id",invoiceF.order_id);
      }
    }
    setSaving(false);setInvoiceModal(null);
  }
  async function deleteInvoice(inv:any){
    await sb.from("sup_invoices").delete().eq("id",inv.id);
    setInvoices(invoices.filter((x:any)=>x.id!==inv.id));
    setDelInvM(null);
  }

  // ════════════════════════════════════════════════════════════════
  // DAYS CHECKBOX HELPER
  // ════════════════════════════════════════════════════════════════
  function DayPicker({val,onChange}:{val:number[],onChange:(v:number[])=>void}){
    return(<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {[1,2,3,4,5,6,0].map(d=>{
        const on=val.includes(d);
        return(<button key={d} type="button" onClick={()=>onChange(on?val.filter(x=>x!==d):[...val,d].sort())}
          style={{padding:"5px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            background:on?"linear-gradient(135deg,#f97316,#ea580c)":C.lt,
            border:`1px solid ${on?C.or:C.bdr}`,color:on?"#fff":C.md}}>
          {DAY[d]}
        </button>);
      })}
    </div>);
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: ОТЧЁТ ПО ПОСТАВЩИКУ
  // ════════════════════════════════════════════════════════════════
  function renderReport() {
    const filtSups = (repSupId > 0
      ? suppliers.filter((s:any)=>s.id===repSupId)
      : suppliers.filter((s:any)=>s.active)
    ).filter((s:any) => isOwnerOrManager || !s.report_hidden);

    return(<div>
      {/* Фильтры */}
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",marginBottom:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div>
          <select value={repSupId} onChange={e=>setRepSupId(+e.target.value)} style={I({width:200})}>
            <option value={0}>Все поставщики</option>
            {suppliers.filter((s:any)=>s.active).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>С</div>
          <input type="date" value={repFrom} onChange={e=>setRepFrom(e.target.value)} style={I({width:148})}/>
        </div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПО</div>
          <input type="date" value={repTo} onChange={e=>setRepTo(e.target.value)} style={I({width:148})}/>
        </div>
      </div>

      {/* По каждому поставщику */}
      {filtSups.map((sup:any)=>{
        // Поставки (накладные) за период
        const supPkgIds = packages.filter((p:any)=>p.supplier_id===sup.id).map((p:any)=>p.id);
        const supDeliveries = deliveries.filter((d:any)=>
          supPkgIds.includes(d.package_id) &&
          d.delivery_date >= repFrom && d.delivery_date <= repTo
        );
        const totalReceived = supDeliveries.reduce((s:number,d:any)=>s+Number(d.amount_invoiced||0),0);

        // Оплаты за период
        const supPayments = payments.filter((p:any)=>
          p.supplier_id===sup.id &&
          p.date >= repFrom && p.date <= repTo
        );
        const totalPaid = supPayments.reduce((s:number,p:any)=>s+Number(p.amount||0),0);

        // Баланс: оплачено - (начальный долг + принято) = аванс (+) или долг (-)
        const initialDebt = Number(sup.initial_balance)||0;
        const balance = totalPaid - totalReceived - initialDebt;

        // Хронологическая лента событий
        type Event = {date:string, type:"delivery"|"payment"|"initial", label:string, amount:number, extra?:string};
        const events: Event[] = [
          // Начальный долг показываем первой строкой если есть
          ...(initialDebt>0 ? [{date: sup.initial_balance_date||repFrom, type:"initial" as const, label:"Входящий остаток (нач. долг)", amount:initialDebt, extra: sup.initial_balance_date?`Зафиксировано: ${fmtDate(sup.initial_balance_date)}`:"Дата не указана"}] : []),
          ...supDeliveries.map((d:any)=>({
            date: d.delivery_date,
            type: "delivery" as const,
            label: pkgLabel(d.package_id),
            amount: Number(d.amount_invoiced||0),
            extra: d.invoice_number ? `Накл. №${d.invoice_number}` : "",
          })),
          ...supPayments.map((p:any)=>({
            date: p.date,
            type: "payment" as const,
            label: p.note||"Оплата",
            amount: Number(p.amount||0),
          })),
        ].sort((a,b)=>a.date.localeCompare(b.date));

        if(!events.length && totalReceived===0 && totalPaid===0 && initialDebt===0) return null;

        return(<div key={sup.id} style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,marginBottom:16,overflow:"hidden"}}>
          {/* Шапка поставщика */}
          <div style={{padding:"12px 16px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",flexWrap:"wrap",gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:14}}>{sup.name}</div>
              {sup.inn&&<div style={{fontSize:11,color:C.mu}}>ИИН/БИН: {sup.inn}</div>}
              {Number(sup.initial_balance)>0&&<div style={{fontSize:11,color:C.am,marginTop:2}}>💰 Входящий остаток: <strong>{fmt(sup.initial_balance)} ₸</strong>{sup.initial_balance_date&&<span style={{fontWeight:400,color:C.mu}}> на {fmtDate(sup.initial_balance_date)}</span>}</div>}
            </div>
            {/* Сводка */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {Number(sup.initial_balance)>0&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:C.am}}>{fmt(sup.initial_balance)} ₸</div>
                <div style={{fontSize:9,color:C.am,fontWeight:700}}>НАЧ. ДОЛГ</div>
              </div>}
              <div style={{background:C.blBg,border:`1px solid ${C.blBd}`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:C.bl}}>{fmt(totalReceived)} ₸</div>
                <div style={{fontSize:9,color:C.mu,fontWeight:700}}>ПРИНЯТО ТОВАРА</div>
              </div>
              <div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:C.gn}}>{fmt(totalPaid)} ₸</div>
                <div style={{fontSize:9,color:C.mu,fontWeight:700}}>ОПЛАЧЕНО</div>
              </div>
              <div style={{background:balance>0?C.puBg:balance<0?C.amBg:C.lt,border:`1px solid ${balance>0?C.puBd:balance<0?C.amBd:C.bdr}`,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:800,color:balance>0?C.pu:balance<0?C.am:C.mu}}>
                  {balance>0?"+":""}{fmt(balance)} ₸
                </div>
                <div style={{fontSize:9,color:C.mu,fontWeight:700}}>{balance>0?"АВАНС":balance<0?"ДОЛГ":"БАЛАНС"}</div>
              </div>
            </div>
          </div>

          {/* Хронологическая таблица */}
          {events.length>0&&<table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#fafbfc"}}>
              <th style={{padding:"6px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.mu,borderBottom:`1px solid ${C.bdr}`}}>ДАТА</th>
              <th style={{padding:"6px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.mu,borderBottom:`1px solid ${C.bdr}`}}>ТИП</th>
              <th style={{padding:"6px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.mu,borderBottom:`1px solid ${C.bdr}`}}>ОПИСАНИЕ</th>
              <th style={{padding:"6px 14px",textAlign:"right",fontSize:10,fontWeight:700,color:C.mu,borderBottom:`1px solid ${C.bdr}`}}>ПРИХОД ТОВАРА</th>
              <th style={{padding:"6px 14px",textAlign:"right",fontSize:10,fontWeight:700,color:C.mu,borderBottom:`1px solid ${C.bdr}`}}>ОПЛАТА</th>
            </tr></thead>
            <tbody>
              {events.map((ev,i)=>(
                <tr key={i} style={{background:ev.type==="initial"?C.amBg:i%2===0?C.w:"#fafbfc",borderBottom:`1px solid #f1f5f9`}}>
                  <td style={{padding:"8px 14px",fontSize:11,color:C.md,whiteSpace:"nowrap"}}>{ev.type==="initial"?"Вх. остаток":fmtDate(ev.date)}</td>
                  <td style={{padding:"8px 14px"}}>
                    {ev.type==="initial"
                      ?<span style={{background:C.amBg,border:`1px solid ${C.amBd}`,color:C.am,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>💰 Нач. долг</span>
                      :ev.type==="delivery"
                      ?<span style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>📦 Приёмка</span>
                      :<span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>💰 Оплата</span>
                    }
                  </td>
                  <td style={{padding:"8px 14px",fontSize:12}}>
                    <div style={{fontWeight:600}}>{ev.label}</div>
                    {ev.extra&&<div style={{fontSize:10,color:C.mu}}>{ev.extra}</div>}
                  </td>
                  <td style={{padding:"8px 14px",textAlign:"right",fontSize:12,fontWeight:(ev.type==="delivery"||ev.type==="initial")?700:400,color:ev.type==="initial"?C.am:ev.type==="delivery"?C.bl:C.mu}}>
                    {(ev.type==="delivery"||ev.type==="initial")?`${fmt(ev.amount)} ₸`:"—"}
                  </td>
                  <td style={{padding:"8px 14px",textAlign:"right",fontSize:12,fontWeight:ev.type==="payment"?700:400,color:ev.type==="payment"?C.gn:C.mu}}>
                    {ev.type==="payment"?`${fmt(ev.amount)} ₸`:"—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {initialDebt>0&&<tr style={{background:C.lt,borderTop:`1px solid ${C.bdr}`}}>
                <td colSpan={3} style={{padding:"6px 14px",fontSize:10,fontWeight:600,color:C.mu}}>Нач. долг + поставки за период</td>
                <td style={{padding:"6px 14px",textAlign:"right",fontSize:12,fontWeight:700,color:C.am}}>{fmt(initialDebt+totalReceived)} ₸</td>
                <td style={{padding:"6px 14px",textAlign:"right",fontSize:12,fontWeight:700,color:C.gn}}>{fmt(totalPaid)} ₸</td>
              </tr>}
              <tr style={{background:C.lt,borderTop:`2px solid ${C.bdr}`}}>
                <td colSpan={3} style={{padding:"8px 14px",fontSize:11,fontWeight:700,color:C.md}}>ИТОГО поставки за период</td>
                <td style={{padding:"8px 14px",textAlign:"right",fontSize:13,fontWeight:800,color:C.bl}}>{fmt(totalReceived)} ₸</td>
                <td style={{padding:"8px 14px",textAlign:"right",fontSize:13,fontWeight:800,color:C.gn}}>{fmt(totalPaid)} ₸</td>
              </tr>
              <tr style={{background:balance>0?C.puBg:balance<0?C.amBg:C.lt}}>
                <td colSpan={3} style={{padding:"6px 14px",fontSize:11,fontWeight:700,color:balance>0?C.pu:balance<0?C.am:C.mu}}>
                  {balance>0?"▲ Аванс у поставщика (переплата)":balance<0?"▼ Задолженность перед поставщиком":"✓ Баланс закрыт"}
                </td>
                <td colSpan={2} style={{padding:"6px 14px",textAlign:"right",fontSize:14,fontWeight:800,color:balance>0?C.pu:balance<0?C.am:C.gn}}>
                  {balance>0?"+":""}{fmt(balance)} ₸
                </td>
              </tr>
            </tfoot>
          </table>}

          {events.length===0&&<div style={{padding:"24px",textAlign:"center",color:C.mu,fontSize:12}}>Нет операций за выбранный период</div>}
        </div>);
      })}

      {filtSups.length===0&&<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,padding:"44px",textAlign:"center",color:C.mu}}>
        <div style={{fontSize:28,marginBottom:8}}>📊</div>
        <div style={{fontSize:13,fontWeight:600}}>Нет данных</div>
      </div>}
    </div>);
  }

  if(loading) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60,color:C.mu}}><div style={{textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>⏳</div><div>Загрузка...</div></div></div>);

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return(<div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14}}>
      <div>
        <h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>🏭 Поставщики и закупки</h2>
        <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>
          {TABS.map((t:any)=><button key={t.k} onClick={()=>setTab(t.k)} style={subBtn(tab===t.k)}>{t.l}</button>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:90}}>
          <div style={{fontSize:16,fontWeight:800,color:C.tx}}>{suppliers.filter((s:any)=>s.active).length}</div>
          <div style={{fontSize:9,color:C.mu,fontWeight:700}}>ПОСТАВЩИКОВ</div>
        </div>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:90}}>
          <div style={{fontSize:16,fontWeight:800,color:C.tx}}>{orders.filter((o:any)=>o.status==="sent").length}</div>
          <div style={{fontSize:9,color:C.mu,fontWeight:700}}>ЗАКАЗОВ</div>
        </div>
        <div style={{background:overdueDelivs.length>0?C.rdBg:C.lt,border:`1px solid ${overdueDelivs.length>0?C.rdBd:C.bdr}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:90}}>
          <div style={{fontSize:16,fontWeight:800,color:overdueDelivs.length>0?C.rd:C.mu}}>{overdueDelivs.length}</div>
          <div style={{fontSize:9,color:overdueDelivs.length>0?C.rd:C.mu,fontWeight:700}}>ПРОСРОЧЕНО</div>
        </div>
        {pendingInvoicesCount>0&&<div style={{background:"#fdf4ff",border:"2px solid #c4b5fd",borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:90}}>
          <div style={{fontSize:16,fontWeight:800,color:C.pu}}>{pendingInvoicesCount}</div>
          <div style={{fontSize:9,color:C.pu,fontWeight:700}}>💳 К ОПЛАТЕ</div>
        </div>}
        <div style={{background:totalDebt>0?C.amBg:C.gnBg,border:`1px solid ${totalDebt>0?C.amBd:C.gnBd}`,borderRadius:9,padding:"8px 14px",textAlign:"center",minWidth:110}}>
          <div style={{fontSize:16,fontWeight:800,color:totalDebt>0?C.am:C.gn}}>{fmt(totalDebt)} ₸</div>
          <div style={{fontSize:9,color:totalDebt>0?C.am:C.gn,fontWeight:700}}>ДОЛГ</div>
        </div>
      </div>
    </div>

    {tab==="schedule"  && renderSchedule()}
    {tab==="orders"    && renderOrders()}
    {tab==="deliveries"&& renderDeliveries()}
    {tab==="payments"  && renderPayments()}
    {tab==="report"    && renderReport()}
    {tab==="refs"      && renderRefs()}

    {/* МОДАЛ: ПОСТАВЩИК */}
    {supModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{supModal==="add"?"Новый поставщик":"Редактировать"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {([["НАИМЕНОВАНИЕ","name"],["КОНТАКТ","contact"],["ТЕЛЕФОН","phone"],["ИИН/БИН","inn"],["ЗАМЕТКИ","notes"]] as [string,string][]).map(([l,k])=>(
            <div key={k}><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>{l}</div><input value={supF[k]||""} onChange={e=>setSupF({...supF,[k]:e.target.value})} style={I()}/></div>
          ))}

          {/* Начальный долг — только owner/manager/accountant */}
          {canEditInitialBalance && <div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:C.am,marginBottom:5,fontWeight:700}}>💰 НАЧАЛЬНЫЙ ДОЛГ (ВХОДЯЩИЙ ОСТАТОК)</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div>
                <div style={{fontSize:9,color:C.am,marginBottom:3,fontWeight:600}}>СУММА ₸</div>
                <input
                  type="number"
                  min={0}
                  value={supF.initial_balance||""}
                  onChange={e=>setSupF({...supF,initial_balance:e.target.value})}
                  placeholder="0"
                  style={I()}
                />
              </div>
              <div>
                <div style={{fontSize:9,color:C.am,marginBottom:3,fontWeight:600}}>ДАТА ФИКСАЦИИ ДОЛГА</div>
                <input
                  type="date"
                  value={supF.initial_balance_date||""}
                  onChange={e=>setSupF({...supF,initial_balance_date:e.target.value})}
                  style={I()}
                />
              </div>
            </div>
            <div style={{fontSize:10,color:C.am,marginTop:8}}>
              Сумма долга перед поставщиком на указанную дату. Учитывается в расчёте текущего баланса для сверки с 1С.
            </div>
          </div>}

          <div><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12}}><input type="checkbox" checked={supF.active||false} onChange={e=>setSupF({...supF,active:e.target.checked})}/>Активен</label></div>
          <div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:9}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <input type="checkbox" checked={supF.report_hidden||false} onChange={e=>setSupF({...supF,report_hidden:e.target.checked})} style={{cursor:"pointer",width:14,height:14}}/>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:supF.report_hidden?C.am:C.tx}}>🔒 Скрыть отчёт от сотрудников</div>
                <div style={{fontSize:10,color:C.mu}}>Отчёт по поставщику виден только владельцу и управляющему</div>
              </div>
            </label>
          </div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setSupModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveSupplier} disabled={saving||!supF.name?.trim()} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: ПАКЕТ */}
    {pkgModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{pkgModal==="add"?"Новый пакет":"Редактировать пакет"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div>
            <select value={pkgF.supplier_id||""} onChange={e=>setPkgF({...pkgF,supplier_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {suppliers.filter((s:any)=>s.active).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НАЗВАНИЕ ПАКЕТА</div><input value={pkgF.name||""} onChange={e=>setPkgF({...pkgF,name:e.target.value})} placeholder="Эфес, Яшкино..." style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТИП ОПЛАТЫ</div>
            <div style={{display:"flex",gap:6}}>
              {([["bank","🏦 Банк"],["cash","💵 Нал"]] as const).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setPkgF({...pkgF,payment_type:v})} style={{flex:1,padding:"7px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:pkgF.payment_type===v?(v==="bank"?C.blBg:C.amBg):C.lt,border:`2px solid ${pkgF.payment_type===v?(v==="bank"?C.blBd:C.amBd):C.bdr}`,color:pkgF.payment_type===v?(v==="bank"?C.bl:C.am):C.mu}}>{l}</button>
              ))}
            </div>
          </div>
          {pkgF.payment_type==="bank"&&!pkgF.prepayment&&<div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОТСРОЧКА (ДНЕЙ)</div><input type="number" value={pkgF.payment_days||""} onChange={e=>setPkgF({...pkgF,payment_days:+e.target.value})} style={I()}/></div>}
          <div style={{background:pkgF.prepayment?"#fdf4ff":C.lt,border:`2px solid ${pkgF.prepayment?"#c4b5fd":C.bdr}`,borderRadius:9,padding:"10px 12px"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <input type="checkbox" checked={pkgF.prepayment||false} onChange={e=>setPkgF({...pkgF,prepayment:e.target.checked})} style={{cursor:"pointer",width:15,height:15}}/>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:pkgF.prepayment?C.pu:C.md}}>💳 Предоплата</div>
                <div style={{fontSize:10,color:C.mu}}>Сначала оплата бухгалтером, потом приход товара</div>
              </div>
            </label>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>УСЛОВИЯ / ЗАМЕТКИ</div><input value={pkgF.notes||""} onChange={e=>setPkgF({...pkgF,notes:e.target.value})} style={I()}/></div>
          <div><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12}}><input type="checkbox" checked={pkgF.active||false} onChange={e=>setPkgF({...pkgF,active:e.target.checked})}/>Активен</label></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setPkgModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={savePackage} disabled={saving||!pkgF.name?.trim()||!pkgF.supplier_id} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: РАСПИСАНИЕ */}
    {schedModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:440,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Расписание заказов</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПАКЕТ</div>
            <select value={schedF.package_id||""} onChange={e=>setSchedF({...schedF,package_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {packages.filter((p:any)=>p.active).map((p:any)=>{const s=supObj(p.supplier_id);return<option key={p.id} value={p.id}>{s?.name} › {p.name}</option>;})}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div>
            <select value={schedF.store_id||""} onChange={e=>setSchedF({...schedF,store_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДНИ ЗАКАЗА</div><DayPicker val={schedF.order_days||[]} onChange={v=>setSchedF({...schedF,order_days:v})}/></div>

          {/* Тип указания срока поставки */}
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:6,fontWeight:700}}>КАК УКАЗАТЬ СРОК ПОСТАВКИ</div>
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              {[["days","📅 Конкретные дни недели"],["lead","⏱ Через N дней"]] .map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setSchedF({...schedF,delivery_mode:v,delivery_days:v==="days"?schedF.delivery_days||[]:[],lead_days:v==="lead"?schedF.lead_days||1:null})}
                  style={{flex:1,padding:"7px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                    background:(schedF.delivery_mode||"days")===v?C.blBg:C.lt,
                    border:`2px solid ${(schedF.delivery_mode||"days")===v?C.blBd:C.bdr}`,
                    color:(schedF.delivery_mode||"days")===v?C.bl:C.mu}}>
                  {l}
                </button>
              ))}
            </div>
            {(schedF.delivery_mode||"days")==="days"
              ? <DayPicker val={schedF.delivery_days||[]} onChange={v=>setSchedF({...schedF,delivery_days:v})}/>
              : <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min={1} max={30} value={schedF.lead_days||""} onChange={e=>setSchedF({...schedF,lead_days:+e.target.value})} style={I({width:80})}/>
                  <span style={{fontSize:12,color:C.mu}}>дней после заказа</span>
                </div>
            }
          </div>

          <div><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12}}><input type="checkbox" checked={schedF.active||false} onChange={e=>setSchedF({...schedF,active:e.target.checked})}/>Активно</label></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setSchedModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveSchedule} disabled={saving||!schedF.package_id||!schedF.store_id} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: ЗАКАЗ */}
    {orderModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{orderModal==="add"?"Новый заказ":"Редактировать заказ"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПАКЕТ</div>
            <select value={orderF.package_id||""} onChange={e=>setOrderF({...orderF,package_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {packages.filter((p:any)=>p.active).map((p:any)=>{const s=supObj(p.supplier_id);return<option key={p.id} value={p.id}>{s?.name} › {p.name}</option>;})}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div>
            <select value={orderF.store_id||""} onChange={e=>setOrderF({...orderF,store_id:e.target.value?+e.target.value:null})} style={I()}>
              <option value="">— Все магазины —</option>
              {(isOwnerOrManager||myStoreIds.length===0?stores:stores.filter((s:any)=>myStoreIds.includes(s.id))).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА ЗАКАЗА</div><input type="date" value={orderF.order_date||""} onChange={e=>setOrderF({...orderF,order_date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОЖИДАЕМАЯ ДАТА ПОСТАВКИ</div><input type="date" value={orderF.expected_delivery_date||""} onChange={e=>setOrderF({...orderF,expected_delivery_date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА ЗАКАЗА (₸)</div><input type="number" value={orderF.amount_ordered||""} onChange={e=>setOrderF({...orderF,amount_ordered:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СТАТУС</div>
            <select value={orderF.status||"sent"} onChange={e=>setOrderF({...orderF,status:e.target.value})} style={I()}>
              {Object.entries(STATUS_ORDER).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ЗАМЕТКИ</div><input value={orderF.notes||""} onChange={e=>setOrderF({...orderF,notes:e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setOrderModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveOrder} disabled={saving||!orderF.package_id} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: ПРИЁМКА */}
    {recvModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:430,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Принять поставку</div>
        <div style={{display:"flex",flexDirection:"column",gap:9,marginTop:14}}>
          {recvModal==="new"&&isOwnerOrManager&&<>
            <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПАКЕТ</div>
              <select value={recvF.package_id||""} onChange={e=>setRecvF({...recvF,package_id:+e.target.value})} style={I()}>
                <option value="">— Выбрать —</option>
                {packages.filter((p:any)=>p.active).map((p:any)=>{const s=supObj(p.supplier_id);return<option key={p.id} value={p.id}>{s?.name} › {p.name}</option>;})}
              </select>
            </div>
            <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div>
              <select value={recvF.store_id||""} onChange={e=>setRecvF({...recvF,store_id:+e.target.value})} style={I()}>
                <option value="">— Выбрать —</option>
                {stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>}
          {recvModal==="new"&&!isOwnerOrManager&&<>
            <div style={{background:C.lt,borderRadius:8,padding:"9px 12px"}}>
              <div style={{fontSize:9,color:C.mu,fontWeight:700,marginBottom:3}}>ПАКЕТ</div>
              <div style={{fontSize:13,fontWeight:700}}>{pkgLabel(recvF.package_id)}</div>
            </div>
            <div style={{background:C.lt,borderRadius:8,padding:"9px 12px"}}>
              <div style={{fontSize:9,color:C.mu,fontWeight:700,marginBottom:3}}>МАГАЗИН</div>
              <div style={{fontSize:13,fontWeight:700}}>{sn(recvF.store_id)}</div>
            </div>
          </>}
          {recvModal!=="new"&&<div style={{background:C.lt,borderRadius:8,padding:"9px 12px"}}>
            <div style={{fontSize:9,color:C.mu,fontWeight:700,marginBottom:3}}>ПАКЕТ</div>
            <div style={{fontSize:13,fontWeight:700}}>
              {pkgLabel(recvF.package_id)}
              {recvModal!=="prepay"&&recvModal?.order_date&&<span style={{fontSize:11,color:C.mu,fontWeight:400}}> · {fmtDate(recvModal.order_date)}</span>}
              {recvModal==="prepay"&&<PrepayBadge/>}
            </div>
            {recvF.store_id&&<div style={{fontSize:11,color:C.mu,marginTop:2}}>🏪 {sn(recvF.store_id)}</div>}
          </div>}
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА ПОСТАВКИ</div><input type="date" value={recvF.delivery_date||""} onChange={e=>setRecvF({...recvF,delivery_date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НОМЕР НАКЛАДНОЙ</div><input value={recvF.invoice_number||""} onChange={e=>setRecvF({...recvF,invoice_number:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА ПО НАКЛАДНОЙ (₸)</div><input type="number" value={recvF.amount_invoiced||""} onChange={e=>setRecvF({...recvF,amount_invoiced:e.target.value})} style={I()}/></div>
          {isOwnerOrManager&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТИП ОПЛАТЫ</div>
              <select value={recvF.payment_type||"bank"} onChange={e=>setRecvF({...recvF,payment_type:e.target.value})} style={I()}>
                <option value="bank">🏦 Банк</option><option value="cash">💵 Нал</option>
              </select>
            </div>
            {recvF.payment_type==="bank"&&<div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОПЛАТИТЬ ДО</div><input type="date" value={recvF.payment_due_date||""} onChange={e=>setRecvF({...recvF,payment_due_date:e.target.value})} style={I()}/></div>}
          </div>}
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СТАТУС</div>
            <div style={{display:"flex",gap:6}}>
              {([["received","✅ Принято"],["discrepancy","⚠️ Расхождение"]] as const).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setRecvF({...recvF,status:v})} style={{flex:1,padding:"7px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:recvF.status===v?(v==="received"?C.gnBg:C.amBg):C.lt,border:`2px solid ${recvF.status===v?(v==="received"?C.gnBd:C.amBd):C.bdr}`,color:recvF.status===v?(v==="received"?C.gn:C.am):C.mu}}>{l}</button>
              ))}
            </div>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ЗАМЕТКИ (РАСХОЖДЕНИЕ И ДР.)</div><input value={recvF.notes||""} onChange={e=>setRecvF({...recvF,notes:e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setRecvModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveDelivery} disabled={saving||!recvF.package_id||!recvF.store_id} style={{flex:1,background:C.gn,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>🚚 Принять</button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: ОПЛАТА */}
    {payModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:380,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Оплата поставщику</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div>
            <select value={payF.supplier_id||""} onChange={e=>setPayF({...payF,supplier_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {suppliers.map((s:any)=>{const d=debtBySup[s.id];return<option key={s.id} value={s.id}>{s.name}{d&&d.total>0?` (долг: ${fmt(d.total)} ₸)`:""}</option>;})}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div><input type="date" value={payF.date||""} onChange={e=>setPayF({...payF,date:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА (₸)</div><input type="number" value={payF.amount||""} onChange={e=>setPayF({...payF,amount:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПРИМЕЧАНИЕ</div><input value={payF.note||""} onChange={e=>setPayF({...payF,note:e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setPayModal(false)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={savePayment} disabled={saving||!payF.supplier_id||!payF.amount} style={{flex:1,background:C.gn,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>💳 Провести</button>
        </div>
      </div>
    </div>}

  {/* МОДАЛ: АГЕНТ */}
    {agentModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:460,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{agentModal==="add"?"Новый агент":"Редактировать агента"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПОСТАВЩИК</div>
            <select value={agentF.supplier_id||""} onChange={e=>setAgentF({...agentF,supplier_id:+e.target.value})} style={I()}>
              <option value="">— Выбрать —</option>
              {suppliers.filter((s:any)=>s.active).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ИМЯ АГЕНТА</div><input value={agentF.name||""} onChange={e=>setAgentF({...agentF,name:e.target.value})} placeholder="Имя Фамилия" style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТЕЛЕФОН</div><input value={agentF.phone||""} onChange={e=>setAgentF({...agentF,phone:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>EMAIL</div><input value={agentF.email||""} onChange={e=>setAgentF({...agentF,email:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ЗАМЕТКИ</div><input value={agentF.notes||""} onChange={e=>setAgentF({...agentF,notes:e.target.value})} style={I()}/></div>
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:6,fontWeight:700}}>ПАКЕТЫ ЭТОГО АГЕНТА</div>
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto",border:`1px solid ${C.bdr}`,borderRadius:8,padding:"8px 10px"}}>
              {packages.filter((p:any)=>p.active&&(!agentF.supplier_id||p.supplier_id===Number(agentF.supplier_id))).map((p:any)=>{
                const sup=supObj(p.supplier_id);
                const checked=agentPkgSel.includes(p.id);
                return(<label key={p.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,padding:"2px 0"}}>
                  <input type="checkbox" checked={checked} onChange={()=>setAgentPkgSel(checked?agentPkgSel.filter(x=>x!==p.id):[...agentPkgSel,p.id])} style={{cursor:"pointer"}}/>
                  <span style={{color:C.mu,fontSize:10}}>{sup?.name} ›</span>
                  <span style={{fontWeight:600}}>{p.name}</span>
                </label>);
              })}
              {packages.filter((p:any)=>p.active&&(!agentF.supplier_id||p.supplier_id===Number(agentF.supplier_id))).length===0&&
                <div style={{fontSize:11,color:C.mu}}>Сначала выберите поставщика</div>}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setAgentModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveAgent} disabled={saving||!agentF.name?.trim()||!agentF.supplier_id} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Сохранить</button>
        </div>
      </div>
    </div>}
    {/* МОДАЛ: УДАЛЕНИЕ РАСПИСАНИЯ */}
    {delSchedM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить расписание?</div>
        <div style={{fontSize:12,color:C.md,fontWeight:600,marginBottom:4}}>{pkgLabel(delSchedM.package_id)}</div>
        <div style={{fontSize:11,color:C.mu,marginBottom:14}}>🏪 {sn(delSchedM.store_id)}</div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelSchedM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteSchedule(delSchedM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
        </div>
      </div>
    </div>}
  {/* МОДАЛ: УДАЛЕНИЕ АГЕНТА */}
    {delAgentM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:320,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить агента?</div>
        <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:14}}>«{delAgentM.name}»</div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelAgentM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteAgent(delAgentM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
        </div>
      </div>
    </div>}
  {/* МОДАЛ: УДАЛЕНИЕ ЗАКАЗА */}
    {delOrdM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:320,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить заказ?</div>
        <div style={{fontSize:12,color:C.md,marginBottom:4}}>{pkgLabel(delOrdM.package_id)}</div>
        <div style={{fontSize:11,color:C.mu,marginBottom:10}}>{fmtDate(delOrdM.order_date)} · {delOrdM.amount_ordered?fmt(delOrdM.amount_ordered)+" ₸":"б/с"}</div>
        {invoices.some((inv:any)=>inv.order_id===delOrdM.id)&&<div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:8,padding:"8px 12px",fontSize:11,color:C.pu,marginBottom:14,textAlign:"left"}}>💜 Связанный счёт на предоплату тоже будет удалён.</div>}
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelOrdM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteOrder(delOrdM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
        </div>
      </div>
    </div>}
    {/* МОДАЛ: УДАЛЕНИЕ ПОСТАВКИ */}
    {delDelvM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить поставку?</div>
        <div style={{fontSize:12,color:C.md,marginBottom:4}}>{pkgLabel(delDelvM.package_id)}</div>
        <div style={{fontSize:11,color:C.mu,marginBottom:4}}>{sn(delDelvM.store_id)} · {fmtDate(delDelvM.delivery_date)}</div>
        <div style={{fontSize:12,fontWeight:700,color:C.rd,marginBottom:10}}>{fmt(delDelvM.amount_invoiced)} ₸{delDelvM.invoice_number&&` · №${delDelvM.invoice_number}`}</div>
        {delDelvM.invoice_id
          ? <div style={{background:"#fdf4ff",border:"1px solid #e9d5ff",borderRadius:8,padding:"8px 12px",fontSize:11,color:C.pu,marginBottom:14,textAlign:"left"}}>💜 Предоплатная поставка — после удаления счёт вернётся в статус «ожидает прихода», оплата сохранится.</div>
          : <div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}>⚠️ Удаление поставки не отменяет оплату поставщику.</div>
        }
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelDelvM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteDelivery(delDelvM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
        </div>
      </div>
    </div>}
    {/* МОДАЛ: УДАЛЕНИЕ ОПЛАТЫ */}
    {delPayM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:320,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить оплату?</div>
        <div style={{fontSize:12,color:C.md,marginBottom:4}}>{suppliers.find((s:any)=>s.id===delPayM.supplier_id)?.name||"—"}</div>
        <div style={{fontSize:14,fontWeight:700,color:C.rd,marginBottom:10}}>{fmt(delPayM.amount)} ₸ · {fmtDate(delPayM.date)}</div>
        <div style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.rd,marginBottom:14,textAlign:"left"}}>Долг поставщика увеличится на эту сумму.</div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelPayM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deletePayment(delPayM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
        </div>
      </div>
    </div>}
  {/* МОДАЛ: СЧЁТ НА ПРЕДОПЛАТУ */}
    {invoiceModal&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.w,border:"2px solid #c4b5fd",borderRadius:14,padding:20,width:440,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:4,color:C.pu}}>💳 Счёт на предоплату</div>
        <div style={{fontSize:11,color:C.mu,marginBottom:14}}>Поставщик выставил счёт — бухгалтер увидит его в разделе Оплаты</div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПАКЕТ</div>
            <select value={invoiceF.package_id||""} onChange={e=>{const p=pkgObj(+e.target.value);setInvoiceF({...invoiceF,package_id:+e.target.value,supplier_id:p?.supplier_id||""});}} style={I()}>
              <option value="">— Выбрать —</option>
              {packages.filter((p:any)=>p.active&&p.prepayment).map((p:any)=>{const s=supObj(p.supplier_id);return<option key={p.id} value={p.id}>{s?.name} › {p.name}</option>;})}
            </select>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН (если один)</div>
            <select value={invoiceF.store_id||""} onChange={e=>setInvoiceF({...invoiceF,store_id:e.target.value?+e.target.value:""})} style={I()}>
              <option value="">— Все / не указан —</option>
              {stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НОМЕР СЧЁТА</div><input value={invoiceF.invoice_number||""} onChange={e=>setInvoiceF({...invoiceF,invoice_number:e.target.value})} placeholder="№ счёта" style={I()}/></div>
            <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА СЧЁТА</div><input type="date" value={invoiceF.invoice_date||today} onChange={e=>setInvoiceF({...invoiceF,invoice_date:e.target.value})} style={I()}/></div>
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СУММА (₸)</div><input type="number" value={invoiceF.amount||""} onChange={e=>setInvoiceF({...invoiceF,amount:e.target.value})} placeholder="0" style={I({fontSize:16,fontWeight:700})}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПРИМЕЧАНИЕ</div><input value={invoiceF.notes||""} onChange={e=>setInvoiceF({...invoiceF,notes:e.target.value})} style={I()}/></div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:14}}>
          <button onClick={()=>setInvoiceModal(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={saveInvoice} disabled={saving||!invoiceF.package_id||!invoiceF.amount} style={{flex:1,background:C.pu,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>📋 Выставить счёт</button>
        </div>
      </div>
    </div>}
  {/* МОДАЛ: УДАЛЕНИЕ СЧЁТА */}
    {delInvM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:320,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить счёт?</div>
        <div style={{fontSize:12,color:C.md,marginBottom:4}}>{pkgLabel(delInvM.package_id)}</div>
        <div style={{fontSize:13,fontWeight:700,color:C.pu,marginBottom:10}}>{fmt(delInvM.amount)} ₸ · №{delInvM.invoice_number||"—"}</div>
        <div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}>⚠️ Удаление возможно только до оплаты.</div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelInvM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteInvoice(delInvM)} disabled={delInvM.status==="paid"} style={{flex:1,background:delInvM.status==="paid"?C.mu:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:delInvM.status==="paid"?"default":"pointer",fontFamily:"inherit"}}>
            {delInvM.status==="paid"?"Уже оплачен":"Удалить"}
          </button>
        </div>
      </div>
    </div>}
  {/* МОДАЛ: УДАЛЕНИЕ ПОСТАВЩИКА */}
    {delSupM&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>{packages.some((p:any)=>p.supplier_id===delSupM.id)?"⚠️":"🗑️"}</div>
        <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить поставщика?</div>
        <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:10}}>«{delSupM.name}»</div>
        {packages.some((p:any)=>p.supplier_id===delSupM.id)&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}>
          ⚠️ У поставщика есть пакеты — он будет деактивирован, не удалён.
        </div>}
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setDelSupM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
          <button onClick={()=>deleteSup(delSupM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {packages.some((p:any)=>p.supplier_id===delSupM.id)?"Деактивировать":"Удалить"}
          </button>
        </div>
      </div>
    </div>}

    {/* МОДАЛ: УДАЛЕНИЕ ПАКЕТА */}
    {delPkgM&&(()=>{
      const sup=suppliers.find((s:any)=>s.id===delPkgM.supplier_id);
      const hasUsage=orders.some((o:any)=>o.package_id===delPkgM.id)||deliveries.some((d:any)=>d.package_id===delPkgM.id);
      return(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
        <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>{hasUsage?"⚠️":"🗑️"}</div>
          <div style={{fontWeight:800,fontSize:14,marginBottom:6}}>Удалить пакет?</div>
          <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:4}}>«{delPkgM.name}»</div>
          <div style={{fontSize:11,color:C.mu,marginBottom:10}}>{sup?.name}</div>
          {hasUsage&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}>
            ⚠️ Есть заказы или поставки — пакет будет деактивирован, не удалён. Расписание будет удалено.
          </div>}
          {!hasUsage&&<div style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.rd,marginBottom:14,textAlign:"left"}}>
            Также будет удалено всё расписание по этому пакету.
          </div>}
          <div style={{display:"flex",gap:7}}>
            <button onClick={()=>setDelPkgM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
            <button onClick={()=>deletePkg(delPkgM)} style={{flex:1,background:hasUsage?C.am:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {hasUsage?"Деактивировать":"Удалить"}
            </button>
          </div>
        </div>
      </div>);
    })()}

  </div>);
}
