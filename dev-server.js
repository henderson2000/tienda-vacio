// Servidor para probar en tu compu sin Vercel: `npm run dev` y abrí http://localhost:3000
// Guarda los datos en la carpeta .datos-local en vez de Vercel Blob.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const PUERTO = process.env.PORT || 3000;
const TIPOS = {".html":"text/html; charset=utf-8",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg",".svg":"image/svg+xml",".js":"text/javascript",".json":"application/json"};
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try{
    if(url.pathname.startsWith("/api/")){
      const mod = await import("./api/" + path.basename(url.pathname) + ".js");
      const handler = mod[req.method];
      if(!handler){ res.writeHead(405).end(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, {method:req.method, headers:req.headers, body: ["GET","HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks)});
      const r = await handler(request);
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    let archivo = url.pathname.startsWith("/_local/")
      ? path.join(".datos-local/fotos", path.basename(url.pathname))
      : path.join("dist", decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if(!path.resolve(archivo).startsWith(path.resolve("."))) throw 0;
    const data = await fs.readFile(archivo);
    res.writeHead(200, {"Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream"}); res.end(data);
  }catch(e){ res.writeHead(404).end("No encontrado"); }
}).listen(PUERTO, () => console.log(`Tienda en http://localhost:${PUERTO}`));
