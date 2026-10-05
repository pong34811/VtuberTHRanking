describe('VTuber profile journey', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/vtubers/aiko/', {
      body: {
        id: 1,
        name: 'Aiko',
        slug: 'aiko',
        bio: 'นักร้องและสตรีมเมอร์',
        category: 'singing',
        affiliation: 'indie',
        current_rank: { monthly_followers: 1 },
        latest_stats: { followers: 95000, total_views: 1200000 },
      },
    }).as('getProfile');
    cy.intercept('GET', '**/api/v1/vtubers/aiko/history/**', {
      body: { history: [
        { date: '2026-08-01', followers: 90000, total_views: 1100000 },
        { date: '2026-09-01', followers: 95000, total_views: 1200000 },
      ] },
    }).as('getHistory');
  });

  it('shows the channel identity, current rank, and history charts', () => {
    cy.visit('/profile/aiko');
    cy.wait(['@getProfile', '@getHistory']);

    cy.contains('h1', 'Aiko').should('exist');
    cy.contains('นักร้องและสตรีมเมอร์').should('exist');
    cy.contains('span', 'ร้องเพลง').should('exist');
    cy.contains('อันดับปัจจุบัน').parent().contains('#1').should('exist');
    cy.contains('แนวโน้มผู้ติดตาม').should('exist');
    cy.contains('แนวโน้มยอดวิว').should('exist');
  });

  it('shows the published archive month and only enabled ranking metrics', () => {
    cy.intercept('GET', '**/api/v1/vtubers/aiko/', {
      name: 'Aiko', slug: 'aiko', ranking_month: '2026-08',
      category_choices: [{ value: 'views', label: 'ยอดวิวรวม' }],
      current_rank: { monthly_views: 1 },
    });
    cy.visit('/profile/aiko');
    cy.get('section[aria-labelledby="profile-rankings"]').within(() => {
      cy.contains('สิงหาคม').should('be.visible');
      cy.contains('2569').should('be.visible');
      cy.contains('ยอดวิวรวม').should('be.visible');
      cy.contains('#1').should('be.visible');
      cy.contains('ผู้ติดตาม').should('not.exist');
      cy.contains('เดือนนี้').should('not.exist');
    });
  });
});
