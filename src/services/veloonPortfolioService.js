const axios = require('axios');

// Utilitário de espera
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função com retry e backoff exponencial
async function fetchWithRetry(url, config, maxRetries = 5, delayMs = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.get(url, config);
            return response;
        } catch (err) {
            if (err.response?.status === 429) {
                const wait = delayMs * Math.pow(2, attempt); // 1s, 2s, 4s, 8s...
                console.warn(`[RETRY ${attempt + 1}] 429 Too Many Requests. Aguardando ${wait}ms...`);
                await sleep(wait);
            } else {
                throw err; // outros erros devem estourar normalmente
            }
        }
    }
    throw new Error('Falha após várias tentativas devido a erros 429.');
}

// Cache em memória
const cache = {
    contactIds: new Set(),
    lastFetch: 0,
    ttl: 3600 * 1000, // 1 hora
};

async function getCarteirizadosContactIds(apiToken) {
    const now = Date.now();
    if (now - cache.lastFetch < cache.ttl && cache.contactIds.size > 0) {
        console.log('[CACHE] Retornando IDs de contatos carteirizados do cache.');
        return cache.contactIds;
    }

    console.log('[API] Cache expirado ou vazio. Buscando IDs de contatos carteirizados na API...');

    try {
        const allContactIds = new Set();
        let portfolioPage = 1;
        let hasMorePortfolios = true;
        const portfolioIds = [];

        // 1. Buscar todas as carteiras (portfolios)
        while (hasMorePortfolios) {
            const response = await fetchWithRetry('https://api.app.veloon.com.br/core/v1/portfolio', {
                headers: { Authorization: apiToken },
                params: { PageSize: 100, PageNumber: portfolioPage }
            });
            const data = response.data;
            data.items.forEach(p => portfolioIds.push(p.id));
            hasMorePortfolios = data.hasMorePages;
            portfolioPage++;
            await sleep(300); // espera curta entre páginas
        }

        console.log(`[API] Encontradas ${portfolioIds.length} carteiras. Buscando contatos...`);

        // 2. Buscar contatos por carteira
        for (const portfolioId of portfolioIds) {
            let contactPage = 1;
            let hasMoreContacts = true;
            while (hasMoreContacts) {
                const response = await fetchWithRetry(
                    `https://api.app.veloon.com.br/core/v1/portfolio/${portfolioId}/contact`,
                    {
                        headers: { Authorization: apiToken },
                        params: { PageSize: 100, PageNumber: contactPage }
                    }
                );
                const data = response.data;
                data.items.forEach(c => allContactIds.add(c.contactId));
                hasMoreContacts = data.hasMorePages;
                contactPage++;
                await sleep(300); // espera curta entre chamadas para evitar 429
            }
        }

        cache.contactIds = allContactIds;
        cache.lastFetch = now;

        console.log(`[CACHE] Cache atualizado com ${cache.contactIds.size} IDs de contatos.`);
        return cache.contactIds;

    } catch (error) {
        console.error('[ERRO] Falha ao buscar contatos carteirizados:', error.message);
        return cache.contactIds;
    }
}

module.exports = { getCarteirizadosContactIds };
