import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import DebtModule from "./DebtModule";

// ═══ SUPABASE ═══
const SUPA_URL = "https://mhbeicelkyezgyvjnlkd.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYmVpY2Vsa3llemd5dmpubGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjI0MTMsImV4cCI6MjA4ODE5ODQxM30.bJAsRm4ZPRAB6mEqCskmE9sx_2J0K8TMNNIo8J2uow4";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ═══ РОЛИ ═══
// owner  — всё, все магазины
// manager — только свой магазин: ввод, выручка, отчёт по магазину
// admin  — только ввод смен своего магазина
const ROLE_LABELS = { owner:"👑 Владелец", manager:"🏪 Управляющий", admin:"📋 Администратор" };

function canDo(role, action) {
  if (role === "owner")   return true;
  if (role === "manager") return true;
  if (role === "admin")   return ["input","report_store","report_emp"].includes(action);
  return false;
}

// ═══ EXCEL EXPORT (SheetJS via CDN — грузится динамически) ═══
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Стиль ячейки
const XS = {
  header:  { font:{bold:true,color:{rgb:"FFFFFF"},sz:10}, fill:{fgColor:{rgb:"EA580C"}}, alignment:{horizontal:"center",vertical:"center"}, border:{bottom:{style:"medium",color:{rgb:"C2410C"}}} },
  subhead: { font:{bold:true,sz:10}, fill:{fgColor:{rgb:"FFF7ED"}}, alignment:{horizontal:"left"} },
  total:   { font:{bold:true,sz:10,color:{rgb:"16A34A"}}, fill:{fgColor:{rgb:"F0FDF4"}}, alignment:{horizontal:"right"} },
  totalLbl:{ font:{bold:true,sz:10}, fill:{fgColor:{rgb:"F0FDF4"}} },
  base:    { font:{color:{rgb:"2563EB"},bold:true,sz:10}, alignment:{horizontal:"right"} },
  varbl:   { font:{color:{rgb:"7C3AED"},bold:true,sz:10}, alignment:{horizontal:"right"} },
  bonus:   { font:{color:{rgb:"16A34A"},sz:10}, alignment:{horizontal:"right"} },
  итого:   { font:{bold:true,color:{rgb:"16A34A"},sz:11}, alignment:{horizontal:"right"} },
  num:     { alignment:{horizontal:"right"}, font:{sz:10} },
  str:     { alignment:{horizontal:"left"},  font:{sz:10} },
  date:    { alignment:{horizontal:"center"},font:{sz:10} },
};

function cell(v, s) { return { v, t: typeof v==='number'?'n':'s', s }; }
function numCell(v,s=XS.num){ return { v: Math.round(v||0), t:'n', s, z:'#,##0' }; }
function moneyCell(v,s=XS.num){ return { v: Math.round(v||0), t:'n', s, z:'#,##0 "₸"' }; }

function applySheet(ws, data) {
  let maxCols = 0;
  data.forEach((row, r) => {
    maxCols = Math.max(maxCols, row.length);
    row.forEach((c, col) => {
      if (c == null) return;
      const addr = window.XLSX.utils.encode_cell({r, c: col});
      ws[addr] = typeof c === 'object' && c.v !== undefined ? c : { v: c, t: typeof c==='number'?'n':'s', s: XS.str };
    });
  });
  return maxCols;
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function addMerge(ws, r1, c1, r2, c2) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s:{r:r1,c:c1}, e:{r:r2,c:c2} });
}

// ── Экспорт: Отчёт по магазину ──────────────────────────────────────────────
async function exportStorePDF(params) {
  const { store, repF, repT, shifts, positions, revenue, stores, emps } = params;
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const stObj = id => stores.find(s=>s.id===id);
  const pn = id => positions.find(p=>p.id===id)?.name||'';
  const fullName = e => e ? [e.last_name,e.first_name,e.middle_name].filter(Boolean).join(' ') : '';
  const en = id => { const e=emps.find(x=>x.id===id); return e?fullName(e):''; };
  const fmtD = d => { try{return new Date(d+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});}catch(e){return d;} };

  const rs = shifts.filter(r=>r.store_id===store&&r.date>=repF&&r.date<=repT)
                   .sort((a,b)=>a.date.localeCompare(b.date));

  // Считаем части
  function parts(rec) {
    const p=positions.find(x=>x.id===rec.pos_id); if(!p) return{base:0,variable:0,bonus:0,total:0};
    const dayRev=(revenue[rec.store_id]||{})[rec.date]||0;
    const h=rec.ovr_val!=null?rec.ovr_val:p.hourly, d=rec.ovr_val!=null?rec.ovr_val:p.daily, pct=rec.ovr_val!=null?rec.ovr_val:p.pct;
    let base=0,variable=0;
    if(p.pay_type==='hourly')base=h*(rec.hours||0);
    else if(p.pay_type==='daily')base=d;
    else if(p.pay_type==='revenue')variable=(dayRev*pct)/100;
    else if(p.pay_type==='hr'){base=h*(rec.hours||0);variable=(dayRev*pct)/100;}
    else if(p.pay_type==='dr'){base=d;variable=(dayRev*pct)/100;}
    return{base:Math.round(base),variable:Math.round(variable),bonus:rec.bonus||0,total:Math.round(base+variable+(rec.bonus||0))};
  }

  const tots = rs.reduce((a,r)=>{const p=parts(r);return{base:a.base+p.base,variable:a.variable+p.variable,bonus:a.bonus+p.bonus,total:a.total+p.total};},{base:0,variable:0,bonus:0,total:0});
  const totalRev = Object.entries(revenue[store]||{}).filter(([d])=>d>=repF&&d<=repT).reduce((s,[,v])=>s+v,0);
  const st = stObj(store);

  const ws = {};
  ws['!ref'] = 'A1:J200';

  const rows = [
    // Заголовок
    [cell(`ОТЧЁТ ПО МАГАЗИНУ: ${st?.name||''}`, XS.header), null,null,null,null,null,null,null,null,null],
    [cell(`Период: ${repF} — ${repT}`, XS.subhead), null,null,null,null,null,null,null,null,null],
    [cell(`Адрес: ${st?.address||''}`, XS.subhead), null,null,null,null,null,null,null,null,null],
    [],
    // Сводка
    [cell('СВОДКА', XS.header),null,null,null,null,null,null,null,null,null],
    [cell('Смен'), numCell(rs.length), cell('Сотрудников'), numCell(new Set(rs.map(r=>r.emp_id)).size),
     cell('Выручка'), moneyCell(totalRev), cell('ФОТ итого'), moneyCell(tots.total),null,null],
    [cell('Оклады (пост.)'), moneyCell(tots.base,XS.base), cell('% выручки (перем.)'), moneyCell(tots.variable,XS.varbl),
     cell('Бонусы'), moneyCell(tots.bonus,XS.bonus), null,null,null,null],
    [],
    // Заголовок таблицы
    [cell('Дата',XS.header), cell('Сотрудник',XS.header), cell('Должность',XS.header),
     cell('Часы',XS.header), cell('Выручка дня',XS.header),
     cell('Оклад',XS.header), cell('% Выр.',XS.header), cell('Бонус',XS.header),
     cell('Итого',XS.header), cell('Комм.',XS.header)],
  ];

  rs.forEach(r => {
    const p = parts(r);
    rows.push([
      cell(fmtD(r.date), XS.date),
      cell(en(r.emp_id), XS.str),
      cell(pn(r.pos_id), XS.str),
      numCell(r.hours),
      moneyCell((revenue[r.store_id]||{})[r.date]||0),
      moneyCell(p.base, XS.base),
      moneyCell(p.variable, XS.varbl),
      moneyCell(p.bonus, XS.bonus),
      moneyCell(p.total, XS.итого),
      cell(r.comment||'', XS.str),
    ]);
  });

  // Итого
  rows.push([
    cell('ИТОГО', XS.totalLbl),null,null,null,null,
    moneyCell(tots.base, {...XS.total,font:{...XS.base.font,bold:true}}),
    moneyCell(tots.variable, {...XS.total,font:{...XS.varbl.font,bold:true}}),
    moneyCell(tots.bonus, XS.total),
    moneyCell(tots.total, XS.total),
    null,
  ]);

  const maxCols = applySheet(ws, rows);
  setColWidths(ws, [12,22,14,7,14,14,14,12,14,20]);
  ws['!ref'] = `A1:J${rows.length}`;
  addMerge(ws,0,0,0,9);
  addMerge(ws,1,0,1,9);
  addMerge(ws,2,0,2,9);
  addMerge(ws,4,0,4,9);
  ws['!rows'] = [{hpt:22},{hpt:16},{hpt:16}];

  XLSX.utils.book_append_sheet(wb, ws, 'По магазину');
  XLSX.writeFile(wb, `Отчёт_${st?.name||'магазин'}_${repF}_${repT}.xlsx`);
}

