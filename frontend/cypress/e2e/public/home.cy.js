describe('Homepage ranking journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/');
    cy.wait(['@getRankings', '@getSummary']);
  });

  it('explains the site and shows summary figures and stubbed channels', () => {
    cy.contains('h1', 'สำรวจอันดับ').should('exist');
    cy.contains('.home-fact', 'ช่องที่ร่วมจัดอันดับ').contains('strong', '2');
    cy.contains('Aiko').should('exist');
    cy.contains('Biko').should('exist');
    cy.get('.home-method summary').click();
    cy.contains('รายเดือน:').should('exist');
  });

  it('requests the selected metric when the ranking filter changes', () => {
    cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/', query: { category: 'views' } }, { fixture: 'rankings.json' }).as('getViewRankings');
    cy.contains('button', 'ยอดวิว').click();
    cy.wait('@getViewRankings').its('request.url').should('include', 'category=views');
    cy.contains('h3', 'ยอดวิว').should('exist');
    cy.contains('Aiko').should('exist');
  });
});
