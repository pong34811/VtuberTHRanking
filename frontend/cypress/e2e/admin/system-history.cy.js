describe('Manager system history', () => {
  it('shows a readable audit record and its expanded details', () => {
    cy.loginAs('manager');
    cy.intercept('GET', '**/api/v1/admin/audit-logs', { fixture: 'audit-logs.json' }).as('getAuditLogs');
    cy.visit('/admin/history');
    cy.wait(['@getMe', '@getAuditLogs']);

    cy.contains('แก้ไข').should('exist');
    cy.contains('ช่อง VTuber').should('exist');
    cy.contains('summary', 'ดูรายละเอียด').click();
    cy.get('pre').should('contain', 'fields');
  });

  it('shows recent update pipeline outcomes in settings', () => {
    cy.loginAs('manager');
    cy.intercept('GET', '**/api/v1/admin/settings', { body: { results: [{ setting_key: 'site_name', setting_value: 'VTuber Thai' }] } }).as('getSettings');
    cy.intercept('GET', '**/api/v1/admin/pipeline-runs', { fixture: 'pipeline-runs.json' }).as('getPipelineRuns');
    cy.visit('/admin/settings');
    cy.wait(['@getMe', '@getSettings', '@getPipelineRuns']);

    cy.contains('สถานะรอบอัปเดตอันดับ').should('exist');
    cy.contains('สำเร็จบางส่วน').should('exist');
    cy.contains('ทุก 7 วัน').should('exist');
    cy.contains('4/6').should('exist');
  });

  it('redirects staff away from manager-only system pages', () => {
    cy.loginAs('staff');
    cy.intercept('GET', '**/api/v1/admin/vtubers', { fixture: 'admin-vtubers.json' }).as('getChannels');
    cy.visit('/admin/settings');
    cy.wait(['@getMe', '@getChannels']);

    cy.location('pathname').should('eq', '/admin/channels');
  });
});
