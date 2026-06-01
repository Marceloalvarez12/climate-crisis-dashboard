const fs = require('fs');
const path = require('path');
const { createPublicClient, http } = require('@arkiv-network/sdk');
const { braga } = require('@arkiv-network/sdk/chains');
const { privateKeyToAccount } = require('@arkiv-network/sdk/accounts');

async function testConnection() {
  console.log('--- Arkiv Connection Test ---');
  
  // 1. Load private key from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local file not found at:', envPath);
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^ARKIV_PRIVATE_KEY=(.+)$/m);
  if (!match) {
    console.error('ERROR: ARKIV_PRIVATE_KEY not found in .env.local');
    return;
  }
  
  const rawKey = match[1].trim();
  console.log(`Found ARKIV_PRIVATE_KEY in .env.local (length: ${rawKey.length})`);
  
  // 2. Validate and parse private key
  let privateKey = rawKey;
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  if (privateKey.length !== 66) {
    console.error(`ERROR: Private key length is ${privateKey.length} characters. Expected 66 (including '0x' prefix).`);
    return;
  }
  
  try {
    // 3. Derive account
    const account = privateKeyToAccount(privateKey);
    console.log(`Wallet address derived from private key: ${account.address}`);
    
    // 4. Connect to Braga chain
    const client = createPublicClient({
      chain: braga,
      transport: http()
    });
    
    console.log(`Connecting to chain: ${braga.name} (ID: ${braga.id})`);
    
    // 5. Test RPC call
    const blockNumber = await client.getBlockNumber();
    console.log(`Successfully connected! Current block number: ${blockNumber}`);
    
    // 6. Check balance
    // Arkiv SDK client has public actions like getBalance
    const balance = await client.getBalance({ address: account.address });
    const balanceInGlm = Number(balance) / 1e18;
    console.log(`Wallet balance: ${balanceInGlm} GLM (${balance} wei)`);
    
    if (balanceInGlm === 0) {
      console.warn('WARNING: Wallet has 0 GLM. You will not be able to send transactions (create entities) on-chain.');
    } else {
      console.log('SUCCESS: Wallet has funds and is ready to write to the blockchain!');
    }
  } catch (error) {
    console.error('ERROR during connection test:', error);
  }
}

testConnection();
