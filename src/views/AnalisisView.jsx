import { useState, useMemo } from "react";
import { fmtCurrency, getTotalExtras } from "../lib/utils.js";
import { MONTHS_SHORT } from "../lib/constants.js";

const HIST_2025 = {
  "2025-09": { eventos: 0, facturacion: 0 },
  "2025-10": { eventos: 2, facturacion: 680000 },
  "2025-11": { eventos: 14, facturacion: 4760000 },
  "2025-12": { eventos: 20, facturacion: 6800000 },
  "2026-01": { eventos: 21, facturacion: 7140000 },
  "2026-02": { eventos: 16, facturacion: 5440000 },
  "2026-03": { eventos: 10, facturacion: 3400000 },
  "2026-04": { eventos: 4, facturacion: 1360000 },
};
const HIST_TOTAL_EV = 87;
const HIST_TOTAL_FAC = 29580000;
const HIST_PROM = Math.round(HIST_TOTAL_FAC / HIST_TOTAL_EV);

const SEASON_MONTHS = ["09","10","11","12","01","02","03","04"];
const seasonKey = (y, m) => `${m <= 4 ? y : y}-${String(m).padStart(2,"0")}`;
const seasonYear = (y, m) => m >= 9 ? y : y - 1;

function getSeasonRange(baseYear) {
  const months = [];
  for (let m = 9; m <= 12; m++) months.push({ year: baseYear, month: m, key: `${baseYear}-${String(m).padStart(2,"0")}` });
  for (let m = 1; m <= 4; m++) months.push({ year: baseYear + 1, month: m, key: `${baseYear + 1}-${String(m).padStart(2,"0")}` });
  return months;
}

function Bar({ value, max, color, height = 28 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: "100%", background: "var(--qb-border)", borderRadius: 6, height, overflow: "hidden", position: "relative" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.6s ease" }} />
      {value > 0 && (
        <span style={{ position: "absolute", top: "50%", left: pct > 15 ? `${pct / 2}%` : `${pct + 2}%`, transform: "translate(-50%,-50%)", fontSize: 11, fontWeight: 800, color: pct > 15 ? "#FFF" : "var(--qb-text3)" }}>
          {value}
        </span>
      )}
    </div>
  );
}

