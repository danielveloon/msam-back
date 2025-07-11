const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const configPath = path.join(__dirname, '..', '..', 'config.json');

// Função principal da automação
const checkInactiveSessions = async () => {
  console.log('Executando verificação de atendimentos inativos...');

  try {
    // 1. Ler as configurações atuais do arquivo
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent);

    // 2. Se a automação estiver desativada no arquivo, não fazer nada
    if (!config.isAutomationActive) {
      console.log('Automação está desativada. Pulando execução.');
      return;
    }

    const inactivityTime = new Date(Date.now() - config.inactivityMinutes * 60 * 1000).toISOString();

    // 3. Buscar atendimentos inativos na API do Veloon
    const response = await axios.get('https://api.app.veloon.com.br/chat/v1/session', {
      headers: {
        'Authorization': config.veloonApiToken,
        'accept': 'application/json'
      },
      params: {
        'Status': 'IN_PROGRESS,STARTED',
        'LastInteractionAt.Before': inactivityTime,
        'PageSize': 100,
        'OrderBy': 'LastInteractionAt',
        'OrderDirection': 'ASCENDING'
      }
    });

    const inactiveSessions = response.data.items;
    if (!inactiveSessions || inactiveSessions.length === 0) {
      console.log('Nenhum atendimento inativo encontrado.');
      return;
    }

    console.log(`Encontrados ${inactiveSessions.length} atendimentos para finalizar.`);

    // 4. Itera sobre cada atendimento e finaliza
    for (const session of inactiveSessions) {
      try {
        // Envia a mensagem de aviso
        await axios.post(
          `https://api.app.veloon.com.br/chat/v1/session/${session.id}/message`,
          { text: config.customMessage },
          { headers: { 'Authorization': config.veloonApiToken } }
        );

        // Conclui o atendimento
        await axios.put(
          `https://api.app.veloon.com.br/chat/v1/session/${session.id}/complete`,
          { reactivateOnNewMessage: true, stopBotInExecution: true },
          { headers: { 'Authorization': config.veloonApiToken } }
        );

        console.log(`Atendimento ${session.id} finalizado com sucesso.`);
      } catch (sessionError) {
         console.error(`Erro ao finalizar o atendimento ${session.id}:`, sessionError.message);
      }
    }

  } catch (error) {
    console.error('Erro geral na execução da automação:', error.message);
  }
};

// Agenda a tarefa para rodar a cada minuto.
const initializeScheduler = () => {
  cron.schedule('* * * * *', checkInactiveSessions);
  console.log('Agendador de tarefas iniciado. A verificação rodará a cada minuto.');
};

module.exports = { initializeScheduler };