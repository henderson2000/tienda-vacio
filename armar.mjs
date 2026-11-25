import fs from "node:fs"; import path from "node:path";
process.chdir(path.dirname(new URL(import.meta.url).pathname));
// Uso:  MARCA=demo node armar.mjs   (o: node armar.mjs demo)  →  arma la carpeta dist/ con la tienda de esa marca.
// En Vercel, cada negocio es un proyecto con la variable MARCA = nombre de su carpeta en marcas/.
const clave = (process.argv[2] || process.env.MARCA || "demo").trim();
const carpeta = path.join("marcas", clave), archivo = path.join(carpeta, "marca.json");
if(!fs.existsSync(archivo)){ console.error("No existe " + archivo); process.exit(1); }
const M = JSON.parse(fs.readFileSync(archivo, "utf8"));
for(const k of ["clave","nombre","rubro","ciudad","desde","url","direccion","calle"]) if(!M[k]) throw new Error("Falta '" + k + "' en " + archivo);
if(!/^[a-z0-9-]{2,30}$/.test(M.clave)) throw new Error("clave: solo minúsculas, números y guiones");
M.url = M.url.replace(/\/+$/, ""); M.whatsapp = String(M.whatsapp || "").replace(/\D/g, "");
const html = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const js = v => JSON.stringify(v).replace(/</g, "\\u003c");
const marcaJs = {demo:!!M.demo, clave:M.clave, nombre:M.nombre, rubro:M.rubro, whatsapp:M.whatsapp, direccion:M.direccion,
  alias:M.alias || "", cbu:M.cbu || "", titular:M.titular || M.nombre};
const valores = {
  NOMBRE: html(M.nombre), NOMBRE_MAYUS: html(M.nombre.toUpperCase()), RUBRO: html(M.rubro), CIUDAD: html(M.ciudad),
  DESDE: html(M.desde), URL: html(M.url), CALLE: html(M.calle), DIRECCION: html(M.direccion), TEL: html(M.telefono || ""),
  WHATSAPP: M.whatsapp, MAPS_Q: encodeURIComponent(M.calle + " " + M.ciudad),
  J_NOMBRE_RUBRO: js(M.nombre + " · " + M.rubro), J_CIUDAD: JSON.stringify(M.ciudad).slice(1, -1), J_CIUDAD_Q: js(M.ciudad),
  J_PROVINCIA: js(M.provincia || M.ciudad), J_TEL: js(M.telefono || ""), J_DESDE: js(M.desde), J_CALLE: js(M.calle),
  VERIFICACION: M.verificacionGoogle ? `<meta name="google-site-verification" content="${html(M.verificacionGoogle)}" />\n` : "",
  MARCA_JSON: js(marcaJs),
  DEMO_SCRIPT: M.demo ? fs.readFileSync("demo.js", "utf8") : "",
  LOGIN_DEMO: M.demo ? `<p class="login-demo">Demo: usuario <b>demo</b> · contraseña <b>demo</b></p>` : "",
};
let pagina = fs.readFileSync("plantilla.html", "utf8").replace(/\{\{([A-Z_]+)\}\}/g, (t, k) => {
  if(!(k in valores)) throw new Error("Marcador sin valor: " + t); return valores[k];
});
const destino = "dist";
fs.rmSync(destino, {recursive:true, force:true});
fs.cpSync("public", destino, {recursive:true});
fs.writeFileSync(path.join(destino, "index.html"), pagina);
for(const img of ["logo.png", "compartir.jpg"]){
  const propia = path.join(carpeta, img);
  fs.copyFileSync(fs.existsSync(propia) ? propia : path.join("marcas/demo", img), path.join(destino, img));
}
fs.writeFileSync(path.join(destino, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${M.url}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
fs.writeFileSync(path.join(destino, "robots.txt"), M.demo ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${M.url}/sitemap.xml\n`);
console.log("Listo: dist/ con la tienda de", M.nombre, M.demo ? "(demo: todo queda en el navegador de quien la prueba)" : "");
