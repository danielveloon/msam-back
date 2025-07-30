const axios = require('axios');

// Utilitário de espera (sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função com retry e backoff exponencial para lidar com "Too Many Requests"
async function fetchWithRetry(url, config, maxRetries = 5, initialDelayMs = 500) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.get(url, config);
            return response;
        } catch (err) {
            // Se o erro for 429 (Too Many Requests), espera e tenta de novo
            if (err.response?.status === 429) {
                const wait = initialDelayMs * Math.pow(2, attempt); // 0.5s, 1s, 2s, 4s...
                console.warn(`[API_WARN] Código 429. Aguardando ${wait}ms para tentar novamente...`);
                await sleep(wait);
            } else {
                // Para outros erros (404, 500, etc.), falha imediatamente.
                throw err;
            }
        }
    }
    throw new Error(`Falha ao buscar dados de ${url} após ${maxRetries} tentativas.`);
}

// Cache em memória para a lista de contatos
const cache = {
    contactIds: new Set(),
    lastFetch: 0,
    ttl: 3600 * 1000, // Cache válido por 1 hora
};

async function getCarteirizadosContactIds(apiToken) {
    const now = Date.now();
    if (now - cache.lastFetch < cache.ttl && cache.contactIds.size > 0) {
        console.log('[CACHE] Retornando IDs de contatos do cache.');
        return cache.contactIds;
    }

    console.log('[API] Buscando lista de contatos carteirizados...');
    try {
        const allContactIds = new Set();
        const portfolioIds = [];
        let portfolioPage = 1;
        let hasMorePortfolios = true;

        // 1. Busca todas as carteiras com paginação e pausas
        while (hasMorePortfolios) {
            const response = await fetchWithRetry('https://api.app.veloon.com.br/core/v1/portfolio', {
                headers: { Authorization: apiToken },
                params: { PageSize: 100, PageNumber: portfolioPage }
            });
            response.data.items.forEach(p => portfolioIds.push(p.id));
            hasMorePortfolios = response.data.hasMorePages;
            portfolioPage++;
            await sleep(250); // Pausa de 250ms entre as buscas de páginas de carteiras
        }

        console.log(`[API] ${portfolioIds.length} carteiras encontradas. Buscando contatos...`);

        // 2. Busca os contatos de cada carteira com paginação e pausas
        for (const portfolioId of portfolioIds) {
            let contactPage = 1;
            let hasMoreContacts = true;
            while (hasMoreContacts) {
                const response = await fetchWithRetry(
                    `https://api.app.veloon.com.br/core/v1/portfolio/${portfolioId}/contact`, {
                        headers: { Authorization: apiToken },
                        params: { PageSize: 100, PageNumber: contactPage }
                    }
                );
                response.data.items.forEach(c => allContactIds.add(c.contactId));
                hasMoreContacts = response.data.hasMorePages;
                contactPage++;
                await sleep(250); // Pausa de 250ms entre as buscas de páginas de contatos
            }
        }

        cache.contactIds = allContactIds;
        cache.lastFetch = now;
        console.log(`[CACHE] Cache atualizado com ${cache.contactIds.size} IDs de contatos.`);
        return cache.contactIds;

    } catch (error) {
        console.error('[ERRO_CRITICO] Não foi possível buscar a lista de contatos carteirizados:', error.message);
        return cache.contactIds; // Retorna o cache antigo (se houver) para não parar a operação
    }
}

module.exports = { getCarteirizadosContactIds };