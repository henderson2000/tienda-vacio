// Utilidades compartidas por las funciones de /api
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// ---------- Almacenamiento ----------
// Catálogo y pedidos: Redis (Upstash, vía su API REST). Fotos: Vercel Blob.
// Sin Redis configurado (pruebas en la compu) se usa un archivo en .datos-local.
const TOKEN_BLOB = process.env.BLOB_READ_WRITE_TOKEN;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), ".datos-local");
const P = (process.env.PREFIJO || "tienda").replace(/[^\w-]/g, "") + ":";   // cambia si dos negocios comparten la misma base
const K = { catalogo:P + "catalogo", fechas:P + "pedidos:fechas", pedidos:P + "pedidos:datos" };
export const hayRedis = !!(REDIS_URL && REDIS_TOKEN);

async function blob(){ return await import("@vercel/blob"); }

// Ejecuta varios comandos de Redis en un solo viaje. Devuelve los resultados en orden.
async function redis(...cmds){
  if(hayRedis){
    const r = await fetch(REDIS_URL.replace(/\/$/,"") + "/pipeline", {method:"POST",
      headers:{Authorization:"Bearer " + REDIS_TOKEN, "Content-Type":"application/json"}, body: JSON.stringify(cmds)});
    if(!r.ok) throw new Error("Redis respondió " + r.status);
    const out = await r.json();
    out.forEach(x => { if(x.error) throw new Error("Redis: " + x.error); });
    return out.map(x => x.result);
  }
  return memoria(cmds);
}
// Mini-Redis en un archivo, solo para probar sin Vercel.
let cola = Promise.resolve();
function memoria(cmds){
  if(process.env.VERCEL) return Promise.reject(new Error("Falta conectar la base de datos Redis (Upstash) al proyecto en Vercel"));
  const tarea = cola.then(async () => {
    const f = path.join(LOCAL_DIR, "redis.json");
    let db = {};
    try{ db = JSON.parse(await fs.readFile(f, "utf8")); }catch(e){}
    const z = k => (db[k] ||= {}), h = k => (db[k] ||= {});
    const res = cmds.map(([c, k, ...a]) => {
      switch(c.toUpperCase()){
        case "GET": return db[k] ?? null;
        case "SET": { if(a.includes("NX") && k in db) return null; db[k] = a[0]; return "OK"; }
        case "INCR": db[k] = String((+db[k] || 0) + 1); return +db[k];
        case "EXPIRE": return 1;
        case "HSETNX": { const m = h(k); if(a[0] in m) return 0; m[a[0]] = a[1]; return 1; }
        case "HMGET": return a.map(x => h(k)[x] ?? null);
        case "HDEL": return a.filter(x => delete h(k)[x]).length;
        case "ZADD": { z(k)[a[1]] = +a[0]; return 1; }
        case "ZREM": return a.filter(x => delete z(k)[x]).length;
        case "ZRANGE": { // ZRANGE k min max BYSCORE
          const [min, max] = a.map(Number); return Object.entries(z(k)).filter(([,s]) => s >= min && s <= max).sort((x,y) => x[1]-y[1]).map(([m]) => m); }
        default: throw new Error("comando no simulado: " + c);
      }
    });
    await fs.mkdir(LOCAL_DIR, {recursive:true});
    await fs.writeFile(f, JSON.stringify(db));
    return res;
  });
  cola = tarea.catch(() => {});
  return tarea;
}

// Catálogo
export async function leerCatalogo(){
  const [raw] = await redis(["GET", K.catalogo]);
  if(raw){ const c = JSON.parse(raw); return {datos:c.datos, version:c.version}; }
  // Primera vez con Redis: se trae lo último que había guardado en Blob (versión anterior de la página).
  if(hayRedis && TOKEN_BLOB){
    try{
      const {list} = await blob();
      const {blobs} = await list({prefix:"tienda/catalogo-", limit:1000});
      if(blobs.length){
        blobs.sort((a,b) => a.pathname < b.pathname ? -1 : 1);
        const r = await fetch(blobs[blobs.length-1].url, {cache:"no-store"});
        if(r.ok){ const datos = await r.json(); const version = await guardarCatalogo(datos); return {datos, version}; }
      }
    }catch(e){ console.error("migración desde Blob", e); }
  }
  return {datos:null, version:""};
}
export async function guardarCatalogo(datos){
  const version = Date.now().toString().padStart(15, "0") + "-" + crypto.randomBytes(3).toString("hex");
  await redis(["SET", K.catalogo, JSON.stringify({version, datos})]);
  return version;
}

