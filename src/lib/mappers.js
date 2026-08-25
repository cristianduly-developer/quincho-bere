import { getCurrentOrgId } from "./supabase.js";

export function mapReserva(r){
  const org = r.orgId || getCurrentOrgId();
  return {id:r.id,org_id:org,cliente_id:r.clienteId,recurso_id:r.recursoId,turno_id:r.turnoId||null,fecha:r.fecha,turno:r.turno,horario:r.horario||"",horario_fin:r.horarioFin||"",cant_invitados:r.cantInvitados||35,monto_pactado:r.montoPactado||0,estado:r.estado||"pendiente",notas:r.notas||"",creado_por:r.creadoPor||"",creado_en:r.creadoEn||new Date().toISOString(),fecha_creacion:r.fechaCreacion||null,recordatorio_enviado:!!r.recordatorioEnviado,post_evento_procesado:!!r.postEventoProcesado,calificacion:r.calificacion||null,proximo_pago_fecha:r.proximoPagoFecha||null,proximo_pago_monto:r.proximoPagoMonto||null,tipo_evento:r.tipoEvento||null,fecha_visita:r.fechaVisita||null,hora_visita:r.horaVisita||null,seguimiento_descartado:!!r.seguimientoDescartado,motivo_no_concreto:r.motivoNoConcreto||null,nombre_evento:r.nombreEvento||null,share_token:r.shareToken||null,share_sections:r.shareSections||null,share_message:r.shareMessage||null,share_theme:r.shareTheme||"verde",share_hero_url:r.shareHeroUrl||null,regalo_descuento:r.regaloDescuento||null,regalo_enviado_en:r.regaloEnviadoEn||null,sobre_digital:r.sobreDigital||null,edit_token:r.editToken||null,mercado_activo:!!r.mercadoActivo};
}
export function mapCliente(c){
  const org = c.orgId || getCurrentOrgId();
  return {id:c.id,org_id:org,nombre:c.nombre||"",apellido:c.apellido||"",whatsapp:c.whatsapp||"",email:c.email||"",localidad:c.localidad||"",notas_internas:c.notasInternas||"",estado_crm:c.estadoCrm||null,origen:c.origen||null,creado_en:c.creadoEn||new Date().toISOString()};
}
export function mapPago(p){
  const org = p.orgId || getCurrentOrgId();
  return {id:p.id,org_id:org,reserva_id:p.reservaId,monto:p.monto||0,fecha:p.fecha,metodo:p.metodo||"Transferencia",notas:p.notas||"",comprobante:p.comprobante||"",creado_por:p.creadoPor||"",creado_en:p.creadoEn||new Date().toISOString()};
}
export function mapGasto(g){
  const org = g.orgId || getCurrentOrgId();
  return {id:g.id,org_id:org,concepto:g.concepto||"",monto:g.monto||0,fecha:g.fecha,categoria:g.categoria||"Otros",metodo:g.metodo||"Efectivo",creado_por:g.creadoPor||"",creado_en:g.creadoEn||new Date().toISOString()};
}
export function mapExtra(e){
  const org = e.orgId || getCurrentOrgId();
  return {id:e.id,org_id:org,reserva_id:e.reservaId,servicio_id:e.servicioId||null,descripcion:e.descripcion||"",cantidad:e.cantidad||1,precio_historico:e.precioHistorico||0,creado_en:e.creadoEn||new Date().toISOString()};
}
export function mapConsulta(c){
  const org = c.orgId || getCurrentOrgId();
  return {id:c.id,org_id:org,fecha:c.fecha,canal:c.canal||"Otro",cantidad:c.cantidad||1,creado_en:c.creadoEn||new Date().toISOString()};
}
export function mapMercadoProducto(p){
  const org = p.orgId || getCurrentOrgId();
  return {id:p.id,org_id:org,nombre:p.nombre||"",emoji:p.emoji||"📦",precio:p.precio||0,orden:p.orden||0,activo:p.activo!==false,creado_en:p.creadoEn||new Date().toISOString()};
}
export function mapMercadoPedido(p){
  const org = p.orgId || getCurrentOrgId();
  return {id:p.id,org_id:org,reserva_id:p.reservaId,producto_nombre:p.productoNombre||"",producto_emoji:p.productoEmoji||"📦",cantidad:p.cantidad||1,precio_unitario:p.precioUnitario||0,total:p.total||0,estado:p.estado||"pendiente",creado_en:p.creadoEn||new Date().toISOString()};
}
export function mapBloqueo(b){
  const org = b.orgId || getCurrentOrgId();
  return {id:b.id,org_id:org,fecha:b.fecha,turno:b.turno,motivo:b.motivo||"",creado_por:b.creadoPor||"",creado_en:b.creadoEn||new Date().toISOString()};
}
export function mapTarea(t){
  const org = t.orgId || getCurrentOrgId();
  return {id:t.id,org_id:org,descripcion:t.descripcion||"",estado:t.estado||"pendiente",fecha_registro:t.fechaRegistro||null,creado_por:t.creadoPor||"",creado_en:t.creadoEn||new Date().toISOString()};
}
export function mapRecordatorio(r){
  const org = r.orgId || getCurrentOrgId();
  return {id:r.id,org_id:org,reserva_id:r.reservaId||null,cliente_id:r.clienteId||null,tipo:r.tipo||"",nota:r.nota||"",fecha_alerta:r.fechaAlerta,hora_alerta:r.horaAlerta||"09:00",estado:r.estado||"Pendiente",creado_en:r.creadoEn||new Date().toISOString()};
}
export function mapUsuario(u){
  return {id:u.id,nombre:u.nombre||"",apellido:u.apellido||"",email:u.email||"",whatsapp:u.whatsapp||"",puesto:u.puesto||"",rol:u.rol||"Personal",estado:u.estado||"Activo",permiso_root:!!u.permisoRoot,ver_finanzas:!!u.verFinanzas,modificar_caja:!!u.modificarCaja,gestion_operativa:!!u.gestionOperativa};
}
