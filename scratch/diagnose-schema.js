const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching columns from information_schema...');
    // We can run a raw SQL query using a Postgres function or try to insert a test row to see what works
    // Let's try to insert a row with only ID and see what columns are returned or fetch it
    const { data, error } = await supabase
      .from('incidentes')
      .insert({
        tipo: 'general',
        severidad: 'low',
        ubicacion: 'Test Temp Location',
        latitud: 0,
        longitud: 0,
        personas_afectadas: 0,
        fuente: 'social',
        estado: 'activo'
      })
      .select();

    if (error) {
      console.error('Insert error:', error);
    } else {
      console.log('Inserted test row successfully:', data[0]);
      // Delete the test row
      await supabase.from('incidentes').delete().eq('id', data[0].id);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
