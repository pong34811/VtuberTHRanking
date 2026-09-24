Cypress.Commands.add('stubPublicApi', () => {
  cy.intercept({ method: 'GET', pathname: '/api/v1/homepage-config/' }, { template: 'search-first' }).as('getHomepageConfig');
  cy.fixture('directory.json').then(directory => {
    cy.intercept({ method: 'GET', pathname: '/api/v1/directory/' }, req => {
      let results = directory.results.filter(creator => !req.query.category || creator.category === req.query.category);
      if (req.query.q) results = results.filter(creator => creator.name.toLowerCase().includes(String(req.query.q).toLowerCase()));
      if (req.query.sort === 'created_at_desc') results = [...results].sort((a, b) => b.created_at.localeCompare(a.created_at));
      else results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 12));
      const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      req.reply({
        total: results.length,
        count: results.slice(offset, offset + limit).length,
        limit,
        offset,
        results: results.slice(offset, offset + limit),
        category_counts: directory.category_counts,
      });
  }).as('getDirectory');
  cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/' }, { fixture: 'rankings.json' }).as('getRankings');
  cy.intercept({ method: 'GET', pathname: '/api/v1/summary/' }, { fixture: 'summary.json' }).as('getSummary');
  cy.intercept({ method: 'GET', pathname: '/api/v1/vtubers/' }, { fixture: 'vtubers.json' }).as('getVtubers');
});
});

Cypress.Commands.add('loginAs', (role = 'staff') => {
  cy.intercept('GET', '**/api/v1/auth/me', {
    statusCode: 200,
    body: {
      user: {
        id: 1,
        username: role === 'manager' ? 'manager' : 'staff',
        display_name: role === 'manager' ? 'Manager' : 'Staff',
        role,
        status: 'active',
      },
      csrfToken: 'test-csrf-token',
    },
  }).as('getMe');
});
