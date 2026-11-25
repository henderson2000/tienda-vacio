<script>
/* ===== MODO DEMO =====
   Todo lo que se hace en la demo (cambios del panel, fotos, pedidos) queda guardado solo en el navegador de quien la prueba.
   No hay servidor ni base de datos: nadie puede tocar los datos de otro, y "Reiniciar demo" vuelve todo al principio. */
(function(){
  const K = MARCA.clave + "_demo_", DIA = 86400000;
  const leer = (k, d) => { try{ const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const escribir = (k, v) => { localStorage.setItem(K + k, JSON.stringify(v)); };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers:{"Content-Type":"application/json"}});
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const solo = (t, n) => String(t ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const inicioDia = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") ? Date.parse(f + "T00:00:00-03:00") : NaN;
  const catalogo = () => (leer("tienda", null)?.datos) || (typeof DEFAULT !== "undefined" ? DEFAULT : null);

  function armarPedido(b, cat){
    const prods = new Map((cat?.productos || []).map(p => [p.id, p]));
    const cats = new Map((cat?.categorias || []).map(c => [c.id, c.nombre]));
    const nombre = solo(b.nombre, 60), whatsapp = solo(b.whatsapp, 25).replace(/[^\d+]/g, "");
    if(!nombre) return {error:"Falta el nombre"};
    if(whatsapp.replace(/\D/g, "").length < 8) return {error:"Falta un WhatsApp válido"};
    const items = [];
    for(const it of (b.items || [])){
      const p = prods.get(it && it.id), g = Math.round(Number(it && it.g));
      if(!p || !(g > 0 && g <= 100000)) continue;
      items.push({id:p.id, nombre:p.nombre, cat:p.cat, catNombre:cats.get(p.cat) || "", g, precioKg:p.precio,
        subtotal: Math.round(p.precio * g / 1000), prep: solo(it.prep, 60), nota: solo(it.nota, 150)});
    }
    if(!items.length) return {error:"El pedido está vacío"};
    return {pedido:{id: solo(b.id, 64) || ("d" + Date.now()), ts: b.ts || Date.now(), nombre, whatsapp, items,
      total: items.reduce((s, i) => s + i.subtotal, 0), retiro:{dia:solo(b.dia, 40), hora:solo(b.hora, 15)},
      pago: solo(b.pago, 60), obs: solo(b.obs, 300), entrega: b.entrega === "uber" ? "uber" : "retiro",
      direccion: b.entrega === "uber" ? solo(b.direccion, 150) : ""}};
  }

  // Pedidos de ejemplo de los últimos 2 meses, para que "Pedidos" y "Más vendidos" muestren algo desde el primer momento
  function pedidosEjemplo(){
    const cat = catalogo(); if(!cat) return [];
    const nombres = ["Laura Gómez","Martín Pereyra","Sofía Herrera","Diego Molina","Valentina Ruiz","Javier Castro","Camila Díaz","Lucas Romero","Florencia Sosa","Nicolás Ferreyra"];
    const prods = cat.productos.filter(p => p.stock !== false);
    let semilla = 7; const azar = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;
    const lista = [], ahora = Date.now();
    for(let i = 0; i < 46; i++){
      const ts = ahora - Math.floor(azar() * 60) * DIA - Math.floor(azar() * 8 + 1) * 3600000;
      const n = 1 + Math.floor(azar() * 3), items = [];
      for(let j = 0; j < n; j++){
        const p = prods[Math.floor(Math.pow(azar(), 1.6) * prods.length)];
        items.push({id:p.id, g:[500, 1000, 1500, 2000][Math.floor(azar() * 4)], prep:(p.preps || [])[0] || "", nota:""});
      }
      const uber = azar() < .3, nom = nombres[Math.floor(azar() * nombres.length)];
      const r = armarPedido({id:"ej" + i, ts, nombre:nom, whatsapp:"351" + String(4000000 + Math.floor(azar() * 999999)),
        items, entrega: uber ? "uber" : "retiro", direccion: uber ? "Av. Colón " + (100 + Math.floor(azar() * 3000)) : "",
        pago: azar() < .5 ? "Transferencia" : (uber ? "Efectivo (a coordinar)" : "Efectivo en el local"),
        dia: new Date(ts).toLocaleDateString("es-AR", {weekday:"long", day:"2-digit", month:"2-digit"}), hora: ["10:00","11:00","18:00","19:00"][i % 4]}, cat);
      if(r.pedido) lista.push(r.pedido);
    }
    return lista.sort((a, b) => b.ts - a.ts);
  }
  const pedidos = () => { let l = leer("pedidos", null); if(!l){ l = pedidosEjemplo(); if(l.length) escribir("pedidos", l); } return l; };

  const fetchReal = window.fetch.bind(window);
  window.fetch = async function(url, op = {}){
    const u = new URL(typeof url === "string" ? url : url.url, location.href);
    if(u.origin !== location.origin || !u.pathname.startsWith("/api/")) return fetchReal(url, op);
    const metodo = (op.method || "GET").toUpperCase(), ruta = u.pathname;
    const sesion = /Bearer demo/.test(JSON.stringify(op.headers || {}));
    await espera(120);
    try{
      if(ruta === "/api/tienda" && metodo === "GET") return resp(leer("tienda", {version:"", datos:null}));
      if(ruta === "/api/login"){
        const b = JSON.parse(op.body || "{}"), n = s => String(s || "").trim().toLowerCase();
        if(n(b.usuario) === "demo" && n(b.clave) === "demo") return resp({token:"demo"});
        await espera(400); return resp({error:"En la demo, el usuario y la contraseña son: demo / demo"}, 401);
      }
      if(ruta === "/api/pedido" && metodo === "POST"){
        const r = armarPedido(JSON.parse(op.body || "{}"), catalogo());
        if(r.error) return resp({error:r.error}, 400);
        const l = pedidos().filter(p => p.id !== r.pedido.id); l.unshift(r.pedido); escribir("pedidos", l);
        return resp({ok:true, nuevo:true, total:r.pedido.total});
      }
      if(!sesion) return resp({error:"Tu sesión venció: ingresá de nuevo"}, 401);
      if(ruta === "/api/tienda" && metodo === "PUT"){
        const datos = JSON.parse(op.body || "null"); if(!datos) return resp({error:"Datos inválidos"}, 400);
        const version = new Date().toISOString();
        try{ escribir("tienda", {version, datos}); }
        catch(e){ return resp({error:"En la demo hay poco espacio: sacá alguna foto subida y probá de nuevo."}, 413); }
        return resp({ok:true, version, datos});
      }
      if(ruta === "/api/foto" && metodo === "POST"){
        const blob = op.body; if(!(blob instanceof Blob) || !blob.size) return resp({error:"La foto llegó vacía"}, 400);
        if(blob.size > 400000) return resp({error:"En la demo las fotos tienen que pesar menos de 400 KB"}, 413);
        const url = await new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = mal; fr.readAsDataURL(blob); });
        return resp({url});
      }
      if(ruta === "/api/pedidos" && metodo === "GET"){
        const d = inicioDia(u.searchParams.get("desde")), h = inicioDia(u.searchParams.get("hasta"));
        if(isNaN(d) || isNaN(h) || h < d) return resp({error:"Elegí un rango de fechas válido"}, 400);
        return resp({pedidos: pedidos().filter(p => p.ts >= d && p.ts <= h + DIA - 1)});
      }
      if(ruta === "/api/pedidos" && metodo === "DELETE"){
        const id = u.searchParams.get("id"), l = pedidos(), q = l.filter(p => p.id !== id);
        escribir("pedidos", q); return resp({ok: q.length !== l.length});
      }
    }catch(e){ return resp({error:"Algo salió mal en la demo"}, 500); }
    return resp({error:"No encontrado"}, 404);
  };

  window.reiniciarDemo = function(){
    if(!confirm("¿Volver la demo al principio? Se borran tus cambios, fotos y pedidos de prueba.")) return;
    Object.keys(localStorage).filter(k => k.startsWith(MARCA.clave + "_")).forEach(k => localStorage.removeItem(k));
    try{ sessionStorage.clear(); }catch(e){}
    location.href = location.pathname;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div"); b.className = "demo-barra";
    b.innerHTML = `<span><b>Página de demostración.</b> Probá todo: lo que cambies queda solo en tu celular. Panel: usuario <b>demo</b>, clave <b>demo</b>.</span>
      <span class="demo-acc"><a href="#panel">Abrir el panel</a><button type="button" onclick="reiniciarDemo()">Reiniciar demo</button></span>`;
    document.body.prepend(b);
  });
})();
</script>
<style>
  .demo-barra{background:#1f1d1a;color:#f3ede4;font-size:.82rem;line-height:1.35;padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:center;text-align:center}
  .demo-barra b{color:#fff}
  .demo-acc{display:inline-flex;gap:8px}
  .demo-acc a,.demo-acc button{font:inherit;font-weight:600;color:#1f1d1a;background:#f3ede4;border:0;border-radius:999px;padding:4px 12px;text-decoration:none;cursor:pointer}
</style>
