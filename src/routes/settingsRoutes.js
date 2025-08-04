const express = require('express');
const router = express.Router();
const db = require('../services/db'); // Importa nosso novo módulo de DB

// Rota GET: Retorna as configurações atuais do banco de dados
router.get('/', async (req, res) => {
  try {
    const settings = await db.getSettings();
    // Remove o token da resposta para não expô-lo no front-end
    const { veloonApiToken, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (error) {
    console.error('Erro ao buscar configurações do DB:', error);
    res.status(500).json({ message: 'Erro interno ao buscar configurações.' });
  }
});

// Rota PUT: Atualiza as configurações no banco de dados
router.put('/', async (req, res) => {
  try {
    const newSettings = req.body;
    await db.updateSettings(newSettings);
    console.log('Configurações atualizadas no banco de dados.');
    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar configurações no DB:', error);
    res.status(500).json({ message: 'Erro interno ao salvar configurações.' });
  }
});

module.exports = router;