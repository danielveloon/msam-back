const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs/promises');
const path =require('path');
const portfolioService = require('./veloonPortfolioService');

const configPath = path.join(__dirname, '..', '..', 'config.json');

/**
 * Função genérica para finalizar um atendimento.
 */
async function finalizeSession(session, apiToken, customMessage) {
  try {
    console.log(`[AÇÃO] Finalizando atendimento ${session.id} (Contato: ${session.contactId})`);
    await axios.post(
      `https://api.app.veloon.com.br/chat/v1/session/${session.id}/message`,
      { text: customMessage },
      { headers: { 'Authorization': apiToken } }
    );
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

/**
 * LÓGICA OTIMIZADA PARA CONTATOS CARTEIRIZADOS
 */
async function processCarteirizados(config, carteirizadosContactIds) {
  console.log(`[INFO] Iniciando busca direcionada para ${carteirizadosContactIds.size} contatos carteirizados.`);
  const inactivityTime = new Date(Date.now() - config.inactivityMinutes * 60 * 1000).toISOString();

  // Para cada ID de contato carteirizado, busca suas sessões inativas.
  for (const contactId of carteirizadosContactIds) {
    try {
      const response = await axios.get('https://api.app.veloon.com.br/chat/v1/session', {
        headers: { 'Authorization': config.veloonApiToken },
        params: {
          'ContactId': contactId,
          'Status': 'IN_PROGRESS,STARTED',
          'LastInteractionAt.Before': inactivityTime,
        }
      });

      if (response.data.items && response.data.items.length > 0) {
        for (const session of response.data.items) {
          await finalizeSession(session, config.veloonApiToken, config.customMessage);
        }
      }
    } catch (error) {
      console.error(`[ERRO] Falha ao buscar sessões para o contato ${contactId}:`, error.message);
    }
  }
}

/**
 * LÓGICA COM PAGINAÇÃO PARA CONTATOS NÃO CARTEIRIZADOS
 */
async function processNaoCarteirizados(config, carteirizadosContactIds) {
  console.log('[INFO] Iniciando busca global paginada para contatos não carteirizados.');
  const inactivityTime = new Date(Date.now() - config.inactivityMinutes * 60 * 1000).toISOString();

  let pageNumber = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    try {
      const response = await axios.get('https://api.app.veloon.com.br/chat/v1/session', {
        headers: { 'Authorization': config.veloonApiToken },
        params: {
          'Status': 'IN_PROGRESS,STARTED',
          'LastInteractionAt.Before': inactivityTime,
          'PageSize': 100,
          'PageNumber': pageNumber,
        }
      });

      const sessions = response.data.items;
      if (!sessions || sessions.length === 0) {
        console.log(`[INFO] Página ${pageNumber} sem atendimentos inativos.`);
        break; // Sai do loop se não houver mais itens
      }

      console.log(`[INFO] Processando ${sessions.length} atendimentos da página ${pageNumber}.`);

      for (const session of sessions) {
        const contactId = session.contactId || session.contact?.id;

        // Pula se não tiver ID ou se for um contato carteirizado
        if (!contactId || carteirizadosContactIds.has(contactId)) {
          continue;
        }

        // Se chegou aqui, é um não-carteirizado, então finaliza.
        await finalizeSession(session, config.veloonApiToken, config.customMessage);
      }

      hasMorePages = response.data.hasMorePages;
      pageNumber++;

    } catch (error) {
      console.error(`[ERRO] Falha ao buscar a página ${pageNumber} de atendimentos:`, error.message);
      break; // Em caso de erro, interrompe a paginação.
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

    // Busca a lista de contatos carteirizados (essencial para ambas as lógicas)
    const carteirizadosContactIds = await portfolioService.getCarteirizadosContactIds(config.veloonApiToken);

    // Decide qual estratégia usar com base na configuração
    if (config.portfolioFilter === 'carteirizados') {
      await processCarteirizados(config, carteirizadosContactIds);
    } else { // 'nao_carteirizados'
      await processNaoCarteirizados(config, carteirizadosContactIds);
    }

  } catch (error) {
    console.error('[ERRO GERAL] Falha crítica na execução da automação:', error.message);
  } finally {
    console.log(`[${new Date().toLocaleString('pt-BR')}] Verificação concluída.`);
    console.log('----------------------------------------------------');
  }
};

const initializeScheduler = () => {
  cron.schedule('* * * * *', checkInactiveSessions);
  console.log('Agendador de tarefas iniciado com lógica otimizada.');
  checkInactiveSessions();
};

module.exports = { initializeScheduler };