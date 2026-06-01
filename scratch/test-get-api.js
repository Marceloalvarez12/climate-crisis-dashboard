const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('--- Simulating API GET for estado=atendido ---');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from('incidentes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  // Filter as in GET /api/incidentes?estado=atendido
  const filteredData = data.filter((inc) => inc.estado === 'atendido' || (inc.estado === 'activo' && inc.fuente === 'social'));

  console.log(`Returned ${filteredData.length} items for estado=atendido`);
  filteredData.forEach(inc => {
    console.log(`ID: ${inc.id} | Ubicacion: ${inc.ubicacion} | Estado: ${inc.estado} | Fuente: ${inc.fuente}`);
  });
}

main();
