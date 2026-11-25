import {leerPedidos, borrarPedido, tokenValido, inicioDia, json} from "./_lib.js";

const DIA = 86400000;
// GET /api/pedidos?desde=2026-11-01&hasta=2026-11-30 → pedidos de ese período (fechas inclusive, hora de Argentina)
export async function GET(request){
  if(!tokenValido(request)) return json({error:"Tu sesión venció: ingresá de nuevo"}, 401);
  const u = new URL(request.url);
  const desde = inicioDia(u.searchParams.get("desde")), hasta = inicioDia(u.searchParams.get("hasta"));
  if(isNaN(desde) || isNaN(hasta) || hasta < desde) return json({error:"Elegí un rango de fechas válido"}, 400);
  if(hasta - desde > 10 * 366 * DIA) return json({error:"El rango máximo es de 10 años"}, 400);
  try{ return json({pedidos: await leerPedidos(desde, hasta + DIA - 1)}); }
  catch(e){ console.error(e); return json({error:"No se pudieron leer los pedidos"}, 500); }
}

// DELETE /api/pedidos?id=... → borra un pedido (por ejemplo, uno de prueba)
export async function DELETE(request){
  if(!tokenValido(request)) return json({error:"Tu sesión venció: ingresá de nuevo"}, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if(!/^[\w-]{8,64}$/.test(id)) return json({error:"Pedido inválido"}, 400);
  try{ return json({ok: await borrarPedido(id)}); }
  catch(e){ console.error(e); return json({error:"No se pudo borrar"}, 500); }
}
