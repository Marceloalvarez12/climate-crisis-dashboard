const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyfvmghkkrofyveixlqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZnZtZ2hra3JvZnl2ZWl4bHFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3OTQ4MCwiZXhwIjoyMDkzMTU1NDgwfQ.GJTDzXEMdvGtxNZrChTThWd456u-W3e5GMcUd8qqq9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching active/attended incidents from Supabase...');
  const { data, error } = await supabase
    .from('incidentes')
    .select('id, tipo, ubicacion, estado, fuente_detalles');

  if (error) {
    console.error('Error fetching incidents:', error);
    return;
  }

  console.log(`Found ${data.length} incidents.`);
  let hasOnChain = false;
  data.forEach((inc) => {
    const details = inc.fuente_detalles || {};
    const dispatchKey = details.arkiv_entity_key;
    const detectionKey = details.detection_arkiv_key || (details.ai_analysis && details.ai_analysis.arkiv_entity_key);

    console.log(`Incident ID: ${inc.id} | Tipo: ${inc.tipo} | Ubicación: ${inc.ubicacion} | Estado: ${inc.estado}`);
    if (dispatchKey) {
      console.log(`  -> Dispatch Arkiv Key: ${dispatchKey}`);
      hasOnChain = true;
    }
    if (detectionKey) {
      console.log(`  -> Detection Arkiv Key: ${detectionKey}`);
      hasOnChain = true;
    }
  });

  if (!hasOnChain) {
    console.log('No incidents found with on-chain Arkiv keys.');
  }
}

main();
