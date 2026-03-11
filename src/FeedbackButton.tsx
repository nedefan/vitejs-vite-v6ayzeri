import { useState, useEffect, useCallback } from "react";

const C = {
  w:"#fff",bdr:"#e2e8f0",lt:"#f1f5f9",tx:"#0f172a",md:"#475569",mu:"#64748b",
  or:"#ea580c",orBg:"#fff7ed",orBd:"#fed7aa",gn:"#16a34a",gnBg:"#f0fdf4",gnBd:"#bbf7d0",
  rd:"#dc2626",rdBg:"#fef2f2",rdBd:"#fecaca",bl:"#2563eb",blBg:"#eff6ff",blBd:"#bfdbfe",
  am:"#b45309",amBg:"#fffbeb",amBd:"#fde68a",
};
const I = (ex:any={}) => ({background:C.w,border:`1px solid ${C.bdr}`,color:C.tx,borderRadius:6,padding:"6px 9px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,width:"100%",...ex});
const fmt = (d:string) => new Date(d).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

const STATUS_CFG:{[k:string]:{l:string,c:string,bg:string,bd:string}} = {
  new:         {l:"🆕 Новое",     c:C.bl, bg:C.blBg, bd:C.blBd},
  in_progress: {l:"🔧 В работе",  c:C.am, bg:C.amBg, bd:C.amBd},
  done:        {l:"✅ Готово",    c:C.gn, bg:C.gnBg, bd:C.gnBd},
};

const TAB_NAMES:{[k:string]:string} = {
  input:"🏪 Ввод смен", sched:"📅 Расписание", reports:"📊 Отчёты",
  refs:"📚 Справочники", suppliers:"🏭 Поставщики", debts:"💳 Задолженности",
  erep:"👤 По сотруднику", srep:"🏪 По магазину", pay:"💰 По зарплате",
  emp:"👥 Сотрудники", stores:"🏬 Магазины", pos:"📋 Должности",
};

interface Props {
  sb: any;
  appUser: any;
  currentTab: string;
  externalOpen?: boolean;
  externalInbox?: boolean;
  onCloseOpen?: () => void;
  onCloseInbox?: () => void;
  onUnreadChange?: (n: number) => void;
}

export default function FeedbackButton({
  sb, appUser, currentTab,
  externalOpen, externalInbox,
  onCloseOpen, onCloseInbox, onUnreadChange
}: Props) {
  // ── state ──────────────────────────────────────────────────────────
  const [openInternal,  setOpenInternal]  = useState(false);
  const [inboxInternal, setInboxInternal] = useState(false);
  const [text,    setText]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [sent,    setSent]    = useState(false);
  const [notes,   setNotes]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState("all");

  // ── computed ───────────────────────────────────────────────────────
  const isOwner = appUser?.role === "owner" || appUser?.role === "manager";
  const unread  = notes.filter(n => n.status === "new").length;

  // ── wrappers that notify parent on close ──────────────────────────
  const setOpen = (v: boolean) => {
    setOpenInternal(v);
    if (!v && onCloseOpen) onCloseOpen();
  };
  const setInbox = (v: boolean) => {
    setInboxInternal(v);
    if (!v && onCloseInbox) onCloseInbox();
  };

  // ── data loader (declared before effects that use it) ─────────────
  const loadNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from("feedback_notes").select("*").order("created_at", { ascending: false });
    if (data) setNotes(data);
    setLoading(false);
  }, [sb]);

  // ── effects ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOwner) loadNotes();
  }, [isOwner, loadNotes]);

  useEffect(() => {
    if (externalOpen) setOpenInternal(true);
  }, [externalOpen]);

  useEffect(() => {
    if (externalInbox) { setInboxInternal(true); loadNotes(); }
  }, [externalInbox, loadNotes]);

  useEffect(() => {
    if (onUnreadChange) onUnreadChange(unread);
  }, [unread, onUnreadChange]);

  // ── actions ───────────────────────────────────────────────────────
  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    const page = TAB_NAMES[currentTab] || currentTab;
    await sb.from("feedback_notes").insert({
      text: text.trim(),
      page,
      author_name: appUser?.full_name || appUser?.email || "—",
      author_role: appUser?.role || "user",
      status: "new",
    });
    setSaving(false);
    setSent(true);
    setText("");
    setTimeout(() => { setSent(false); setOpen(false); }, 1500);
    if (isOwner) loadNotes();
  }

  async function setStatus(id: number, status: string) {
    await sb.from("feedback_notes").update({ status }).eq("id", id);
    setNotes(notes.map(n => n.id === id ? { ...n, status } : n));
  }

  async function deleteNote(id: number) {
    await sb.from("feedback_notes").delete().eq("id", id);
    setNotes(notes.filter(n => n.id !== id));
  }

  const filtered = filter === "all" ? notes : notes.filter(n => n.status === filter);

  // ── render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Модал: оставить заметку */}
      {openInternal && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.4)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:80}}>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:20,width:360,maxWidth:"95vw",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontWeight:800,fontSize:14}}>📝 Заметка</div>
              <button onClick={()=>setOpen(false)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:14}}>×</button>
            </div>
            <div style={{fontSize:11,color:C.mu,marginBottom:12}}>
              Страница: <strong style={{color:C.or}}>{TAB_NAMES[currentTab]||currentTab}</strong>
            </div>
            {sent ? (
              <div style={{background:C.gnBg,border:`1px solid ${C.gnBd}`,borderRadius:10,padding:"16px",textAlign:"center",color:C.gn,fontWeight:700,fontSize:13}}>
                ✅ Заметка отправлена!
              </div>
            ) : (
              <>
                <textarea
                  autoFocus
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Опишите что нужно доработать или добавить..."
                  rows={4}
                  style={{...I(), resize:"vertical", minHeight:100}}
                />
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button onClick={()=>setOpen(false)} style={{flex:1,background:C.lt,border:`1px solid ${C.bdr}`,color:C.md,padding:"8px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Отмена</button>
                  <button onClick={submit} disabled={saving||!text.trim()} style={{flex:2,background:"linear-gradient(135deg,#f97316,#ea580c)",border:"none",color:"#fff",padding:"8px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!text.trim()||saving)?0.5:1}}>
                    {saving?"Отправка...":"📤 Отправить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Модал: инбокс (только owner/manager) */}
      {inboxInternal && isOwner && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.w,border:`1px solid ${C.bdr}`,borderRadius:16,padding:24,width:680,maxWidth:"96vw",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>📬 Заметки и обратная связь</div>
                <div style={{fontSize:11,color:C.mu,marginTop:2}}>
                  {unread > 0 ? <span style={{color:C.bl,fontWeight:600}}>{unread} новых</span> : "Всё прочитано"} · всего {notes.length}
                </div>
              </div>
              <button onClick={()=>setInbox(false)} style={{background:C.lt,border:`1px solid ${C.bdr}`,color:C.mu,width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
            </div>

            <div style={{background:C.lt,borderRadius:10,padding:4,display:"inline-flex",gap:2,marginBottom:16}}>
              {[["all","Все"],["new","🆕 Новые"],["in_progress","🔧 В работе"],["done","✅ Готово"]].map(([k,l])=>(
                <button key={k} onClick={()=>setFilter(k)} style={{
                  background:filter===k?C.w:"none",border:`1px solid ${filter===k?C.bdr:"transparent"}`,
                  borderRadius:7,cursor:"pointer",padding:"5px 12px",fontSize:11,fontWeight:600,
                  fontFamily:"inherit",color:filter===k?C.or:C.mu,
                  boxShadow:filter===k?"0 1px 3px rgba(0,0,0,.07)":"none",
                }}>{l}</button>
              ))}
            </div>

            {loading ? (
              <div style={{textAlign:"center",padding:40,color:C.mu}}>Загрузка...</div>
            ) : filtered.length === 0 ? (
              <div style={{textAlign:"center",padding:40,color:C.mu}}>
                <div style={{fontSize:28,marginBottom:8}}>📭</div>
                <div style={{fontSize:13}}>Нет заметок</div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtered.map(note => {
                  const st = STATUS_CFG[note.status] || STATUS_CFG.new;
                  return (
                    <div key={note.id} style={{
                      background: note.status==="done" ? "#fafbfc" : C.w,
                      border:`1px solid ${note.status==="new"?C.blBd:C.bdr}`,
                      borderRadius:10, padding:"12px 16px",
                      opacity: note.status==="done" ? 0.7 : 1,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                        <div style={{flex:1,fontSize:13,color:C.tx,lineHeight:1.5}}>{note.text}</div>
                        <button onClick={()=>deleteNote(note.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.mu,fontSize:14,padding:"0 4px",flexShrink:0}}>×</button>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,color:C.mu}}>{fmt(note.created_at)}</span>
                        {note.page && <span style={{background:C.orBg,border:`1px solid ${C.orBd}`,color:C.or,padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:600}}>{note.page}</span>}
                        <span style={{fontSize:10,color:C.mu}}>{note.author_name}</span>
                        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                          {Object.entries(STATUS_CFG).map(([k,v])=>(
                            <button key={k} onClick={()=>setStatus(note.id,k)} style={{
                              padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                              background:note.status===k?v.bg:C.lt,
                              border:`1px solid ${note.status===k?v.bd:C.bdr}`,
                              color:note.status===k?v.c:C.mu,
                            }}>{v.l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