// Pedidos: cada pedido se guarda una vez (si llega repetido, se ignora) y se indexa por fecha.
export async function guardarPedido(p){
  const [nuevo] = await redis(["HSETNX", K.pedidos, p.id, JSON.stringify(p)]);
  if(nuevo) await redis(["ZADD", K.fechas, String(p.ts), p.id]);
  return !!nuevo;
}
export async function leerPedidos(desde, hasta){
  const [ids] = await redis(["ZRANGE", K.fechas, String(desde), String(hasta), "BYSCORE"]);
  if(!ids || !ids.length) return [];
  const lista = [];
  for(let i = 0; i < ids.length; i += 500){
    const [jsons] = await redis(["HMGET", K.pedidos, ...ids.slice(i, i+500)]);
    jsons.forEach(j => { if(j) try{ lista.push(JSON.parse(j)); }catch(e){} });
  }
  return lista.sort((a,b) => b.ts - a.ts);
}
export async function borrarPedido(id){
  const [a] = await redis(["ZREM", K.fechas, id], ["HDEL", K.pedidos, id]);
  return !!a;
}
// Límite simple de pedidos por minuto y por IP (frena a quien quiera llenar el historial de basura)
export async function permitir(ip, max = 10){
  const k = `${P}rl:${ip}:${Math.floor(Date.now()/60000)}`;
  const [n] = await redis(["INCR", k], ["EXPIRE", k, "120"]);
  return n <= max;
}

// Fotos
export const hayBlob = !!TOKEN_BLOB;
export async function guardarFoto(buffer, tipo){
  const ext = {"image/webp":"webp","image/jpeg":"jpg","image/png":"png","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"}[tipo];
  const nombre = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  if(!TOKEN_BLOB){
    await fs.mkdir(path.join(LOCAL_DIR, "fotos"), {recursive:true});
    await fs.writeFile(path.join(LOCAL_DIR, "fotos", nombre), buffer);
    return "/_local/" + nombre;
  }
  const {put} = await blob();
  const r = await put("fotos/" + nombre, buffer, {access:"public", contentType:tipo, addRandomSuffix:false});
  return r.url;
}

// ---------- Sesión del panel ----------
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
const sha = t => crypto.createHash("sha256").update(t).digest("hex");
// Usuario y contraseña de cada negocio: se definen en Vercel con ADMIN_USUARIO y ADMIN_CLAVE.
// Sin esas variables nadie puede entrar al panel (salvo en la compu, con "prueba" / "prueba").
const CREDENCIAL = process.env.ADMIN_USUARIO && process.env.ADMIN_CLAVE
  ? sha(norm(process.env.ADMIN_USUARIO) + "|" + norm(process.env.ADMIN_CLAVE))
  : (process.env.VERCEL ? "" : sha("prueba|prueba"));
const SECRETO = process.env.SESSION_SECRET || TOKEN_BLOB || "solo-para-pruebas-locales";
const DURACION = 12 * 60 * 60 * 1000; // 12 horas

export function credencialesValidas(usuario, clave){
  const a = Buffer.from(sha(norm(usuario) + "|" + norm(clave))), b = Buffer.from(CREDENCIAL);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function crearToken(){
  const vence = Date.now() + DURACION;
  const firma = crypto.createHmac("sha256", SECRETO).update("admin." + vence).digest("hex");
  return `${vence}.${firma}`;
}
export function tokenValido(request){ return tokenTextoValido((request.headers.get("authorization") || "").replace(/^Bearer /, "")); }
export function tokenTextoValido(t){
  const m = String(t || "").match(/^(\d+)\.([a-f0-9]{64})$/);
  if(!m || +m[1] < Date.now()) return false;
  const esperado = Buffer.from(crypto.createHmac("sha256", SECRETO).update("admin." + m[1]).digest("hex"));
  const dado = Buffer.from(m[2]);
  return esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado);
}

