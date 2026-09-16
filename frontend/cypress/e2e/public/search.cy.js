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
});