function MiniBar({ val, max, color, label }) {
  const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      <div style={{ width: 32, fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", textAlign: "right", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 18, background: "var(--qb-border)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ width: 28, fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", flexShrink: 0 }}>{val}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: "var(--qb-bg-card)", border: "1px solid var(--qb-border)", borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "var(--qb-text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: accent || "var(--qb-text)", marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--qb-text2)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ProgressRing({ pct, size = 110, stroke = 10, color, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--qb-border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export default function AnalisisView({ reservas, pagos, extrasReserva, serviciosExtras, gastos, negocio }) {
  const today = new Date();
  const currentSeasonStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;

  const [meta, setMeta] = useState(() => {
    try { const s = localStorage.getItem("qb_metas"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [editMeta, setEditMeta] = useState(!meta);
  const [metaForm, setMetaForm] = useState({ eventos: meta?.eventos || "100", facturacion: meta?.facturacion || "50000000" });

  const saveMeta = () => {
    const m = { eventos: Number(metaForm.eventos) || 100, facturacion: Number(metaForm.facturacion) || 50000000 };
    localStorage.setItem("qb_metas", JSON.stringify(m));
    setMeta(m);
    setEditMeta(false);
  };

  const seasonMonths = getSeasonRange(currentSeasonStart);
  const prevSeasonMonths = getSeasonRange(currentSeasonStart - 1);

  const currentData = useMemo(() => {
    const data = {};
    const validStates = ["pendiente", "senada", "confirmada", "finalizada"];
    const filtered = reservas.filter(r => validStates.includes(r.estado) && r.fecha);
    filtered.forEach(r => {
      const mk = r.fecha.slice(0, 7);
      if (!data[mk]) data[mk] = { eventos: 0, facturacion: 0 };
      data[mk].eventos++;
      data[mk].facturacion += (r.montoPactado || 0) + getTotalExtras(r.id, extrasReserva);
    });
    return data;
  }, [reservas, extrasReserva]);

  const totalEventos = useMemo(() => {
    return seasonMonths.reduce((s, m) => s + (currentData[m.key]?.eventos || 0), 0);
  }, [currentData, seasonMonths]);

  const totalFac = useMemo(() => {
    return seasonMonths.reduce((s, m) => s + (currentData[m.key]?.facturacion || 0), 0);
  }, [currentData, seasonMonths]);

  const ticketProm = totalEventos > 0 ? Math.round(totalFac / totalEventos) : 0;

  const prevTotalEventos = prevSeasonMonths.reduce((s, m) => s + (HIST_2025[m.key]?.eventos || 0), 0);

  const monthsPassed = seasonMonths.filter(m => {
    const d = new Date(m.year, m.month - 1, 1);
    return d <= today;
  }).length;

  const prevAtThisPoint = (() => {
    let sum = 0;
    for (let i = 0; i < monthsPassed && i < prevSeasonMonths.length; i++) {
      sum += HIST_2025[prevSeasonMonths[i].key]?.eventos || 0;
    }
    return sum;
  })();

  const projection = monthsPassed > 0 ? Math.round((totalEventos / monthsPassed) * 8) : 0;
  const projectionFac = monthsPassed > 0 ? Math.round((totalFac / monthsPassed) * 8) : 0;

  const maxMonthly = Math.max(
    ...seasonMonths.map(m => currentData[m.key]?.eventos || 0),
    ...prevSeasonMonths.map(m => HIST_2025[m.key]?.eventos || 0),
    1
  );

  const metaEventos = meta?.eventos || 100;
  const metaFac = meta?.facturacion || 50000000;
  const pctEventos = Math.round((totalEventos / metaEventos) * 100);
  const pctFac = Math.round((totalFac / metaFac) * 100);

  const eventosRestantes = Math.max(0, metaEventos - totalEventos);
  const mesesRestantes = Math.max(1, 8 - monthsPassed);
  const necesitasPorMes = Math.ceil(eventosRestantes / mesesRestantes);

  const insights = useMemo(() => {
    const list = [];
    const diff = totalEventos - prevAtThisPoint;
    if (diff > 0) list.push({ icon: "📈", text: `Llevás ${diff} reservas más que a esta altura del año pasado`, type: "good" });
    else if (diff < 0) list.push({ icon: "⚠️", text: `Vas ${Math.abs(diff)} reservas por debajo del año pasado a esta fecha`, type: "warn" });
    else list.push({ icon: "🔄", text: "Vas al mismo ritmo que el año pasado", type: "neutral" });

    if (ticketProm > HIST_PROM) {
      const mejora = Math.round(((ticketProm - HIST_PROM) / HIST_PROM) * 100);
      list.push({ icon: "💰", text: `Tu ticket promedio subió un ${mejora}% vs 2025 (${fmtCurrency(HIST_PROM)} → ${fmtCurrency(ticketProm)})`, type: "good" });
    }

    const earlyMonths = seasonMonths.slice(0, 2);
    const earlyNow = earlyMonths.reduce((s, m) => s + (currentData[m.key]?.eventos || 0), 0);
    const earlyPrev = earlyMonths.reduce((s, m) => s + (HIST_2025[m.key]?.eventos || 0), 0);
    if (earlyNow > earlyPrev && earlyPrev > 0) {
      list.push({ icon: "🌱", text: `Temporada baja mejoró ${Math.round(((earlyNow - earlyPrev) / earlyPrev) * 100)}%: de ${earlyPrev} a ${earlyNow} eventos (Sep-Oct)`, type: "good" });
    }

    if (eventosRestantes > 0) {
      list.push({ icon: "🎯", text: `Necesitás ~${necesitasPorMes} reservas/mes en los ${mesesRestantes} meses que quedan para llegar a ${metaEventos}`, type: "neutral" });
    } else {
      list.push({ icon: "🏆", text: `Ya alcanzaste tu meta de ${metaEventos} reservas`, type: "good" });
    }

    if (projection > 0) {
      list.push({ icon: "🔮", text: `Al ritmo actual, proyectás ${projection} reservas y ${fmtCurrency(projectionFac)} esta temporada`, type: projection >= metaEventos ? "good" : "warn" });
    }

    return list;
  }, [totalEventos, prevAtThisPoint, ticketProm, currentData, seasonMonths, eventosRestantes, necesitasPorMes, mesesRestantes, metaEventos, projection, projectionFac]);

  const card = { background: "var(--qb-bg-card)", borderRadius: 16, border: "1px solid var(--qb-border)", boxShadow: "var(--qb-shadow)" };
  const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--qb-text)", fontFamily: "'Playfair Display',serif" }}>Análisis</div>
        <div style={{ fontSize: 12, color: "var(--qb-text2)", marginTop: 2 }}>Temporada {currentSeasonStart}/{currentSeasonStart + 1}</div>
      </div>

      {/* ── BLOQUE 1: OBJETIVOS ── */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--qb-text)" }}>🎯 Objetivos de temporada</div>
          <button onClick={() => { setMetaForm({ eventos: String(meta?.eventos || 100), facturacion: String(meta?.facturacion || 50000000) }); setEditMeta(true); }}
            style={{ background: "none", border: "1px solid var(--qb-border)", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "var(--qb-accent)", cursor: "pointer", fontFamily: "inherit" }}>
            ✏️ Editar
          </button>
        </div>

        {editMeta ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", display: "block", marginBottom: 4 }}>Meta de reservas</label>
              <input type="number" value={metaForm.eventos} onChange={e => setMetaForm(p => ({ ...p, eventos: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--qb-border)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--qb-input-bg)", color: "var(--qb-text)" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", display: "block", marginBottom: 4 }}>Meta de facturación ($)</label>
              <input type="number" value={metaForm.facturacion} onChange={e => setMetaForm(p => ({ ...p, facturacion: e.target.value }))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--qb-border)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--qb-input-bg)", color: "var(--qb-text)" }} />
            </div>
            <button onClick={saveMeta}
              style={{ padding: "10px", background: "var(--qb-accent)", color: "#FFF", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Guardar metas
            </button>
          </div>
        ) : (
          <>
            {/* Doble ring */}
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 20 }}>
              <div style={{ textAlign: "center" }}>
                <ProgressRing pct={pctEventos} color="var(--qb-accent)">
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--qb-accent)" }}>{totalEventos}</div>
                  <div style={{ fontSize: 9, color: "var(--qb-text2)", fontWeight: 700 }}>/{metaEventos}</div>
                </ProgressRing>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", marginTop: 6 }}>Reservas</div>
                <div style={{ fontSize: 10, color: "var(--qb-text2)" }}>{pctEventos}% completado</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ProgressRing pct={pctFac} color="#16A34A">
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#16A34A" }}>{(totalFac / 1000000).toFixed(1)}M</div>
                  <div style={{ fontSize: 9, color: "var(--qb-text2)", fontWeight: 700 }}>/{(metaFac / 1000000).toFixed(0)}M</div>
                </ProgressRing>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--qb-text3)", marginTop: 6 }}>Facturación</div>
                <div style={{ fontSize: 10, color: "var(--qb-text2)" }}>{pctFac}% completado</div>
              </div>
            </div>

            {/* Context line */}
            <div style={{ textAlign: "center", padding: "10px 14px", background: "var(--qb-bg-card-alt)", borderRadius: 10, fontSize: 12, color: "var(--qb-text3)" }}>
              <span style={{ fontWeight: 800 }}>{totalEventos}</span> reservas esta temporada — el año pasado a esta altura ibas <span style={{ fontWeight: 800 }}>{prevAtThisPoint}</span>
              {totalEventos > prevAtThisPoint && <span style={{ color: "#16A34A", fontWeight: 700 }}> (+{totalEventos - prevAtThisPoint})</span>}
              {totalEventos < prevAtThisPoint && <span style={{ color: "#DC2626", fontWeight: 700 }}> ({totalEventos - prevAtThisPoint})</span>}
            </div>
          </>
        )}
      </div>

      {/* ── BLOQUE 2: COMPARATIVA MES A MES ── */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--qb-text)", marginBottom: 4 }}>📊 Comparativa mes a mes</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--qb-text2)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--qb-accent-light)" }} /> {currentSeasonStart - 1}/{currentSeasonStart}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--qb-text2)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--qb-accent)" }} /> {currentSeasonStart}/{currentSeasonStart + 1}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {seasonMonths.map((m, i) => {
            const prev = HIST_2025[prevSeasonMonths[i]?.key]?.eventos || 0;
            const curr = currentData[m.key]?.eventos || 0;
            const diff = curr - prev;
            const monthDate = new Date(m.year, m.month - 1, 1);
            const isPast = monthDate < new Date(today.getFullYear(), today.getMonth(), 1);
            const isCurrent = m.month === (today.getMonth() + 1) && m.year === today.getFullYear();
            return (
              <div key={m.key} style={{ opacity: (!isPast && !isCurrent && curr === 0) ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? "var(--qb-accent)" : "var(--qb-text3)" }}>
                    {monthNames[m.month]} {isCurrent && "← ahora"}
                  </div>
                  {(isPast || isCurrent) && diff !== 0 && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: diff > 0 ? "#16A34A" : "#DC2626", background: diff > 0 ? "var(--qb-st-confirmada-bg)" : "var(--qb-st-cancelada-bg)", padding: "1px 6px", borderRadius: 4 }}>
                      {diff > 0 ? "+" : ""}{diff}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  <div style={{ flex: 1 }}>
                    <MiniBar val={prev} max={maxMonthly} color="var(--qb-accent-light)" label="" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <MiniBar val={curr} max={maxMonthly} color="var(--qb-accent)" label="" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--qb-border)", display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "var(--qb-text2)" }}>Total temporada anterior: <span style={{ fontWeight: 800, color: "var(--qb-text3)" }}>{HIST_TOTAL_EV}</span></div>
          <div style={{ fontSize: 12, color: "var(--qb-text2)" }}>Esta temporada: <span style={{ fontWeight: 800, color: "var(--qb-accent)" }}>{totalEventos}</span></div>
        </div>
      </div>

      {/* ── BLOQUE 2B: ACUMULADO ── */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--qb-text)", marginBottom: 14 }}>📈 Reservas acumuladas</div>
        {(() => {
          let accPrev = 0, accCurr = 0;
          const rows = seasonMonths.map((m, i) => {
            accPrev += HIST_2025[prevSeasonMonths[i]?.key]?.eventos || 0;
            accCurr += currentData[m.key]?.eventos || 0;
            const isCurrent = m.month === (today.getMonth() + 1) && m.year === today.getFullYear();
            const monthDate = new Date(m.year, m.month - 1, 1);
            const isPast = monthDate < new Date(today.getFullYear(), today.getMonth(), 1);
            return { month: monthNames[m.month], accPrev, accCurr, isCurrent, show: isPast || isCurrent || accCurr > 0 };
          });
          const maxAcc = Math.max(metaEventos, HIST_TOTAL_EV, totalEventos, 1);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.filter(r => r.show).map((r, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, fontWeight: r.isCurrent ? 800 : 600, color: r.isCurrent ? "var(--qb-accent)" : "var(--qb-text3)", marginBottom: 2 }}>
                    {r.month} {r.isCurrent && "←"}
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <div style={{ flex: 1 }}><MiniBar val={r.accPrev} max={maxAcc} color="var(--qb-accent-light)" label="" /></div>
                    <div style={{ flex: 1 }}><MiniBar val={r.accCurr} max={maxAcc} color="var(--qb-accent)" label="" /></div>
                  </div>
                </div>
              ))}
              {meta && (
                <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px dashed var(--qb-border)", fontSize: 11, color: "var(--qb-text2)", textAlign: "center" }}>
                  Meta: {metaEventos} reservas · Proyección: <span style={{ fontWeight: 800, color: projection >= metaEventos ? "#16A34A" : "#DC2626" }}>{projection}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── BLOQUE 3: INDICADORES ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard icon="🎫" label="Ticket promedio" value={fmtCurrency(ticketProm)}
          sub={`2025: ${fmtCurrency(HIST_PROM)}`}
          accent={ticketProm >= HIST_PROM ? "#16A34A" : "#DC2626"} />
        <StatCard icon="📅" label="Eventos/mes" value={(monthsPassed > 0 ? (totalEventos / monthsPassed).toFixed(1) : "—")}
          sub={`2025: ${(HIST_TOTAL_EV / 8).toFixed(1)}/mes`}
          accent="#C4602B" />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard icon="💵" label="Facturado" value={`${(totalFac / 1000000).toFixed(1)}M`}
          sub={`2025: ${(HIST_TOTAL_FAC / 1000000).toFixed(1)}M`}
          accent="#16A34A" />
        <StatCard icon="🔮" label="Proyección" value={`${(projectionFac / 1000000).toFixed(1)}M`}
          sub={`Meta: ${(metaFac / 1000000).toFixed(0)}M`}
          accent={projectionFac >= metaFac ? "#16A34A" : "#D97706"} />
      </div>

      {/* ── BLOQUE 4: INSIGHTS ── */}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--qb-text)", marginBottom: 12 }}>💡 Panorama</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10,
              background: ins.type === "good" ? "var(--qb-cobro-bg)" : ins.type === "warn" ? "var(--qb-accent-bg)" : "var(--qb-bg-card-alt)",
              border: `1px solid ${ins.type === "good" ? "var(--qb-cobro-border)" : ins.type === "warn" ? "var(--qb-accent-light)" : "var(--qb-border)"}`
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{ins.icon}</span>
              <span style={{ fontSize: 13, color: "var(--qb-text3)", lineHeight: 1.4 }}>{ins.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", fontSize: 10, color: "var(--qb-text2)", padding: "8px 0" }}>
        Datos 2025 cargados manualmente · Datos {currentSeasonStart}/{currentSeasonStart + 1} calculados en tiempo real
      </div>
    </div>
  );
}
