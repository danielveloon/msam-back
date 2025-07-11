const express = require('express');
const cors = require('cors');
const settingsRoutes = require('./routes/settingsRoutes');
const { initializeScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001; // Porta do backend

// Middlewares
app.use(cors()); // Permite que o front (em outra porta) acesse a API
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições

// Rotas da API
app.use('/api/v1/settings', settingsRoutes);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor backend rodando na porta ${PORT}`);
  // Inicia o agendador de tarefas quando o servidor sobe
  initializeScheduler();
});