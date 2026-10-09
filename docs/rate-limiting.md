# Límites de solicitudes

El middleware limita las APIs a 200 solicitudes por minuto por IP,
los reportes ciudadanos a 3 intentos cada 10 minutos y la generación
de pruebas `/api/incidentes/zk-verify` a 10 intentos por minuto.
Los rechazos devuelven `429`, `Retry-After` y el instante de reinicio.
Los intentos inválidos también consumen cuota.

## Redis distribuido

Configurar en el gestor de secretos del hosting, sin prefijo `NEXT_PUBLIC_`:

```dotenv
UPSTASH_REDIS_REST_URL=https://tu-instancia.upstash.io
UPSTASH_REDIS_REST_TOKEN=token-con-permisos-de-escritura
RATE_LIMIT_PREFIX=zntinel-production
RATE_LIMIT_REQUIRE_DISTRIBUTED=true
```

Todas las instancias del mismo despliegue deben usar la misma base Redis
y el mismo prefijo. Usar un prefijo diferente para staging. No configurar
un token de solo lectura. La implementación usa la
[API REST de Upstash](https://upstash.com/docs/redis/features/restapi)
y un único script Lua `EVAL` que incrementa y establece la expiración
atómicamente. Las IP se guardan como hashes SHA-256 con TTL, no en texto claro;
el hash es pseudónimo y no garantiza anonimato frente a enumeración.

Si Redis está configurado y falla, la API devuelve `503` con `Retry-After: 5`.
No cambia a contadores locales, porque eso permitiría eludir la cuota.
Una configuración incompleta también devuelve `503`.

Sin ambas variables Redis y sin `RATE_LIMIT_REQUIRE_DISTRIBUTED=true`,
se conservan los contadores locales, limitados a 10.000 identificadores.
Esto permite desarrollo local y transición, pero **no proporciona protección
compartida entre instancias**. Para producción activar las tres variables
anteriores después de conectar Redis. Si se exige Redis sin configurarlo,
las APIs quedan temporalmente indisponibles.

## IP y alcance

El hosting o proxy debe eliminar los encabezados de IP enviados por clientes
y establecer `x-forwarded-for` / `x-real-ip` con la IP real. El middleware
confía en esos encabezados; no publicar el servidor directamente aceptando
encabezados arbitrarios. Un límite por IP no reemplaza protección de borde
frente a ataques distribuidos y usuarios detrás de una NAT comparten cuota.

## Verificación

`npm test` verifica los límites locales y su reinicio exacto, la cuota
compartida entre dos instancias con transporte Redis simulado, y el rechazo
de respuestas inválidas, fallos y configuraciones incompletas. No escribe
en una base real. Ejecutar también `npm run lint`, `npx tsc --noEmit` y
`npm run build`. La activación en Redis real requiere sus credenciales.
