describe('Public stats journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/stats');
    cy.wait(['@getRankings', '@getSummary']);
  });

  it('explains the site and shows summary figures and stubbed channels', () => {
    cy.contains('h1', 'สถิติ VTuber ไทย').should('exist');
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

  it('navigates from the directory to the stats page', () => {
    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'หน้าแรก').click();
    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'สถิติ').click();
    cy.location('pathname').should('eq', '/stats');
    cy.contains('h1', 'สถิติ VTuber ไทย').should('be.visible');
  });

  it('fits the public navigation and ranking table on mobile', () => {
    cy.viewport(390, 844);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.get('.home-rankings').should('be.visible');
  });
});
