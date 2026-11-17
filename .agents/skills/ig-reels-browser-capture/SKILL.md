---
name: ig-reels-browser-capture
description: Guía operativa para usar Antigravity (versión Browser) para buscar Reels en Instagram por nicho, hashtag o cuenta referente, capturar metadatos + primer frame, y enviarlos a Content Studio (/api/instagram/reels/capture) para alimentar el Roadmap IG independiente.
---

# IG Reels & Cosmetología Browser Capture (Antigravity Browser → Content Studio)

Usa este skill cuando el usuario quiera buscar cuentas referentes y contenido de Instagram (especialmente **cosmetología, estética facial, skincare** para ayudar a cuentas como **`@ssabeaute`**) usando **Antigravity (versión Browser)**, capturar **Reels (`/reel/`) e imágenes/carruseles con consejos (`/p/`)** más su primer frame/portada, y enviarlos al backend de **Content Studio** (`POST /api/instagram/reels/capture`) para generar un **Roadmap IG de 30 días** aparte.

## Reglas de Seguridad y Sesión
1. **Nunca automatices credenciales ni evadas retos anti-bot**: Si Instagram muestra `/accounts/login/`, verificación 2FA o un CAPTCHA, **detente** y pide al usuario que inicie sesión o resuelva la verificación manualmente en la ventana del navegador de Antigravity.
2. **Límite responsable por lote**: Captura entre **6 y 12 piezas** por búsqueda (combinando Reels, carruseles e imágenes educativas de distintas cuentas referentes de cosmetología) para evitar límites de tasa de Instagram y mantener tiempos rápidos en Gemini Vision.
3. **Resolución de frame / portada**: Al capturar el primer frame del video o imagen portada (`frameImageBase64`), prioriza formato JPEG comprimido (~360–480 px de ancho) para no saturar el payload ni Supabase.

---

## Flujo Paso a Paso con Antigravity Browser

### Paso 1: Verificar sesión activa en Instagram
1. Navega a `https://www.instagram.com/`.
2. Si aparece pantalla de inicio de sesión o botón "Entrar" / "Log in", avisa al usuario para que complete el login en el navegador y espera confirmación antes de continuar.

### Paso 2: Analizar cuenta principal (ej. `@ssabeaute`) y buscar otros IGs referentes
1. Si hay una cuenta principal (por ejemplo `@ssabeaute`), visita brevemente `https://www.instagram.com/ssabeaute/` para conocer su estilo, tratamientos y tono actual.
2. Luego busca **otros perfiles y contenido referente de cosmetología** según lo que pidió el usuario:
   - **Por palabra clave / nicho**: `https://www.instagram.com/explore/search/keyword/?q=cosmetologia%20facial%20skincare`
   - **Por hashtag**: `https://www.instagram.com/explore/tags/cosmetologia/` o `/explore/tags/esteticafacial/`
   - **Por cuenta referente encontrada**: `https://www.instagram.com/<HANDLE_SIN_ARROBA>/reels/` o `/<HANDLE_SIN_ARROBA>/`

Espera 2–3 segundos a que cargue la grilla y haz scroll suave 1–2 veces para poblar al menos 8–12 tarjetas (`a[href*="/reel/"], a[href*="/p/"]`).

