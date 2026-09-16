describe('Admin channels journey', () => {
  beforeEach(() => {
    cy.loginAs('staff');
    cy.intercept('GET', '**/api/v1/admin/vtubers', { fixture: 'admin-vtubers.json' }).as('getChannels');
    cy.visit('/admin/channels');
    cy.wait(['@getMe', '@getChannels']);
  });

  it('lists channels from the stub', () => {
    cy.contains('คลังช่อง VTuber').should('exist');
    cy.contains('Aiko').should('exist');
    cy.contains('Biko').should('exist');
  });

  it('opens the add-channel dialog', () => {
    cy.contains('button', 'เพิ่มช่องใหม่').click();
    cy.get('[role="dialog"]').contains('เพิ่มช่อง').should('exist');
    cy.get('[role="dialog"]').contains('ชื่อช่อง').should('exist');
  });
});
