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
    // Remove o token da resposta para não expô-lo no front-end
    const { veloonApiToken, ...safeConfig } = config;
    res.json(safeConfig);
  } catch (error) {
    console.error('Erro ao ler o arquivo de configuração:', error);
    res.status(500).json({ message: 'Erro interno ao buscar configurações.' });
  }
});

// Rota PUT: Atualiza as configurações
router.put('/', async (req, res) => {
  try {
    // Lê o arquivo atual para manter o token, que não vem do front-end
    const currentFileContent = await fs.readFile(configPath, 'utf-8');
    const currentConfig = JSON.parse(currentFileContent);

    // Cria a nova configuração mesclando o token antigo com os novos dados
    const updatedConfig = {
      veloonApiToken: currentConfig.veloonApiToken, // Preserva o token
      ...req.body // Adiciona os dados vindos do front-end
    };

    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar o arquivo de configuração:', error);
    res.status(500).json({ message: 'Erro interno ao salvar configurações.' });
  }
});

module.exports = router;