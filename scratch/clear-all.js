const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('--- Database Clean Slate Script ---');
  
  // 1. Load environment variables from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local file not found');
    return;
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
    console.error('ERROR: Missing Supabase credentials in env');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    // 2. Clear all incident logs
    console.log('Deleting all entries in table "incidentes"...');
    const { error: deleteIncidentsError } = await supabase
      .from('incidentes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (deleteIncidentsError) {
      throw new Error(`Failed to delete incidents: ${deleteIncidentsError.message}`);
    }
    console.log('Successfully cleared all incidents!');

    // 3. Reset all emergency dispatch resources to available
    console.log('Resetting all dispatch resources in table "recursos"...');
    const { error: resetResourcesError } = await supabase
      .from('recursos')
      .update({
        estado: 'available',
        incidente_id: null,
        updated_at: new Date().toISOString()
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (resetResourcesError) {
      console.warn(`Could not reset resources table: ${resetResourcesError.message}`);
    } else {
      console.log('Successfully reset all resources to available!');
    }

    console.log('\nDATABASE CLEAN SLATE COMPLETED!');
  } catch (error) {
    console.error('ERROR during database clear:', error.message);
  }
}

main();
