describe('Public discovery Home', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/discover');
    cy.wait(['@getHomepageConfig', '@getDirectory']);
  });

  it('shows real directory creators and keeps rankings off the Home request path', () => {
    cy.contains('h1', 'ค้นหา VTuber ไทย').should('be.visible');
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

  it('filters creators by name inside discovery', () => {
    cy.get('.discovery-search input').type('Aiko');
    cy.get('.discovery-search button[type="submit"]').click();
    cy.location('pathname').should('eq', '/discover');
    cy.location('search').should('eq', '?q=Aiko');
    cy.wait('@getFilteredDirectory').its('request.url').should('include', 'q=Aiko');
    cy.get('.discovery-search input').should('have.value', 'Aiko');
    cy.get('.discovery-card').should('have.length', 1).and('contain', 'Aiko');
  });

  it('filters creators by category inside discovery', () => {
    cy.contains('.discovery-category', 'ร้องเพลง').click();
    cy.location('pathname').should('eq', '/discover');
    cy.location('search').should('eq', '?category=singing');
    cy.wait('@getFilteredDirectory').its('request.url').should('include', 'category=singing');
    cy.get('.discovery-card').should('have.length', 1).and('contain', 'Biko');
  });

  it('redirects old search bookmarks and clears filters on discovery', () => {
    cy.visit('/search?q=Aiko&category=gaming');
    cy.wait('@getDirectory');
    cy.location('pathname').should('eq', '/discover');
    cy.location('search').should('eq', '?q=Aiko&category=gaming');
    cy.get('.discovery-card').should('have.length', 1).and('contain', 'Aiko');
    cy.get('nav[aria-label="เมนูหลัก"] a[href="/discover"]').should('have.length', 1).and('contain.text', 'ค้นหา');
    cy.contains('a', 'ล้างตัวกรอง').click();
    cy.wait('@getDirectory');
    cy.location('search').should('eq', '');
    cy.get('.discovery-search input').should('have.value', '');
    cy.get('.discovery-card').should('have.length', 2);
  });

  it('filters creators by affiliation', () => {
    cy.contains('.discovery-shortcuts a', 'อิสระ').click();
    cy.wait('@getFilteredDirectory').its('request.url').should('include', 'affiliation=indie');
    cy.location('pathname').should('eq', '/discover');
    cy.get('.discovery-card').should('have.length', 1).and('contain', 'Aiko');
  });

  it('reaches the statistics experience from the discovery Home', () => {
    cy.get('.discovery-stats-link').click();
    cy.location('pathname').should('eq', '/stats');
    cy.wait(['@getSummary', '@getRankings']);
    cy.contains('h1', 'อันดับวีทูปเบอร์ไทยทั้งหมด').should('be.visible');
  });

  it('keeps the main discovery path visible and within mobile and desktop widths', () => {
    cy.viewport(390, 844);
    cy.get('.discovery-search input').should('be.visible');
    cy.get('.discovery-card').first().should('be.visible').then($card => {
      expect($card[0].getBoundingClientRect().top).to.be.lessThan(844);
    });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.get('.discovery-search input').focus();
    cy.get('.discovery-search-row').should($row => {
      expect(getComputedStyle($row[0]).boxShadow).not.to.equal('none');
    });

    cy.viewport(1280, 720);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
  });

  it('keeps the 3D header inset after lazy CSS loads in every discovery template', () => {
    ['search-first', 'category-first', 'newest-first'].forEach(template => {
      cy.intercept('GET', '**/api/v1/homepage-config/', { template });
      cy.visit('/discover');
      cy.get('.discovery-home').should('have.attr', 'data-template', template);
      [390, 811, 1280].forEach(width => {
        cy.viewport(width, 884);
        ['light', 'dark'].forEach(theme => {
          cy.get('[aria-label="ธีมหน้าจอ"]').select(theme);
          cy.get('.discovery-header').should($header => {
            const header = $header[0];
            const bounds = header.getBoundingClientRect();
            const style = getComputedStyle(header);
            expect(parseFloat(style.paddingLeft)).to.be.at.least(18);
            expect(parseFloat(style.paddingTop)).to.be.at.least(18);
            expect(parseFloat(style.paddingBottom)).to.be.at.least(18);
            [header.querySelector('h1'), header.querySelector('.discovery-search-row')].forEach(element => {
              const rect = element.getBoundingClientRect();
              expect(rect.left).to.be.at.least(bounds.left + 18);
              expect(rect.right).to.be.at.most(bounds.right - 18);
            });
          });
          cy.document().its('documentElement.scrollWidth').should('be.lte', width);
        });
      });
    });
  });
});
