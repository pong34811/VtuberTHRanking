describe('Search journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/search');
    cy.wait('@getVtubers');
  });

  it('shows the search headline and stubbed results', () => {
    cy.contains('h1', 'ค้นหา VTuber').should('exist');
    cy.contains('Aiko').should('exist');
  });

  it('filters by search query', () => {
    cy.get('#vtuber-search').clear().type('aiko');
    cy.wait('@getVtubers');
    cy.contains('Aiko').should('exist');
  });

  it('filters by follower range and orders the results by followers', () => {
    cy.get('#followers-min').type('100');
    cy.get('#followers-max').type('900');
    cy.get('#search-sort').select('followers_desc');

    cy.wait('@getVtubers').then(({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('min_followers')).to.equal('100');
      expect(params.get('max_followers')).to.equal('900');
      expect(params.get('sort')).to.equal('followers_desc');
    });
  });

  it('keeps search filters usable on mobile without horizontal scrolling', () => {
    cy.viewport(390, 844);
    ['#vtuber-search', '#followers-min', '#followers-max', '#search-sort'].forEach((selector) => {
      cy.get(selector).should('be.visible');
    });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
  });
});
