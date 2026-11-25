# Tienda para carnicerías (plantilla)

La misma tienda que Del Rivera, pero sin su marca ni sus datos. Sirve para dos cosas:

1. **Demo pública** (`marcas/demo`): cualquiera la prueba, entra al panel con `demo` / `demo`, cambia precios,
   sube fotos y hace pedidos. Todo queda guardado **solo en el navegador de quien la prueba**: no hay base de datos,
   nadie ve los cambios de otro y el botón "Reiniciar demo" la deja como nueva.
2. **Un negocio nuevo** (`marcas/<negocio>`): su propia página, con su panel, su base de datos y su contraseña.

Nada de esto toca la página de Del Rivera: es otro repositorio, otros proyectos de Vercel y otras bases de datos.

## Cómo está armado

- `plantilla.html` – la página con marcadores (`{{NOMBRE}}`, `{{CIUDAD}}`…).
- `marcas/<negocio>/marca.json` – nombre, rubro, ciudad, WhatsApp, dirección, alias, URL, etc.
  `marcas/<negocio>/logo.png` y `compartir.jpg` – logo e imagen para compartir en WhatsApp/redes.
- `armar.mjs` – junta la plantilla con la ficha y arma `dist/` (lo que se publica). Vercel lo corre solo.
- `demo.js` – en la demo, reemplaza al servidor por una versión que guarda todo en el navegador.
- `api/` – el servidor de los negocios reales (catálogo, pedidos, fotos, login).
- `imagenes.py` – genera un logo y una imagen para compartir genéricos (`python3 imagenes.py <negocio>`).
  Si el negocio tiene logo propio, guardalo como `marcas/<negocio>/logo-propio.png` antes de correrlo.

## Sumar un negocio nuevo

1. Copiá `marcas/ejemplo` a `marcas/<negocio>` y completá `marca.json` (`demo: false`, `clave` = nombre de la carpeta).
2. `python3 imagenes.py <negocio>` (o poné su `logo.png` y `compartir.jpg` a mano). Subí los cambios a GitHub.
3. En Vercel: **Add New → Project →** este repositorio. En *Environment Variables*:
   - `MARCA` = `<negocio>`
   - `ADMIN_USUARIO` y `ADMIN_CLAVE` = usuario y contraseña del panel de ese negocio
   - `SESSION_SECRET` = cualquier texto largo al azar
4. En el proyecto nuevo, **Storage**: conectá una base **Upstash Redis** y un **Blob** (fotos) propios.
   Si dos negocios comparten la misma base, poné `PREFIJO` distinto en cada uno.
5. Cambiá la `url` de `marca.json` por la definitiva (la de Vercel o su dominio) para Google y WhatsApp.

Sin `ADMIN_USUARIO` / `ADMIN_CLAVE` nadie puede entrar al panel. En la compu (`npm run dev`) se entra con `prueba` / `prueba`.

## Probar en la compu

```
npm install
MARCA=demo npm run dev      # o MARCA=ejemplo
```
y abrí http://localhost:3000
