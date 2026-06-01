const { createPublicClient, http } = require('@arkiv-network/sdk');
const { braga } = require('@arkiv-network/sdk/chains');

async function main() {
  const key = '0xb5443307029efA0a1F1BF44421CCCaF3249ac0e4';
  console.log(`Querying Braga Testnet with key: ${key}`);
  
  try {
    const client = createPublicClient({
      chain: braga,
      transport: http()
    });
    
    console.log('Client created. Calling getEntity...');
    const entity = await client.getEntity(key);
    console.log('Result:', entity);
  } catch (error) {
    console.error('Error caught during getEntity:', error);
  }
}

main();
