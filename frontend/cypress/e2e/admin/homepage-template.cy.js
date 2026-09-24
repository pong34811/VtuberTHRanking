const templateSettingsPath = '**/api/v1/admin/settings/homepage-template';

function stubTemplateSettings(readPublished, savePublished) {
  cy.intercept('GET', templateSettingsPath, req => {
    req.reply({ homepage_template: readPublished() });
  }).as('getHomepageTemplate');
  cy.intercept('PUT', templateSettingsPath, req => {
    savePublished(req.body.homepage_template);
    req.reply({ ok: true, homepage_template: req.body.homepage_template });
  }).as('saveHomepageTemplate');
}

function stubPublicApi(readPublished) {
  cy.intercept({ method: 'GET', pathname: '/api/v1/summary/' }, req => {
    req.reply({
      total_vtubers: 2,
      total_followers_all: 183000,
      top_gainer: null,
      latest_update: '2026-09-16T00:00:00.000Z',
      homepage_template: readPublished(),
      period_choices: [
        { value: 'monthly', label: 'รายเดือน' },
        { value: 'alltime', label: 'ทั้งหมด' },
      ],
      category_choices: [
        { value: 'followers', label: 'ผู้ติดตาม' },
        { value: 'views', label: 'ยอดวิว' },
        { value: 'videos', label: 'จำนวนคลิป' },
      ],
    });
  }).as('getSummary');
  cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/' }, { fixture: 'rankings.json' }).as('getRankings');
}

describe('Admin homepage templates', () => {
  it('previews a manager draft, saves it, and publishes it on the public Home', () => {
    let publishedTemplate = 'ranking-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getSummary', '@getRankings']);
    [
      ['ranking-first', ['hero', 'summary', 'method', 'rankings', 'discovery']],
      ['discovery-first', ['hero', 'summary', 'discovery', 'rankings', 'method']],
      ['compact-ranking', ['hero', 'summary', 'rankings', 'method', 'discovery']],
    ].forEach(([id, expectedOrder]) => {
      cy.get(`.homepage-template-thumbnail--${id}`).should($thumbnail => {
        const actualOrder = getComputedStyle($thumbnail[0]).gridTemplateAreas.replace(/"/g, '').trim().split(/\s+/);
        expect(actualOrder).to.deep.equal(expectedOrder);
      });
    });
    cy.contains('button', 'ค้นพบ VTuber').click();
    cy.get('[data-testid="homepage-preview"] .homepage').should('have.attr', 'data-template', 'discovery-first');
    cy.contains('.homepage-template-draft-label', 'ตัวอย่าง — ยังไม่เผยแพร่').should('exist');
    cy.contains('.homepage-template-published', 'เผยแพร่อยู่: อันดับเด่น').should('exist');

    cy.contains('button', 'บันทึกเป็นหน้าแรก').click();
    cy.wait('@saveHomepageTemplate').its('request.body.homepage_template').should('eq', 'discovery-first');
    cy.contains('.homepage-template-published', 'เผยแพร่อยู่: ค้นพบ VTuber').should('exist');
    cy.contains('.homepage-template-draft-label').should('not.exist');

    cy.visit('/');
    cy.wait(['@getSummary', '@getRankings']);
    cy.get('.homepage').should('have.attr', 'data-template', 'discovery-first');
  });

  it('leaves an unsaved draft unpublished when the manager opens the public Home', () => {
    let publishedTemplate = 'ranking-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getSummary', '@getRankings']);
    cy.contains('button', 'อันดับแบบกระชับ').click();
    cy.contains('.homepage-template-draft-label', 'ตัวอย่าง — ยังไม่เผยแพร่').should('exist');
    cy.get('@saveHomepageTemplate.all').should('have.length', 0);

    cy.visit('/');
    cy.wait(['@getSummary', '@getRankings']);
    cy.get('.homepage').should('have.attr', 'data-template', 'ranking-first');
    cy.get('@saveHomepageTemplate.all').should('have.length', 0);
  });

  it('lets a manager select a preset with the keyboard', () => {
    let publishedTemplate = 'ranking-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getSummary', '@getRankings']);
    cy.contains('button', 'อันดับเด่น').click();
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('have.class', 'homepage-template-option').and('contain.text', 'อันดับแบบกระชับ');
    cy.press(Cypress.Keyboard.Keys.SPACE);

    cy.contains('button', 'อันดับแบบกระชับ').should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-testid="homepage-preview"] .homepage').should('have.attr', 'data-template', 'compact-ranking');
    cy.contains('.homepage-template-published', 'เผยแพร่อยู่: อันดับเด่น').should('exist');
    cy.get('@saveHomepageTemplate.all').should('have.length', 0);
  });

  it('redirects staff without requesting template settings', () => {
    cy.loginAs('staff');
    cy.intercept('GET', templateSettingsPath).as('staffTemplateSettings');
    cy.intercept('GET', '**/api/v1/admin/vtubers', { body: { results: [] } }).as('getChannels');

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getChannels']);
    cy.location('pathname').should('eq', '/admin/channels');
    cy.get('@staffTemplateSettings.all').should('have.length', 0);
  });

  it('keeps all public presets and the Admin preview within a 390px viewport', () => {
    let publicTemplate = 'ranking-first';
    cy.viewport(390, 844);
    cy.loginAs('manager');
    stubTemplateSettings(() => publicTemplate, value => { publicTemplate = value; });
    stubPublicApi(() => publicTemplate);

    for (const template of ['ranking-first', 'discovery-first', 'compact-ranking']) {
      cy.then(() => { publicTemplate = template; });
      cy.visit('/');
      cy.wait(['@getSummary', '@getRankings']);
      cy.get('.homepage').should('have.attr', 'data-template', template);
      cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    }

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getSummary', '@getRankings']);
    cy.get('.homepage-template-options').should($options => {
      expect($options[0].scrollWidth).to.be.lte($options[0].clientWidth);
    });
    cy.get('[data-testid="homepage-preview"]').should($preview => {
      expect($preview[0].scrollWidth).to.be.lte($preview[0].clientWidth);
    });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
  });
});
