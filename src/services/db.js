// Arquivo: src/services/db.js

const { Pool } = require('pg');

// Detecta se está no Heroku (que define a variável NODE_ENV)
const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  // Exige SSL apenas em produção (no Heroku)
  ssl: isProduction ? { rejectUnauthorized: false } : false
};

const pool = new Pool(connectionConfig);

/**
 * Função para criar a tabela de configurações se ela não existir.
 */
const initializeDatabase = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            isAutomationActive BOOLEAN NOT NULL,
            inactivityMinutes INT NOT NULL,
            customMessage TEXT NOT NULL,
            portfolioFilter VARCHAR(20) NOT NULL,
            veloonApiToken TEXT NOT NULL
        );
    `;
    try {
        await pool.query(queryText);
        console.log("Tabela 'settings' verificada/criada com sucesso.");

        // Insere a configuração padrão se a tabela estiver vazia
        const res = await pool.query('SELECT COUNT(*) FROM settings WHERE id = 1');
        if (res.rows[0].count === '0') {
            const insertQuery = `
                INSERT INTO settings(id, isAutomationActive, inactivityMinutes, customMessage, portfolioFilter, veloonApiToken)
                VALUES(1, false, 4320, 'Sua mensagem padrão aqui', 'carteirizados', 'SEU_TOKEN_AQUI')
            `;
            await pool.query(insertQuery);
            console.log("Configuração inicial inserida no banco de dados.");
        }
    } catch (err) {
        console.error("Erro ao inicializar o banco de dados:", err);
    }
};

/**
 * Busca as configurações do banco de dados.
 */
const getSettings = async () => {
    const res = await pool.query('SELECT * FROM settings WHERE id = 1');
    // A API do Postgres retorna as chaves em minúsculas, precisamos mapear para camelCase
    const dbRow = res.rows[0];
    return {
        isAutomationActive: dbRow.isautomationactive,
        inactivityMinutes: dbRow.inactivityminutes,
        customMessage: dbRow.custommessage,
        portfolioFilter: dbRow.portfoliofilter,
        veloonApiToken: dbRow.veloonapitoken,
    };
};

/**
 * Atualiza as configurações no banco de dados.
 */
const updateSettings = async (newSettings) => {
    const query = `
        UPDATE settings
        SET isAutomationActive = $1, inactivityMinutes = $2, customMessage = $3, portfolioFilter = $4
        WHERE id = 1
    `;
    const values = [
        newSettings.isAutomationActive,
        newSettings.inactivityMinutes,
        newSettings.customMessage,
        newSettings.portfolioFilter
    ];
    await pool.query(query, values);
};

module.exports = {
    initializeDatabase,
    getSettings,
    updateSettings,
};