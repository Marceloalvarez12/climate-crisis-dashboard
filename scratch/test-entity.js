const { createPublicClient, http } = require('@arkiv-network/sdk');
const { braga } = require('@arkiv-network/sdk/chains');

const keysToTest = [
  '0x766417b5fca4ab3f226d52f15d709aedec109bfbdcd5150a8b204ad563f54fb7',
  '0x8af6d0ce67206692bb6058581d9b388a989cfa0fe36be7dbc9c1868904b5c1e4',
  '0x314947347592668c3da29484e372630dbd97edaae712ce3e6d27f7af08dc053e'
];

async function main() {
  const client = createPublicClient({
    chain: braga,
    transport: http()
  });

  for (const key of keysToTest) {
    console.log(`Testing key: ${key}`);
    try {
      const entity = await client.getEntity(key);
      console.log(`Key ${key} exists:`, !!entity);
      if (entity) {
        console.log('Entity details:', JSON.stringify(entity, null, 2));
      }
    } catch (error) {
      console.log(`Key ${key} error (does not exist or network error):`, error.message);
    }
    console.log('---------------------------------------------');
  }
}

main();
