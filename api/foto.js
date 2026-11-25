import {guardarFoto, tokenValido, json} from "./_lib.js";

const TIPOS = ["image/webp","image/jpeg","image/png"];
const MAX = 3 * 1024 * 1024;

// POST /api/foto (cuerpo = la imagen ya achicada por el navegador) → {url}
export async function POST(request){
  if(!tokenValido(request)) return json({error:"Tu sesión venció: ingresá de nuevo"}, 401);
  const tipo = (request.headers.get("content-type") || "").split(";")[0].trim();
  if(!TIPOS.includes(tipo)) return json({error:"Ese formato no sirve: usá JPG, PNG o WEBP"}, 415);
  const buf = Buffer.from(await request.arrayBuffer());
  if(!buf.length) return json({error:"La foto llegó vacía"}, 400);
  if(buf.length > MAX) return json({error:"La foto es muy pesada (máximo 3 MB)"}, 413);
  try{ return json({url: await guardarFoto(buf, tipo)}); }
  catch(e){ console.error(e); return json({error:"No se pudo guardar la foto. ¿Está conectado el almacenamiento Blob en Vercel?"}, 500); }
}
