describe('Homepage ranking journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/');
    cy.wait(['@getRankings', '@getSummary']);
  });

  it('shows the ranking headline and stubbed channels', () => {
    cy.contains('h1', 'VTuber ไทย').should('exist');
    cy.contains('Aiko').should('exist');
    cy.contains('Biko').should('exist');
    cy.contains('ช่อง VTuber ในรายการ').should('exist');
  });

  it('reloads rankings when the metric changes', () => {
    cy.contains('button', 'ยอดวิว').click();
    cy.wait('@getRankings');
    cy.contains('Aiko').should('exist');
  });
});
