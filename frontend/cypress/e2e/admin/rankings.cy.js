describe('Admin ranking controls', () => {
  beforeEach(() => {
    cy.loginAs('manager');
    cy.intercept('GET', '**/api/v1/admin/rankings*', request => {
      const category = new URL(request.url).searchParams.get('category');
      request.reply({ body: { results: [{
        id: 1, vtuber_id: 1, rank: 1, name: 'Aiko',
        subscriber_count: 95000, total_views: 1200000, video_count: 120,
        rank_change: category === 'followers' ? null : 2,
      }] } });
    }).as('getAdminRankings');
    cy.intercept('POST', '**/api/v1/admin/rankings/calculate', { body: { ok: true, count: 1 } }).as('calculateRankings');
    cy.visit('/admin/rankings');
    cy.wait(['@getMe', '@getAdminRankings']);
  });

  it('loads one metric at a time and calculates the selected metric', () => {
    cy.contains('button', 'ผู้ติดตาม').should('have.attr', 'aria-pressed', 'true');
    cy.contains('ไม่มีอันดับก่อนหน้า').should('exist');

    cy.intercept({ method: 'GET', pathname: '/api/v1/admin/rankings', query: { category: 'views' } }, {
      body: { results: [{
        id: 1, vtuber_id: 1, rank: 1, name: 'Aiko',
        subscriber_count: 95000, total_views: 1200000, video_count: 120, rank_change: 2,
      }] },
    }).as('getViewsRanking');
    cy.contains('button', 'ยอดดู').click();
    cy.wait('@getViewsRanking').its('request.url').should('include', 'category=views');
    cy.get('table thead').contains('ยอดดู').should('exist');
    cy.contains('ขึ้น 2').should('exist');

    cy.contains('button', 'คำนวณอันดับใหม่').click();
    cy.wait('@calculateRankings').its('request.body').should('include', { category: 'views' });
    cy.wait('@getViewsRanking');
  });
});
