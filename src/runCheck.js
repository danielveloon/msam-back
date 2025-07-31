// Arquivo: src/run-check.js

// Importa apenas o necessário para a tarefa
const { checkInactiveSessions } = require('./services/scheduler');

console.log('Iniciando execução manual via Heroku Scheduler...');

// Chama a função e finaliza o processo quando terminar
checkInactiveSessions().then(() => {
    console.log('Execução do Heroku Scheduler concluída.');
    process.exit(0); // Sai com sucesso
}).catch(error => {
    console.error('Erro na execução do Heroku Scheduler:', error);
    process.exit(1); // Sai com erro
});