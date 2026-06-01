const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyfvmghkkrofyveixlqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZnZtZ2hra3JvZnl2ZWl4bHFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU3OTQ4MCwiZXhwIjoyMDkzMTU1NDgwfQ.GJTDzXEMdvGtxNZrChTThWd456u-W3e5GMcUd8qqq9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('incidentes')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total incidents in DB: ${data.length}`);
  data.forEach(d => {
    console.log(`ID: ${d.id} | Tipo: ${d.tipo} | Fuente: ${d.fuente} | Estado: ${d.estado} | Key: ${d.fuente_detalles?.arkiv_entity_key}`);
  });
}

main();
