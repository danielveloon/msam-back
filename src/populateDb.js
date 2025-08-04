// Arquivo: src/populate-db.js

// Carrega as variáveis do arquivo .env
require('dotenv').config();

const { Pool } = require('pg');

// Garante que estamos conectando ao banco correto
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const populateDatabase = async () => {
  const token = process.env.VELOON_API_TOKEN;

  if (!token) {
    console.error("ERRO: VELOON_API_TOKEN não encontrado no arquivo .env");
    return;
  }

  console.log("Conectando ao banco de dados para popular...");

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Inicializa a tabela (cria se não existir e insere a linha padrão)
    const initQuery = `
        CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            isAutomationActive BOOLEAN,
            inactivityMinutes INT,
            customMessage TEXT,
            portfolioFilter VARCHAR(20),
            veloonApiToken TEXT
        );
    `;
    await client.query(initQuery);

    // Insere uma linha padrão se ela não existir
    await client.query(`
        INSERT INTO settings (id, isAutomationActive, inactivityMinutes, customMessage, portfolioFilter, veloonApiToken)
        VALUES (1, false, 4320, 'Mensagem padrão', 'carteirizados', 'TOKEN_PLACEHOLDER')
        ON CONFLICT (id) DO NOTHING;
    `);

    // Agora, atualiza o token com o valor real do .env
    const updateQuery = 'UPDATE settings SET veloonApiToken = $1 WHERE id = 1';
    await client.query(updateQuery, [token]);

    await client.query('COMMIT');
    console.log("✅ SUCESSO! O banco de dados foi populado/atualizado com seu token.");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ FALHA: Erro ao popular o banco de dados.", err);
  } finally {
    client.release();
    pool.end();
  }
};

populateDatabase();