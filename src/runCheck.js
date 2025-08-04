// Carrega as variáveis de ambiente do Heroku
require('dotenv').config();

// O require de db.js inicializa a conexão com o banco de dados
require('./services/db');

// Importa apenas a função principal que queremos executar
const { checkInactiveSessions } = require('./services/scheduler');

console.log('Iniciando tarefa agendada pelo Heroku Scheduler...');

// Chama a função e finaliza o processo informando o status para o Heroku
checkInactiveSessions()
  .then(() => {
    console.log('Tarefa agendada concluída com sucesso.');
    process.exit(0); // Sai com sucesso
  })
  .catch(error => {
    console.error('Erro durante a execução da tarefa agendada:', error);
    process.exit(1); // Sai com erro
  });