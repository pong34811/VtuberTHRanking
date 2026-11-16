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

  it('does not display delete button for staff', () => {
    cy.get('button[aria-label="ลบ Aiko"]').should('not.exist');
  });

  it('opens the add-channel dialog', () => {
    cy.contains('button', 'เพิ่มช่องใหม่').click();
    cy.get('[role="dialog"]').contains('เพิ่มช่อง').should('exist');
    cy.get('[role="dialog"]').contains('ชื่อช่อง').should('exist');
  });
});

describe('Admin channels manager journey', () => {
  let channels;

  beforeEach(() => {
    channels = [
      { id: 1, name: 'Aiko', slug: 'aiko', agency_name: 'Indie', platform: 'youtube', is_active: 1 },
      { id: 2, name: 'Biko', slug: 'biko', agency_name: 'Indie', platform: 'youtube', is_active: 0 },
    ];
    cy.loginAs('manager');
    cy.intercept('GET', '**/api/v1/admin/vtubers', (req) => {
      req.reply({ body: { results: channels } });
    }).as('getChannels');
    cy.visit('/admin/channels');
    cy.wait(['@getMe', '@getChannels']);
  });

  it('allows manager to delete a channel with confirmation dialog', () => {
    cy.intercept('DELETE', '**/api/v1/admin/vtubers/*', (req) => {
      channels = channels.filter(c => c.id !== 1);
      req.reply({ statusCode: 200, body: { ok: true } });
    }).as('deleteChannel');

    cy.get('button[aria-label="ลบ Aiko"]').should('exist').click();
    cy.get('[role="dialog"]').contains('ลบช่อง').should('exist');
    cy.get('[role="dialog"]').contains('Aiko').should('exist');

    // Cancel deletion
    cy.get('[role="dialog"]').contains('button', 'ยกเลิก').click();
    cy.get('[role="dialog"]').should('not.exist');

    // Confirm deletion
    cy.get('button[aria-label="ลบ Aiko"]').click();
    cy.get('[role="dialog"]').contains('button', 'ลบช่อง').click();
    cy.wait('@deleteChannel').its('request.headers').should('have.property', 'x-csrf-token', 'test-csrf-token');
    cy.wait('@getChannels');
    cy.contains('ลบช่อง “Aiko” เรียบร้อยแล้ว').should('exist');
    cy.get('table').contains('Aiko').should('not.exist');
    cy.get('table').contains('Biko').should('exist');

    // Regression: the success alert must stay a single-column block so the
    // metrics strip and the channel card keep stacking full width.
    cy.get('.channel-metrics').then(($metrics) => {
      cy.get('.channel-table-card').then(($card) => {
        const metrics = $metrics[0].getBoundingClientRect();
        const card = $card[0].getBoundingClientRect();
        expect(Math.abs(metrics.width - card.width)).to.be.lessThan(8);
        expect(card.top).to.be.at.least(metrics.bottom - 1);
      });
    });
  });

  it('displays error alert when deletion fails and keeps dialog open', () => {
    cy.intercept('DELETE', '**/api/v1/admin/vtubers/*', {
      statusCode: 500,
      body: { message: 'Failed to delete channel' },
    }).as('deleteChannelFail');

    cy.get('button[aria-label="ลบ Aiko"]').should('exist').click();
    cy.get('[role="dialog"]').contains('button', 'ลบช่อง').click();
    cy.wait('@deleteChannelFail');
    cy.get('[role="dialog"]').contains('Failed to delete channel').should('exist');

    // Can dismiss after error
    cy.get('[role="dialog"]').contains('button', 'ยกเลิก').click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('Aiko').should('exist');
  });
});
