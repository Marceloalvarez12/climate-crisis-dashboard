const fs = require('fs');
const path = require('path');

const subagents = [
  { id: '1e309c21-a34a-4011-bc03-baefda729cf8', name: 'api_reviewer' },
  { id: '17e1ceb4-6fa6-4a8f-ac74-21d5dbb2c3b7', name: 'frontend_reviewer' },
  { id: '909f0f04-fb68-4991-8857-ebe9f897d5bf', name: 'hooks_reviewer' }
];

subagents.forEach(agent => {
  const transcriptPath = `C:\\Users\\MARCELO ALVAREZ\\.gemini\\antigravity\\brain\\${agent.id}\\.system_generated\\logs\\transcript.jsonl`;
  try {
    if (!fs.existsSync(transcriptPath)) return;
    const fileContent = fs.readFileSync(transcriptPath, 'utf8');
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
    
    console.log(`\n========================================`);
    console.log(`=== LAST STEPS OF ${agent.name.toUpperCase()} ===`);
    console.log(`========================================`);
    
    const lastN = Math.min(5, lines.length);
    for (let i = lines.length - lastN; i < lines.length; i++) {
      const obj = JSON.parse(lines[i]);
      console.log(`Step ${obj.step_index}: source=${obj.source}, type=${obj.type}, status=${obj.status}`);
      if (obj.thinking) {
        console.log(`--- THINKING (length: ${obj.thinking.length}) ---`);
        console.log(obj.thinking.slice(0, 1000) + '...\n');
      }
      if (obj.content) {
        console.log(`--- CONTENT (length: ${obj.content.length}) ---`);
        console.log(obj.content.slice(0, 1000) + '...\n');
      }
    }
  } catch (err) {
    console.error(err);
  }
});
