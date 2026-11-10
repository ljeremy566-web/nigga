# nigga

## AI Content Studio | YouTube & Instagram Trend Oracle + Gemini AI & Supabase

Sistema backend y dashboard interactivo para generar roadmaps mensuales completos de 30 días para Instagram analizando tendencias en tiempo real de **YouTube Data API v3**, inteligencia de perfiles de **Instagram** y orquestación con **Gemini AI** (`gemini-2.5-flash`), persistiendo todo en **Supabase (PostgreSQL)** y preparado para correr 24/7 de forma autónoma en un VPS de **Oracle Cloud**.

---

### 🚀 Características Principales

1. **Oráculo Autónomo Mensual:**
   - Rastreo autónomo programado para el día 1 de cada mes a las 00:00 UTC vía `node-cron`.
   - Disparo manual inmediato con `POST /api/oracle/run-now`.
   - Endpoint compatible con cron jobs de Linux: `POST /api/cron/orchestrate`.

2. **Inteligencia de YouTube (v3):**
   - Búsqueda de videos virales por nicho / palabras clave.
   - Extracción de métricas, títulos con alto CTR y descripciones.
   - Historial de búsquedas y catálogo de videos persistido en Supabase.

3. **Inteligencia de Instagram:**
   - Análisis de cuentas y perfiles de referencia (`@cuenta`) para modelar ganchos, formatos y tono de voz.

4. **Motor de IA Gemini:**
   - Generación de 30 días organizados en 4 fases estratégicas:
     - **Semana 1:** Atracción y ganchos virales (0-3 segundos).
     - **Semana 2:** Autoridad y carruseles paso a paso.
     - **Semana 3:** Comunidad y debates interactivos.
     - **Semana 4:** Conversión y llamadas a la acción directas.
   - Prompts de imagen detallados para Midjourney y DALL-E (ratios 9:16 y 1:1).
   - Guiones completos paso a paso para Reels y Carruseles.

5. **Dashboard Visual Interactivo:**
   - Visualización por semanas y calendario.
   - Modal de detalle con opción de copiado de guiones y prompts.
   - Cambio de estado de cada publicación (`pendiente`, `grabado`, `editado`, `publicado`).
   - Exportación completa a CSV y JSON.

6. **Despliegue 24/7 en Oracle Cloud VPS:**
   - Script de aprovisionamiento automatizado: `oracle/deploy_oracle_vps.sh`.
   - Servicio systemd: `oracle/youtube-instagram-oracle.service`.

---

### 📦 Estructura del Proyecto

```
.
├── src/
│   ├── config/
│   │   ├── env.ts              # Configuración y variables de entorno
│   │   └── supabase.ts         # Cliente Supabase con fallback en memoria
│   ├── services/
│   │   ├── youtube.service.ts  # YouTube Data API v3 client
│   │   ├── instagram.service.ts# Analizador de perfiles de Instagram
│   │   ├── gemini.service.ts   # Generador estratégico con Gemini 2.5 Flash
│   │   ├── roadmap.service.ts  # Gestor y persistencia de 30 días
│   │   └── oracle-orchestrator.service.ts # Orquestador autónomo y cron
│   ├── routes/
│   │   ├── youtube.routes.ts   # Rutas /api/youtube
│   │   ├── roadmap.routes.ts   # Rutas /api/roadmap
│   │   └── oracle.routes.ts    # Rutas /api/oracle y /api/cron
│   └── index.ts                # Entrada principal Express
├── sql/
│   └── supabase_schema.sql     # DDL de tablas, índices y RLS para Supabase
├── oracle/
│   ├── deploy_oracle_vps.sh    # Script de despliegue en VPS Ubuntu/Debian
│   └── youtube-instagram-oracle.service # Servicio systemd para correr 24/7
├── public/
│   └── index.html              # Dashboard visual interactivo
├── .env.example                # Plantilla de variables de entorno
├── package.json
└── tsconfig.json
```

---

### ⚙️ Instalación y Uso Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor en modo desarrollo con recarga en caliente
npm run dev

# Compilar a TypeScript
npm run build

# Iniciar en producción
npm start
```

Abrir en el navegador: `http://localhost:3000`

---

### 🔑 Variables de Entorno (`.env.local`)

```env
PORT=3000
YOUTUBE_API_KEY=tu_youtube_api_key
SUPABASE_URL=https://fappvfiamxqrydamrwrz.supabase.co
SUPABASE_ANON_KEY=tu_supabase_anon_key
GEMINI_API_KEY=tu_gemini_api_key
```
