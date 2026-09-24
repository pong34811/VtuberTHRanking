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
  cy.intercept({ method: 'GET', pathname: '/api/v1/homepage-config/' }, req => {
    req.reply({ template: readPublished() });
  }).as('getHomepageConfig');
  cy.fixture('directory.json').then(directory => {
    cy.intercept({ method: 'GET', pathname: '/api/v1/directory/' }, req => {
      let results = directory.results.filter(creator => !req.query.category || creator.category === req.query.category);
      if (req.query.sort === 'created_at_desc') results = [...results].sort((a, b) => b.created_at.localeCompare(a.created_at));
      else results = [...results].sort((a, b) => a.name.localeCompare(b.name));
      const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 12));
      const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      req.reply({
        total: results.length,
        count: results.slice(offset, offset + limit).length,
        limit,
        offset,
        results: results.slice(offset, offset + limit),
        category_counts: directory.category_counts,
      });
    }).as('getDirectory');
  });
  cy.intercept({ method: 'GET', pathname: '/api/v1/summary/' }, {
    total_vtubers: 2,
    total_followers_all: 183000,
    top_gainer: null,
    latest_update: '2026-09-16T00:00:00.000Z',
    period_choices: [
      { value: 'monthly', label: 'รายเดือน' },
      { value: 'alltime', label: 'ทั้งหมด' },
    ],
    category_choices: [
      { value: 'followers', label: 'ผู้ติดตาม' },
      { value: 'views', label: 'ยอดวิว' },
      { value: 'videos', label: 'จำนวนคลิป' },
    ],
  }).as('getSummary');
  cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/' }, { fixture: 'rankings.json' }).as('getRankings');
}

describe('Admin homepage templates', () => {
  it('previews a category draft, saves it, and publishes it on the public Home', () => {
    let publishedTemplate = 'search-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getDirectory']);
    cy.get('.homepage-template-thumbnail--search-first .thumbnail-search-bar').should('exist');
    cy.get('.homepage-template-thumbnail--category-first .thumbnail-category-tiles').should('exist');
    cy.get('.homepage-template-thumbnail--newest-first .thumbnail-newest-entry').should('exist');

    cy.get('.homepage-template-option').eq(1).click();
    cy.get('[data-testid="homepage-preview"] .homepage').should('have.attr', 'data-template', 'category-first');
    cy.get('[data-testid="homepage-preview"]').contains('Biko').should('be.visible');
    cy.contains('.homepage-template-draft-label', 'ตัวอย่าง — ยังไม่เผยแพร่').should('exist');
    cy.contains('.homepage-template-published', 'เผยแพร่อยู่: ค้นหาก่อน').should('exist');

    cy.contains('button', 'บันทึกเป็นหน้าแรก').click();
    cy.wait('@saveHomepageTemplate').its('request.body.homepage_template').should('eq', 'category-first');
    cy.contains('.homepage-template-published', 'เผยแพร่อยู่: เลือกหมวดหมู่').should('exist');
    cy.contains('.homepage-template-draft-label').should('not.exist');

    cy.visit('/');
    cy.wait(['@getHomepageConfig', '@getDirectory']);
    cy.get('.homepage').should('have.attr', 'data-template', 'category-first');
    cy.contains('.discovery-group', 'Biko').should('be.visible');
    cy.get('@getSummary.all').should('have.length', 0);
    cy.get('@getRankings.all').should('have.length', 0);
  });

  it('keeps an unsaved newest draft unpublished on the public Home', () => {
    let publishedTemplate = 'search-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getDirectory']);
    cy.contains('button', 'เพิ่มเข้ารายการล่าสุด').click();
    cy.get('[data-testid="homepage-preview"] .discovery-date-note').should('contain.text', 'ไม่ใช่วันเดบิวต์');
    cy.contains('.homepage-template-draft-label', 'ตัวอย่าง — ยังไม่เผยแพร่').should('exist');
    cy.get('@saveHomepageTemplate.all').should('have.length', 0);

    cy.visit('/');
    cy.wait(['@getHomepageConfig', '@getDirectory']);
    cy.get('.homepage').should('have.attr', 'data-template', 'search-first');
    cy.get('@saveHomepageTemplate.all').should('have.length', 0);
  });

  it('keeps the preview controls contained and lets a manager select with the keyboard', () => {
    let publishedTemplate = 'search-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publishedTemplate, value => { publishedTemplate = value; });
    stubPublicApi(() => publishedTemplate);

    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getDirectory']);
    cy.get('.homepage-template-option').first().focus();
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('have.class', 'homepage-template-option').and('contain.text', 'เลือกหมวดหมู่');
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('[data-testid="homepage-preview"] .homepage').should('have.attr', 'data-template', 'category-first');
    cy.get('[data-testid="homepage-preview"] form[role="search"] input').should('not.exist');

    cy.get('.homepage-template-option').first().click();
    cy.get('[data-testid="homepage-preview"] form[role="search"] input').type('Aiko');
    cy.get('[data-testid="homepage-preview"] form[role="search"]').submit();
    cy.get('[data-testid="homepage-preview"] .discovery-card').first().click();
    cy.location('pathname').should('eq', '/admin/homepage');
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

  it('keeps public templates and the Admin preview within mobile and desktop widths', () => {
    let publicTemplate = 'search-first';
    cy.loginAs('manager');
    stubTemplateSettings(() => publicTemplate, value => { publicTemplate = value; });
    stubPublicApi(() => publicTemplate);

    for (const template of ['search-first', 'category-first', 'newest-first']) {
      cy.then(() => { publicTemplate = template; });
      cy.viewport(390, 844);
      cy.visit('/');
      cy.wait(['@getHomepageConfig', '@getDirectory']);
      cy.get('.homepage').should('have.attr', 'data-template', template);
      cy.get('.discovery-card').first().should('be.visible');
      cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    }

    cy.viewport(1280, 720);
    cy.visit('/');
    cy.wait(['@getHomepageConfig', '@getDirectory']);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.get('.discovery-home form[role="search"] input').focus();
    cy.focused().should('match', 'input');
    cy.focused().then($input => {
      expect(getComputedStyle($input[0]).outlineStyle).not.to.equal('none');
    });

    cy.viewport(390, 844);
    cy.visit('/admin/homepage');
    cy.wait(['@getMe', '@getHomepageTemplate', '@getDirectory']);
    cy.get('.homepage-template-options').should($options => {
      expect($options[0].scrollWidth).to.be.lte($options[0].clientWidth);
    });
    cy.get('[data-testid="homepage-preview"]').should($preview => {
      expect($preview[0].scrollWidth).to.be.lte($preview[0].clientWidth);
    });
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
  });
});
