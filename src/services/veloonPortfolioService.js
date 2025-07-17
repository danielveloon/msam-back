const axios = require('axios');

// Cache em memória para evitar chamadas excessivas à API
const cache = {
    contactIds: new Set(),
    lastFetch: 0,
    ttl: 3600 * 1000, // Tempo de vida do cache: 1 hora em milissegundos
};

/**
 * Busca todos os IDs de contatos que pertencem a alguma carteira.
 * Usa um cache para evitar sobrecarregar a API.
 */
async function getCarteirizadosContactIds(apiToken) {
    const now = Date.now();
    if (now - cache.lastFetch < cache.ttl && cache.contactIds.size > 0) {
        console.log('[CACHE] Retornando IDs de contatos carteirizados do cache.');
        return cache.contactIds;
    }

    console.log('[API] Cache expirado ou vazio. Buscando IDs de contatos carteirizados na API...');

    try {
        const allContactIds = new Set();

        // 1. Buscar todas as carteiras (portfolios)
        let portfolioPage = 1;
        let hasMorePortfolios = true;
        const portfolioIds = [];

        while(hasMorePortfolios) {
            const portfolioResponse = await axios.get('https://api.app.veloon.com.br/core/v1/portfolio', {
                headers: { 'Authorization': apiToken },
                params: { 'PageSize': 100, 'PageNumber': portfolioPage }
            });
            portfolioResponse.data.items.forEach(p => portfolioIds.push(p.id));
            hasMorePortfolios = portfolioResponse.data.hasMorePages;
            portfolioPage++;
        }

        console.log(`[API] Encontradas ${portfolioIds.length} carteiras. Buscando contatos...`);

        // 2. Para cada carteira, buscar os contatos associados
        for (const portfolioId of portfolioIds) {
            let contactPage = 1;
            let hasMoreContacts = true;
            while(hasMoreContacts) {
                const contactResponse = await axios.get(`https://api.app.veloon.com.br/core/v1/portfolio/${portfolioId}/contact`, {
                    headers: { 'Authorization': apiToken },
                    params: { 'PageSize': 100, 'PageNumber': contactPage }
                });
                contactResponse.data.items.forEach(c => allContactIds.add(c.contactId));
                hasMoreContacts = contactResponse.data.hasMorePages;
                contactPage++;
            }
        }

        // Atualiza o cache
        cache.contactIds = allContactIds;
        cache.lastFetch = now;

        console.log(`[CACHE] Cache atualizado com ${cache.contactIds.size} IDs de contatos.`);
        return cache.contactIds;

    } catch (error) {
        console.error('[ERRO] Falha ao buscar contatos carteirizados:', error.message);
        // Em caso de erro, retorna o cache antigo se existir, para não parar a operação
        return cache.contactIds;
    }
}

module.exports = { getCarteirizadosContactIds };