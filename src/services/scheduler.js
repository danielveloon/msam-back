const axios = require('axios');
const portfolioService = require('./veloonPortfolioService');
const db = require('./db'); // Importa o nosso módulo de banco de dados

// Utilitário de espera
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ----- INÍCIO DAS FUNÇÕES AUXILIARES (finalizeSession, etc.) -----
// (Copie as funções processCarteirizados, processNaoCarteirizados e finalizeSession aqui,
// pois elas não precisam de alteração)

async function finalizeSession(session, apiToken, customMessage) {
    try {
        console.log(`[AÇÃO] Finalizando atendimento ${session.id} (Contato: ${session.contactId})`);
        const lastInteraction = new Date(session.lastInteractionDate);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (lastInteraction > twentyFourHoursAgo) {
            await axios.post(
                `https://api.app.veloon.com.br/chat/v1/session/${session.id}/message`,
                { text: customMessage },
                { headers: { 'Authorization': apiToken } }
            );
            await sleep(500);
        } else {
            console.log(`[INFO] Atendimento ${session.id} com mais de 24h. Não será enviada a mensagem de aviso.`);
        }

        await axios.put(
            `https://api.app.veloon.com.br/chat/v1/session/${session.id}/complete`,
            { reactivateOnNewMessage: true, stopBotInExecution: true },
            { headers: { 'Authorization': apiToken } }
        );
        console.log(`[SUCESSO] Atendimento ${session.id} finalizado.`);
    } catch (error) {
        console.error(`[ERRO] Falha ao finalizar o atendimento ${session.id}:`, error.response?.data?.message || error.message);
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
                    await sleep(1000);
                }
            }
        } catch (error) {
            console.error(`[ERRO] Falha ao buscar sessões para o contato ${contactId}:`, error.message);
        }
        await sleep(250);
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
                await sleep(1000);
            }
            hasMorePages = response.data.hasMorePages;
            pageNumber++;
            await sleep(2000);
        } catch (error) {
            console.error(`[ERRO] Falha ao buscar a página ${pageNumber} de atendimentos:`, error.message);
            break;
        }
    }
}

// ----- FIM DAS FUNÇÕES AUXILIARES -----


// Função principal que será chamada pelo Heroku Scheduler
const checkInactiveSessions = async () => {
    console.log('----------------------------------------------------');
    console.log(`[${new Date().toLocaleString('pt-BR')}] Iniciando verificação...`);
    try {
        // VERSÃO CORRETA: Busca as configurações do banco de dados
        const config = await db.getSettings();

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
        console.error('[ERRO GERAL] Falha crítica na execução da automação:', error);
    } finally {
        console.log(`[${new Date().toLocaleString('pt-BR')}] Verificação concluída.`);
        console.log('----------------------------------------------------');
    }
};

// Apenas exporta a função principal. Nenhuma chamada ao cron.schedule aqui.
module.exports = { checkInactiveSessions };