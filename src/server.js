const express = require('express');
const cors = require('cors');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota da API para o front-end
app.use('/api/v1/settings', settingsRoutes);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor da API rodando na porta ${PORT}`);
});