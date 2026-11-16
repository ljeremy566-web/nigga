---
name: ig-reels-browser-capture
description: Guía operativa para usar Antigravity (versión Browser) para buscar Reels en Instagram por nicho, hashtag o cuenta referente, capturar metadatos + primer frame, y enviarlos a Content Studio (/api/instagram/reels/capture) para alimentar el Roadmap IG independiente.
---

# IG Reels Browser Capture (Antigravity Browser → Content Studio)

Usa este skill cuando el usuario quiera buscar Reels en Instagram usando **Antigravity (versión Browser)**, capturar sus datos y primer frame, y enviarlos al backend de **Content Studio** (`POST /api/instagram/reels/capture`) para generar un **Roadmap IG de 30 días** aparte.

## Reglas de Seguridad y Sesión
1. **Nunca automatices credenciales ni evadas retos anti-bot**: Si Instagram muestra `/accounts/login/`, verificación 2FA o un CAPTCHA, **detente** y pide al usuario que inicie sesión o resuelva la verificación manualmente en la ventana del navegador de Antigravity.
2. **Límite responsable por lote**: Captura entre **6 y 12 Reels** por búsqueda para evitar límites de tasa de Instagram y mantener tiempos rápidos de análisis en Gemini Vision.
3. **Resolución de primer frame**: Al capturar el primer frame (`frameImageBase64`), prioriza formato JPEG comprimido (~360–480 px de ancho) para no saturar el payload ni Supabase.

---

## Flujo Paso a Paso con Antigravity Browser

### Paso 1: Verificar sesión activa en Instagram
1. Navega a `https://www.instagram.com/`.
2. Si aparece pantalla de inicio de sesión o botón "Entrar" / "Log in", avisa al usuario para que complete el login en el navegador y espera confirmación antes de continuar.

### Paso 2: Navegar a la búsqueda o cuenta objetivo
Elige la URL según lo que pidió el usuario:
- **Por palabra clave / nicho**: `https://www.instagram.com/explore/search/keyword/?q=<QUERY_URL_ENCODED>`
- **Por hashtag**: `https://www.instagram.com/explore/tags/<TAG_SIN_HASH>/`
- **Por cuenta referente**: `https://www.instagram.com/<HANDLE_SIN_ARROBA>/reels/`

Espera 2–3 segundos a que cargue la grilla y haz scroll suave 1–2 veces para poblar al menos 6–12 tarjetas de Reels (`a[href*="/reel/"]`).

### Paso 3: Recolectar los enlaces `/reel/<shortcode>/`
Ejecuta en la consola / `Runtime.evaluate` del navegador:
```js
(() => {
  const seen = new Set();
  const links = [];
  for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
    const m = (a.getAttribute('href') || '').match(/\/reel\/([A-Za-z0-9_-]+)/);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      links.push({
        shortcode: m[1],
        reelUrl: `https://www.instagram.com/reel/${m[1]}/`
      });
    }
  }
  return links.slice(0, 10);
})();
```

### Paso 4: Abrir cada Reel, capturar metadatos y primer frame
Para cada `reelUrl` (o haciendo clic en la tarjeta modal):
1. Espera a que aparezca el contenedor del Reel (`article`, `video` o diálogo modal).
2. Pausa el video (`document.querySelector('video')?.pause()`) en el primer frame visible (`0–1s`).
3. Captura una imagen JPEG del elemento `<video>` o del primer frame visible (si tu entorno Browser Subagent devuelve screenshot o `canvas.toDataURL('image/jpeg', 0.65)`).
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

  // Caption (primer bloque de texto largo distinto del header)
  const candidates = Array.from(root.querySelectorAll('h1, span[dir="auto"], div[dir="auto"]'))
    .map((el) => (el.innerText || '').trim())
    .filter((t) => t.length > 20);
  const caption = candidates[0] || '';

  // Audio
  const audioEl = root.querySelector('a[href*="/audio/"]');
  const audioName = audioEl ? audioEl.innerText.trim() : 'Audio original';

  // Métricas visibles (likes / comentarios / vistas si aparecen)
  const textBlob = root.innerText || '';
  const likesMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(Me gusta|likes?)/i);
  const commentsMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(comentarios?|comments?)/i);
  const viewsMatch = textBlob.match(/([0-9.,]+[KMB]?)\s*(reproducciones?|views?|plays?)/i);

  // Primer frame desde <video> (si CORS lo permite; de lo contrario usar screenshot CDP/Browser)
  let frameImageBase64 = '';
  const vid = root.querySelector('video');
  if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
    try {
      const canvas = document.createElement('canvas');
      const targetW = 360;
      const targetH = Math.round((vid.videoHeight / vid.videoWidth) * targetW);
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.getContext('2d').drawImage(vid, 0, 0, targetW, targetH);
      frameImageBase64 = canvas.toDataURL('image/jpeg', 0.65);
    } catch (_) {
      frameImageBase64 = '';
    }
  }

  return {
    shortcode,
    reelUrl: shortcode ? `https://www.instagram.com/reel/${shortcode}/` : url,
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
> Nota: si `<canvas>` falla por CORS del CDN de Instagram, toma la captura del elemento `<video>` con la herramienta de screenshot del navegador y adjúntala como `frameImageBase64` (`data:image/jpeg;base64,...`).

### Paso 5: Enviar el lote capturado a Content Studio
Haz `POST` a `<CONTENT_STUDIO_URL>/api/instagram/reels/capture` (por defecto `http://localhost:3000/api/instagram/reels/capture`):
```json
{
  "sourceQuery": "ia productividad",
  "capturedVia": "antigravity_browser",
  "reels": [
    {
      "shortcode": "CxYz123AbC",
      "reelUrl": "https://www.instagram.com/reel/CxYz123AbC/",
      "authorHandle": "@creador_ejemplo",
      "caption": "3 automatizaciones con IA que te ahorran 2 horas al día...",
      "audioName": "Original Audio",
      "viewCount": "48.2K",
      "likeCount": "3.1K",
      "commentCount": "142",
      "frameImageBase64": "data:image/jpeg;base64,..."
    }
  ]
}
```
Si el navegador no permite `fetch` hacia `localhost` por política mixed-content/CORS desde `instagram.com`, copia el JSON generado y pégalo en **Content Studio → IG Reels → Importar captura JSON**.

### Paso 6: Generar el Roadmap IG independiente
Llama a `POST <CONTENT_STUDIO_URL>/api/instagram/roadmap/generate` con `{ "niche": "<NICHO>", "sourceQuery": "<QUERY>" }` o haz clic en **"Generar Roadmap IG (30 días)"** dentro de la pestaña **IG Reels** / **Roadmap IG**.
