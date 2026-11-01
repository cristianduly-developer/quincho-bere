import { useEffect, useState, useRef } from "react";
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

export function Field({ label, children }) {
  return <div style={{marginBottom:14}}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Input({ label, value, onChange, type="text", placeholder, min, required, readOnly }) {
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
