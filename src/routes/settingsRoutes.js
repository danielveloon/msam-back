const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');

const configPath = path.join(__dirname, '..', '..', 'config.json');

// Rota GET: Retorna as configurações atuais
router.get('/', async (req, res) => {
  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    res.json(config);
  } catch (error) {
    console.error('Erro ao ler o arquivo de configuração:', error);
    res.status(500).json({ message: 'Erro interno ao buscar configurações.' });
  }
});

// Rota PUT: Atualiza as configurações
router.put('/', async (req, res) => {
  try {
    // Lê o arquivo atual para não perder campos que não vêm do front (como o token)
    const currentFileContent = await fs.readFile(configPath, 'utf-8');
    const currentConfig = JSON.parse(currentFileContent);

    // Atualiza o objeto de configuração com os novos dados do corpo da requisição
    const updatedConfig = {
      ...currentConfig,
      ...req.body
    };

    // Escreve o objeto atualizado de volta no arquivo JSON
    // O 'null, 2' formata o JSON para que ele fique legível
    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar o arquivo de configuração:', error);
    res.status(500).json({ message: 'Erro interno ao salvar configurações.' });
  }
});

module.exports = router;