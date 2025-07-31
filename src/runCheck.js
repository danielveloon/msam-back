const fs = require('fs');
const path = require('path');

function getConfig() {
    const configPath = path.resolve(__dirname, '../config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
}

async function checkInactiveSessions() {
    const config = getConfig();

    if (!config.enabled) {
        console.log('[INFO] Automação está desativada. Pulando execução.');
        return;
    }

    // lógica da verificação aqui
    console.log('[INFO] Executando rotina de verificação...');
}

module.exports = { checkInactiveSessions };
