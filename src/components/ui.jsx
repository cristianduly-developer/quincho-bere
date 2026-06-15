import { useEffect } from "react";
import { STATUS, TURNOS } from "../lib/constants.js";
import { inputStyle, labelStyle } from "../lib/styles.js";

export function Field({ label, children }) {
  return <div style={{marginBottom:14}}><label style={labelStyle}>{label}</label>{children}</div>;
}
export function Input({ label, value, onChange, type="text", placeholder, min, required, readOnly }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        min={min} required={required} readOnly={readOnly}
        style={{...inputStyle, background: readOnly?"#F9F6F2":"#FFF"}} />
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
export function Btn({ onClick, children, variant="primary", small, fullWidth, disabled }) {
  const vs = {
    primary:   { background:"#C4602B", color:"#FFF", border:"none" },
    secondary: { background:"#FDF8F3", color:"#C4602B", border:"1.5px solid #C4602B" },
    ghost:     { background:"transparent", color:"#8B7355", border:"1.5px solid #EDE0D0" },
    danger:    { background:"#FEF2F2", color:"#DC2626", border:"1.5px solid #FECACA" },
    green:     { background:"#F0FDF4", color:"#16A34A", border:"1.5px solid #86EFAC" },
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
  useEffect(() => { document.body.style.overflow="hidden"; return ()=>{ document.body.style.overflow=""; }; }, []);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,14,8,0.55)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:2000}} onClick={onClose}>
      <div style={{background:"#FFF",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"sticky",top:0,background:"#FFF",zIndex:1,padding:"10px 20px 14px",borderBottom:"1px solid #EDE0D0"}}>
          <div style={{width:36,height:4,background:"#D4C5B5",borderRadius:2,margin:"0 auto 14px"}} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#1C1C1E",fontFamily:"'Playfair Display', serif"}}>{title}</h2>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#8B7355",lineHeight:1}}>✕</button>
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
export function TurnoBadge({ turno }) {
  const t = TURNOS[turno]||TURNOS.dia;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:t.color,background:t.bg}}>{t.icon} {t.label}</span>;
}
export function Avatar({ nombre }) {
  return (
    <div style={{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#C4602B,#9E4A1E)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontWeight:800,fontSize:18,flexShrink:0,fontFamily:"'Playfair Display', serif"}}>
      {nombre?.[0]?.toUpperCase()||"?"}
    </div>
  );
}
