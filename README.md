# Climate Crisis Dashboard — Tucumán
### Hackathon Track: Arkiv × Puna Tech Builder Challenge 2026

**Climate Crisis Dashboard** es una plataforma inteligente de simulación y gestión de emergencias en tiempo real para **San Miguel de Tucumán**, diseñada específicamente para la toma de decisiones gubernamentales (B2G). 

El sistema demuestra cómo la convergencia de **Inteligencia Artificial (Google Gemini 2.0 Flash)** y **Blockchain (Arkiv Network)** resuelve el colapso de las líneas de emergencia tradicionales (911) durante catástrofes climáticas, garantizando una ingesta automatizada de reportes y un registro público, transparente e inmutable de la respuesta del Estado.

---

## 👥 Datos del Equipo
*   **Participante:** Alvarez, Marcelo Simon
*   **Rol:** Fullstack Developer & Web3/AI Integrator
*   **Repositorio del Proyecto:** [climate-crisis-dashboard](https://github.com/Arkiv-Network/arkiv-puna-tech-hackathon)

---

## 🔗 Evidencia de Integración Arkiv (Prueba de Transacción On-Chain)
Para certificar que el sistema interactúa de manera real y exitosa con la blockchain **Braga Testnet de Arkiv Network**, aquí se presentan los hashes y enlaces del explorador generados durante las pruebas oficiales:
*   **Dirección de la Billetera del Operador:** `0xb5443307029efA0a1F1BF44421CCCaF3249ac0e4`
*   **Entity Key en Braga Testnet (Registro Inmutable):** `0x5d0d95f154889e650afe18c6c4a86d2ada55ca8a238061776a03f0878cec3558`
*   **Enlace al Explorador de Braga (Blockscout):** [Ver Entidad Auditada en Arkiv Explorer](https://explorer.braga.hoodi.arkiv.network/entity/0x5d0d95f154889e650afe18c6c4a86d2ada55ca8a238061776a03f0878cec3558)

---

## 🚀 Arquitectura Avanzada e Integración Blockchain Premium

Para este desafío, hemos llevado la integración de **Arkiv Blockchain** a un nivel sumamente competitivo, inspirándonos en la arquitectura de proyectos ganadores previos como `ark-hive` (pensamientos on-chain enlazados) y `Cortex` (ciclo de vida de memoria evolutiva).

### 1. "Darwinian Emergency Lease" (Inspirado en Cortex)
Actualmente, subir reportes masivos a una red descentralizada de forma permanente genera saturación y costos innecesarios. Implementamos un sistema de ciclo de vida evolutivo dinámico:
*   **Detección de IA (Lease Corto)**: Cuando el `SocialMediaAgent` detecta un incidente en redes sociales, lo registra en **Braga Testnet** con un lease corto de **1 hora** (`expiresIn: 3600`). Si no hay intervención humana en ese lapso, el reporte "muere" (decae) y se auto-elimina del ledger on-chain, limpiando el histórico de falsas alarmas.
*   **Validación Humana (Extensión de Lease)**: En cuanto el operador civil confirma el incidente y despacha unidades desde el panel de control, el backend llama a `walletClient.extendEntity` para **extender la vida del reporte original a 7 días** (`expiresIn: 604800`). Solo las crisis reales validadas por humanos perduran en el ledger de largo plazo.

### 2. "Tethered Audit Trail" (Inspirado en ark-hive)
En lugar de registrar eventos de despacho aislados, el sistema genera una línea de auditoría criptográficamente enlazada:
*   Al despachar recursos, se emite una transacción en Braga Testnet que crea un nuevo registro inmutable con el payload de despacho (unidades enviadas, dirección del operador, fecha, etc.).
*   Este registro incluye un atributo de búsqueda indexado `detectionKey` que apunta directamente a la Entity Key de la detección inicial de IA. Esto permite trazar el camino completo (Detección de IA ➡️ Validación Humana) sin depender de una base de datos centralizada.

### 3. Portal de Auditoría Ciudadana Interactivo (`/auditoria`)
Rediseñamos la página de auditoría ciudadana para ofrecer una visualización en línea de tiempo interactiva y animada:
*   Si la Entity Key consultada tiene una entidad vinculada (una alerta enlazada con un despacho o viceversa), el portal realiza consultas en paralelo a la blockchain y renderiza la **Línea de Tiempo de Auditoría de la Emergencia**:
    1.  🤖 **Paso 1: Detección por IA**: Muestra la fecha de escaneo, la severidad original, el nivel de confianza y el razonamiento analítico de Gemini 2.0 Flash sellado en la blockchain.
    2.  👤 **Paso 2: Validación y Despacho Humano**: Detalla los recursos desplegados, el vencimiento del lease extendido a 7 días, y la dirección de la billetera del operador que firmó la acción.

### 4. Resolución de Entidades Híbridas (On-Chain + DB Fallback)
Para garantizar la mejor experiencia durante demostraciones híbridas (donde un incidente puede originarse de sensores locales simulados pero recibir un despacho real on-chain):
*   Nuestra API `/api/incidentes/arkiv-verify/[key]` resuelve dinámicamente las claves cruzadas.
*   Si se busca un despacho real en Braga Testnet cuya alerta original fue generada por el simulador local, el endpoint recupera la firma y metadatos de Braga y reconstruye transparentemente el paso de IA desde Supabase, permitiendo visualizar la línea de tiempo auditada en su totalidad sin romperse.

---

## 🛠️ Mitigación de Errores Críticos (Web3 Shielding)

Durante el despliegue del proyecto, identificamos y solucionamos dos problemas estructurales de red y seguridad:
1.  **Protección de API y Headers de Middleware**:
    El middleware de Next.js (`middleware.ts`) restringe el acceso a los endpoints internos de la API `/api/*` mediante un token de autenticación (`x-api-secret`). Corregimos las llamadas asíncronas de despacho (`/api/incidentes/arkiv-dispatch`) agregando la cabecera correspondiente de forma segura desde el cliente con la variable expuesta `NEXT_PUBLIC_API_SECRET`. Esto desbloqueó el flujo de firma on-chain que previamente era interrumpido con errores `401 Unauthorized`.
2.  **Alineación de Redirección del Explorador**:
    Corregimos las rutas de redirección hacia el explorador de bloques de Braga. Previamente apuntaban al subdominio RPC (`braga.hoodi.arkiv.network`) el cual devolvía errores `404 page not found`. Se modificaron todos los enlaces en el dashboard, historial y código QR para apuntar al explorador Blockscout oficial en **`https://explorer.braga.hoodi.arkiv.network/entity/${key}`**, permitiendo la navegación directa a las entidades del ledger.

---

## 🚀 La Solución: ¿Cómo funciona el Climate Crisis Dashboard?

1.  **Ingesta de Reportes Multicanal**: Simula una ingesta continua desde redes sociales (X/Twitter, Facebook, Instagram), sensores de caudal meteorológico y cámaras de videovigilancia ciudadana.
2.  **Filtrado por IA**: Un Agente de IA lee constantemente la cola de mensajes en tiempo real y, mediante Gemini 2.0 Flash, filtra reportes falsos, estima personas afectadas, clasifica la severidad (`critical`, `high`, `medium`, `low`), extrae la ubicación exacta y sugiere planes de acción.
3.  **Monitoreo y Despacho Georreferenciado**: Las alertas verificadas por la IA se persisten en **Supabase** y se renderizan al instante en el mapa interactivo. El operador evalúa el incidente, selecciona las unidades a despachar (ambulancias, bomberos, botes, policía, etc.) e inicia el envío.
4.  **Auditoría y Certificación On-Chain (Arkiv Network)**: Al autorizar el envío, la solicitud se firma digitalmente y se envía a la **Blockchain de Arkiv (Red Braga - Testnet)**. Este proceso crea una entidad inmutable en la blockchain con los detalles específicos del incidente y los recursos asignados.
5.  **Reportes PDF con Doble Sello y Planilla General**:
    *   **Reporte Individual**: Permite descargar un reporte PDF oficial para cada incidente que contiene el **Doble Sello de Verificación On-Chain**: el *Sello de Detección de IA (Gemini 2.0)* (con color esmeralda) y el *Sello de Despacho Operativo (Comando)* (con color azul), ambos con códigos QR individuales que apuntan directamente al explorador de blockchain Braga.
    *   **Planilla Operativa de Situación**: Genera una planilla de control general consolidada en formato horizontal, que incluye una **Tabla de Historial de Incidentes Auditados On-Chain** detallando los tiempos de resolución, ubicaciones, severidades y los hashes de transacción criptográfica (IA y Despacho) de cada suceso histórico para máxima transparencia administrativa.

---

## ✨ Características de Competitividad (Efecto WOW)

1.  **Portal Público de Auditoría Ciudadana (`/auditoria`)**: Una página web pública e independiente (sin necesidad de loguearse) diseñada para generar confianza y transparencia. Cualquier ciudadano, periodista o auditor gubernamental puede ingresar y pegar el Hash de Arkiv para ver los datos inmutables decodificados en tiempo real directamente de la blockchain.
2.  **Sincronización en Tiempo Real (Supabase Realtime)**: Reemplazamos el polling tradicional en el cliente por conexiones de WebSockets directas con Supabase. Cuando un incidente es detectado por la IA o resuelto por un operador, el mapa, la lista de incidentes activos e históricos, y los paneles de analíticas se actualizan instantáneamente sin refrescar la pestaña.
3.  **Animación de Radar Sonar Beacon (Efecto WOW)**: Los incidentes de severidad **Crítica** y **Alta** en el mapa interactivo de Leaflet cuentan con una animación de radar expansivo de color a juego con su gravedad. Esta onda de choque visual atrae inmediatamente la atención del operador durante momentos críticos.

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
    *El parámetro `?dev=true` activa la barra de simulación en la esquina inferior izquierda. Desde allí puedes forzar la ingesta por IA, simular reportes críticos y activar/detener la simulación.*