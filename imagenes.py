# Genera logo.png y compartir.jpg genéricos para una marca (se usa después de armar.mjs).
# Si la ficha trae "logo": "ruta/al/logo.png", se usa ese logo en vez del genérico.
# Uso: python3 imagenes.py marcas/demo.json
import asyncio, json, sys, shutil, base64, html, os
from playwright.async_api import async_playwright
C = sys.argv[1]; M = json.load(open(f"marcas/{C}/marca.json")); dest = f"marcas/{C}"
foto = base64.b64encode(open("public/products/a8db74af1b7f.webp","rb").read()).decode()
ini = "".join(w[0] for w in M["nombre"].replace("Tu ","").split()[:2]).upper()
E = html.escape
ICONO = '<svg viewBox="0 0 64 64" width="{s}" height="{s}"><path d="M13 41c-3-11 5-22 16-25 8-2 12 1 18 0 8-1 13 1 14 8 2 9-3 16-12 18-7 2-13 0-19 1-9 2-15 6-17-2z" fill="#f6f3ed"/><path d="M13 41c-3-11 5-22 16-25 8-2 12 1 18 0" fill="none" stroke="#e3c9a0" stroke-width="3" stroke-linecap="round"/><ellipse cx="44" cy="30" rx="5" ry="4" fill="#c9a46a"/></svg>'
LOGO = f'''<html><body style="margin:0;background:transparent"><div style="width:300px;height:300px;border-radius:70px;background:#7b282a;display:grid;place-items:center">{ICONO.format(s=220)}</div></body></html>'''
OG = f'''<html><head><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@500&display=swap');</style></head>
<body style="margin:0;width:1200px;height:630px;font-family:'DM Sans',sans-serif">
<div style="position:absolute;inset:0;background:url(data:image/webp;base64,{foto}) center/cover"></div>
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(30,12,10,.95) 0%,rgba(30,12,10,.88) 50%,rgba(30,12,10,.35) 100%)"></div>
<div style="position:absolute;left:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#f6f3ed;max-width:900px">
<div style="display:flex;align-items:center;gap:18px;margin-bottom:34px"><div style="width:84px;height:84px;border-radius:20px;background:#7b282a;display:grid;place-items:center">{ICONO.format(s=62)}</div>
<div style="font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#e3c9a0">{E(M["rubro"])}</div></div>
<div style="font-family:'Playfair Display',serif;font-size:92px;line-height:1">{E(M["nombre"])}</div>
<div style="font-size:32px;margin-top:26px;opacity:.9">Pedí tus cortes online · Retiro o envío por Uber</div>
<div style="font-size:26px;margin-top:18px;color:#e3c9a0">{E(M["ciudad"])}</div></div></body></html>'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width":300,"height":300})
        if os.path.exists(f"{dest}/logo-propio.png"): shutil.copy(f"{dest}/logo-propio.png", f"{dest}/logo.png")
        else:
            await pg.set_content(LOGO); await pg.screenshot(path=f"{dest}/logo.png", omit_background=True)
        await pg.set_viewport_size({"width":1200,"height":630}); await pg.set_content(OG); await pg.wait_for_timeout(1200)
        await pg.screenshot(path="/tmp/og.png")
        await b.close()
    from PIL import Image
    Image.open("/tmp/og.png").convert("RGB").save(f"{dest}/compartir.jpg", quality=86)
    print("imágenes listas en", dest)
asyncio.run(main())
