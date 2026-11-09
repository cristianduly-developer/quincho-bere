import { useEffect, useState, useRef, useMemo } from "react";
import { STATUS, TURNOS } from "../lib/constants.js";
import { inputStyle, labelStyle } from "../lib/styles.js";

function useIsDesktopModal() {
  const [is, setIs] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIs(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return is;
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

function formatDateDisplay(v) {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]?.slice(0, 3)} ${y}`;
}

function formatTimeDisplay(v) {
  if (!v) return "";
  return v.slice(0, 5);
}

export function DatePickerCustom({ value, onChange, style: extStyle, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const parsed = value ? new Date(value + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + "T12:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const pick = (d) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const base = { ...inputStyle, ...extStyle, cursor: readOnly ? "default" : "pointer", background: readOnly ? "var(--qb-input-readonly)" : "var(--qb-input-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => { if (!readOnly) setOpen(!open); }} style={base}>
        <span style={{ color: value ? "var(--qb-text)" : "var(--qb-text2)" }}>{value ? formatDateDisplay(value) : "Seleccionar fecha"}</span>
        <span style={{ fontSize: 14, opacity: 0.5 }}>📅</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 1100, background: "var(--qb-dropdown-bg)", border: "1.5px solid var(--qb-border)", borderRadius: 12, boxShadow: "var(--qb-dropdown-shadow)", width: 280, padding: "12px 10px", animation: "fadeIn 0.15s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
            <button onClick={prev} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--qb-text2)", padding: "4px 8px", borderRadius: 6 }}>‹</button>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--qb-text)", fontFamily: "'Playfair Display', serif" }}>{MESES[viewMonth]} {viewYear}</span>
            <button onClick={next} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--qb-text2)", padding: "4px 8px", borderRadius: 6 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ fontSize: 10, fontWeight: 700, color: "var(--qb-text2)", padding: "4px 0", textTransform: "uppercase", letterSpacing: 0.5 }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={"e" + i} />;
              const mm = String(viewMonth + 1).padStart(2, "0");
              const dd = String(d).padStart(2, "0");
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const isSel = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <div key={i} onClick={() => pick(d)} style={{
                  padding: "7px 0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: isSel ? 700 : 400,
                  background: isSel ? "var(--qb-accent)" : isToday ? "var(--qb-accent-bg)" : "transparent",
                  color: isSel ? "#FFF" : isToday ? "var(--qb-accent)" : "var(--qb-text)",
                  transition: "background 0.12s"
                }}>{d}</div>
              );
            })}
          </div>
          {value && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button onClick={() => { onChange(""); setOpen(false); }} style={{ background: "none", border: "none", fontSize: 11, color: "var(--qb-text2)", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Limpiar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TimePickerCustom({ value, onChange, style: extStyle, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hoursRef = useRef(null);
  const minsRef = useRef(null);

  const [selH, selM] = useMemo(() => {
    if (!value) return [null, null];
    const parts = value.split(":");
    return [parseInt(parts[0]), parseInt(parts[1])];
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (hoursRef.current && selH !== null) {
        const el = hoursRef.current.querySelector(`[data-h="${selH}"]`);
        if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
      }
      if (minsRef.current && selM !== null) {
        const el = minsRef.current.querySelector(`[data-m="${selM}"]`);
        if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }, 30);
  }, [open]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const pickH = (h) => {
    const m = selM !== null ? selM : 0;
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };
  const pickM = (m) => {
    const h = selH !== null ? selH : 12;
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const base = { ...inputStyle, ...extStyle, cursor: readOnly ? "default" : "pointer", background: readOnly ? "var(--qb-input-readonly)" : "var(--qb-input-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" };

  const colStyle = { flex: 1, overflowY: "auto", maxHeight: 200, scrollbarWidth: "thin" };
  const cellBase = { padding: "8px 0", textAlign: "center", borderRadius: 8, cursor: "pointer", fontSize: 14, transition: "background 0.1s" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => { if (!readOnly) setOpen(!open); }} style={base}>
        <span style={{ color: value ? "var(--qb-text)" : "var(--qb-text2)" }}>{value ? formatTimeDisplay(value) : "Seleccionar hora"}</span>
        <span style={{ fontSize: 14, opacity: 0.5 }}>🕐</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 1100, background: "var(--qb-dropdown-bg)", border: "1.5px solid var(--qb-border)", borderRadius: 12, boxShadow: "var(--qb-dropdown-shadow)", width: 180, animation: "fadeIn 0.15s ease" }}>
          <div style={{ padding: "10px 10px 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, borderBottom: "1px solid var(--qb-border)" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--qb-text)", fontFamily: "'Playfair Display', serif" }}>
              {value ? formatTimeDisplay(value) : "--:--"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            <div style={{ ...colStyle, borderRight: "1px solid var(--qb-border)", padding: "4px" }} ref={hoursRef}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--qb-text2)", textAlign: "center", padding: "2px 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Hora</div>
              {hours.map(h => (
                <div key={h} data-h={h} onClick={() => pickH(h)} style={{
                  ...cellBase,
                  fontWeight: h === selH ? 700 : 400,
                  background: h === selH ? "var(--qb-accent)" : "transparent",
                  color: h === selH ? "#FFF" : "var(--qb-text)"
                }}>{String(h).padStart(2, "0")}</div>
              ))}
            </div>
            <div style={{ ...colStyle, padding: "4px" }} ref={minsRef}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--qb-text2)", textAlign: "center", padding: "2px 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Min</div>
              {minutes.map(m => (
                <div key={m} data-m={m} onClick={() => pickM(m)} style={{
                  ...cellBase,
                  fontWeight: m === selM ? 700 : 400,
                  background: m === selM ? "var(--qb-accent)" : "transparent",
                  color: m === selM ? "#FFF" : "var(--qb-text)"
                }}>{String(m).padStart(2, "0")}</div>
              ))}
            </div>
          </div>
          {value && (
            <div style={{ textAlign: "center", padding: "6px 0 8px", borderTop: "1px solid var(--qb-border)" }}>
              <button onClick={() => { onChange(""); setOpen(false); }} style={{ background: "none", border: "none", fontSize: 11, color: "var(--qb-text2)", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Limpiar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return <div style={{marginBottom:14}}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Input({ label, value, onChange, type="text", placeholder, min, required, readOnly }) {
  if (type === "date") {
    return (
      <Field label={label}>
        <DatePickerCustom value={value} onChange={onChange} readOnly={readOnly} />
      </Field>
    );
  }
  if (type === "time") {
    return (
      <Field label={label}>
        <TimePickerCustom value={value} onChange={onChange} readOnly={readOnly} />
      </Field>
    );
  }
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        min={min} required={required} readOnly={readOnly}
        style={{...inputStyle, background: readOnly?"var(--qb-input-readonly)":"var(--qb-input-bg)"}} />
    </Field>
  );
}
export function Select({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={inputStyle}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
export function TextArea({ label, value, onChange, placeholder, rows=3 }) {
  return (
    <Field label={label}>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        rows={rows} style={{...inputStyle, resize:"vertical"}} />
    </Field>
  );
}
export function SearchSelect({ label, value, onChange, options, placeholder="Buscar..." }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = q ? options.filter(o => o.value && o.label.toLowerCase().includes(q.toLowerCase())) : options.filter(o => o.value);

  return (
    <Field label={label}>
      <div ref={ref} style={{position:"relative"}}>
        <div onClick={() => { setOpen(!open); setQ(""); }} style={{...inputStyle, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", minHeight:40}}>
          <span style={{color: selected ? "var(--qb-text)" : "var(--qb-text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1}}>{selected ? selected.label : (placeholder || "— Seleccionar —")}</span>
          <span style={{fontSize:10, color:"var(--qb-text2)", marginLeft:8}}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{position:"absolute", top:"100%", left:0, right:0, zIndex:100, background:"var(--qb-dropdown-bg)", border:"1.5px solid var(--qb-border)", borderRadius:10, boxShadow:"var(--qb-dropdown-shadow)", maxHeight:260, display:"flex", flexDirection:"column"}}>
            <div style={{padding:"8px 10px", borderBottom:"1px solid var(--qb-border)"}}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar cliente..."
                style={{...inputStyle, marginBottom:0, fontSize:13}} onClick={e => e.stopPropagation()} />
            </div>
            <div style={{overflowY:"auto", flex:1}}>
              {filtered.length === 0 ? (
                <div style={{padding:"14px 12px", textAlign:"center", color:"var(--qb-text2)", fontSize:13}}>Sin resultados</div>
              ) : filtered.map(o => (
                <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  style={{padding:"10px 14px", cursor:"pointer", fontSize:13, color:"var(--qb-text)", background: o.value === value ? "var(--qb-bg-hover)" : "transparent", borderBottom:"1px solid var(--qb-border-light)"}}
                  onMouseEnter={e => e.currentTarget.style.background="var(--qb-bg-hover)"}
                  onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background="transparent"; }}>
                  {o.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
export function Btn({ onClick, children, variant="primary", small, fullWidth, disabled }) {
  const vs = {
    primary:   { background:"var(--qb-accent)", color:"#FFF", border:"none" },
    secondary: { background:"var(--qb-bg)", color:"var(--qb-accent)", border:"1.5px solid var(--qb-accent)" },
    ghost:     { background:"transparent", color:"var(--qb-text2)", border:"1.5px solid var(--qb-border)" },
    danger:    { background:"var(--qb-gasto-bg)", color:"#DC2626", border:"1.5px solid var(--qb-gasto-border)" },
    green:     { background:"var(--qb-cobro-bg)", color:"#16A34A", border:"1.5px solid var(--qb-cobro-border)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...(vs[variant]||vs.primary), borderRadius:8, padding: small?"6px 14px":"10px 20px",
      fontSize: small?12:14, fontWeight:600, cursor: disabled?"not-allowed":"pointer",
      opacity: disabled?0.5:1, fontFamily:"inherit", width: fullWidth?"100%":"auto",
      display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
    }}>{children}</button>
  );
}
export function BottomModal({ title, onClose, children }) {
  const desk = useIsDesktopModal();
  useEffect(() => { document.body.style.overflow="hidden"; return ()=>{ document.body.style.overflow=""; }; }, []);
  return (
    <div style={{position:"fixed",inset:0,background:"var(--qb-modal-overlay)",display:"flex",alignItems:desk?"flex-start":"flex-end",justifyContent:"center",zIndex:2000,paddingTop:desk?"5vh":0}} onClick={onClose}>
      <div style={{background:"var(--qb-modal-bg)",borderRadius:desk?20:"20px 20px 0 0",width:"100%",maxWidth:desk?560:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"var(--qb-shadow-lg)"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:"var(--qb-modal-bg)",zIndex:1,padding:"10px 20px 14px",borderBottom:"1px solid var(--qb-border)"}}>
          <div style={{width:36,height:4,background:"var(--qb-grab-bar)",borderRadius:2,margin:"0 auto 14px"}} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"var(--qb-text)",fontFamily:"'Playfair Display', serif"}}>{title}</h2>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--qb-text2)",lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{padding:"20px 20px 40px"}}>{children}</div>
      </div>
    </div>
  );
}
export function StatusBadge({ estado }) {
  const s = STATUS[estado]||STATUS.pendiente;
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:s.color,background:s.bg,border:`1px solid ${s.border}`}}>{s.label}</span>;
}
export function TurnoBadge({ turno, label }) {
  const t = TURNOS[turno]||TURNOS.dia;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:t.color,background:t.bg}}>{t.icon} {label||t.label}</span>;
}
export function Avatar({ nombre }) {
  return (
    <div style={{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:18,flexShrink:0,fontFamily:"'Playfair Display', serif"}}>
      {nombre?.[0]?.toUpperCase()||"?"}
    </div>
  );
}
