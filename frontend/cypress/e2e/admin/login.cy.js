describe('Admin login journey', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 401,
      body: { setupRequired: false, message: 'Authentication required' },
    }).as('getMe');
    cy.visit('/admin');
    cy.wait('@getMe');
  });

  it('shows the login form when logged out', () => {
    cy.contains('h1', 'เข้าสู่ระบบผู้ดูแล').should('exist');
  });

  it('shows login failures visibly', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 401,
      body: { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
    }).as('postLogin');

    cy.contains('label', 'ชื่อผู้ใช้').find('input').type('staff');
    cy.contains('label', 'รหัสผ่าน').find('input').type('wrong-password');
    cy.contains('button', 'เข้าสู่ระบบ').click();
    cy.wait('@postLogin');
    cy.contains('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง').should('exist');
  });

  it('enters the console after a successful login', () => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 200,
      body: {
        user: { id: 1, username: 'staff', display_name: 'Staff', role: 'staff', status: 'active' },
        csrfToken: 'test-csrf-token',
      },
    }).as('postLogin');
    cy.intercept('GET', '**/api/v1/admin/vtubers', { fixture: 'admin-vtubers.json' }).as('getChannels');

    cy.contains('label', 'ชื่อผู้ใช้').find('input').type('staff');
    cy.contains('label', 'รหัสผ่าน').find('input').type('correct-password');
    cy.contains('button', 'เข้าสู่ระบบ').click();
    cy.wait('@postLogin');
    cy.wait('@getChannels');
    cy.contains('คลังช่อง VTuber').should('exist');
    cy.contains('Aiko').should('exist');
  });
});
