describe('Public stats journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/home');
    cy.wait(['@getRankings', '@getSummary']);
  });

  it('explains the site and shows summary figures and stubbed channels', () => {
    cy.contains('h1', 'อันดับวีทูปเบอร์ไทยทั้งหมด').should('exist');
    cy.contains('.home-fact', 'ช่องในอันดับที่เลือก').contains('strong', '2');
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

  it('shows only channels from the selected ranking menu', () => {
    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'วีทูปเบอร์อิสระ').click();
    cy.get('@getRankings.all').should(requests => {
      expect(requests.some(({ request }) => request.url.includes('affiliation=indie'))).to.be.true;
    });
    cy.contains('h1', 'อันดับวีทูปเบอร์อิสระ').should('be.visible');
    cy.contains('.home-table', 'Aiko').should('exist');
    cy.contains('.home-table', 'Biko').should('not.exist');

    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'วีทูปเบอร์สังกัด').click();
    cy.get('@getRankings.all').should(requests => {
      expect(requests.some(({ request }) => request.url.includes('affiliation=agency'))).to.be.true;
    });
    cy.contains('h1', 'อันดับวีทูปเบอร์สังกัด').should('be.visible');
    cy.contains('.home-table', 'Biko').should('exist');
    cy.contains('.home-table', 'Aiko').should('not.exist');
    cy.get('.home-table tbody .home-rank').should('have.text', '01');
    cy.contains('.home-table', 'อันดับรวม #2').should('exist');
  });

  it('fits the public navigation and ranking table on mobile', () => {
    cy.viewport(390, 844);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.get('.home-rankings').should('be.visible');
  });
});
