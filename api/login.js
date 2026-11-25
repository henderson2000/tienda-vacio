import {credencialesValidas, crearToken, json} from "./_lib.js";

// POST /api/login {usuario, clave} → token de sesión por 12 horas
export async function POST(request){
  let b = {};
  try{ b = await request.json(); }catch(e){}
  if(!credencialesValidas(b.usuario, b.clave)){
    await new Promise(r => setTimeout(r, 600));   // frena intentos repetidos
    return json({error:"Usuario o contraseña incorrectos."}, 401);
  }
  return json({token: crearToken()});
}
