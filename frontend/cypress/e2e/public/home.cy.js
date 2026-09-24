describe('Public discovery Home', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/');
    cy.wait(['@getHomepageConfig', '@getDirectory']);
  });

  it('shows real directory creators and keeps rankings off the Home request path', () => {
    cy.contains('h1', 'ค้นพบ VTuber ไทย').should('be.visible');
    cy.contains('.discovery-card', 'Aiko').should('be.visible');
    cy.contains('.discovery-card', 'Biko').should('exist');
    cy.get('.discovery-card').first().should('have.attr', 'href', '/profile/aiko');
    cy.get('@getDirectory').its('request.url').should(url => {
      const params = new URL(url).searchParams;
      expect(params.get('sort')).to.equal('name');
      expect(params.get('limit')).to.equal('12');
    });
    cy.get('@getSummary.all').should('have.length', 0);
    cy.get('@getRankings.all').should('have.length', 0);
  });

  it('submits a name query to Search and preselects its matching results', () => {
    cy.get('.discovery-search input').type('Aiko');
    cy.get('.discovery-search button[type="submit"]').click();
    cy.location('pathname').should('eq', '/search');
    cy.location('search').should('eq', '?q=Aiko');
    cy.wait('@getVtubers').its('request.url').should('include', 'q=Aiko');
    cy.get('#vtuber-search').should('have.value', 'Aiko');
  });

  it('follows a category shortcut into Search with the category selected', () => {
    cy.contains('.discovery-category', 'ร้องเพลง').click();
    cy.location('pathname').should('eq', '/search');
    cy.location('search').should('eq', '?category=singing');
    cy.wait('@getVtubers').its('request.url').should('include', 'category=singing');
    cy.get('#category-filter').should('have.value', 'singing');
  });

  it('reaches the statistics experience from the discovery Home', () => {
    cy.get('.discovery-stats-link').click();
    cy.location('pathname').should('eq', '/stats');
    cy.wait(['@getSummary', '@getRankings']);
    cy.contains('h1', 'สถิติ VTuber ไทย').should('be.visible');
  });

  it('keeps the main discovery path visible and within mobile and desktop widths', () => {
    cy.viewport(390, 844);
    cy.get('.discovery-search input').should('be.visible');
    cy.get('.discovery-card').first().should('be.visible').then($card => {
      expect($card[0].getBoundingClientRect().top).to.be.lessThan(844);
    });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.get('.discovery-search input').focus().should('have.css', 'outline-style', 'solid');

    cy.viewport(1280, 720);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
  });
});
