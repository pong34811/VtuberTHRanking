Cypress.Commands.add('stubPublicApi', () => {
  cy.intercept('GET', '**/api/v1/rankings/**', { fixture: 'rankings.json' }).as('getRankings');
  cy.intercept('GET', '**/api/v1/summary/', { fixture: 'summary.json' }).as('getSummary');
  cy.intercept('GET', '**/api/v1/vtubers/**', { fixture: 'vtubers.json' }).as('getVtubers');
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