### Paso 3: Recolectar los enlaces `/reel/` y `/p/` (Reels, carruseles e imágenes)
Ejecuta en la consola / `Runtime.evaluate` del navegador:
```js
(() => {
  const seen = new Set();
  const links = [];
  for (const a of document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
    if (m && !seen.has(m[2])) {
      seen.add(m[2]);
      links.push({
        type: m[1] === 'reel' ? 'reel' : 'post',
        shortcode: m[2],
        reelUrl: `https://www.instagram.com/${m[1]}/${m[2]}/`
      });
    }
  }
  return links.slice(0, 12);
})();
```

### Paso 4: Abrir cada pieza, capturar metadatos y primer frame o imagen
Para cada `reelUrl` (o haciendo clic en la tarjeta modal):
1. Espera a que aparezca el contenedor (`article`, `video`, `img` o diálogo modal).
2. Si es video/Reel, pausa el video (`document.querySelector('video')?.pause()`) en el primer frame visible (`0–1s`). Si es imagen/carrusel (`/p/`), toma la imagen principal del `article`.
3. Captura una imagen JPEG del elemento `<video>` / `<img>` (por screenshot del Browser Subagent o `canvas.toDataURL('image/jpeg', 0.65)`).
4. Extrae los metadatos visibles con el siguiente extractor DOM:
```js
(() => {
  const url = window.location.href;
  const scMatch = url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  const shortcode = scMatch ? scMatch[1] : '';
  const root = document.querySelector('div[role="dialog"]') || document.querySelector('main') || document.body;

  // Autor (@handle)
  const authorLink = root.querySelector('header a[href^="/"], a[role="link"][href^="/"]');
  const authorRaw = authorLink ? (authorLink.getAttribute('href') || authorLink.textContent || '') : '';
  const authorHandle = authorRaw.replace(/\//g, '').trim();

  // Caption (consejos, rutina, explicación completa)
  const candidates = Array.from(root.querySelectorAll('h1, span[dir="auto"], div[dir="auto"]'))
    .map((el) => (el.innerText || '').trim())
    .filter((t) => t.length > 20);
  const caption = candidates[0] || '';

  // Audio (si aplica)
  const audioEl = root.querySelector('a[href*="/audio/"]');
  const audioName = audioEl ? audioEl.innerText.trim() : 'Audio original';

  // Métricas visibles
  const textBlob = root.innerText || '';
  const likesMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(Me gusta|likes?)/i);
  const commentsMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(comentarios?|comments?)/i);
  const viewsMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(reproducciones?|views?|plays?)/i);

  // Primer frame desde <video> o <img> portada (si CORS lo permite; si no, usar screenshot Browser)
  let frameImageBase64 = '';
  const mediaEl = root.querySelector('video') || root.querySelector('article img[src*="instagram"], article img[src*="fbcdn"]');
  if (mediaEl) {
    try {
      const w = mediaEl.videoWidth || mediaEl.naturalWidth || 0;
      const h = mediaEl.videoHeight || mediaEl.naturalHeight || 0;
      if (w > 0 && h > 0) {
        const canvas = document.createElement('canvas');
        const targetW = 360;
        const targetH = Math.round((h / w) * targetW);
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.getContext('2d').drawImage(mediaEl, 0, 0, targetW, targetH);
        frameImageBase64 = canvas.toDataURL('image/jpeg', 0.65);
      }
    } catch (_) {
      frameImageBase64 = '';
    }
  }

  return {
    shortcode,
    reelUrl: url.split('?')[0],
    authorHandle,
    caption,
    audioName,
    likeCount: likesMatch ? likesMatch[1] : 0,
    commentCount: commentsMatch ? commentsMatch[1] : 0,
    viewCount: viewsMatch ? viewsMatch[1] : 0,
    frameImageBase64
  };
})();
```
> Nota: si `<canvas>` falla por CORS del CDN de Instagram, toma la captura del elemento `<video>` o `<img>` con la herramienta de screenshot del navegador y adjúntala como `frameImageBase64` (`data:image/jpeg;base64,...`).

### Paso 5: Enviar el lote capturado a Content Studio
Haz `POST` a `<CONTENT_STUDIO_URL>/api/instagram/reels/capture` (por defecto `http://localhost:3000/api/instagram/reels/capture`):
```json
{
  "sourceQuery": "Cosmetología y Estética Facial (@ssabeaute)",
  "capturedVia": "antigravity_browser",
  "reels": [
    {
      "shortcode": "CxCosmeto01",
      "reelUrl": "https://www.instagram.com/reel/CxCosmeto01/",
      "authorHandle": "@cosmetologa_ref",
      "caption": "3 errores al hacer limpieza facial profunda que irritan la barrera cutánea...",
      "audioName": "Original Audio",
      "viewCount": "64.5K",
      "likeCount": "4.2K",
      "commentCount": "185",
      "frameImageBase64": "data:image/jpeg;base64,..."
    }
  ]
}
```
Si el navegador no permite `fetch` hacia `localhost` por política mixed-content/CORS desde `instagram.com`, copia el JSON generado y pégalo en **Content Studio → IG Reels → Importar captura JSON**.

### Paso 6: Generar el Roadmap IG independiente (1 mes para `@ssabeaute`)
Llama a `POST <CONTENT_STUDIO_URL>/api/instagram/roadmap/generate` con `{ "niche": "Cosmetología y Estética Facial para @ssabeaute", "sourceQuery": "<QUERY>" }` o haz clic en **"Generar 30 días IG"** dentro de la pestaña **Roadmap IG**.
