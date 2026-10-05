describe('Responsive public header', () => {
  it('keeps one row, opens all links and supports Escape and preserved filters', () => {
    cy.stubPublicApi();
    cy.visit('/home?period=monthly&category=views&month=2026-09');
    cy.wait(['@getSummary', '@getRankings']);
    [320, 390, 789, 980].forEach(width => {
      cy.viewport(width, 884);
      ['light', 'dark'].forEach(theme => {
        cy.get('[aria-label="ธีมหน้าจอ"]').select(theme);
        cy.get('.public-menu-toggle').should('be.visible').and('have.attr', 'aria-expanded', 'false');
        cy.get('#public-main-menu').should('not.be.visible');
        cy.get('.nav-shell').should($shell => {
          const shell = $shell[0];
          expect(shell.getBoundingClientRect().height).to.be.lessThan(100);
          const brand = shell.querySelector('.brand').getBoundingClientRect();
          const button = shell.querySelector('button').getBoundingClientRect();
          expect(Math.abs((brand.top + brand.height / 2) - (button.top + button.height / 2))).to.be.lessThan(2);
        });
        cy.document().its('documentElement.scrollWidth').should('be.lte', width);
        cy.get('.public-menu-toggle').focus();
        cy.get('.public-menu-toggle').click();
        cy.get('.public-menu-toggle').should('have.attr', 'aria-expanded', 'true');
        cy.get('#public-main-menu a').should('have.length', 5).each($link => cy.wrap($link).should('be.visible'));
        cy.get('#public-main-menu a').first().focus();
        cy.press('Escape');
        cy.get('.public-menu-toggle').should('have.focus').and('have.attr', 'aria-expanded', 'false');
      });
    });
    cy.viewport(789, 884);
    cy.get('.nav-shell').screenshot('responsive-header-789');
    cy.get('.public-menu-toggle').click();
    cy.get('#public-main-menu').contains('a', 'วีทูปเบอร์อิสระ').click();
    cy.location('search').should('include', 'affiliation=indie').and('include', 'month=2026-09').and('include', 'category=views');
    cy.get('.public-menu-toggle').should('have.attr', 'aria-expanded', 'false');
    cy.get('.public-menu-toggle').click();
    cy.get('#public-main-menu').contains('a', 'วีทูปเบอร์อิสระ').should('have.attr', 'aria-current', 'page');
    cy.get('.public-menu-toggle').click();
    cy.viewport(1280, 884);
    cy.get('.public-menu-toggle').should('not.be.visible');
    cy.get('#public-main-menu a').each($link => cy.wrap($link).should('be.visible'));
  });
});
