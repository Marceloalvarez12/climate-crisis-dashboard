const fs = require('fs');
const path = require('path');
const { createWalletClient, http } = require('@arkiv-network/sdk');
const { braga } = require('@arkiv-network/sdk/chains');
const { privateKeyToAccount } = require('@arkiv-network/sdk/accounts');
const { jsonToPayload } = require('@arkiv-network/sdk/utils');

async function main() {
  console.log('--- Registering Real Entity on Braga Testnet ---');
  
  // 1. Load private key
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local file not found');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^ARKIV_PRIVATE_KEY=(.+)$/m);
  if (!match) {
    console.error('ERROR: ARKIV_PRIVATE_KEY not found in .env.local');
    return;
  }
  
  let privateKey = match[1].trim();
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  try {
    const account = privateKeyToAccount(privateKey);
    console.log(`Using account: ${account.address}`);

    const walletClient = createWalletClient({
      chain: braga,
      transport: http(),
      account,
    });

    const testPayload = {
      agent: "Gemini 2.0 Flash",
      task: "Real-time Climate Crisis Monitoring (Hackathon Integration Proof)",
      location: "San Miguel de Tucumán",
      type: "flood",
      severity: "high",
      summary: "Simulación de inundación severa en Av. Mate de Luna certificada on-chain para el track de Arkiv.",
      confidence: 95,
      scannedAt: new Date().toISOString(),
    };

    console.log('Sending transaction to create entity...');
    const result = await walletClient.createEntity({
      payload: jsonToPayload(testPayload),
      contentType: 'application/json',
      attributes: [
        { key: 'project', value: 'climate-crisis-dashboard' },
        { key: 'agent', value: 'Gemini 2.0 Flash' },
        { key: 'tipo', value: 'flood' },
        { key: 'severidad', value: 'high' },
        { key: 'status', value: 'detected' },
        { key: 'track', value: 'arkiv' },
      ],
      expiresIn: 604800, // 7 días
    });

    console.log('\nSUCCESS!');
    console.log(`Created Entity Key: ${result.entityKey}`);
    console.log(`Transaction Hash: ${result.transactionHash || 'Available via explorer using Entity Key'}`);
    console.log(`Block Explorer Link: https://explorer.braga.hoodi.arkiv.network/entity/${result.entityKey}`);
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}

main();
