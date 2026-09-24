describe('Channel comparison journey', () => {
  beforeEach(() => {
    cy.intercept({ method: 'GET', pathname: '/api/v1/vtubers/' }, { fixture: 'vtubers.json' }).as('getVtubers');
    cy.intercept('POST', '**/api/v1/compare/', {
      body: {
        category: 'followers',
        vtubers: [
          { id: 1, name: 'Aiko', color: '#ef4444', history: [
            { date: '2026-08-01', value: 90000 }, { date: '2026-09-01', value: 95000 },
          ] },
          { id: 2, name: 'Biko', color: '#3b82f6', history: [
            { date: '2026-08-01', value: 84000 }, { date: '2026-09-01', value: 88000 },
          ] },
        ],
      },
    }).as('postCompare');
  });

  it('requires two selected channels and displays their history comparison', () => {
    cy.visit('/compare');
    cy.wait('@getVtubers');
    cy.contains('button', 'เลือกอีก 2 ช่อง').should('be.disabled');

    cy.get('.channel-picker').contains('button', 'Aiko').click();
    cy.get('.channel-picker').contains('button', 'Biko').click();
    cy.contains('button', 'แสดงกราฟเปรียบเทียบ').click();
    cy.wait('@postCompare').its('request.body').should('include', { category: 'followers', months: 6 });

    cy.get('[aria-label="กราฟเปรียบเทียบ"]').should('exist');
  });
});
