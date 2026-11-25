import {leerCatalogo, guardarCatalogo, tokenValido, validar, json} from "./_lib.js";

// GET /api/tienda → catálogo actual. La red de Vercel guarda la respuesta 15 s para no consultar la base en cada visita.
export async function GET(){
  try{ return json(await leerCatalogo(), 200, "public, max-age=0, s-maxage=15, stale-while-revalidate=60"); }
  catch(e){ console.error(e); return json({error:"No se pudo leer el catálogo"}, 500); }
}

// PUT /api/tienda → guarda cambios del panel (requiere sesión)
export async function PUT(request){
  if(!tokenValido(request)) return json({error:"Tu sesión venció: ingresá de nuevo"}, 401);
  let cuerpo;
  try{ cuerpo = await request.json(); }catch(e){ return json({error:"Datos inválidos"}, 400); }
  if(JSON.stringify(cuerpo).length > 400_000) return json({error:"Demasiados datos"}, 413);
  const datos = validar(cuerpo);
  if(!datos) return json({error:"Revisá los datos: falta alguna categoría o producto"}, 400);
  try{ const version = await guardarCatalogo(datos); return json({ok:true, version, datos}); }
  catch(e){ console.error(e); return json({error:"No se pudo guardar. ¿Está conectada la base de datos en Vercel?"}, 500); }
}
