require('dotenv').config();

const express = require('express');
const cors = require('cors');
const settingsRoutes = require('./routes/settingsRoutes');
const db = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota da API
app.use('/api/v1/settings', settingsRoutes);

// Inicializa o banco de dados e então inicia o servidor
db.initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor da API rodando na porta ${PORT}`);
    });
});