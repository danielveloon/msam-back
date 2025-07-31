// Este script é chamado pelo Heroku Scheduler

const { checkInactiveSessions } = require('./services/scheduler');

console.log('Iniciando tarefa agendada pelo Heroku Scheduler...');

checkInactiveSessions()
  .then(() => {
    console.log('Tarefa agendada concluída com sucesso.');
    process.exit(0); // Informa ao Heroku que terminou bem
  })
  .catch(error => {
    console.error('Erro durante a execução da tarefa agendada:', error);
    process.exit(1); // Informa ao Heroku que deu erro
  });