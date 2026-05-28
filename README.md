# Climate Crisis Dashboard — Tucumán
### Hackathon Track: Arkiv × Puna Tech Builder Challenge 2026

**Climate Crisis Dashboard** es una plataforma inteligente de simulación y gestión de emergencias en tiempo real para **San Miguel de Tucumán**, diseñada específicamente para la toma de decisiones gubernamentales (B2G). 

El sistema demuestra cómo la convergencia de **Inteligencia Artificial (Google Gemini 2.0 Flash)** y **Blockchain (Arkiv Network)** resuelve el colapso de las líneas de emergencia tradicionales (911) durante catástrofes climáticas, garantizando una ingesta automatizada de reportes y un registro público, transparente e inmutable de la respuesta del Estado.

---

## 👥 Datos del Equipo
*   **Participante:** Alvarez, Marcelo Simon
*   **Rol:** Fullstack Developer & Web3/AI Integrator
*   **Repositorio del Proyecto:** [climate-crisis-dashboard](https://github.com/Arkiv-Network/arkiv-puna-tech-hackathon) (Desarrollado durante el Puna Tech Challenge 2026)

---

## 🚀 La Solución: ¿Cómo funciona el Climate Crisis Dashboard?

1.  **Ingesta de Reportes Multicanal**: Durante tormentas e inundaciones severas en Tucumán, los canales tradicionales de llamadas colapsan. El sistema simula una ingesta continua desde redes sociales (X/Twitter, Facebook, Instagram), sensores de caudal meteorológico y cámaras de videovigilancia ciudadana.
2.  **Filtrado e Inferencia por IA (Gemini 2.0 Flash)**: Un Agente de IA lee constantemente la cola de mensajes en tiempo real. Utilizando la API de Gemini, analiza semánticamente el texto y las imágenes de los reportes para:
    *   Filtrar reportes falsos o irrelevantes (limpieza de ruido).
    *   Estimar con precisión el número de personas afectadas y clasificar la severidad (`critical`, `high`, `medium`, `low`).
    *   Extraer la ubicación geográfica y mapearla en coordenadas de Leaflet.
    *   Sugerir planes de acción rápidos.
3.  **Monitoreo y Despacho Georreferenciado**: Las alertas verificadas por el Agente de IA se persisten en **Supabase** y se renderizan al instante en el mapa interactivo. El operador del comando de crisis puede evaluar el incidente, seleccionar las unidades específicas a despachar (ambulancias, bomberos, botes, policía, etc.) e iniciar el envío.
4.  **Auditoría y Certificación On-Chain (Arkiv Network)**: Al autorizar el envío, la solicitud se firma digitalmente y se envía a la **Blockchain de Arkiv (Red Braga - Testnet)**. Este proceso crea una entidad inmutable en la blockchain con los detalles específicos del incidente y los recursos asignados.
5.  **Sello de Auditoría Criptográfica en Tiempo Real**: Una vez registrado el caso on-chain, su estado pasa a `"atendido"`. Desde la pestaña de **Historial**, el operador puede hacer clic en cualquier incidente y ver el **Sello de Verificación Verde**, el cual hace una consulta directa a la blockchain mediante el cliente público de Arkiv para verificar la firma, el emisor y el payload original, con un enlace directo al explorador de bloques de Braga.

---

## 🧠 Enfoque de Implementación y Aprendizajes (Arkiv Integration)

Durante el diseño e integración del SDK de Arkiv, nos enfrentamos a desafíos técnicos clave que resolvimos con enfoques innovadores para el hackathon:

*   **Gestión del Ciclo de Vida y Visibilidad**: Al cambiar el estado de los incidentes a `"atendido"` (para que no saturen la pantalla de monitoreo activo), estos desaparecían. Diseñamos un panel de pestañas con estados (`Activos` vs `Historial`) y extendimos la API de Supabase para poder filtrar por estado, permitiendo la auditoría cruzada en cualquier momento.
*   **Arquitectura Tolerante a Fallos (Fallback Local)**: En una situación de emergencia real, una falla de red Web3 o un problema con las claves privadas del operador no debe impedir el despacho físico de los recursos. Implementamos un sistema de despacho dual: si la firma en la blockchain de Arkiv falla o no está autorizada, el sistema registra el evento localmente en la base de datos y permite que los recursos salgan, notificando al operador sobre la omisión de la firma de manera elegante.
*   **Verificación Directa Criptográfica**: Para evitar depender de los datos de la base de datos de Supabase (que podrían ser manipulados por administradores locales), el componente `<OnChainVerifier />` utiliza el cliente público del SDK de Arkiv para realizar una lectura directa (`client.getEntity(arkivKey)`) del estado actual en Braga Testnet, contrastando la verdad de la base de datos con la verdad de la blockchain.

---

## 🛠️ Stack Tecnológico

-   **Frontend & Routing**: Next.js 16 (App Router + TypeScript)
-   **Diseño Visual**: Tailwind CSS v4 + Radix UI + HSL Custom Palettes (Diseño oscuro premium de alta fidelidad)
-   **Motor de Mapas**: Leaflet + React-Leaflet (Centrado geográficamente en San Miguel de Tucumán)
-   **Capa de Inteligencia Artificial**: Google Generative AI SDK (Gemini 2.0 Flash)
-   **Capa de Base de Datos**: Supabase (PostgreSQL para persistencia relacional en tiempo real)
-   **Capa de Blockchain**: `@arkiv-network/sdk` (Instanciación de clientes públicos y de billetera en la red Braga Testnet)
-   **Control del Simulador**: Panel de desarrollo integrado (consola de control en la esquina inferior izquierda)

---

## 📦 Estructura del Proyecto

```
climate-crisis-dashboard/
├── app/
│   ├── page.tsx                    # Interfaz principal (Dashboard completo de crisis)
│   └── api/
│       ├── agent/                  # Agente IA (Escanea posts y llama a Gemini)
│       ├── analytics/              # KPIs y analíticas del panel inferior
│       ├── incidentes/             # CRUD de incidentes en Supabase
│       │   ├── arkiv-dispatch/     # Firma on-chain de Arkiv y asignación de key
│       │   ├── arkiv-verify/[key]/ # Consulta directa a Braga Testnet mediante el SDK
│       │   ├── auto-resolve/       # Resolución de incidentes viejos no atendidos
│       │   └── respawn/            # Simulación continua de incidentes
│       └── recursos/               # Control de ambulancias y bomberos
│           └── auto-reset/         # Restablecimiento de recursos
├── components/
│   └── dashboard/
│       ├── crisis-map.tsx          # Panel del mapa con toggles "Activos" e "Historial"
│       ├── crisis-map/
│       │   ├── map-modals.tsx      # Modal de detalle con visor del sello on-chain <OnChainVerifier />
│       │   ├── use-map-data.ts     # SWR hooks para consulta reactiva
│       │   └── resource-helpers.ts # Componentes gráficos de recursos
│       └── incident-dispatch-card.tsx # Módulo Web3 de confirmación y firma de despacho
```

---

## 🔑 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto para conectar las APIs reales:

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
ARKIV_PRIVATE_KEY=0x_tu_private_key_aqui
```

*Nota: Si `ARKIV_PRIVATE_KEY` no está configurada, el simulador funcionará en modo de despacho local y avisará en los logs y notificaciones de la UI.*

---

## 🎬 Instalación y Ejecución Local

1.  Clona el repositorio e instala las dependencias:
    ```bash
    npm install
    ```
2.  Inicia el servidor de desarrollo local:
    ```bash
    npm run dev
    ```
3.  Ingresa a tu navegador en: [http://localhost:3000?dev=true](http://localhost:3000?dev=true).
    *El parámetro `?dev=true` activa la barra de simulación en la esquina inferior izquierda. Desde allí puedes forzar la ingesta por IA, simular reportes críticos y activar/detener la simulación de llamadas.*

---

## 🛡️ Auditoría On-Chain con Arkiv Network

### Registro (Dispatch)
Al confirmar un despacho, el sistema publica en la blockchain de Arkiv usando una cuenta Web3:
- **Atributos de Entidad**:
  - `project`: `climate-crisis-dashboard` (Namespace de separación)
  - `tipo`: Tipo del incidente (`flood`, `fire`, etc.)
  - `severidad`: Nivel de severidad
  - `status`: `dispatched`
  - `track`: `arkiv`
- **Expiración**: Establecido en 7 días (`604800` segundos).

### Verificación (Verification)
Al hacer clic en un incidente del **Historial**, el panel realiza un fetch a `/api/incidentes/arkiv-verify/[key]`. El endpoint consulta directamente el nodo RPC de Braga Testnet. Si la entidad existe, extrae el creador criptográfico y los metadatos exactos de la emergencia, asegurando transparencia absoluta frente a auditorías externas.