// ── Экспорт: Отчёт по сотруднику ────────────────────────────────────────────
async function exportEmpReport(params) {
  const { emp, repMo, shifts, positions, revenue, stores, emps } = params;
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const sn = id => stores.find(s=>s.id===id)?.name||'';
  const pn = id => positions.find(p=>p.id===id)?.name||'';
  const fullName = e => e ? [e.last_name,e.first_name,e.middle_name].filter(Boolean).join(' ') : '';
  const fmtD = d => { try{return new Date(d+'T00:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});}catch(e){return d;} };

  const rs = shifts.filter(r=>r.emp_id===emp.id&&r.date.startsWith(repMo))
                   .sort((a,b)=>a.date.localeCompare(b.date));

  function parts(rec) {
    const p=positions.find(x=>x.id===rec.pos_id); if(!p) return{base:0,variable:0,bonus:0,total:0};
    const dayRev=(revenue[rec.store_id]||{})[rec.date]||0;
    const h=rec.ovr_val!=null?rec.ovr_val:p.hourly, d=rec.ovr_val!=null?rec.ovr_val:p.daily, pct=rec.ovr_val!=null?rec.ovr_val:p.pct;
    let base=0,variable=0;
    if(p.pay_type==='hourly')base=h*(rec.hours||0);
    else if(p.pay_type==='daily')base=d;
    else if(p.pay_type==='revenue')variable=(dayRev*pct)/100;
    else if(p.pay_type==='hr'){base=h*(rec.hours||0);variable=(dayRev*pct)/100;}
    else if(p.pay_type==='dr'){base=d;variable=(dayRev*pct)/100;}
    return{base:Math.round(base),variable:Math.round(variable),bonus:rec.bonus||0,total:Math.round(base+variable+(rec.bonus||0))};
  }

  const tots = rs.reduce((a,r)=>{const p=parts(r);return{base:a.base+p.base,variable:a.variable+p.variable,bonus:a.bonus+p.bonus,total:a.total+p.total};},{base:0,variable:0,bonus:0,total:0});
  const days = new Set(rs.map(r=>r.date)).size;

  const ws = {};
  const rows = [
    [cell(`ВЫПИСКА: ${fullName(emp)}`, XS.header),null,null,null,null,null,null,null,null],
    [cell(`Месяц: ${repMo}   |   Должность: ${pn(emp.pos_id)}   |   Магазин: ${sn(emp.default_store)}`, XS.subhead),null,null,null,null,null,null,null,null],
    [],
    [cell('Дней'),numCell(days), cell('Оклад (пост.)'),moneyCell(tots.base,XS.base),
     cell('% выручки (перем.)'),moneyCell(tots.variable,XS.varbl),
     cell('Бонусы'),moneyCell(tots.bonus,XS.bonus), moneyCell(tots.total,XS.итого)],
    [],
    [cell('Дата',XS.header),cell('Магазин',XS.header),cell('Должность',XS.header),
     cell('Часы',XS.header),cell('Выручка дня',XS.header),
     cell('Оклад',XS.header),cell('% Выр.',XS.header),cell('Бонус',XS.header),
     cell('Итого',XS.header)],
  ];

  rs.forEach(r => {
    const p = parts(r);
    rows.push([
      cell(fmtD(r.date),XS.date),
      cell(sn(r.store_id),XS.str),
      cell(pn(r.pos_id),XS.str),
      numCell(r.hours),
      moneyCell((revenue[r.store_id]||{})[r.date]||0),
      moneyCell(p.base,XS.base),
      moneyCell(p.variable,XS.varbl),
      moneyCell(p.bonus,XS.bonus),
      moneyCell(p.total,XS.итого),
    ]);
  });

  rows.push([
    cell('ИТОГО',XS.totalLbl),null,null,null,null,
    moneyCell(tots.base,{...XS.total,font:{...XS.base.font,bold:true}}),
    moneyCell(tots.variable,{...XS.total,font:{...XS.varbl.font,bold:true}}),
    moneyCell(tots.bonus,XS.total),
    moneyCell(tots.total,XS.total),
  ]);

  applySheet(ws, rows);
  setColWidths(ws,[12,18,14,7,14,14,14,12,14]);
  ws['!ref'] = `A1:I${rows.length}`;
  addMerge(ws,0,0,0,8);
  addMerge(ws,1,0,1,8);

  XLSX.utils.book_append_sheet(wb, ws, 'По сотруднику');
  XLSX.writeFile(wb, `Выписка_${fullName(emp)}_${repMo}.xlsx`);
}

// ── Экспорт: Зарплатная ведомость ───────────────────────────────────────────
async function exportPayroll(params) {
  const { repMo, shifts, positions, revenue, stores, emps } = params;
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const sn = id => stores.find(s=>s.id===id)?.name||'';
  const pn = id => positions.find(p=>p.id===id)?.name||'';
  const fullName = e => e ? [e.last_name,e.first_name,e.middle_name].filter(Boolean).join(' ') : '';

  function parts(rec) {
    const p=positions.find(x=>x.id===rec.pos_id); if(!p) return{base:0,variable:0,bonus:0,total:0};
    const dayRev=(revenue[rec.store_id]||{})[rec.date]||0;
    const h=rec.ovr_val!=null?rec.ovr_val:p.hourly, d=rec.ovr_val!=null?rec.ovr_val:p.daily, pct=rec.ovr_val!=null?rec.ovr_val:p.pct;
    let base=0,variable=0;
    if(p.pay_type==='hourly')base=h*(rec.hours||0);
    else if(p.pay_type==='daily')base=d;
    else if(p.pay_type==='revenue')variable=(dayRev*pct)/100;
    else if(p.pay_type==='hr'){base=h*(rec.hours||0);variable=(dayRev*pct)/100;}
    else if(p.pay_type==='dr'){base=d;variable=(dayRev*pct)/100;}
    return{base:Math.round(base),variable:Math.round(variable),bonus:rec.bonus||0,total:Math.round(base+variable+(rec.bonus||0))};
  }

  const activeEmps = emps.filter(e=>e.active);
  const empData = activeEmps.map(e => {
    const rs = shifts.filter(r=>r.emp_id===e.id&&r.date.startsWith(repMo));
    const tots = rs.reduce((a,r)=>{const p=parts(r);return{base:a.base+p.base,variable:a.variable+p.variable,bonus:a.bonus+p.bonus,total:a.total+p.total,shifts:a.shifts+1};},{base:0,variable:0,bonus:0,total:0,shifts:0});
    return{emp:e, days:new Set(rs.map(r=>r.date)).size, ...tots};
  });

  const grand = empData.reduce((a,d)=>({base:a.base+d.base,variable:a.variable+d.variable,bonus:a.bonus+d.bonus,total:a.total+d.total}),{base:0,variable:0,bonus:0,total:0});

  // Лист 1: Ведомость
  const ws1 = {};
  const rows1 = [
    [cell(`ЗАРПЛАТНАЯ ВЕДОМОСТЬ — ${repMo}`,XS.header),null,null,null,null,null,null,null],
    [cell(`Сотрудников: ${activeEmps.length}   |   Сформировано: ${new Date().toLocaleDateString('ru-RU')}`,XS.subhead),null,null,null,null,null,null,null],
    [],
    [cell('ИТОГО ФОТ',XS.subhead), moneyCell(grand.total,XS.итого),
     cell('Оклады:',XS.subhead), moneyCell(grand.base,XS.base),
     cell('% выручки:',XS.subhead), moneyCell(grand.variable,XS.varbl),
     cell('Бонусы:',XS.subhead), moneyCell(grand.bonus,XS.bonus)],
    [],
    [cell('№',XS.header),cell('ФИО',XS.header),cell('Должность',XS.header),
     cell('Магазин',XS.header),cell('Смен',XS.header),
     cell('Оклад',XS.header),cell('% Выр.',XS.header),cell('Бонус',XS.header),
     cell('К выплате',XS.header),cell('Подпись',XS.header)],
  ];

  empData.forEach((d,i) => {
    rows1.push([
      numCell(i+1),
      cell(fullName(d.emp),XS.str),
      cell(pn(d.emp.pos_id),XS.str),
      cell(sn(d.emp.default_store),XS.str),
      numCell(d.shifts),
      moneyCell(d.base,XS.base),
      moneyCell(d.variable,XS.varbl),
      moneyCell(d.bonus,XS.bonus),
      moneyCell(d.total,XS.итого),
      cell('',XS.str),
    ]);
  });

  rows1.push([
    cell('ИТОГО',XS.totalLbl),null,null,null,null,
    moneyCell(grand.base,{...XS.total,font:{...XS.base.font,bold:true}}),
    moneyCell(grand.variable,{...XS.total,font:{...XS.varbl.font,bold:true}}),
    moneyCell(grand.bonus,XS.total),
    moneyCell(grand.total,XS.total),
    null,
  ]);

  applySheet(ws1, rows1);
  setColWidths(ws1,[5,24,16,16,6,14,14,12,14,16]);
  ws1['!ref'] = `A1:J${rows1.length}`;
  addMerge(ws1,0,0,0,9);
  addMerge(ws1,1,0,1,9);
  ws1['!rows'] = [{hpt:24}];

  XLSX.utils.book_append_sheet(wb, ws1, 'Ведомость');

  // Лист 2: По магазинам
  const ws2 = {};
  const storeRows = [
    [cell(`РАЗБИВКА ПО МАГАЗИНАМ — ${repMo}`,XS.header),null,null,null,null],
    [],
    [cell('Магазин',XS.header),cell('Сотрудников',XS.header),cell('Оклады',XS.header),cell('% Выр.',XS.header),cell('Итого ФОТ',XS.header)],
  ];

  stores.forEach(s => {
    const sEmps = empData.filter(d=>d.emp.default_store===s.id);
    const stots = sEmps.reduce((a,d)=>({base:a.base+d.base,variable:a.variable+d.variable,total:a.total+d.total}),{base:0,variable:0,total:0});
    storeRows.push([
      cell(s.name,XS.str),
      numCell(sEmps.length),
      moneyCell(stots.base,XS.base),
      moneyCell(stots.variable,XS.varbl),
      moneyCell(stots.total,XS.итого),
    ]);
  });

  storeRows.push([
    cell('ИТОГО',XS.totalLbl),
    numCell(activeEmps.length),
    moneyCell(grand.base,{...XS.total,font:{...XS.base.font,bold:true}}),
    moneyCell(grand.variable,{...XS.total,font:{...XS.varbl.font,bold:true}}),
    moneyCell(grand.total,XS.total),
  ]);

  applySheet(ws2, storeRows);
  setColWidths(ws2,[20,14,16,16,16]);
  ws2['!ref'] = `A1:E${storeRows.length}`;
  addMerge(ws2,0,0,0,4);

  XLSX.utils.book_append_sheet(wb, ws2, 'По магазинам');
  XLSX.writeFile(wb, `Ведомость_${repMo}.xlsx`);
}


// ═══ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ═══
const PL = { hourly:"₸/час", daily:"₸/день", revenue:"% выручки", hr:"₸/ч+%", dr:"₸/д+%" };

function storeHours(st) {
  if (!st) return 8;
  try {
    const [oh,om] = st.open.split(":").map(Number);
    const [ch,cm] = st.close.split(":").map(Number);
    let h = (ch*60+cm) - (oh*60+om);
    if (h <= 0) h += 24*60;
    return Math.round(h/60);
  } catch(e) { return 8; }
}

function calcParts(rec, pos, revMap) {
  const p = pos.find(x => x.id === rec.pos_id);
  if (!p) return { base:0, variable:0, bonus:0, total:0 };
  const dayRev = (revMap[String(rec.store_id)] || {})[rec.date] || 0;
  const h = rec.ovr_val != null ? rec.ovr_val : p.hourly;
  const d = rec.ovr_val != null ? rec.ovr_val : p.daily;
  const pct = rec.ovr_val != null ? rec.ovr_val : p.pct;
  let base = 0, variable = 0;
  if (p.pay_type === "hourly")  base = h * (rec.hours||0);
  else if (p.pay_type === "daily")  base = d;
  else if (p.pay_type === "revenue") variable = (dayRev*pct)/100;
  else if (p.pay_type === "hr") { base = h*(rec.hours||0); variable = (dayRev*pct)/100; }
  else if (p.pay_type === "dr") { base = d; variable = (dayRev*pct)/100; }
  const bonus = rec.bonus || 0;
  return { base:Math.round(base), variable:Math.round(variable), bonus, total:Math.round(base+variable+bonus) };
}
function calcSal(rec, pos, revMap) { return calcParts(rec, pos, revMap).total; }

const C = {
  bg:"#f8fafc",w:"#fff",bdr:"#e2e8f0",lt:"#f1f5f9",tx:"#0f172a",md:"#475569",mu:"#94a3b8",
  or:"#ea580c",orBg:"#fff7ed",orBd:"#fed7aa",gn:"#16a34a",gnBg:"#f0fdf4",gnBd:"#bbf7d0",
  rd:"#dc2626",rdBg:"#fef2f2",rdBd:"#fecaca",bl:"#2563eb",blBg:"#eff6ff",blBd:"#bfdbfe",
  am:"#b45309",amBg:"#fffbeb",amBd:"#fde68a",pu:"#7c3aed",puBg:"#f5f3ff",puBd:"#ddd6fe"
};
const PC = [[C.bl,C.blBg,C.blBd],[C.gn,C.gnBg,C.gnBd],[C.pu,C.puBg,C.puBd],[C.or,C.orBg,C.orBd],[C.am,C.amBg,C.amBd],[C.rd,C.rdBg,C.rdBd]];
const pc = id => PC[(id-1)%PC.length];
const av = id => `hsl(${(id*47)%360},55%,45%)`;
const avB = id => `hsl(${(id*47)%360},55%,92%)`;
const fullName = e => e ? [e.last_name, e.first_name, e.middle_name].filter(Boolean).join(" ") : "";
const shortName = e => e ? [e.last_name, e.first_name?e.first_name[0]+".":"", e.middle_name?e.middle_name[0]+".":""].filter(Boolean).join(" ") : "";
const ini = e => e ? [(e.last_name||"")[0],(e.first_name||"")[0]].filter(Boolean).join("") : "";
const fmt = n => Math.round(n).toLocaleString();
const fmtD = d => { try { return new Date(d+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"}); } catch(e){ return d; } };
const I = (ex={}) => ({background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,borderRadius:6,padding:"6px 9px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",width:"100%",...ex});
const Bdg = ({c,bg,bd,ch}) => <span style={{background:bg,border:`1px solid ${bd}`,color:c,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{ch}</span>;
const TH = ({ch}) => <th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:C.mu,letterSpacing:"0.5px",textTransform:"uppercase",whiteSpace:"nowrap",background:C.lt,borderBottom:`1px solid ${C.bdr}`}}>{ch}</th>;
const TD = ({ch,s={}}) => <td style={{padding:"8px 10px",fontSize:12,borderBottom:"1px solid #f1f5f9",...s}}>{ch}</td>;

const TOP_TABS = [{k:"input",l:"🏪 Ввод"},{k:"sched",l:"📅 Расписание"},{k:"reports",l:"📊 Отчёты"},{k:"refs",l:"📚 Справочники"},{k:"debts",l:"💳 Задолженности"}];
const REP_TABS = [{k:"erep",l:"👤 По сотруднику"},{k:"srep",l:"🏪 По магазину"},{k:"pay",l:"💰 По зарплате"}];
const REF_TABS = [{k:"emp",l:"👥 Сотрудники"},{k:"stores",l:"🏬 Магазины"},{k:"pos",l:"📋 Должности"}];

export default function App() {
  // ── AUTH STATE ────────────────────────────────────────────────────────────
  const [session, setSession]     = useState(null);
  const [appUser, setAppUser]     = useState(null);  // {role, store_id, full_name, email}
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode]   = useState("login"); // login | register
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass]   = useState("");
  const [authName, setAuthName]   = useState("");
  const [authErr, setAuthErr]     = useState("");
  const [authBusy, setAuthBusy]   = useState(false);

  // Управление пользователями (только owner)
  const [usersTab, setUsersTab]   = useState(false);
  const [cleanupTab, setCleanupTab] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(null); // {type, label, warning}
  const [cleanupInput, setCleanupInput] = useState("");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [appUsers, setAppUsers]   = useState([]);
  const [editUser, setEditUser]   = useState(null);

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("input");
  const [repTab, setRepTab] = useState("erep");
  const [refTab, setRefTab] = useState("emp");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [stores, setStores] = useState([]);
  const [positions, setPositions] = useState([]);
  const [emps, setEmps] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [revenue, setRevenue] = useState({}); // {storeId: {date: amount}}
  const [schedule, setSchedule] = useState({}); // {storeId: {month: [{pos_id,count}]}}

  // Ввод
  const [store, setStore] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [addM, setAddM] = useState(false);
  const [nr, setNr] = useState({emp_id:"",pos_id:"",hours:14,ovr_val:"",bonus:0,comment:"",showOvr:false,showHours:false});
  const [editId, setEditId] = useState(null);
  const [er, setEr] = useState(null);
  const [showAllEmps, setShowAllEmps] = useState(false);
  const [revEditing, setRevEditing] = useState(false);
  const [revInput, setRevInput] = useState("");

  // Отчёты
  const [repE, setRepE] = useState(null);
  const [repMo, setRepMo] = useState(new Date().toISOString().slice(0,7));
  const [repS, setRepS] = useState(null);
  const [repF, setRepF] = useState(new Date().toISOString().slice(0,7)+"-01");
  const [repT, setRepT] = useState(new Date().toISOString().slice(0,10));

  // Расписание
  const [schedStore, setSchedStore] = useState(null);
  const [schedMo, setSchedMo] = useState(new Date().toISOString().slice(0,7));
  const [schedCopyFrom, setSchedCopyFrom] = useState("");

  // Должности
  const [posM, setPosM] = useState(false);
  const [editP, setEditP] = useState(null);
  const [np, setNp] = useState({name:"",pay_type:"daily",hourly:0,daily:0,pct:0});
  const [delPosM, setDelPosM] = useState(null);

  // Сотрудники
  const [empM, setEmpM] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [ne, setNe] = useState({last_name:"",first_name:"",middle_name:"",pos_id:"",default_store:""});
  const [fireM, setFireM] = useState(null);

  // Магазины
  const [storeM, setStoreM] = useState(false);
  const [editSt, setEditSt] = useState(null);
  const [ns, setNs] = useState({name:"",address:"",open:"08:00",close:"22:00"});
  const [delStM, setDelStM] = useState(null);

  // ── ЗАДОЛЖЕННОСТИ ──
  const [debts, setDebts] = useState([]);
  const [debtMoves, setDebtMoves] = useState([]);

  // ── ЗАГРУЗКА ДАННЫХ ───────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stRes, posRes, empRes, shRes, revRes, schedRes, debtRes, dmRes] = await Promise.all([
        sb.from("stores").select("*").order("id"),
        sb.from("positions").select("*").order("id"),
        sb.from("employees").select("*").order("id"),
        sb.from("shifts").select("*").order("date", {ascending:false}),
        sb.from("revenue").select("*"),
        sb.from("schedule").select("*"),
        sb.from("debts").select("*").order("id"),
        sb.from("debt_moves").select("*").order("date", {ascending:false}),
      ]);
      const sts = stRes.data || [];
      const poss = posRes.data || [];
      const empsData = empRes.data || [];
      const shData = shRes.data || [];
      const revData = revRes.data || [];
      const schedData = schedRes.data || [];

      setStores(sts);
      setPositions(poss);
      setEmps(empsData);
      setShifts(shData);
      if (sts.length > 0) { setStore(s => s || sts[0].id); setSchedStore(s => s || sts[0].id); setRepS(s => s || sts[0].id); }

      // Выручка → {storeId: {date: amount}}
      const revMap = {};
      revData.forEach(r => {
        if (!revMap[r.store_id]) revMap[r.store_id] = {};
        revMap[r.store_id][r.date] = r.amount;
      });
      setRevenue(revMap);

      // Расписание → {storeId: {month: [{pos_id,count}]}}
      const schedMap = {};
      schedData.forEach(s => {
        if (!schedMap[s.store_id]) schedMap[s.store_id] = {};
        if (!schedMap[s.store_id][s.month]) schedMap[s.store_id][s.month] = [];
        schedMap[s.store_id][s.month].push({pos_id:s.pos_id, count:s.count});
      });
      setSchedule(schedMap);
      setDebts(debtRes.data || []);
      setDebtMoves(dmRes.data || []);
    } catch(e) {
      setError("Ошибка загрузки: " + e.message);
    }
    setLoading(false);
  }, []);

  // ── AUTH EFFECTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadAppUser(session.user.id);
      else setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadAppUser(session.user.id);
      else { setAppUser(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadAppUser(uid) {
    let data = null;
    // Пробуем до 8 раз с паузой — триггер создания записи может запаздывать
    for (let i = 0; i < 8; i++) {
      const res = await sb.from("app_users").select("*").eq("id", uid).maybeSingle();
      if (res.data) { data = res.data; break; }
      await new Promise(r => setTimeout(r, 800));
    }
    // Если запись не найдена — создаём вручную как owner (первый пользователь)
    if (!data) {
      const { data: existing } = await sb.from("app_users").select("id").limit(1);
      const role = (!existing || existing.length === 0) ? "owner" : "admin";
      const { data: sess } = await sb.auth.getUser();
      const email = sess?.user?.email || "";
      const full_name = sess?.user?.user_metadata?.full_name || email;
      const ins = await sb.from("app_users").insert({ id: uid, email, full_name, role }).select().single();
      data = ins.data;
    }
    setAppUser(data);
    setAuthLoading(false);
  }

  async function refreshRole() {
    const { data: { user } } = await sb.auth.getUser();
    if (user) await loadAppUser(user.id);
  }

  async function loadAppUsers() {
    const { data } = await sb.from("app_users").select("*").order("created_at");
    setAppUsers(data || []);
  }

  async function signIn() {
    setAuthBusy(true); setAuthErr("");
    const { error } = await sb.auth.signInWithPassword({ email: authEmail, password: authPass });
    if (error) setAuthErr(error.message);
    setAuthBusy(false);
  }

  async function signUp() {
    setAuthBusy(true); setAuthErr("");
    const { error } = await sb.auth.signUp({
      email: authEmail, password: authPass,
      options: { data: { full_name: authName } }
    });
    if (error) setAuthErr(error.message);
    else setAuthErr("✅ Письмо отправлено — подтвердите email");
    setAuthBusy(false);
  }

  async function signInGoogle() {
    await sb.auth.signInWithOAuth({ provider: "google",
      options: { redirectTo: window.location.origin } });
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  // ── ОЧИСТКА ДАННЫХ ────────────────────────────────────────────────────────
  const CLEANUP_ITEMS = [
    {
      group: "Рабочие данные",
      items: [
        { type:"shifts_day",    icon:"📋", label:"Смены за текущий день",     warning:"Удалит все смены за сегодня по всем магазинам.", color:"or" },
        { type:"shifts_month",  icon:"📅", label:"Смены за текущий месяц",    warning:"Удалит все смены за текущий месяц по всем магазинам.", color:"or" },
        { type:"shifts_all",    icon:"🗂",  label:"Все смены (вся история)",   warning:"Удалит ВСЮ историю смен. Восстановление невозможно!", color:"rd" },
        { type:"revenue_month", icon:"💰", label:"Выручка за текущий месяц",  warning:"Удалит все данные по выручке за текущий месяц.", color:"or" },
        { type:"revenue_all",   icon:"📈", label:"Вся выручка (вся история)", warning:"Удалит ВСЕ данные по выручке. Восстановление невозможно!", color:"rd" },
      ]
    },
    {
      group: "Справочники",
      items: [
        { type:"schedule_month",icon:"📆", label:"Расписание за текущий месяц", warning:"Удалит штатное расписание за текущий месяц.", color:"am" },
        { type:"schedule_all",  icon:"📆", label:"Всё расписание",               warning:"Удалит всё штатное расписание по всем магазинам.", color:"rd" },
        { type:"employees",     icon:"👥", label:"Все сотрудники",               warning:"Удалит ВСЕХ сотрудников. Сначала нужно очистить смены!", color:"rd" },
        { type:"positions",     icon:"📋", label:"Все должности",                warning:"Удалит ВСЕ должности. Сначала нужно очистить сотрудников и смены!", color:"rd" },
        { type:"stores",        icon:"🏪", label:"Все магазины",                 warning:"Удалит ВСЕ магазины. Сначала нужно очистить все остальные данные!", color:"rd" },
      ]
    },
    {
      group: "Полная очистка",
      items: [
        { type:"all",           icon:"💣", label:"Очистить ВСЁ",               warning:"Удалит абсолютно все данные: смены, выручку, расписание, сотрудников, должности и магазины. Восстановление НЕВОЗМОЖНО!", color:"rd" },
      ]
    }
  ];

  async function runCleanup(type) {
    setCleanupBusy(true);
    setCleanupResult(null);
    const today = new Date().toISOString().slice(0,10);
    const month = today.slice(0,7);
    try {
      let msg = "";
      if (type === "shifts_day") {
        const {count} = await sb.from("shifts").delete({count:"exact"}).eq("date", today);
        setShifts(shifts.filter(s => s.date !== today));
        msg = `Удалено смен за ${today}: ${count||0}`;
      } else if (type === "shifts_month") {
        const {count} = await sb.from("shifts").delete({count:"exact"}).like("date", `${month}%`);
        setShifts(shifts.filter(s => !s.date.startsWith(month)));
        msg = `Удалено смен за ${month}: ${count||0}`;
      } else if (type === "shifts_all") {
        const {count} = await sb.from("shifts").delete({count:"exact"}).gte("id", 0);
        setShifts([]);
        msg = `Удалена вся история смен: ${count||0} записей`;
      } else if (type === "revenue_month") {
        const {count} = await sb.from("revenue").delete({count:"exact"}).like("date", `${month}%`);
        setRevenue(prev => {
          const next = {...prev};
          Object.keys(next).forEach(sid => {
            const filtered = {};
            Object.entries(next[sid]||{}).forEach(([d,v]) => { if (!d.startsWith(month)) filtered[d]=v; });
            next[sid] = filtered;
          });
          return next;
        });
        msg = `Удалена выручка за ${month}: ${count||0} записей`;
      } else if (type === "revenue_all") {
        const {count} = await sb.from("revenue").delete({count:"exact"}).gte("id", 0);
        setRevenue({});
        msg = `Удалена вся выручка: ${count||0} записей`;
      } else if (type === "schedule_month") {
        const {count} = await sb.from("schedule").delete({count:"exact"}).eq("month", month);
        setSchedule(prev => {
          const next = {...prev};
          Object.keys(next).forEach(sid => { const s={...next[sid]}; delete s[month]; next[sid]=s; });
          return next;
        });
        msg = `Удалено расписание за ${month}`;
      } else if (type === "schedule_all") {
        const {count} = await sb.from("schedule").delete({count:"exact"}).gte("id", 0);
        setSchedule({});
        msg = `Удалено всё расписание: ${count||0} записей`;
      } else if (type === "employees") {
        const {count} = await sb.from("employees").delete({count:"exact"}).gte("id", 0);
        setEmps([]);
        msg = `Удалены все сотрудники: ${count||0}`;
      } else if (type === "positions") {
        const {count} = await sb.from("positions").delete({count:"exact"}).gte("id", 0);
        setPositions([]);
        msg = `Удалены все должности: ${count||0}`;
      } else if (type === "stores") {
        const {count} = await sb.from("stores").delete({count:"exact"}).gte("id", 0);
        setStores([]);
        msg = `Удалены все магазины: ${count||0}`;
      } else if (type === "all") {
        await sb.from("shifts").delete().gte("id", 0);
        await sb.from("revenue").delete().gte("id", 0);
        await sb.from("schedule").delete().gte("id", 0);
        await sb.from("employees").delete().gte("id", 0);
        await sb.from("positions").delete().gte("id", 0);
        await sb.from("stores").delete().gte("id", 0);
        setShifts([]); setRevenue({}); setSchedule({}); setEmps([]); setPositions([]); setStores([]);
        msg = "База полностью очищена";
      }
      setCleanupResult({ok:true, msg});
    } catch(e) {
      setCleanupResult({ok:false, msg:"Ошибка: " + e.message});
    }
    setCleanupBusy(false);
    setCleanupConfirm(null);
    setCleanupInput("");
  }

  async function saveUserRole(userId, role, storeId) {
    await sb.from("app_users").update({
      role, store_id: role === "owner" ? null : (storeId || null)
    }).eq("id", userId);
    loadAppUsers();
    setEditUser(null);
  }

  // ── DATA LOAD (only after auth) ────────────────────────────────────────────
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { document.title = "100 Food OF · HR"; }, []);

  // ── ХЕЛПЕРЫ ───────────────────────────────────────────────────────────────
  const activeE = emps.filter(e => e.active);
  const firedE = emps.filter(e => !e.active);
  const stObj = id => stores.find(s => s.id === id);
  const sn = id => stObj(id)?.name || "";
  const pn = id => positions.find(p => p.id === id)?.name || "";
  const en = id => { const e = emps.find(x => x.id === id); return e ? shortName(e) : ""; };
  const getDayRev = (sid, dt) => (revenue[sid] || {})[dt] || 0;
  const autoHours = sid => storeHours(stObj(sid));
  const getSchedItems = (sid, mo) => (schedule[sid] || {})[mo] || [];
  const getAvailPos = (sid, mo) => {
    const items = getSchedItems(sid, mo);
    if (items.length === 0) return positions;
    return positions.filter(p => items.some(x => x.pos_id === p.id));
  };

  const dayShifts = useMemo(() =>
    shifts.filter(r => r.store_id === store && r.date === date),
    [shifts, store, date]
  );

  // ── СМЕНЫ ────────────────────────────────────────────────────────────────
  function openAdd() {
    const mo = date.slice(0,7);
    const storeEmps = activeE.filter(e => e.default_store === store);
    const firstEmp = storeEmps[0] || activeE[0];
    const empId = firstEmp?.id || "";
    const avPos = getAvailPos(store, mo);
    const empPosId = firstEmp?.pos_id;
    const posId = avPos.find(p => p.id === empPosId) ? empPosId : (avPos[0]?.id || "");
    setShowAllEmps(false);
    setNr({emp_id:empId, pos_id:posId, hours:autoHours(store), ovr_val:"", bonus:0, comment:"", showOvr:false, showHours:false});
    setAddM(true);
  }

  function changeNrEmp(empId) {
    const emp = emps.find(e => e.id === +empId);
    if (!emp) { setNr({...nr, emp_id:empId}); return; }
    const mo = date.slice(0,7);
    const avPos = getAvailPos(store, mo);
    const posId = avPos.find(p => p.id === emp.pos_id) ? emp.pos_id : (avPos[0]?.id || "");
    setNr({...nr, emp_id:empId, pos_id:posId});
  }

  async function addShift() {
    if (!nr.emp_id || !nr.pos_id) return;
    setSaving(true);
    const { data, error } = await sb.from("shifts").insert({
      date, store_id:store, emp_id:+nr.emp_id, pos_id:+nr.pos_id,
      hours:+nr.hours||0, ovr_val:nr.ovr_val!==""?+nr.ovr_val:null,
      bonus:+nr.bonus||0, comment:nr.comment||""
    }).select().single();
    if (!error && data) setShifts([data, ...shifts]);
    setSaving(false);
    setAddM(false);
  }

  async function saveEditShift() {
    if (!er) return;
    setSaving(true);
    const { data, error } = await sb.from("shifts").update({
      emp_id:+er.emp_id, pos_id:+er.pos_id, hours:+er.hours||0,
      ovr_val:er.ovr_val!==""?+er.ovr_val:null, bonus:+er.bonus||0, comment:er.comment||""
    }).eq("id", editId).select().single();
    if (!error && data) setShifts(shifts.map(s => s.id===editId ? data : s));
    setSaving(false);
    setEditId(null); setEr(null);
  }

  async function deleteShift(id) {
    await sb.from("shifts").delete().eq("id", id);
    setShifts(shifts.filter(s => s.id !== id));
  }

  function openEdit(rec) {
    setEditId(rec.id);
    setEr({emp_id:rec.emp_id, pos_id:rec.pos_id, hours:rec.hours,
           ovr_val:rec.ovr_val!=null?rec.ovr_val:"", bonus:rec.bonus||0, comment:rec.comment||"", showOvr:rec.ovr_val!=null, showHours:false});
  }

  const prevSal = () => calcSal({...nr, emp_id:+nr.emp_id, pos_id:+nr.pos_id, hours:+nr.hours, ovr_val:nr.ovr_val!==""?+nr.ovr_val:null, bonus:+nr.bonus, store_id:store, date}, positions, revenue);

  // ── ВЫРУЧКА ───────────────────────────────────────────────────────────────
  async function saveRev() {
    if (!revInput) return;
    setSaving(true);
    const existing = (revenue[store]||{})[date];
    if (existing !== undefined) {
      await sb.from("revenue").update({amount:+revInput}).eq("store_id",store).eq("date",date);
    } else {
      await sb.from("revenue").insert({store_id:store, date, amount:+revInput});
    }
    setRevenue(prev => ({...prev, [store]:{...(prev[store]||{}), [date]:+revInput}}));
    setSaving(false);
    setRevEditing(false); setRevInput("");
  }

  // ── РАСПИСАНИЕ ────────────────────────────────────────────────────────────
  async function setSchedCount(sid, mo, posId, count) {
    const items = getSchedItems(sid, mo);
    const existing = items.find(x => x.pos_id === posId);
    if (count <= 0) {
      if (existing) await sb.from("schedule").delete().eq("store_id",sid).eq("month",mo).eq("pos_id",posId);
    } else {
      if (existing) await sb.from("schedule").update({count}).eq("store_id",sid).eq("month",mo).eq("pos_id",posId);
      else await sb.from("schedule").insert({store_id:sid, month:mo, pos_id:posId, count});
    }
    setSchedule(prev => {
      const key = sid;
      const cur = (prev[key]||{})[mo] || [];
      let next;
      if (count <= 0) next = cur.filter(x => x.pos_id !== posId);
      else { const ex = cur.find(x => x.pos_id===posId); if(ex) next=cur.map(x=>x.pos_id===posId?{...x,count}:x); else next=[...cur,{pos_id:posId,count}]; }
      return {...prev, [key]:{...(prev[key]||{}), [mo]:next}};
    });
  }

  async function copySchedule() {
    if (!schedCopyFrom) return;
    const src = (schedule[schedStore]||{})[schedCopyFrom];
    if (!src || src.length===0) return;
    await sb.from("schedule").delete().eq("store_id",schedStore).eq("month",schedMo);
    const rows = src.map(x => ({store_id:schedStore, month:schedMo, pos_id:x.pos_id, count:x.count}));
    await sb.from("schedule").insert(rows);
    setSchedule(prev => ({...prev, [schedStore]:{...(prev[schedStore]||{}), [schedMo]:src.map(x=>({...x}))}}));
    setSchedCopyFrom("");
  }

  // ── ДОЛЖНОСТИ ─────────────────────────────────────────────────────────────
  async function savePos() {
    if (!np.name.trim()) return;
    setSaving(true);
    if (editP) {
      const {data} = await sb.from("positions").update({name:np.name,pay_type:np.pay_type,hourly:+np.hourly,daily:+np.daily,pct:+np.pct}).eq("id",editP.id).select().single();
      if (data) setPositions(positions.map(p => p.id===editP.id ? data : p));
    } else {
      const {data} = await sb.from("positions").insert({name:np.name,pay_type:np.pay_type,hourly:+np.hourly,daily:+np.daily,pct:+np.pct}).select().single();
      if (data) setPositions([...positions, data]);
    }
    setSaving(false); setPosM(false); setEditP(null);
  }

  async function confirmDeletePos() {
    if (!delPosM) return;
    await sb.from("schedule").delete().eq("pos_id",delPosM.pos.id);
    await sb.from("positions").delete().eq("id",delPosM.pos.id);
    setPositions(positions.filter(p => p.id!==delPosM.pos.id));
    setDelPosM(null);
  }

  // ── СОТРУДНИКИ ────────────────────────────────────────────────────────────
  function openEmpForm(e) {
    if (e) { setEditEmp(e); setNe({last_name:e.last_name,first_name:e.first_name,middle_name:e.middle_name||"",pos_id:e.pos_id,default_store:e.default_store}); }
    else { setEditEmp(null); setNe({last_name:"",first_name:"",middle_name:"",pos_id:positions[0]?.id||"",default_store:stores[0]?.id||""}); }
    setEmpM(true);
  }

  async function saveEmp() {
    if (!ne.last_name.trim()) return;
    setSaving(true);
    const payload = {last_name:ne.last_name, first_name:ne.first_name, middle_name:ne.middle_name, pos_id:+ne.pos_id, default_store:+ne.default_store};
    if (editEmp) {
      const {data} = await sb.from("employees").update(payload).eq("id",editEmp.id).select().single();
      if (data) setEmps(emps.map(e => e.id===editEmp.id ? data : e));
    } else {
      const {data} = await sb.from("employees").insert({...payload,active:true}).select().single();
      if (data) setEmps([...emps, data]);
    }
    setSaving(false); setEmpM(false); setEditEmp(null);
  }

  async function fireEmployee(emp) {
    const {data} = await sb.from("employees").update({active:false, fired_at:new Date().toISOString().slice(0,10)}).eq("id",emp.id).select().single();
    if (data) setEmps(emps.map(e => e.id===emp.id ? data : e));
    setFireM(null);
  }

  async function restoreEmployee(emp) {
    const {data} = await sb.from("employees").update({active:true, fired_at:null}).eq("id",emp.id).select().single();
    if (data) setEmps(emps.map(e => e.id===emp.id ? data : e));
  }

  // ── МАГАЗИНЫ ──────────────────────────────────────────────────────────────
  async function saveSt() {
    if (!ns.name.trim()) return;
    setSaving(true);
    if (editSt) {
      const {data} = await sb.from("stores").update({name:ns.name,address:ns.address,open:ns.open,close:ns.close}).eq("id",editSt.id).select().single();
      if (data) setStores(stores.map(s => s.id===editSt.id ? data : s));
    } else {
      const {data} = await sb.from("stores").insert({name:ns.name,address:ns.address,open:ns.open,close:ns.close}).select().single();
      if (data) setStores([...stores, data]);
    }
    setSaving(false); setStoreM(false); setEditSt(null);
  }

  async function confirmDeleteStore() {
    if (!delStM) return;
    await sb.from("stores").delete().eq("id",delStM.store.id);
    setStores(stores.filter(s => s.id!==delStM.store.id));
    setDelStM(null);
  }

  // ── СТИЛИ ─────────────────────────────────────────────────────────────────
  const subTabBtn = (active) => ({
    background:active?C.w:"none", border:`1px solid ${active?C.bdr:"transparent"}`,
    borderRadius:7, cursor:"pointer", padding:"6px 14px", fontSize:11, fontWeight:600,
    fontFamily:"inherit", color:active?C.or:C.mu, boxShadow:active?"0 1px 3px rgba(0,0,0,.07)":"none",
  });

  // ── ЭКРАН ЗАГРУЗКИ ────────────────────────────────────────────────────────
  const Spinner = ({text=""}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,flexDirection:"column",gap:12}}>
      <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${C.bdr}`,borderTopColor:C.or,animation:"spin 0.8s linear infinite"}}></div>
      <div style={{fontSize:13,color:C.mu,fontFamily:"system-ui"}}>{text||"Загрузка..."}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── ЭКРАН АВТОРИЗАЦИИ ─────────────────────────────────────────────────────
  if (authLoading) return <Spinner text="Проверка сессии..."/>;

  if (!session) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"linear-gradient(135deg,#fff7ed,#fef3c7)",fontFamily:"system-ui"}}>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:"32px 28px",width:360,maxWidth:"95vw",boxShadow:"0 20px 60px rgba(0,0,0,.12)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontWeight:800,fontSize:18,color:C.tx}}>100 Food OF · HR</div>
          <div style={{fontSize:12,color:C.mu,marginTop:2}}>Платформа управления персоналом</div>
        </div>

        <div style={{display:"flex",background:C.lt,borderRadius:8,padding:3,marginBottom:20,gap:2}}>
          {[["login","Войти"],["register","Регистрация"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setAuthMode(m);setAuthErr("");}} style={{flex:1,background:authMode===m?C.w:"none",border:`1px solid ${authMode===m?C.bdr:"transparent"}`,borderRadius:6,padding:"6px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:authMode===m?C.or:C.mu}}>{l}</button>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {authMode==="register"&&(
            <div>
              <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ИМЯ</div>
              <input type="text" value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Ваше имя" style={I()}/>
            </div>
          )}
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>EMAIL</div>
            <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="email@example.com" style={I()} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?signIn():signUp())}/>
          </div>
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПАРОЛЬ</div>
            <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="••••••••" style={I()} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?signIn():signUp())}/>
          </div>

          {authErr&&<div style={{padding:"8px 10px",borderRadius:7,fontSize:11,background:authErr.startsWith("✅")?C.gnBg:C.rdBg,border:`1px solid ${authErr.startsWith("✅")?C.gnBd:C.rdBd}`,color:authErr.startsWith("✅")?C.gn:C.rd}}>{authErr}</div>}

          <button onClick={authMode==="login"?signIn:signUp} disabled={authBusy||!authEmail||!authPass} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"10px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(authBusy||!authEmail||!authPass)?0.6:1,marginTop:4}}>
            {authBusy?"...":(authMode==="login"?"Войти":"Зарегистрироваться")}
          </button>

          <div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0"}}>
            <div style={{flex:1,height:1,background:C.bdr}}/>
            <span style={{fontSize:10,color:C.mu}}>или</span>
            <div style={{flex:1,height:1,background:C.bdr}}/>
          </div>

          <button onClick={signInGoogle} style={{background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,padding:"9px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Войти через Google
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) return <Spinner text="Загрузка данных..."/>;

  if (error) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,flexDirection:"column",gap:12,fontFamily:"system-ui"}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontSize:14,color:C.rd,fontWeight:700}}>Ошибка подключения</div>
      <div style={{fontSize:12,color:C.mu,maxWidth:400,textAlign:"center"}}>{error}</div>
      <button onClick={loadAll} style={{background:C.or,border:"none",color:"#fff",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Попробовать снова</button>
    </div>
  );

  const role = appUser?.role || "admin";
  const myStoreId = appUser?.store_id || null;

  // ── РЕНДЕР ВКЛАДОК ────────────────────────────────────────────────────────
  function renderInput() {
    if (!store) return <div style={{padding:40,textAlign:"center",color:C.mu}}>Нет магазинов. Добавьте в Справочниках.</div>;
    const dayRev = getDayRev(store, date);
    const st = stObj(store);
    return (
    <div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div>
          <select value={store||""} onChange={e=>setStore(+e.target.value)} style={I({width:170,fontWeight:600})}>
            {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ДАТА</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={I({width:150})}/>
        </div>
        <div style={{marginLeft:"auto"}}>
          <button onClick={openAdd} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            + Добавить сотрудника
          </button>
        </div>
      </div>

      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:700,color:C.md}}>🏪 {sn(store)}</span>
        <span style={{fontSize:11,color:C.mu}}>{st?.address}</span>
        <span style={{fontSize:11,color:C.mu}}>🕐 {st?.open}–{st?.close} ({autoHours(store)}ч)</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:C.mu}}>Выручка {fmtD(date)}:</span>
          {dayRev
            ?<span style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 10px",borderRadius:6,fontWeight:700,fontSize:12}}>{fmt(dayRev)} ₸</span>
            :<span style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 10px",borderRadius:6,fontSize:11}}>не введена</span>
          }
          {revEditing
            ?<div style={{display:"flex",gap:5,alignItems:"center"}}>
                <input type="number" value={revInput} onChange={e=>setRevInput(e.target.value)} placeholder="сумма ₸" style={I({width:130})} autoFocus/>
                <button onClick={saveRev} disabled={saving} style={{background:C.gn,border:"none",color:"#fff",padding:"5px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✓</button>
                <button onClick={()=>setRevEditing(false)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,padding:"5px 8px",borderRadius:6,fontSize:11,cursor:"pointer"}}>✕</button>
              </div>
            :<button onClick={()=>{setRevInput(String(dayRev||""));setRevEditing(true);}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                {dayRev?"✎ Изменить":"+ Ввести"}
              </button>
          }
        </div>
      </div>

      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        {dayShifts.length>0&&<div style={{display:"flex",gap:8,padding:"7px 12px",borderBottom:`1px solid ${C.lt}`,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:C.bl,display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:2,background:C.bl,display:"inline-block"}}></span>Оклад</span>
          <span style={{fontSize:10,color:C.pu,display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:2,background:C.pu,display:"inline-block"}}></span>% выручки</span>
          <span style={{fontSize:10,color:C.gn,display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:2,background:C.gn,display:"inline-block"}}></span>Бонус</span>
        </div>}
        {dayShifts.length===0
          ?<div style={{padding:"44px",textAlign:"center",color:C.mu}}><div style={{fontSize:28,marginBottom:8}}>📋</div><div style={{fontSize:13,fontWeight:600}}>Нет записей</div></div>
          :<table style={{width:"100%",borderCollapse:"collapse",minWidth:750}}>
            <thead><tr><TH ch="Сотрудник"/><TH ch="Должность"/><TH ch="Доп?"/><TH ch="Часы"/><TH ch="Выручка"/><TH ch="Оклад"/><TH ch="% Выр."/><TH ch="Бонус"/><TH ch="Итого"/><TH ch="Комм."/><TH ch=""/></tr></thead>
            <tbody>
              {dayShifts.map((rec,i) => {
                const emp = emps.find(e=>e.id===rec.emp_id);
                const pt = calcParts(rec, positions, revenue);
                const isDop = emp && emp.default_store !== rec.store_id;
                const isEd = editId===rec.id;
                const pos = positions.find(p=>p.id===rec.pos_id);
                const isRevB = pos&&(pos.pay_type==="revenue"||pos.pay_type==="hr"||pos.pay_type==="dr");
                if (isEd&&er) return (
                  <tr key={rec.id} style={{background:"#fffbf5"}}>
                    <TD ch={<select value={er.emp_id} onChange={e=>setEr({...er,emp_id:+e.target.value})} style={I({width:130})}>{emps.map(e=><option key={e.id} value={e.id}>{shortName(e)}</option>)}</select>}/>
                    <TD ch={<select value={er.pos_id} onChange={e=>setEr({...er,pos_id:+e.target.value})} style={I({width:130})}>{positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}/>
                    <TD ch="—" s={{color:C.mu}}/>
                    <TD ch={<div style={{display:"flex",alignItems:"center",gap:4}}>{er.showHours?<input type="number" value={er.hours} onChange={e=>setEr({...er,hours:e.target.value})} style={I({width:55})}/>:<span>{er.hours}ч</span>}<button onClick={()=>setEr({...er,showHours:!er.showHours})} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:C.mu}}>{er.showHours?"✓":"✎"}</button></div>}/>
                    <TD ch={<span style={{color:C.mu,fontSize:10}}>{fmt(getDayRev(rec.store_id,rec.date))} ₸</span>}/>
                    <TD ch={<div style={{display:"flex",alignItems:"center",gap:4}}>{er.showOvr?<input type="number" step="0.1" value={er.ovr_val} onChange={e=>setEr({...er,ovr_val:e.target.value})} style={I({width:80})}/>:<span style={{fontSize:11,color:C.md}}>{er.ovr_val?`${er.ovr_val}${isRevB?"%":"₸"}`:"авто"}</span>}<button onClick={()=>setEr({...er,showOvr:!er.showOvr})} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:C.mu}}>{er.showOvr?"✓":"✎"}</button></div>}/>
                    <TD ch="—" s={{color:C.mu}}/>
                    <TD ch={<input type="number" value={er.bonus} onChange={e=>setEr({...er,bonus:e.target.value})} style={I({width:75})}/>}/>
                    <TD ch="—" s={{color:C.mu}}/>
                    <TD ch={<input type="text" value={er.comment} onChange={e=>setEr({...er,comment:e.target.value})} style={I({width:85})}/>}/>
                    <TD ch={<div style={{display:"flex",gap:3}}><button onClick={saveEditShift} disabled={saving} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 7px",borderRadius:5,fontSize:11,cursor:"pointer",fontWeight:700}}>✓</button><button onClick={()=>{setEditId(null);setEr(null);}} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,padding:"3px 7px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✕</button></div>}/>
                  </tr>
                );
                return (
                  <tr key={rec.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
                    <TD ch={<div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:22,height:22,borderRadius:"50%",background:avB(rec.emp_id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:av(rec.emp_id)}}>{ini(emp)}</div><span style={{fontWeight:700,color:C.bl}}>{en(rec.emp_id)}</span></div>}/>
                    <TD ch={<Bdg c={pc(rec.pos_id)[0]} bg={pc(rec.pos_id)[1]} bd={pc(rec.pos_id)[2]} ch={pn(rec.pos_id)}/>}/>
                    <TD ch={isDop?<Bdg c={C.pu} bg={C.puBg} bd={C.puBd} ch="Из другого"/>:<span style={{color:C.mu,fontSize:10}}>Свой</span>}/>
                    <TD ch={<span style={{color:C.md}}>{rec.hours}ч</span>}/>
                    <TD ch={<span style={{color:C.mu,fontSize:10}}>{fmt(getDayRev(store,date))} ₸</span>}/>
                    <TD ch={pt.base>0?<span style={{fontWeight:600,color:C.bl}}>{fmt(pt.base)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
                    <TD ch={pt.variable>0?<span style={{fontWeight:600,color:C.pu}}>{fmt(pt.variable)} ₸</span>:<span style={{color:C.mu}}>—</span>}/>
                    <TD ch={<span style={{color:pt.bonus?C.gn:C.mu}}>{pt.bonus?`+${pt.bonus.toLocaleString()} ₸`:"—"}</span>}/>
                    <TD ch={<span style={{fontWeight:800,color:C.gn,fontSize:13}}>{fmt(pt.total)} ₸</span>}/>
                    <TD ch={<span style={{color:C.mu,fontSize:10}}>{rec.comment||"—"}</span>}/>
                    <TD ch={<div style={{display:"flex",gap:3}}><button onClick={()=>openEdit(rec)} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 7px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✎</button><button onClick={()=>deleteShift(rec.id)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 7px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✕</button></div>}/>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>{(()=>{const tots=dayShifts.reduce((acc,r)=>{const pt=calcParts(r,positions,revenue);return{base:acc.base+pt.base,variable:acc.variable+pt.variable,bonus:acc.bonus+pt.bonus,total:acc.total+pt.total};},{base:0,variable:0,bonus:0,total:0});return(<tr style={{background:C.gnBg}}>
              <td colSpan={5} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.gn,borderTop:`2px solid ${C.gnBd}`}}>ИТОГО</td>
              <td style={{padding:"8px 10px",fontWeight:700,fontSize:12,color:C.bl,borderTop:`2px solid ${C.gnBd}`}}>{fmt(tots.base)} ₸</td>
              <td style={{padding:"8px 10px",fontWeight:700,fontSize:12,color:C.pu,borderTop:`2px solid ${C.gnBd}`}}>{fmt(tots.variable)} ₸</td>
              <td style={{padding:"8px 10px",fontWeight:700,fontSize:12,color:C.gn,borderTop:`2px solid ${C.gnBd}`}}>{fmt(tots.bonus)} ₸</td>
              <td style={{padding:"8px 10px",fontWeight:800,fontSize:14,color:C.gn,borderTop:`2px solid ${C.gnBd}`}}>{fmt(tots.total)} ₸</td>
              <td colSpan={2} style={{borderTop:`2px solid ${C.gnBd}`}}></td>
            </tr>);})()}</tfoot>
          </table>
        }
      </div>
    </div>
    );
  }

  function renderSched() {
    if (!schedStore) return null;
    const items = getSchedItems(schedStore, schedMo);
    return (
    <div>
      <div style={{marginBottom:12}}><h2 style={{margin:0,fontSize:16,fontWeight:800}}>Штатное расписание</h2></div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",marginBottom:14,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div><select value={schedStore||""} onChange={e=>setSchedStore(+e.target.value)} style={I({width:170})}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МЕСЯЦ</div><input type="month" value={schedMo} onChange={e=>setSchedMo(e.target.value)} style={I({width:148})}/></div>
        <div style={{borderLeft:`1px solid ${C.bdr}`,paddingLeft:12,display:"flex",gap:8,alignItems:"flex-end"}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СКОПИРОВАТЬ ИЗ</div><input type="month" value={schedCopyFrom} onChange={e=>setSchedCopyFrom(e.target.value)} style={I({width:148})}/></div>
          <button onClick={copySchedule} disabled={!schedCopyFrom} style={{background:schedCopyFrom?C.blBg:C.lt,border:`1px solid ${schedCopyFrom?C.blBd:C.bdr}`,color:schedCopyFrom?C.bl:C.mu,padding:"7px 12px",borderRadius:7,fontSize:11,cursor:schedCopyFrom?"pointer":"default",fontFamily:"inherit",fontWeight:600}}>Скопировать</button>
        </div>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.md,marginBottom:12}}>{sn(schedStore)} — {schedMo}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
          {positions.map(p=>{
            const item=items.find(x=>x.pos_id===p.id); const count=item?.count||0;
            return(<div key={p.id} style={{border:`2px solid ${count>0?pc(p.id)[2]:C.bdr}`,borderRadius:10,padding:"12px 14px",background:count>0?pc(p.id)[1]:C.lt}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><div style={{fontWeight:700,fontSize:12,color:count>0?pc(p.id)[0]:C.mu}}>{p.name}</div><div style={{fontSize:10,color:C.mu}}>{PL[p.pay_type]}</div></div>
                {count>0&&<Bdg c={pc(p.id)[0]} bg="rgba(255,255,255,.6)" bd={pc(p.id)[2]} ch={`${count} ставок`}/>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>setSchedCount(schedStore,schedMo,p.id,Math.max(0,count-1))} style={{width:26,height:26,borderRadius:6,background:C.w,border:`1px solid ${C.bdr}`,cursor:"pointer",fontSize:14,fontWeight:700,color:C.md}}>−</button>
                <span style={{fontSize:16,fontWeight:800,minWidth:24,textAlign:"center",color:count>0?pc(p.id)[0]:C.mu}}>{count}</span>
                <button onClick={()=>setSchedCount(schedStore,schedMo,p.id,count+1)} style={{width:26,height:26,borderRadius:6,background:count>0?pc(p.id)[0]:C.bl,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,color:"#fff"}}>+</button>
              </div>
            </div>);
          })}
        </div>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"auto"}}>
        <div style={{padding:"10px 14px",background:C.lt,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.md}}>Сводная таблица — {schedMo}</div>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
          <thead><tr><TH ch="Магазин"/>{positions.map(p=><TH key={p.id} ch={p.name}/>)}<TH ch="Итого"/></tr></thead>
          <tbody>{stores.map((s,i)=>{const its=getSchedItems(s.id,schedMo);const total=its.reduce((sum,x)=>sum+x.count,0);return(
            <tr key={s.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontWeight:600,fontSize:11}}>{s.name}</span>}/>
              {positions.map(p=>{const it=its.find(x=>x.pos_id===p.id);const cnt=it?.count||0;return<TD key={p.id} ch={cnt>0?<span style={{color:pc(p.id)[0],fontWeight:700}}>{cnt}</span>:<span style={{color:C.bdr}}>—</span>} s={{textAlign:"center"}}/>;})}<TD ch={<strong style={{color:C.or}}>{total}</strong>} s={{textAlign:"center"}}/>
            </tr>);})}</tbody>
        </table>
      </div>
    </div>
    );
  }

  function renderErep() {
    const rs = repE ? shifts.filter(r=>r.emp_id===repE.id&&r.date.startsWith(repMo)).sort((a,b)=>a.date.localeCompare(b.date)) : [];
    const tots = rs.reduce((acc,r)=>{const pt=calcParts(r,positions,revenue);return{base:acc.base+pt.base,variable:acc.variable+pt.variable,bonus:acc.bonus+pt.bonus,total:acc.total+pt.total};},{base:0,variable:0,bonus:0,total:0});
    const days = new Set(rs.map(r=>r.date)).size;
    return(<div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>СОТРУДНИК</div>
          <select value={repE?.id||""} onChange={e=>setRepE(emps.find(x=>x.id===+e.target.value)||null)} style={I({width:230})}>
            <option value="">— выберите —</option>
            {emps.map(e=><option key={e.id} value={e.id}>{fullName(e)}{!e.active?" (ув.)":""}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МЕСЯЦ</div><input type="month" value={repMo} onChange={e=>setRepMo(e.target.value)} style={I({width:155})}/></div>
        {repE&&<div style={{marginLeft:"auto"}}>
          <button onClick={()=>exportEmpReport({emp:repE,repMo,shifts,positions,revenue,stores,emps})}
            style={{background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            📥 Скачать Excel
          </button>
        </div>}
      </div>
      {!repE
        ?<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,padding:"44px",textAlign:"center",color:C.mu}}><div style={{fontSize:26,marginBottom:6}}>👤</div><div style={{fontSize:13,fontWeight:600}}>Выберите сотрудника</div></div>
        :<div>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"13px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:avB(repE.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:av(repE.id)}}>{ini(repE)}</div>
              <div><div style={{fontWeight:800,fontSize:14}}>{fullName(repE)}</div><div style={{fontSize:11,color:C.mu}}>{pn(repE.pos_id)} · {sn(repE.default_store)}</div></div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <div style={{textAlign:"center",minWidth:44}}><div style={{fontSize:18,fontWeight:800,color:C.or}}>{days}</div><div style={{fontSize:10,color:C.mu}}>дней</div></div>
              {tots.base>0&&<div style={{background:C.blBg,border:`1px solid ${C.blBd}`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:C.bl}}>{fmt(tots.base)} ₸</div><div style={{fontSize:9,color:C.md}}>оклад</div></div>}
              {tots.variable>0&&<div style={{background:C.puBg,border:`1px solid ${C.puBd}`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:C.pu}}>{fmt(tots.variable)} ₸</div><div style={{fontSize:9,color:C.md}}>% выручки</div></div>}
              {tots.bonus>0&&<div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:C.gn}}>{fmt(tots.bonus)} ₸</div><div style={{fontSize:9,color:C.md}}>бонусы</div></div>}
              <div style={{background:C.orBg,border:`1px solid ${C.orBd}`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:800,color:C.or}}>{fmt(tots.total)} ₸</div><div style={{fontSize:9,color:C.md}}>итого</div></div>
            </div>
          </div>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"hidden"}}>
            {rs.length===0?<div style={{padding:"32px",textAlign:"center",color:C.mu}}>Нет данных</div>:(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><TH ch="Дата"/><TH ch="Магазин"/><TH ch="Должность"/><TH ch="Часы"/><TH ch="Выручка"/><TH ch="Оклад"/><TH ch="% Выр."/><TH ch="Бонус"/><TH ch="Итого"/><TH ch="Комм."/></tr></thead>
              <tbody>{rs.map((r,i)=>{const pt=calcParts(r,positions,revenue);return(
                <tr key={r.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
                  <TD ch={<span style={{fontWeight:600}}>{fmtD(r.date)}</span>}/>
                  <TD ch={<Bdg c={C.or} bg={C.orBg} bd={C.orBd} ch={sn(r.store_id)}/>}/>
                  <TD ch={<Bdg c={pc(r.pos_id)[0]} bg={pc(r.pos_id)[1]} bd={pc(r.pos_id)[2]} ch={pn(r.pos_id)}/>}/>
                  <TD ch={`${r.hours}ч`} s={{color:C.md}}/>
                  <TD ch={<span style={{color:C.mu,fontSize:10}}>{fmt(getDayRev(r.store_id,r.date))} ₸</span>}/>
                  <TD ch={pt.base>0?`${fmt(pt.base)} ₸`:"—"} s={{color:C.bl,fontWeight:600}}/>
                  <TD ch={pt.variable>0?`${fmt(pt.variable)} ₸`:"—"} s={{color:C.pu,fontWeight:600}}/>
                  <TD ch={pt.bonus?`+${pt.bonus.toLocaleString()} ₸`:"—"} s={{color:pt.bonus?C.gn:C.mu}}/>
                  <TD ch={`${fmt(pt.total)} ₸`} s={{fontWeight:800,color:C.gn}}/>
                  <TD ch={r.comment||"—"} s={{color:C.mu,fontSize:10}}/>
                </tr>);})}
              </tbody>
              <tfoot><tr style={{background:C.gnBg}}>
                <td colSpan={5} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.md,borderTop:`2px solid ${C.gnBd}`}}>ИТОГО</td>
                <td style={{padding:"6px 10px",fontWeight:700,color:C.bl,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.base)} ₸</td>
                <td style={{padding:"6px 10px",fontWeight:700,color:C.pu,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.variable)} ₸</td>
                <td style={{padding:"6px 10px",fontWeight:700,color:C.gn,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.bonus)} ₸</td>
                <td style={{padding:"6px 10px",fontWeight:800,color:C.gn,borderTop:`2px solid ${C.gnBd}`,fontSize:14}}>{fmt(tots.total)} ₸</td>
                <td style={{borderTop:`2px solid ${C.gnBd}`}}></td>
              </tr></tfoot>
            </table>)}
          </div>
        </div>
      }
    </div>);
  }

  function renderSrep() {
    const rs = shifts.filter(r=>r.store_id===repS&&r.date>=repF&&r.date<=repT).sort((a,b)=>a.date.localeCompare(b.date));
    const tots = rs.reduce((acc,r)=>{const pt=calcParts(r,positions,revenue);return{base:acc.base+pt.base,variable:acc.variable+pt.variable,bonus:acc.bonus+pt.bonus,total:acc.total+pt.total};},{base:0,variable:0,bonus:0,total:0});
    const ue = new Set(rs.map(r=>r.emp_id)).size;
    const totalRev = Object.entries(revenue[repS]||{}).filter(([d])=>d>=repF&&d<=repT).reduce((s,[,v])=>s+v,0);
    return(<div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН</div><select value={repS||""} onChange={e=>setRepS(+e.target.value)} style={I({width:160})}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>С</div><input type="date" value={repF} onChange={e=>setRepF(e.target.value)} style={I({width:148})}/></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ПО</div><input type="date" value={repT} onChange={e=>setRepT(e.target.value)} style={I({width:148})}/></div>
        <div style={{marginLeft:"auto"}}>
          <button onClick={()=>exportStorePDF({store:repS,repF,repT,shifts,positions,revenue,stores,emps})}
            style={{background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            📥 Скачать Excel
          </button>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
          {[{l:"Смен",v:rs.length,ic:"📅",c:C.bl,bg:C.blBg,b:C.blBd},{l:"Сотрудников",v:ue,ic:"👥",c:C.pu,bg:C.puBg,b:C.puBd},{l:"Выручка",v:`${fmt(totalRev)} ₸`,ic:"📈",c:C.gn,bg:C.gnBg,b:C.gnBd},{l:"ФОТ всего",v:`${fmt(tots.total)} ₸`,ic:"💰",c:C.or,bg:C.orBg,b:C.orBd}].map((s,i)=>(
            <div key={i} style={{background:s.bg,border:`1px solid ${s.b}`,borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:15,marginBottom:3}}>{s.ic}</div><div style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.md}}>{s.l}</div></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[{ic:"🏦",v:tots.base,l:"Оклады — постоянная часть",c:C.bl,bg:C.blBg,b:C.blBd},{ic:"📊",v:tots.variable,l:"% от выручки — переменная",c:C.pu,bg:C.puBg,b:C.puBd},{ic:"🎁",v:tots.bonus,l:"Бонусы",c:C.gn,bg:C.gnBg,b:C.gnBd}].map((s,i)=>(
            <div key={i} style={{background:s.bg,border:`1px solid ${s.b}`,borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:s.c,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,flexShrink:0}}>{s.ic}</div>
              <div><div style={{fontSize:14,fontWeight:800,color:s.c}}>{fmt(s.v)} ₸</div><div style={{fontSize:10,color:C.md}}>{s.l}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"hidden"}}>
        {rs.length===0?<div style={{padding:"32px",textAlign:"center",color:C.mu}}>Нет данных</div>:(
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH ch="Дата"/><TH ch="Сотрудник"/><TH ch="Должность"/><TH ch="Часы"/><TH ch="Оклад"/><TH ch="% Выр."/><TH ch="Бонус"/><TH ch="Итого"/><TH ch="Комм."/></tr></thead>
          <tbody>{rs.map((r,i)=>{const pt=calcParts(r,positions,revenue);return(
            <tr key={r.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<span style={{fontWeight:600}}>{fmtD(r.date)}</span>}/>
              <TD ch={<div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:20,borderRadius:"50%",background:avB(r.emp_id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:av(r.emp_id)}}>{ini(emps.find(e=>e.id===r.emp_id))}</div><span style={{fontWeight:600,color:C.bl}}>{en(r.emp_id)}</span></div>}/>
              <TD ch={<Bdg c={pc(r.pos_id)[0]} bg={pc(r.pos_id)[1]} bd={pc(r.pos_id)[2]} ch={pn(r.pos_id)}/>}/>
              <TD ch={`${r.hours}ч`} s={{color:C.md}}/>
              <TD ch={pt.base>0?`${fmt(pt.base)} ₸`:"—"} s={{color:C.bl,fontWeight:600}}/>
              <TD ch={pt.variable>0?`${fmt(pt.variable)} ₸`:"—"} s={{color:C.pu,fontWeight:600}}/>
              <TD ch={pt.bonus?`+${pt.bonus.toLocaleString()} ₸`:"—"} s={{color:pt.bonus?C.gn:C.mu}}/>
              <TD ch={`${fmt(pt.total)} ₸`} s={{fontWeight:800,color:C.gn}}/>
              <TD ch={r.comment||"—"} s={{color:C.mu,fontSize:10}}/>
            </tr>);})}
          </tbody>
          <tfoot><tr style={{background:C.gnBg}}>
            <td colSpan={4} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.md,borderTop:`2px solid ${C.gnBd}`}}>ИТОГО</td>
            <td style={{padding:"6px 10px",fontWeight:700,color:C.bl,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.base)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:700,color:C.pu,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.variable)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:700,color:C.gn,borderTop:`2px solid ${C.gnBd}`,fontSize:12}}>{fmt(tots.bonus)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:800,color:C.gn,borderTop:`2px solid ${C.gnBd}`,fontSize:14}}>{fmt(tots.total)} ₸</td>
            <td style={{borderTop:`2px solid ${C.gnBd}`}}></td>
          </tr></tfoot>
        </table>)}
      </div>
    </div>);
  }

  function renderPay() {
    const allParts = activeE.map(e=>{const rs=shifts.filter(r=>r.emp_id===e.id&&r.date.startsWith(repMo));return rs.reduce((acc,r)=>{const pt=calcParts(r,positions,revenue);return{base:acc.base+pt.base,variable:acc.variable+pt.variable,bonus:acc.bonus+pt.bonus,total:acc.total+pt.total,shifts:acc.shifts+1,days:acc.days};},{base:0,variable:0,bonus:0,total:0,shifts:0,days:new Set(rs.map(r=>r.date)).size});});
    const grand = allParts.reduce((acc,p)=>({base:acc.base+p.base,variable:acc.variable+p.variable,bonus:acc.bonus+p.bonus,total:acc.total+p.total}),{base:0,variable:0,bonus:0,total:0});
    return(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МЕСЯЦ</div><input type="month" value={repMo} onChange={e=>setRepMo(e.target.value)} style={I({width:155})}/></div>
        <button onClick={()=>exportPayroll({repMo,shifts,positions,revenue,stores,emps})}
          style={{background:"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
          📥 Скачать Excel (ведомость)
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[{l:"Оклады",v:`${fmt(grand.base)} ₸`,ic:"🏦",c:C.bl,bg:C.blBg,b:C.blBd},{l:"% от выручки",v:`${fmt(grand.variable)} ₸`,ic:"📈",c:C.pu,bg:C.puBg,b:C.puBd},{l:"Бонусы",v:`${fmt(grand.bonus)} ₸`,ic:"🎁",c:C.gn,bg:C.gnBg,b:C.gnBd},{l:"Итого ФОТ",v:`${fmt(grand.total)} ₸`,ic:"💰",c:C.or,bg:C.orBg,b:C.orBd}].map((s,i)=>(
          <div key={i} style={{background:s.bg,border:`1px solid ${s.b}`,borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:18,marginBottom:4}}>{s.ic}</div><div style={{fontSize:17,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:C.md}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH ch="Сотрудник"/><TH ch="Магазин"/><TH ch="Смен"/><TH ch="Дней"/><TH ch="Оклад"/><TH ch="% Выр."/><TH ch="Бонус"/><TH ch="ИТОГО"/></tr></thead>
          <tbody>{activeE.map((e,i)=>{const p=allParts[i];return(<tr key={e.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
            <TD ch={<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:26,height:26,borderRadius:"50%",background:avB(e.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:av(e.id)}}>{ini(e)}</div><div><div style={{fontWeight:600,fontSize:12}}>{fullName(e)}</div><div style={{fontSize:10,color:C.mu}}>{pn(e.pos_id)}</div></div></div>}/>
            <TD ch={<span style={{fontSize:11,color:C.md}}>{sn(e.default_store)}</span>}/>
            <TD ch={p.shifts} s={{color:C.md}}/><TD ch={p.days} s={{color:C.md}}/>
            <TD ch={p.base>0?`${fmt(p.base)} ₸`:"—"} s={{color:C.bl,fontWeight:600}}/>
            <TD ch={p.variable>0?`${fmt(p.variable)} ₸`:"—"} s={{color:C.pu,fontWeight:600}}/>
            <TD ch={p.bonus>0?`+${fmt(p.bonus)} ₸`:"—"} s={{color:p.bonus?C.gn:C.mu}}/>
            <TD ch={`${fmt(p.total)} ₸`} s={{fontWeight:800,fontSize:14,color:C.or}}/>
          </tr>);})}</tbody>
          <tfoot><tr style={{background:C.lt}}>
            <td colSpan={4} style={{padding:"8px 10px",fontWeight:700,fontSize:11,color:C.md,borderTop:`2px solid ${C.bdr}`}}>ИТОГО</td>
            <td style={{padding:"6px 10px",fontWeight:800,color:C.bl,borderTop:`2px solid ${C.bdr}`,fontSize:13}}>{fmt(grand.base)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:800,color:C.pu,borderTop:`2px solid ${C.bdr}`,fontSize:13}}>{fmt(grand.variable)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:800,color:C.gn,borderTop:`2px solid ${C.bdr}`,fontSize:13}}>{fmt(grand.bonus)} ₸</td>
            <td style={{padding:"6px 10px",fontWeight:800,color:C.or,borderTop:`2px solid ${C.bdr}`,fontSize:14}}>{fmt(grand.total)} ₸</td>
          </tr></tfoot>
        </table>
      </div>
    </div>);
  }

  function renderEmp() {
    return(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><h3 style={{margin:0,fontSize:14,fontWeight:800}}>Сотрудники</h3><p style={{margin:"2px 0 0",fontSize:11,color:C.mu}}>{activeE.length} активных · {firedE.length} уволенных</p></div>
        <button onClick={()=>openEmpForm(null)} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Добавить</button>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH ch="Сотрудник"/><TH ch="Магазин"/><TH ch="Должность"/><TH ch="Статус"/><TH ch=""/></tr></thead>
          <tbody>{activeE.map((e,i)=>(
            <tr key={e.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
              <TD ch={<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:26,height:26,borderRadius:"50%",background:avB(e.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:av(e.id)}}>{ini(e)}</div><div style={{fontWeight:600,fontSize:12}}>{fullName(e)}</div></div>}/>
              <TD ch={<Bdg c={C.or} bg={C.orBg} bd={C.orBd} ch={sn(e.default_store)}/>}/>
              <TD ch={<Bdg c={pc(e.pos_id)[0]} bg={pc(e.pos_id)[1]} bd={pc(e.pos_id)[2]} ch={pn(e.pos_id)}/>}/>
              <TD ch={<Bdg c={C.gn} bg={C.gnBg} bd={C.gnBd} ch="Активен"/>}/>
              <TD ch={<div style={{display:"flex",gap:4}}>
                <button onClick={()=>{setRepE(e);setRepTab("erep");setTab("reports");}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer"}}>Выписка</button>
                <button onClick={()=>openEmpForm(e)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✎ Ред.</button>
                <button onClick={()=>setFireM(e)} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer"}}>Уволить</button>
              </div>}/>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {firedE.length>0&&<div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"8px 14px",background:"#fafafa",borderBottom:`1px solid ${C.bdr}`,fontSize:10,fontWeight:700,color:C.mu}}>УВОЛЕННЫЕ</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>{firedE.map((e,i)=>(
          <tr key={e.id} style={{background:i%2===0?C.w:"#fafbfc",opacity:0.65}}>
            <TD ch={<span style={{fontWeight:600,fontSize:12,color:C.md}}>{fullName(e)}</span>}/>
            <TD ch={<span style={{fontSize:11,color:C.mu}}>{sn(e.default_store)}</span>}/>
            <TD ch={<Bdg c={C.mu} bg={C.lt} bd={C.bdr} ch={pn(e.pos_id)}/>}/>
            <TD ch={<span style={{color:C.rd,fontSize:11}}>Уволен {e.fired_at}</span>}/>
            <TD ch={<div style={{display:"flex",gap:4}}>
              <button onClick={()=>openEmpForm(e)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✎ Ред.</button>
              <button onClick={()=>restoreEmployee(e)} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer"}}>Восстановить</button>
            </div>}/>
          </tr>
        ))}</tbody></table>
      </div>}
    </div>);
  }

  function renderStores() {
    return(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><h3 style={{margin:0,fontSize:14,fontWeight:800}}>Магазины</h3></div>
        <button onClick={()=>{setEditSt(null);setNs({name:"",address:"",open:"08:00",close:"22:00"});setStoreM(true);}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Добавить</button>
      </div>
      <div style={{display:"grid",gap:10}}>
        {stores.map(s=>{const ec=activeE.filter(e=>e.default_store===s.id).length;return(
          <div key={s.id} style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11}}>М{s.id}</div>
              <div><div style={{fontWeight:800,fontSize:14}}>{s.name}</div><div style={{fontSize:11,color:C.mu}}>📍 {s.address}</div></div>
            </div>
            <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.or}}>{s.open}–{s.close}</div><div style={{fontSize:9,color:C.mu}}>ВРЕМЯ РАБОТЫ</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.bl}}>{storeHours(s)}ч</div><div style={{fontSize:9,color:C.mu}}>СМЕНА</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.pu}}>{ec}</div><div style={{fontSize:9,color:C.mu}}>СОТРУДНИКОВ</div></div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>{setEditSt(s);setNs({name:s.name,address:s.address,open:s.open,close:s.close});setStoreM(true);}} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer"}}>✎ Изменить</button>
                <button onClick={()=>setDelStM({store:s,used:ec>0||shifts.some(r=>r.store_id===s.id)})} style={{background:C.rdBg,border:`1px solid ${C.rdBd}`,color:C.rd,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer"}}>🗑 Удалить</button>
              </div>
            </div>
          </div>
        );})}
      </div>
    </div>);
  }

  function renderPos() {
    return(<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><h3 style={{margin:0,fontSize:14,fontWeight:800}}>Должности</h3></div>
        <button onClick={()=>{setEditP(null);setNp({name:"",pay_type:"daily",hourly:0,daily:0,pct:0});setPosM(true);}} style={{background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"7px 13px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Добавить</button>
      </div>
      <div style={{display:"grid",gap:8}}>
        {positions.map(p=>{const used=shifts.some(r=>r.pos_id===p.id)||emps.some(e=>e.pos_id===p.id);return(
          <div key={p.id} style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:7,background:pc(p.id)[1],border:`1px solid ${pc(p.id)[2]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>💼</div>
              <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><Bdg c={pc(p.id)[0]} bg={pc(p.id)[1]} bd={pc(p.id)[2]} ch={PL[p.pay_type]||p.pay_type}/></div>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {(p.pay_type==="hourly"||p.pay_type==="hr")&&<div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.bl}}>{p.hourly}</div><div style={{fontSize:9,color:C.mu}}>₸/час</div></div>}
              {(p.pay_type==="daily"||p.pay_type==="dr")&&<div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.gn}}>{p.daily}</div><div style={{fontSize:9,color:C.mu}}>₸/день</div></div>}
              {(p.pay_type==="revenue"||p.pay_type==="hr"||p.pay_type==="dr")&&<div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:C.or}}>{p.pct}%</div><div style={{fontSize:9,color:C.mu}}>выручки</div></div>}
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>{setEditP(p);setNp({...p});setPosM(true);}} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"4px 9px",borderRadius:6,fontSize:11,cursor:"pointer"}}>✎ Изменить</button>
                <button onClick={()=>setDelPosM({pos:p,used})} style={{background:used?C.amBg:C.rdBg,border:`1px solid ${used?C.amBd:C.rdBd}`,color:used?C.am:C.rd,padding:"4px 9px",borderRadius:6,fontSize:11,cursor:"pointer"}}>🗑 Удалить</button>
              </div>
            </div>
          </div>
        );})}
      </div>
    </div>);
  }

  // ── РЕНДЕР ────────────────────────────────────────────────────────────────
  // Фильтруем вкладки по роли
  const visibleTabs = TOP_TABS.filter(t => {
    if (role === "owner" || role === "manager") return true;
    if (t.k === "input")   return true;
    if (t.k === "reports") return true;
    if (t.k === "debts")   return true;
    return false;
  });

  // manager/admin видит только свой магазин
  const visibleStores = role === "owner" ? stores : stores.filter(s => s.id === myStoreId);

  return (
<div style={{fontFamily:"system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.tx}}>
  <div style={{background:C.w,borderBottom:`1px solid ${C.bdr}`,padding:"0 16px",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
    <div style={{display:"flex",alignItems:"center",height:46,gap:10}}>
      <div style={{background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:"#fff"}}>100</div>
      <span style={{fontWeight:800,fontSize:13}}>100 Food OF</span>
      <span style={{fontSize:10,color:C.mu}}>HR</span>
      {saving&&<span style={{fontSize:10,color:C.or,marginLeft:8}}>💾 сохранение...</span>}
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
        <div style={{background:C.lt,border:`1px solid ${C.bdr}`,borderRadius:20,padding:"3px 10px",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:C.or,fontWeight:700}}>{ROLE_LABELS[role]||role}</span>
          <span style={{fontSize:10,color:C.mu}}>{appUser?.full_name||appUser?.email||""}</span>
          <button onClick={refreshRole} title="Обновить роль" style={{background:"none",border:"none",cursor:"pointer",fontSize:11,padding:"0 2px",color:C.mu}}>↻</button>
        </div>
        {role==="owner"&&<button onClick={()=>{setUsersTab(true);loadAppUsers();}} style={{background:C.blBg,border:`1px solid ${C.blBd}`,color:C.bl,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>👥 Пользователи</button>}

        <button onClick={signOut} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,padding:"4px 9px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Выйти</button>
      </div>
    </div>
    <div style={{display:"flex",overflowX:"auto"}}>
      {visibleTabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 14px",fontSize:11,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap",color:tab===t.k?C.or:C.mu,borderBottom:tab===t.k?`2px solid ${C.or}`:"2px solid transparent"}}>{t.l}</button>)}
    </div>
  </div>

  <div style={{padding:"14px 16px",maxWidth:1400,margin:"0 auto"}}>
    {tab==="input"&&renderInput()}
    {tab==="sched"&&renderSched()}
    {tab==="reports"&&(<div>
      <div style={{marginBottom:14}}><h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>📊 Отчёты</h2>
        <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>
          {REP_TABS.filter(t=>!(role==="admin"&&t.k==="pay")).map(t=><button key={t.k} onClick={()=>setRepTab(t.k)} style={subTabBtn(repTab===t.k)}>{t.l}</button>)}
        </div>
      </div>
      {repTab==="erep"&&renderErep()}
      {repTab==="srep"&&renderSrep()}
      {repTab==="pay"&&renderPay()}
    </div>)}
    {tab==="refs"&&(<div>
      <div style={{marginBottom:14,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:"0 0 10px",fontSize:16,fontWeight:800}}>📚 Справочники</h2>
          <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2}}>{REF_TABS.map(t=><button key={t.k} onClick={()=>setRefTab(t.k)} style={subTabBtn(refTab===t.k)}>{t.l}</button>)}</div>
        </div>
        {role==="owner"&&<button onClick={()=>{setCleanupTab(true);setCleanupResult(null);}} style={{background:C.rdBg,border:`2px solid ${C.rdBd}`,color:C.rd,padding:"8px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
          🗑 Очистка базы данных
        </button>}
      </div>
      {refTab==="emp"&&renderEmp()}
      {refTab==="stores"&&renderStores()}
      {refTab==="pos"&&renderPos()}
    </div>)}
    {tab==="debts"&&<DebtModule sb={sb} emps={emps} stores={stores} debts={debts} setDebts={setDebts} debtMoves={debtMoves} setDebtMoves={setDebtMoves}/>}
  </div>

  {/* МОДАЛ ДОБАВИТЬ НА СМЕНУ */}
  {addM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:420,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><div style={{fontWeight:800,fontSize:14}}>Добавить на смену</div><div style={{fontSize:11,color:C.mu}}>🏪 {sn(store)} · {fmtD(date)}</div></div>
        <button onClick={()=>setAddM(false)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:15}}>×</button>
      </div>
      {(()=>{
        const storeEmps=activeE.filter(e=>e.default_store===store);
        const otherEmps=activeE.filter(e=>e.default_store!==store);
        return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:4,fontWeight:700}}>СОТРУДНИК</div>
            {otherEmps.length>0&&<div style={{display:"flex",background:C.lt,borderRadius:8,padding:3,marginBottom:6,gap:2}}>
              <button onClick={()=>setShowAllEmps(false)} style={{flex:1,background:showAllEmps?"none":C.w,border:`1px solid ${showAllEmps?"transparent":C.bdr}`,borderRadius:6,padding:"5px 8px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:showAllEmps?C.mu:C.tx}}>🏪 {sn(store)} ({storeEmps.length})</button>
              <button onClick={()=>setShowAllEmps(true)} style={{flex:1,background:showAllEmps?C.puBg:"none",border:`1px solid ${showAllEmps?C.puBd:"transparent"}`,borderRadius:6,padding:"5px 8px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:showAllEmps?C.pu:C.mu}}>🔄 Все ({activeE.length})</button>
            </div>}
            <select value={nr.emp_id} onChange={e=>changeNrEmp(e.target.value)} style={I()}>
              {showAllEmps?(
                <>{storeEmps.length>0&&<optgroup label={`— ${sn(store)} —`}>{storeEmps.map(e=><option key={e.id} value={e.id}>{fullName(e)} · {pn(e.pos_id)}</option>)}</optgroup>}
                {otherEmps.length>0&&<optgroup label="— Из других магазинов —">{otherEmps.map(e=><option key={e.id} value={e.id}>{fullName(e)} ({sn(e.default_store)}) · {pn(e.pos_id)}</option>)}</optgroup>}</>
              ):(storeEmps.map(e=><option key={e.id} value={e.id}>{fullName(e)} · {pn(e.pos_id)}</option>))}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:4,fontWeight:700}}>ДОЛЖНОСТЬ</div>
            <select value={nr.pos_id} onChange={e=>setNr({...nr,pos_id:+e.target.value})} style={I()}>
              {getAvailPos(store,date.slice(0,7)).map(p=><option key={p.id} value={p.id}>{p.name} — {PL[p.pay_type]}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:C.mu,marginBottom:4,fontWeight:700,display:"flex",justifyContent:"space-between"}}>
              <span>ЧАСОВ</span>
              <button onClick={()=>setNr({...nr,showHours:!nr.showHours,hours:nr.showHours?autoHours(store):nr.hours})} style={{background:"none",border:"none",cursor:"pointer",fontSize:9,color:C.bl,fontFamily:"inherit"}}>{nr.showHours?"← авто":"✎ изменить"}</button>
            </div>
            {nr.showHours?<input type="number" min="0" max="24" value={nr.hours} onChange={e=>setNr({...nr,hours:e.target.value})} style={I()}/>:<div style={{background:C.lt,border:`1px solid ${C.bdr}`,borderRadius:6,padding:"6px 9px",fontSize:12,color:C.md}}>{nr.hours} ч <span style={{fontSize:10,color:C.mu}}>({sn(store)}: {stObj(store)?.open}–{stObj(store)?.close})</span></div>}
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:4,fontWeight:700}}>БОНУС ₸</div><input type="number" min="0" value={nr.bonus} onChange={e=>setNr({...nr,bonus:e.target.value})} style={I()}/></div>
          <div>
            <button onClick={()=>setNr({...nr,showOvr:!nr.showOvr,ovr_val:""})} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:nr.showOvr?C.rd:C.mu,fontFamily:"inherit",padding:0,textDecoration:"underline"}}>{nr.showOvr?"✕ убрать ручную ставку":"⚙ изменить ставку вручную"}</button>
            {nr.showOvr&&(()=>{const p=positions.find(x=>x.id===+nr.pos_id);const isRevB=p&&(p.pay_type==="revenue"||p.pay_type==="hr"||p.pay_type==="dr");return(<div style={{marginTop:6}}><input type="number" step="0.1" placeholder={isRevB?`% (сейчас ${p?.pct}%)`:`₸ (сейчас ${p?.daily||p?.hourly} ₸)`} value={nr.ovr_val} onChange={e=>setNr({...nr,ovr_val:e.target.value})} style={I()}/></div>);})()}
          </div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:4,fontWeight:700}}>КОММЕНТАРИЙ</div><input type="text" placeholder="необязательно" value={nr.comment} onChange={e=>setNr({...nr,comment:e.target.value})} style={I()}/></div>
        </div>);
      })()}
      <div style={{margin:"12px 0",padding:"8px 11px",background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:7,fontSize:12,color:C.gn,fontWeight:600}}>💡 Начислено: <strong>{fmt(prevSal())} ₸</strong></div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setAddM(false)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={addShift} disabled={saving||!nr.emp_id||!nr.pos_id} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>Добавить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ СОТРУДНИК */}
  {empM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:400,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
      <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{editEmp?"Редактировать":"Новый сотрудник"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
        <div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ФАМИЛИЯ</div><input type="text" value={ne.last_name} onChange={e=>setNe({...ne,last_name:e.target.value})} placeholder="Иванов" style={I()}/></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ИМЯ</div><input type="text" value={ne.first_name} onChange={e=>setNe({...ne,first_name:e.target.value})} placeholder="Иван" style={I()}/></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОТЧЕСТВО</div><input type="text" value={ne.middle_name} onChange={e=>setNe({...ne,middle_name:e.target.value})} style={I()}/></div>
        <div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>МАГАЗИН ПО УМОЛЧАНИЮ</div><select value={ne.default_store} onChange={e=>setNe({...ne,default_store:+e.target.value})} style={I()}>{stores.map(s=><option key={s.id} value={s.id}>{s.name} — {s.address}</option>)}</select></div>
        <div style={{gridColumn:"1/-1"}}><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОСНОВНАЯ ДОЛЖНОСТЬ</div><select value={ne.pos_id} onChange={e=>setNe({...ne,pos_id:+e.target.value})} style={I()}>{positions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      </div>
      <div style={{display:"flex",gap:7,marginTop:14}}>
        <button onClick={()=>{setEmpM(false);setEditEmp(null);}} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={saveEmp} disabled={saving} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ УВОЛЬНЕНИЕ */}
  {fireM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:310,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:7}}>⚠️</div>
      <div style={{fontWeight:800,fontSize:14,marginBottom:5}}>Уволить сотрудника?</div>
      <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:14}}>{fullName(fireM)}</div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setFireM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={()=>fireEmployee(fireM)} style={{flex:1,background:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Уволить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ МАГАЗИН */}
  {storeM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:380,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
      <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{editSt?"Изменить":"Новый магазин"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НАЗВАНИЕ</div><input type="text" value={ns.name} onChange={e=>setNs({...ns,name:e.target.value})} style={I()}/></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>АДРЕС</div><input type="text" value={ns.address} onChange={e=>setNs({...ns,address:e.target.value})} style={I()}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ОТКРЫТИЕ</div><input type="time" value={ns.open} onChange={e=>setNs({...ns,open:e.target.value})} style={I()}/></div>
          <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ЗАКРЫТИЕ</div><input type="time" value={ns.close} onChange={e=>setNs({...ns,close:e.target.value})} style={I()}/></div>
        </div>
        <div style={{background:C.lt,borderRadius:7,padding:"7px 10px",fontSize:11,color:C.md}}>🕐 Смена: <strong>{storeHours(ns)} ч</strong></div>
      </div>
      <div style={{display:"flex",gap:7,marginTop:14}}>
        <button onClick={()=>{setStoreM(false);setEditSt(null);}} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={saveSt} disabled={saving} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ УДАЛЕНИЕ МАГАЗИНА */}
  {delStM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:7}}>{delStM.used?"⚠️":"🗑️"}</div>
      <div style={{fontWeight:800,fontSize:14,marginBottom:5}}>Удалить магазин?</div>
      <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:10}}>«{delStM.store.name}»</div>
      {delStM.used&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}><strong>⚠️</strong> Есть сотрудники или записи смен.</div>}
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setDelStM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={confirmDeleteStore} style={{flex:1,background:delStM.used?C.am:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Удалить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ ДОЛЖНОСТЬ */}
  {posM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:20,width:360,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)"}}>
      <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>{editP?"Изменить":"Новая должность"}</div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>НАЗВАНИЕ</div><input type="text" value={np.name} onChange={e=>setNp({...np,name:e.target.value})} style={I()}/></div>
        <div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>ТИП ОПЛАТЫ</div>
          <select value={np.pay_type} onChange={e=>setNp({...np,pay_type:e.target.value})} style={I()}>
            <option value="hourly">Почасовая (₸ × часы)</option><option value="daily">Дневная (фикс. ₸/день)</option><option value="revenue">% от выручки</option><option value="hr">Почасовая + % выручки</option><option value="dr">Дневная + % выручки</option>
          </select>
        </div>
        {(np.pay_type==="hourly"||np.pay_type==="hr")&&<div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>₸/ЧАС</div><input type="number" value={np.hourly} onChange={e=>setNp({...np,hourly:+e.target.value})} style={I()}/></div>}
        {(np.pay_type==="daily"||np.pay_type==="dr")&&<div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>₸/ДЕНЬ</div><input type="number" value={np.daily} onChange={e=>setNp({...np,daily:+e.target.value})} style={I()}/></div>}
        {(np.pay_type==="revenue"||np.pay_type==="hr"||np.pay_type==="dr")&&<div><div style={{fontSize:9,color:C.mu,marginBottom:3,fontWeight:700}}>% ВЫРУЧКИ</div><input type="number" step="0.1" value={np.pct} onChange={e=>setNp({...np,pct:+e.target.value})} style={I()}/></div>}
      </div>
      <div style={{display:"flex",gap:7,marginTop:14}}>
        <button onClick={()=>{setPosM(false);setEditP(null);}} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={savePos} disabled={saving} style={{flex:1,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button>
      </div>
    </div>
  </div>)}

  {/* МОДАЛ УДАЛЕНИЕ ДОЛЖНОСТИ */}
  {delPosM&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:14,padding:22,width:340,maxWidth:"95vw",boxShadow:"0 20px 40px rgba(0,0,0,.14)",textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:7}}>{delPosM.used?"⚠️":"🗑️"}</div>
      <div style={{fontWeight:800,fontSize:14,marginBottom:5}}>Удалить должность?</div>
      <div style={{fontSize:13,color:C.md,fontWeight:600,marginBottom:10}}>«{delPosM.pos.name}»</div>
      {delPosM.used&&<div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"10px 12px",fontSize:11,color:C.am,marginBottom:14,textAlign:"left"}}><strong>⚠️</strong> Используется в сменах или у сотрудников.</div>}
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setDelPosM(null)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button onClick={confirmDeletePos} style={{flex:1,background:delPosM.used?C.am:C.rd,border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{delPosM.used?"Всё равно":"Удалить"}</button>
      </div>
    </div>
  </div>)}


  {/* ПАНЕЛЬ ОЧИСТКИ ДАННЫХ (только owner) */}
  {cleanupTab&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:24,width:620,maxWidth:"96vw",boxShadow:"0 24px 60px rgba(0,0,0,.2)",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div><div style={{fontWeight:800,fontSize:15,color:C.rd}}>🗑 Очистка данных</div><div style={{fontSize:11,color:C.mu,marginTop:2}}>Только для владельца · Действия необратимы</div></div>
        <button onClick={()=>{setCleanupTab(false);setCleanupConfirm(null);setCleanupInput("");setCleanupResult(null);}} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
      </div>

      {cleanupResult&&<div style={{padding:"10px 14px",borderRadius:8,marginBottom:12,background:cleanupResult.ok?C.gnBg:C.rdBg,border:`1px solid ${cleanupResult.ok?C.gnBd:C.rdBd}`,color:cleanupResult.ok?C.gn:C.rd,fontSize:12,fontWeight:600}}>
        {cleanupResult.ok?"✅ ":"❌ "}{cleanupResult.msg}
        <button onClick={()=>setCleanupResult(null)} style={{float:"right",background:"none",border:"none",cursor:"pointer",color:C.mu,fontSize:12}}>✕</button>
      </div>}

      {CLEANUP_ITEMS.map(group=>(
        <div key={group.group} style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.mu,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${C.bdr}`}}>{group.group}</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {group.items.map(item=>{
              const cc = item.color==="rd"?[C.rd,C.rdBg,C.rdBd]:item.color==="or"?[C.or,C.orBg,C.orBd]:[C.am,C.amBg,C.amBd];
              return(
              <div key={item.type} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:cc[1],border:`1px solid ${cc[2]}`,borderRadius:10,gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{item.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:12,color:cc[0]}}>{item.label}</div>
                    <div style={{fontSize:10,color:C.mu,marginTop:1}}>{item.warning}</div>
                  </div>
                </div>
                <button onClick={()=>{setCleanupConfirm(item);setCleanupInput("");setCleanupResult(null);}}
                  style={{background:cc[0],border:"none",color:"#fff",padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                  Очистить
                </button>
              </div>);
            })}
          </div>
        </div>
      ))}
    </div>
  </div>)}

  {/* ПОДТВЕРЖДЕНИЕ ОЧИСТКИ */}
  {cleanupConfirm&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
    <div style={{background:C.w,border:`2px solid ${C.rd}`,borderRadius:16,padding:28,width:420,maxWidth:"95vw",boxShadow:"0 24px 60px rgba(0,0,0,.25)",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:8}}>⚠️</div>
      <div style={{fontWeight:800,fontSize:16,color:C.rd,marginBottom:6}}>Подтвердите действие</div>
      <div style={{fontWeight:600,fontSize:13,color:C.tx,marginBottom:4}}>{cleanupConfirm.label}</div>
      <div style={{fontSize:12,color:C.mu,marginBottom:16,padding:"8px 12px",background:C.rdBg,borderRadius:8}}>{cleanupConfirm.warning}</div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.mu,marginBottom:6}}>Для подтверждения введите: <strong style={{color:C.rd}}>УДАЛИТЬ</strong></div>
        <input
          type="text"
          value={cleanupInput}
          onChange={e=>setCleanupInput(e.target.value)}
          placeholder="Введите УДАЛИТЬ"
          autoFocus
          style={{...I({textAlign:"center",fontSize:14,fontWeight:700,letterSpacing:"1px"}),border:`2px solid ${cleanupInput==="УДАЛИТЬ"?C.gn:C.bdr}`}}
        />
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setCleanupConfirm(null);setCleanupInput("");}} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"10px",borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
        <button
          onClick={()=>runCleanup(cleanupConfirm.type)}
          disabled={cleanupInput!=="УДАЛИТЬ"||cleanupBusy}
          style={{flex:1,background:cleanupInput==="УДАЛИТЬ"?C.rd:"#ccc",border:"none",color:"#fff",padding:"10px",borderRadius:8,fontSize:13,fontWeight:700,cursor:cleanupInput==="УДАЛИТЬ"?"pointer":"default",fontFamily:"inherit",opacity:cleanupBusy?0.7:1}}
        >
          {cleanupBusy?"Удаляю...":"✓ Удалить"}
        </button>
      </div>
    </div>
  </div>)}

  {/* ПАНЕЛЬ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ (только owner) */}
  {usersTab&&(<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
    <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:24,width:640,maxWidth:"96vw",boxShadow:"0 24px 60px rgba(0,0,0,.18)",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><div style={{fontWeight:800,fontSize:15}}>👥 Пользователи платформы</div><div style={{fontSize:11,color:C.mu,marginTop:2}}>Управление доступом и ролями</div></div>
        <button onClick={()=>{setUsersTab(false);setEditUser(null);}} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
      </div>

      <div style={{background:C.amBg,border:`1px solid ${C.amBd}`,borderRadius:8,padding:"9px 12px",fontSize:11,color:C.am,marginBottom:14}}>
        💡 Новые пользователи регистрируются сами через форму входа. После регистрации назначь им роль и магазин здесь.
      </div>

      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
        <thead><tr><TH ch="Пользователь"/><TH ch="Email"/><TH ch="Роль"/><TH ch="Магазин"/><TH ch=""/></tr></thead>
        <tbody>{appUsers.map((u,i)=>{
          const isEdit = editUser?.id===u.id;
          return(<tr key={u.id} style={{background:i%2===0?C.w:"#fafbfc"}}>
            <TD ch={<div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:u.id===appUser?.id?C.orBg:C.lt,border:`1px solid ${u.id===appUser?.id?C.orBd:C.bdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:u.id===appUser?.id?C.or:C.md}}>
                {(u.full_name||u.email||"?")[0].toUpperCase()}
              </div>
              <span style={{fontWeight:600,fontSize:12}}>{u.full_name||"—"}{u.id===appUser?.id&&<span style={{fontSize:9,color:C.or,marginLeft:4}}>вы</span>}</span>
            </div>}/>
            <TD ch={<span style={{fontSize:11,color:C.mu}}>{u.email}</span>}/>
            <TD ch={isEdit
              ?<select defaultValue={u.role} id={`role_${u.id}`} style={I({width:140})}>
                  <option value="owner">👑 Владелец</option>
                  <option value="manager">🏪 Управляющий</option>
                  <option value="admin">📋 Администратор</option>
                </select>
              :<Bdg c={u.role==="owner"?C.or:u.role==="manager"?C.bl:C.pu} bg={u.role==="owner"?C.orBg:u.role==="manager"?C.blBg:C.puBg} bd={u.role==="owner"?C.orBd:u.role==="manager"?C.blBd:C.puBd} ch={ROLE_LABELS[u.role]||u.role}/>
            }/>
            <TD ch={isEdit
              ?<select defaultValue={u.store_id||""} id={`store_${u.id}`} style={I({width:140})}>
                  <option value="">— Все магазины —</option>
                  {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              :<span style={{fontSize:11,color:C.md}}>{u.store_id?sn(u.store_id):"Все магазины"}</span>
            }/>
            <TD ch={isEdit
              ?<div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{
                    const r=document.getElementById(`role_${u.id}`)?.value||u.role;
                    const s=document.getElementById(`store_${u.id}`)?.value||"";
                    saveUserRole(u.id,r,s?+s:null);
                  }} style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,color:C.gn,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:"pointer",fontWeight:700}}>✓</button>
                  <button onClick={()=>setEditUser(null)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,padding:"3px 7px",borderRadius:5,fontSize:11,cursor:"pointer"}}>✕</button>
                </div>
              :<button onClick={()=>setEditUser(u)} disabled={u.id===appUser?.id} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:u.id===appUser?.id?C.bdr:C.md,padding:"3px 8px",borderRadius:5,fontSize:11,cursor:u.id===appUser?.id?"default":"pointer"}}>✎ Изменить</button>
            }/>
          </tr>);
        })}</tbody>
      </table>

      <div style={{background:C.lt,borderRadius:10,padding:"12px 14px"}}>
        <div style={{fontSize:11,fontWeight:700,color:C.md,marginBottom:8}}>📋 Права по ролям:</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,fontSize:10,color:C.md}}>
          <div style={{background:C.orBg,border:`1px solid ${C.orBd}`,borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontWeight:700,color:C.or,marginBottom:4}}>👑 Владелец</div>
            <div>✅ Все магазины</div><div>✅ Справочники</div><div>✅ Все отчёты + зарплаты</div><div>✅ Управление пользователями</div>
          </div>
          <div style={{background:C.blBg,border:`1px solid ${C.blBd}`,borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontWeight:700,color:C.bl,marginBottom:4}}>🏪 Управляющий</div>
            <div>✅ Все магазины</div><div>✅ Все функции</div><div>✅ Все отчёты и зарплаты</div><div>✅ Справочники</div>
          </div>
          <div style={{background:C.puBg,border:`1px solid ${C.puBd}`,borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontWeight:700,color:C.pu,marginBottom:4}}>📋 Администратор</div>
            <div>✅ Только свой магазин</div><div>✅ Ввод смен</div><div>✅ Отчёт по магазину</div><div>✅ Отчёт по сотруднику</div><div>❌ Зарплаты скрыты</div>
          </div>
        </div>
      </div>
    </div>
  </div>)}

</div>
  );
}
