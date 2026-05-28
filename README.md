# Crisis Dashboard — Tucumán

Crisis Dashboard es una plataforma de simulación y gestión de emergencias en tiempo real para **San Miguel de Tucumán**, diseñada para la toma de decisiones gubernamentales (B2G). 

El sistema demuestra cómo las tecnologías avanzadas de **Inteligencia Artificial (Gemini 2.0 Flash)** y **Blockchain (Arkiv Network)** pueden unirse para resolver el colapso de las líneas de emergencia tradicionales durante crisis climáticas, ofreciendo un registro inmutable de la velocidad de respuesta pública.

---

## 🚀 La Solución (Cómo funciona el Simulador)

1.  **Ingesta de Reportes**: El sistema simula un flujo dinámico de reportes multi-canal (X/Twitter, Facebook, Instagram, sensores meteorológicos y cámaras de seguridad).
2.  **Análisis por IA**: La inteligencia artificial de **Google Gemini 2.0 Flash** (usando la API real configurada) analiza cada reporte para:
    *   Filtrar el ruido e identificar incidentes reales.
    *   Estimar el número de personas afectadas y clasificar la severidad (`critical`, `high`, `medium`, `low`).
    *   Inferir la ubicación exacta y sugerir acciones de respuesta inmediatas.
3.  **Persistencia en Base de Datos**: Las alertas verificadas por el agente de IA se guardan directamente en **Supabase**, actualizando instantáneamente el mapa interactivo de incidentes.
4.  **Auditoría y Certificación On-Chain (Blockchain)**: Cuando el operador valida y despacha los recursos (ambulancias, bomberos, helicópteros, etc.), el despacho se firma digitalmente y se registra en la **Blockchain de Arkiv (Red Braga - Testnet)**.
5.  **Sello de Auditoría Inmutable**: Al completarse la transacción blockchain, el panel del operador muestra un **Sello de Auditoría Verde** que contiene el hash de la transacción (`entityKey`) y un enlace directo al explorador de bloques para verificar la veracidad y los tiempos de despacho.

---

## 🛠️ Stack Tecnológico

-   **Frontend**: Next.js 16 (App Router + TypeScript)
-   **Estilos**: Tailwind CSS v4 + Radix UI
-   **Mapas**: Leaflet + React-Leaflet (CARTO Dark Tiles centrado en Tucumán)
-   **Inteligencia Artificial**: Google Gemini 2.0 Flash SDK
-   **Base de Datos**: Supabase (PostgreSQL)
-   **Blockchain**: SDK de Arkiv Network (Red Braga Testnet)
-   **Diseño de Gráficos**: Recharts
-   **Notificaciones**: Sonner toasts

---

## 📦 Arquitectura del Proyecto

```
app/
├── page.tsx              # Dashboard interactivo principal (Desktop / Mobile)
└── api/
    ├── agent/            # Endpoint del Agente de IA (Escanea posts y llama a Gemini)
    ├── analytics/        # KPIs de tiempo de respuesta y severidad en tiempo real
    ├── incidentes/       # CRUD de incidentes en Supabase
    │   ├── arkiv-dispatch/ # Registra el despacho en Arkiv Blockchain y guarda el arkiv_key
    │   ├── auto-resolve/ # Resuelve alertas automáticamente tras 5 minutos sin atención
    │   └── respawn/      # Mantiene el mapa con incidentes durante la simulación
    └── recursos/         # Control de estado de ambulancias y patrullas
        └── auto-reset/   # Libera recursos que queden en standby
```

---

## 🔑 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con la siguiente estructura:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Google AI Studio (Gemini)
GOOGLE_AI_API_KEY=tu-gemini-api-key

# Seguridad de API
API_SECRET=clave-aleatoria-de-api
NEXT_PUBLIC_API_SECRET=clave-aleatoria-de-api

# Blockchain Arkiv
ARKIV_PRIVATE_KEY=clave-privada-de-tu-wallet-web3
```

---

## 🎬 Cómo Lanzar el Simulador

1. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre el explorador en `http://localhost:3000?dev=true`.
   *(El parámetro `?dev=true` activa la consola de control de la simulación en la esquina inferior izquierda para forzar despachos y ver las métricas en tiempo real)*.

---

## 🗺️ Futura Implementación (Roadmap de Producción)

El proyecto está estructurado de forma modular para que la transición de simulación a producción sea transparente:
1.  **Conexión a Redes Sociales Reales**: La arquitectura ya incluye los conectores listos para APIs reales (`x-connector.ts`, `facebook-connector.ts`, `instagram-connector.ts`). En un entorno productivo, basta con proveer las credenciales oficiales en el `.env.local` para pasar de los posts simulados a la ingesta directa de reportes ciudadanos en tiempo real.
2.  **Integración de Sensores IoT**: El canal de sensores meteorológicos está preparado para enlazarse con estaciones físicas de medición de caudal y precipitaciones en puntos críticos (como el Canal Norte y El Manantial).
3.  **Cámaras con Visión Artificial**: Conectar el feed de cámaras al centro de monitoreo del municipio (SMT) y procesar las imágenes mediante modelos de detección de objetos para identificar anegamientos e incendios de forma autónoma.

---

## 🗄️ Esquema de Base de Datos (Supabase)

### Tabla `incidentes`
*   `id` (uuid): Clave primaria.
*   `tipo` (text): Tipo de crisis (`flood`, `fire`, `storm`, `looting`, `violence`, `accident`, `general`).
*   `severidad` (text): Gravedad (`critical`, `high`, `medium`, `low`).
*   `ubicacion` (text): Dirección o zona del reporte.
*   `latitud` / `longitud` (float8): Coordenadas geográficas para el mapa de Leaflet.
*   `personas_afectadas` (int4): Estimación del impacto.
*   `fuente` (text): Origen (`social`, `sensor`, `camera`).
*   `fuente_detalles` (jsonb): Contenido del reporte y logs de razonamiento de Gemini.
*   `estado` (text): Estado de la alerta (`activo`, `atendido`).
*   `arkiv_key` (text): Hash inmutable retornado por la Blockchain de Arkiv (Auditoría cruzada).
*   `created_at` / `updated_at` (timestamptz).

### Tabla `recursos`
*   `id` (uuid): Clave primaria.
*   `tipo` (text): Categoría (`ambulance`, `firefighter`, `helicopter`, `boat`, `police`).
*   `nombre` (text): Identificador de la unidad (ej. "Ambulancia 01").
*   `estado` (text): Disponibilidad (`available`, `dispatched`, `busy`).
*   `ubicacion` (text): Base de operaciones.
*   `incidente_id` (uuid): Relación con el incidente asignado.