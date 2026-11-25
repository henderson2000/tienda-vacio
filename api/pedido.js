import {leerCatalogo, guardarPedido, armarPedido, permitir, json} from "./_lib.js";

// POST /api/pedido → registra el pedido que el cliente manda por WhatsApp (público, sin sesión)
export async function POST(request){
  let b;
  try{ b = await request.json(); }catch(e){ return json({error:"Pedido inválido"}, 400); }
  if(JSON.stringify(b).length > 30_000) return json({error:"Pedido demasiado grande"}, 413);
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  try{
    if(!(await permitir(ip))) return json({error:"Demasiados pedidos seguidos. Esperá un minuto."}, 429);
    const {datos} = await leerCatalogo();
    const r = armarPedido(b, datos);
    if(r.error) return json({error:r.error}, 400);
    const nuevo = await guardarPedido(r.pedido);
    return json({ok:true, nuevo, total:r.pedido.total});
  }catch(e){ console.error(e); return json({error:"No se pudo registrar el pedido"}, 500); }
}
