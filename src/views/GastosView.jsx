import { useState } from "react";
import { MONTHS, EXPENSE_CATS, CAT_COLORS } from "../lib/constants.js";
import { fmtCurrency, fmtDate } from "../lib/utils.js";
import { card, inputStyle } from "../lib/styles.js";
import { Btn } from "../components/ui.jsx";

export default function GastosView({ gastos, onNewGasto, onEditGasto, onDeleteGasto }) {
  const nowG = new Date();
  const [filterCat,setFilterCat]=useState("all");
  const [filterYear,setFilterYear]=useState(nowG.getFullYear());
  const [filterMonthNum,setFilterMonthNum]=useState(nowG.getMonth());
  const [search,setSearch]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(null);
  const filterKey=`${filterYear}-${String(filterMonthNum+1).padStart(2,"0")}`;
  const sorted=gastos
    .filter(g=>filterCat==="all"||g.categoria===filterCat)
    .filter(g=>g.fecha?.startsWith(filterKey))
    .filter(g=>!search||g.concepto?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const total=sorted.reduce((s,g)=>s+g.monto,0);
  return (
    <div style={{padding:"16px 16px 100px"}}>
      <div style={{...card,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:11,color:"#8B7355"}}>💸 Total gastos (filtrado)</div>
        <div style={{fontSize:28,fontWeight:800,color:"#DC2626",fontFamily:"'Playfair Display', serif"}}>{fmtCurrency(total)}</div>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar gasto..." style={{...inputStyle,marginBottom:10}} />
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:10,scrollbarWidth:"none"}}>
        {[{value:"all",label:"Todos"},...EXPENSE_CATS.map(c=>({value:c,label:c}))].map(opt=>(
          <button key={opt.value} onClick={()=>setFilterCat(opt.value)} style={{
            padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,whiteSpace:"nowrap",
            background:filterCat===opt.value?"#DC2626":"#FDF8F3",color:filterCat===opt.value?"#FFF":"#8B7355",
            border:`1px solid ${filterCat===opt.value?"#DC2626":"#EDE0D0"}`,cursor:"pointer",fontFamily:"inherit",
          }}>{opt.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
        <button onClick={()=>{ if(filterMonthNum===0){setFilterMonthNum(11);setFilterYear(y=>y-1);}else setFilterMonthNum(m=>m-1); }} style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>‹</button>
        <div style={{...card,flex:1,padding:"9px 14px",textAlign:"center",fontWeight:700,fontSize:14,color:"#1C1C1E"}}>{MONTHS[filterMonthNum]} {filterYear}</div>
        <button onClick={()=>{ if(filterMonthNum===11){setFilterMonthNum(0);setFilterYear(y=>y+1);}else setFilterMonthNum(m=>m+1); }} style={{background:"#FDF8F3",border:"1px solid #EDE0D0",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:16}}>›</button>
      </div>
      {sorted.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 0",color:"#8B7355"}}>
          <div style={{fontSize:44,marginBottom:10}}>💸</div>
          <div style={{fontWeight:600}}>{search?"No hay gastos que coincidan":"No hay gastos registrados"}</div>
        </div>
      ) : sorted.map(g=>(
        <div key={g.id} style={{...card,padding:"12px 16px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,color:"#1C1C1E"}}>{g.concepto}</div>
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                {fmtDate(g.fecha)} · <span style={{fontWeight:600,color:CAT_COLORS[g.categoria]||"#8B7355"}}>{g.categoria}</span>
                {g.metodo && <span> · {g.metodo}</span>}
              </div>
            </div>
            <div style={{fontWeight:700,fontSize:15,color:"#DC2626",flexShrink:0}}>-{fmtCurrency(g.monto)}</div>
          </div>
          {confirmDelete===g.id ? (
            <div style={{display:"flex",gap:8,marginTop:8,padding:"8px 10px",background:"#FEF2F2",borderRadius:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#DC2626",fontWeight:600,flex:1}}>¿Eliminar este gasto?</span>
              <button onClick={()=>{onDeleteGasto(g);setConfirmDelete(null);}} style={{padding:"4px 12px",background:"#DC2626",color:"#FFF",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Sí, eliminar</button>
              <button onClick={()=>setConfirmDelete(null)} style={{padding:"4px 12px",background:"#F3F4F6",color:"#6B7280",border:"none",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>No</button>
            </div>
          ) : (
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <button onClick={()=>onEditGasto(g)} style={{fontSize:11,color:"#C4602B",background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:600}}>✏️ Editar</button>
              <button onClick={()=>setConfirmDelete(g.id)} style={{fontSize:11,color:"#9CA3AF",background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:600}}>🗑 Eliminar</button>
            </div>
          )}
        </div>
      ))}
      <div style={{marginTop:20,textAlign:"center"}}><Btn onClick={onNewGasto}>+ Registrar Gasto</Btn></div>
    </div>
  );
}