// ---------- Validación de lo que manda el panel ----------
const txt = (v, max) => String(v ?? "").slice(0, max);
const esArchivo = f => typeof f === "string" && (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[\w\-./%]+$/i.test(f) || /^\/_local\/[\w\-.]+$/.test(f));
const esFoto = f => typeof f === "string" && (/^[a-f0-9]{12}$/.test(f) || esArchivo(f));
// Portada: diapositivas con imagen o video, texto y botón
function validarPortada(p){
  const slides = Array.isArray(p?.slides) ? p.slides : [];
  return {slides: slides.slice(0, 8).filter(x => x && /^[\w-]{1,40}$/.test(x.id) && (esArchivo(x.url) || /^products\/[a-f0-9]{12}\.webp$/.test(x.url))).map(x => ({
    id: x.id, tipo: x.tipo === "video" ? "video" : "imagen", url: x.url,
    kicker: txt(x.kicker, 60), titulo: txt(x.titulo, 120), texto: txt(x.texto, 280), boton: txt(x.boton, 40),
    accion: ["cortes","whatsapp","ninguno"].includes(x.accion) ? x.accion : "cortes",
    oscuro: Math.min(85, Math.max(0, Math.round(Number(x.oscuro) || 0))), activo: x.activo !== false }))};
}
export function validar(d){
  if(!d || typeof d !== "object" || !Array.isArray(d.productos) || !Array.isArray(d.categorias)) return null;
  const categorias = d.categorias.slice(0, 50).filter(c => c && /^[a-z0-9-]{1,40}$/.test(c.id) && txt(c.nombre, 60).trim())
    .map(c => ({id:c.id, nombre:txt(c.nombre, 60).trim()}));
  if(!categorias.length) return null;
  const ids = new Set(categorias.map(c => c.id));
  const productos = d.productos.slice(0, 500).filter(p => p && /^[\w-]{1,40}$/.test(p.id) && txt(p.nombre, 80).trim()).map(p => ({
    id: p.id, cat: ids.has(p.cat) ? p.cat : categorias[0].id, nombre: txt(p.nombre, 80).trim(), desc: txt(p.desc, 300),
    precio: Math.min(10_000_000, Math.max(0, Math.round(Number(p.precio) || 0))), foto: esFoto(p.foto) ? p.foto : "",
    preps: Array.isArray(p.preps) ? p.preps.slice(0, 12).map(x => txt(x, 60).trim()).filter(Boolean) : [], stock: p.stock !== false }));
  const a = d.ajustes || {};
  const ajustes = {
    whatsapp: txt(a.whatsapp, 20).replace(/\D/g, ""), direccion: txt(a.direccion, 150), horarioTexto: txt(a.horarioTexto, 150),
    dias: Array.isArray(a.dias) ? [...new Set(a.dias.filter(x => Number.isInteger(x) && x >= 0 && x <= 6))] : [1,2,3,4,5,6],
    horarios: Array.isArray(a.horarios) ? a.horarios.slice(0, 30).map(h => txt(h, 10).trim()).filter(Boolean) : [],
    alias: txt(a.alias, 40), cbu: txt(a.cbu, 30), titular: txt(a.titular, 80),
    mapsLink: /^https:\/\/[^\s"'<>]+$/i.test(String(a.mapsLink || "").trim()) ? txt(String(a.mapsLink).trim(), 300) : ""
  };
  // Si en "Dirección" llega un link, se guarda como link del mapa
  if(/^https?:\/\//i.test(ajustes.direccion.trim())){ if(!ajustes.mapsLink && /^https:/i.test(ajustes.direccion.trim())) ajustes.mapsLink = ajustes.direccion.trim(); ajustes.direccion = ""; }
  return {categorias, productos, ajustes, portada: validarPortada(d.portada)};
}

export const json = (obj, status = 200, cache = "no-store") => new Response(JSON.stringify(obj), {status, headers:{"Content-Type":"application/json; charset=utf-8", "Cache-Control":cache}});

// ---------- Pedidos ----------
const solo = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max).trim();
// Arma el pedido con los precios y nombres del catálogo (nunca con los que manda el navegador)
export function armarPedido(b, catalogo){
  if(!b || typeof b !== "object" || !/^[\w-]{8,64}$/.test(b.id)) return {error:"Pedido inválido"};
  const nombre = solo(b.nombre, 60), whatsapp = solo(b.whatsapp, 25).replace(/[^\d+]/g, "");
  if(!nombre) return {error:"Falta el nombre"};
  if(whatsapp.replace(/\D/g,"").length < 8) return {error:"Falta un WhatsApp válido"};
  if(!Array.isArray(b.items) || !b.items.length || b.items.length > 60) return {error:"El pedido está vacío"};
  if(b.entrega === "uber" && solo(b.direccion, 150).length < 5) return {error:"Falta la dirección de entrega"};
  const prods = new Map((catalogo?.productos || []).map(p => [p.id, p]));
  const cats = new Map((catalogo?.categorias || []).map(c => [c.id, c.nombre]));
  const items = [];
  for(const it of b.items){
    const p = prods.get(it && it.id); const g = Math.round(Number(it && it.g));
    if(!p || !(g > 0 && g <= 100000)) continue;
    items.push({id:p.id, nombre:p.nombre, cat:p.cat, catNombre:cats.get(p.cat) || "", g, precioKg:p.precio,
      subtotal: Math.round(p.precio * g / 1000), prep: solo(it.prep, 60), nota: solo(it.nota, 150)});
  }
  if(!items.length) return {error:"Los productos del pedido ya no están disponibles"};
  const ts = Date.now();
  return {pedido:{id:b.id, ts, nombre, whatsapp, items, total: items.reduce((s,i) => s + i.subtotal, 0),
    retiro:{dia:solo(b.dia, 40), hora:solo(b.hora, 15)}, pago:solo(b.pago, 60), obs:solo(b.obs, 300),
    entrega: b.entrega === "uber" ? "uber" : "retiro", direccion: b.entrega === "uber" ? solo(b.direccion, 150) : ""}};
}
// "2026-11-24" en hora de Argentina (UTC-3) → milisegundos
export function inicioDia(fecha){ return /^\d{4}-\d{2}-\d{2}$/.test(fecha || "") ? Date.parse(fecha + "T00:00:00-03:00") : NaN; }
