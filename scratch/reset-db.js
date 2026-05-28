const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Helper to generate simulated hex key
function generateSimulatedKey() {
  const chars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function run() {
  try {
    console.log('Loading environment variables from .env.local...');
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      throw new Error(`Could not find .env.local in ${process.cwd()}`);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
      }
    });

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    }

    console.log(`Connecting to Supabase at ${supabaseUrl}...`);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 1. Delete all incidents
    console.log('Deleting existing incidents from table "incidentes"...');
    const { error: deleteError } = await supabase
      .from('incidentes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      throw new Error(`Failed to delete incidents: ${deleteError.message}`);
    }
    console.log('Successfully deleted all existing incidents.');

    // 2. Reset resources
    console.log('Resetting all resources in table "recursos" to "available"...');
    const { error: resetResourcesError } = await supabase
      .from('recursos')
      .update({
        estado: 'available',
        incidente_id: null,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (resetResourcesError) {
      console.warn(`Could not reset resources (maybe resources table is empty or doesn't exist?): ${resetResourcesError.message}`);
    } else {
      console.log('Successfully reset all resources.');
    }

    // 3. Define clean incidents to insert
    const now = new Date();
    const minutesAgo = (mins) => new Date(now.getTime() - mins * 60 * 1000).toISOString();

    const activeIncidents = [
      {
        tipo: 'flood',
        severidad: 'critical',
        ubicacion: 'Plaza Independencia - Centro Historico',
        latitud: -26.8305,
        longitud: -65.2038,
        personas_afectadas: 150,
        fuente: 'social',
        estado: 'activo',
        created_at: minutesAgo(12),
        updated_at: minutesAgo(12),
        fuente_detalles: {
          platform: 'X (Twitter)',
          username: '@bomberos_tuc',
          content: 'URGENTE: Canal desbordado en Plaza Independencia. El agua supera los 50cm. Vecinos atrapados. #InundacionTucuman',
          imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600',
          arkiv_entity_key: generateSimulatedKey(),
          ai_analysis: {
            reasoning: 'Múltiples reportes en redes sociales de usuarios en Plaza Independencia indican agua a nivel de rodilla y calles bloqueadas.',
            suggestedActions: ['Desplegar botes de rescate', 'Corte preventivo de energía eléctrica', 'Establecer cordón de desvío de tránsito'],
            confidence: 94,
            relatedPostIds: ['101', '102'],
            arkiv_entity_key: generateSimulatedKey()
          }
        }
      },
      {
        tipo: 'fire',
        severidad: 'high',
        ubicacion: 'Plaza San Martin - Barrio Sur',
        latitud: -26.8398,
        longitud: -65.2088,
        personas_afectadas: 45,
        fuente: 'camera',
        estado: 'activo',
        created_at: minutesAgo(8),
        updated_at: minutesAgo(8),
        fuente_detalles: {
          cameraId: 'CAM-SM-047',
          cameraLocation: 'Plaza San Martin - Barrio Sur',
          imageUrl: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600',
          arkiv_entity_key: generateSimulatedKey(),
          ai_analysis: {
            reasoning: 'Análisis de visión por computadora detecta columna de humo denso e incendios estructurales activos en las inmediaciones de la plaza.',
            suggestedActions: ['Despachar camión de bomberos principal', 'Alertar a la policía de Barrio Sur para evacuación perimetral'],
            confidence: 98,
            relatedPostIds: ['201'],
            arkiv_entity_key: generateSimulatedKey()
          }
        }
      },
      {
        tipo: 'storm',
        severidad: 'medium',
        ubicacion: 'Parque 9 de Julio - Av. Soldati',
        latitud: -26.8288,
        longitud: -65.1912,
        personas_afectadas: 30,
        fuente: 'sensor',
        estado: 'activo',
        created_at: minutesAgo(4),
        updated_at: minutesAgo(4),
        fuente_detalles: {
          sensorId: 'WS-PJ-09',
          temperature: 19,
          humidity: 92,
          windSpeed: 75,
          pressure: 1007,
          arkiv_entity_key: generateSimulatedKey(),
          ai_analysis: {
            reasoning: 'Sensores registran ráfagas de viento huracanado superiores a 70 km/h y una brusca caída de presión barométrica.',
            suggestedActions: ['Advertir a la población evitar circular por zonas arboladas', 'Desplegar equipos de Defensa Civil para despejar caídas de ramas'],
            confidence: 85,
            relatedPostIds: ['301'],
            arkiv_entity_key: generateSimulatedKey()
          }
        }
      }
    ];

    const attendedIncidents = [
      {
        tipo: 'flood',
        severidad: 'critical',
        ubicacion: 'Av. Roca y Lincoln - Zona Sur',
        latitud: -26.8453,
        longitud: -65.2198,
        personas_afectadas: 220,
        fuente: 'social',
        estado: 'atendido',
        created_at: minutesAgo(120),
        updated_at: minutesAgo(105),
        fuente_detalles: (() => {
          const aiKey = generateSimulatedKey();
          const dispatchKey = generateSimulatedKey();
          return {
            platform: 'Multi-plataforma (IA)',
            content: 'URGENTE: Canal desbordado en Zona Sur. El agua ingresa a viviendas y arrastra vehículos.',
            imageUrl: 'https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=600',
            username: '@emergencias_tuc',
            arkiv_entity_key: dispatchKey,
            ai_analysis: {
              reasoning: 'Análisis de lenguaje natural detecta reportes coincidentes de inundaciones en viviendas en Zona Sur.',
              suggestedActions: ['Despliegue inmediato de Defensa Civil', 'Apertura de centro de evacuados'],
              confidence: 96,
              relatedPostIds: ['401', '402'],
              arkiv_entity_key: aiKey
            }
          };
        })()
      },
      {
        tipo: 'fire',
        severidad: 'high',
        ubicacion: 'Terminal de Omnibus - Av. Brigido Teran',
        latitud: -26.8366,
        longitud: -65.1954,
        personas_afectadas: 90,
        fuente: 'camera',
        estado: 'atendido',
        created_at: minutesAgo(90),
        updated_at: minutesAgo(70),
        fuente_detalles: (() => {
          const aiKey = generateSimulatedKey();
          const dispatchKey = generateSimulatedKey();
          return {
            cameraId: 'CAM-TO-023',
            cameraLocation: 'Terminal de Omnibus - Av. Brigido Teran',
            imageUrl: 'https://images.unsplash.com/photo-1486551937199-baf066858de7?w=600',
            arkiv_entity_key: dispatchKey,
            ai_analysis: {
              reasoning: 'Detección visual de cortocircuito e incendio en depósito exterior de la terminal.',
              suggestedActions: ['Intervención de dotación de bomberos', 'Evacuación de andenes 1 a 15'],
              confidence: 97,
              relatedPostIds: ['501'],
              arkiv_entity_key: aiKey
            }
          };
        })()
      },
      {
        tipo: 'accident',
        severidad: 'medium',
        ubicacion: 'Plazoleta Mitre - Av. Belgrano y Mitre',
        latitud: -26.8159,
        longitud: -65.2153,
        personas_afectadas: 15,
        fuente: 'social',
        estado: 'atendido',
        created_at: minutesAgo(60),
        updated_at: minutesAgo(48),
        fuente_detalles: (() => {
          const aiKey = generateSimulatedKey();
          const dispatchKey = generateSimulatedKey();
          return {
            platform: 'X (Twitter)',
            username: '@vecino_mitre',
            content: 'Colisión de tres autos en rotonda de Plazoleta Mitre. Tránsito totalmente interrumpido.',
            arkiv_entity_key: dispatchKey,
            ai_analysis: {
              reasoning: 'Análisis textual de posteos confirma accidente vial con congestión importante.',
              suggestedActions: ['Enviar ambulancia preventiva', 'Coordinar con tránsito municipal para desvíos'],
              confidence: 90,
              relatedPostIds: ['601'],
              arkiv_entity_key: aiKey
            }
          };
        })()
      },
      {
        tipo: 'violence',
        severidad: 'low',
        ubicacion: 'Av. Fco. de Aguirre y Juan B. Justo',
        latitud: -26.8001,
        longitud: -65.2014,
        personas_afectadas: 8,
        fuente: 'social',
        estado: 'atendido',
        created_at: minutesAgo(45),
        updated_at: minutesAgo(35),
        fuente_detalles: (() => {
          const aiKey = generateSimulatedKey();
          const dispatchKey = generateSimulatedKey();
          return {
            platform: 'X (Twitter)',
            username: '@seguridad_norte',
            content: 'Disturbios y peleas callejeras en inmediaciones de la avenida.',
            arkiv_entity_key: dispatchKey,
            ai_analysis: {
              reasoning: 'Publicación aislada reporta comportamiento antisocial activo.',
              suggestedActions: ['Notificar patrulla policial de la zona'],
              confidence: 72,
              relatedPostIds: ['701'],
              arkiv_entity_key: aiKey
            }
          };
        })()
      }
    ];

    // Merge arkiv_keys for attended incidents into their details as well
    attendedIncidents.forEach(inc => {
      inc.fuente_detalles.dispatched_at = inc.updated_at;
      inc.fuente_detalles.platform = 'Climate Crisis Dashboard Operator';
    });

    const allIncidents = [...activeIncidents, ...attendedIncidents];

    console.log(`Inserting ${allIncidents.length} clean mock incidents into Supabase...`);
    const { data: insertedData, error: insertError } = await supabase
      .from('incidentes')
      .insert(allIncidents)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert seed incidents: ${insertError.message}`);
    }

    console.log(`Successfully seeded ${insertedData.length} incidents in Supabase!`);
    console.log('Database reset completed successfully.');
  } catch (err) {
    console.error('Error running database reset:', err.message);
    process.exit(1);
  }
}

run();
