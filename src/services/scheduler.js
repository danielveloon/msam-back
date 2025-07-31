const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const portfolioService = require('./veloonPortfolioService');

const configPath = path.join(__dirname, '..', '..', 'config.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function finalizeSession(session, apiToken, customMessage) {
    try {
        console.log(`[AÇÃO] Finalizando atendimento ${session.id} (Contato: ${session.contactId})`);
        await axios.post(
            `https://api.app.veloon.com.br/chat/v1/session/${session.id}/message`,
            { text: customMessage },
            { headers: { 'Authorization': apiToken } }
        );
        await sleep(500); // Pequena pausa entre enviar a mensagem e concluir
        await axios.put(
            `https://api.app.veloon.com.br/chat/v1/session/${session.id}/complete`,
            { reactivateOnNewMessage: true, stopBotInExecution: true },
            { headers: { 'Authorization': apiToken } }
        );
        console.log(`[SUCESSO] Atendimento ${session.id} finalizado.`);
    } catch (error) {
        console.error(`[ERRO] Falha ao finalizar o atendimento ${session.id}:`, error.message);
    }
}

async function processCarteirizados(config, carteirizadosContactIds) {
    const inactivityTime = new Date(Date.now() - config.inactivityMinutes * 60 * 1000);
    console.log(`[INFO] Buscando atendimentos CARTEIRIZADOS inativos desde: ${inactivityTime.toLocaleString('pt-BR')}`);

    for (const contactId of carteirizadosContactIds) {
        try {
            const response = await axios.get('https://api.app.veloon.com.br/chat/v1/session', {
                headers: { 'Authorization': config.veloonApiToken },
                params: {
                    'ContactId': contactId,
                    'Status': 'IN_PROGRESS,STARTED',
                    'LastInteractionAt.Before': inactivityTime.toISOString(),
                }
            });
            if (response.data.items && response.data.items.length > 0) {
                for (const session of response.data.items) {
                    await finalizeSession(session, config.veloonApiToken, config.customMessage);
                    await sleep(1000); // Pausa de 1 segundo entre a finalização de cada atendimento
                }
            }
        } catch (error) {
            console.error(`[ERRO] Falha ao buscar sessões para o contato ${contactId}:`, error.message);
        }
        await sleep(250); // Pausa de 250ms entre a verificação de cada contato
    }
}

async function processNaoCarteirizados(config, carteirizadosContactIds) {
    const inactivityTime = new Date(Date.now() - config.inactivityMinutes * 60 * 1000);
    console.log(`[INFO] Buscando atendimentos NÃO CARTEIRIZADOS inativos desde: ${inactivityTime.toLocaleString('pt-BR')}`);

    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        try {
            const response = await axios.get('https://api.app.veloon.com.br/chat/v1/session', {
                headers: { 'Authorization': config.veloonApiToken },
                params: {
                    'Status': 'IN_PROGRESS,STARTED',
                    'LastInteractionAt.Before': inactivityTime.toISOString(),
                    'PageSize': 100,
                    'PageNumber': pageNumber,
                }
            });
            const sessions = response.data.items;
            if (!sessions || sessions.length === 0) break;

            console.log(`[INFO] Processando ${sessions.length} atendimentos da página ${pageNumber}.`);
            for (const session of sessions) {
                const contactId = session.contactId || session.contact?.id;
                if (!contactId || carteirizadosContactIds.has(contactId)) {
                    continue;
                }
                await finalizeSession(session, config.veloonApiToken, config.customMessage);
                await sleep(1000); // Pausa de 1 segundo entre a finalização de cada atendimento
            }
            hasMorePages = response.data.hasMorePages;
            pageNumber++;
            await sleep(2000); // Pausa de 2 segundos entre as páginas
        } catch (error) {
            console.error(`[ERRO] Falha ao buscar a página ${pageNumber} de atendimentos:`, error.message);
            break;
        }
    }
}

const checkInactiveSessions = async () => {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleString('pt-BR')}] Iniciando verificação...`);
    try {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(fileContent);

        if (!config.isAutomationActive) {
            console.log('[INFO] Automação está desativada. Pulando execução.');
            return;
        }

        const carteirizadosContactIds = await portfolioService.getCarteirizadosContactIds(config.veloonApiToken);

        if (config.portfolioFilter === 'carteirizados') {
            await processCarteirizados(config, carteirizadosContactIds);
        } else {
            await processNaoCarteirizados(config, carteirizadosContactIds);
        }
    } catch (error) {
        console.error('[ERRO GERAL] Falha crítica na execução da automação:', error.message);
    } finally {
        console.log(`[${new Date().toLocaleString('pt-BR')}] Verificação concluída.`);
        console.log('----------------------------------------------------');
    }
};

//const initializeScheduler = () => {
    // AGENDAMENTO MAIS SEGURO: A cada 15 minutos.
    //cron.schedule('*/15 * * * *', checkInactiveSessions);
    //console.log('Agendador de tarefas iniciado para rodar a cada 15 minutos.');
    // Descomente a linha abaixo apenas para um teste imediato ao iniciar o servidor.
    // checkInactiveSessions();
//};

module.exports = { checkInactiveSessions };