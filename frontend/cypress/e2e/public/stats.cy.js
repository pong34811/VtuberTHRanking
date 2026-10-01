describe('Public stats journey', () => {
  beforeEach(() => {
    cy.stubPublicApi();
    cy.visit('/home');
    cy.wait(['@getRankings', '@getSummary']);
  });

  it('explains the site and shows summary figures and stubbed channels', () => {
    cy.contains('h1', 'อันดับวีทูปเบอร์ไทยทั้งหมด').should('exist');
    cy.contains('.home-fact', 'ช่องในอันดับที่เลือก').contains('strong', '2');
    cy.contains('Aiko').should('exist');
    cy.contains('Biko').should('exist');
    cy.get('.home-method summary').click();
    cy.contains('รายเดือน:').should('exist');
  });

  it('requests the selected metric when the ranking filter changes', () => {
    cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/', query: { category: 'views' } }, { fixture: 'rankings.json' }).as('getViewRankings');
    cy.contains('button', 'ยอดวิว').click();
    cy.wait('@getViewRankings').its('request.url').should('include', 'category=views');
    cy.contains('h3', 'ยอดวิว').should('exist');
    cy.contains('Aiko').should('exist');
  });

  it('shows only channels from the selected ranking menu', () => {
    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'วีทูปเบอร์อิสระ').click();
    cy.get('@getRankings.all').should(requests => {
      expect(requests.some(({ request }) => request.url.includes('affiliation=indie'))).to.be.true;
    });
    cy.contains('h1', 'อันดับวีทูปเบอร์อิสระ').should('be.visible');
    cy.contains('.home-table', 'Aiko').should('exist');
    cy.contains('.home-table', 'Biko').should('not.exist');

    cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'วีทูปเบอร์สังกัด').click();
    cy.get('@getRankings.all').should(requests => {
      expect(requests.some(({ request }) => request.url.includes('affiliation=agency'))).to.be.true;
    });
    cy.contains('h1', 'อันดับวีทูปเบอร์สังกัด').should('be.visible');
    cy.contains('.home-table', 'Biko').should('exist');
    cy.contains('.home-table', 'Aiko').should('not.exist');
    cy.get('.home-table tbody .home-rank').should('have.text', '01');
    cy.contains('.home-table', 'อันดับรวม #2').should('exist');
  });

  it('fits the public navigation and ranking table on mobile', () => {
    cy.viewport(390, 844);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.get('.home-rankings').should('be.visible');
  });

  it('preserves ranking filters through a mobile search and profile round trip', () => {
    cy.viewport(320, 844);
    cy.intercept('GET', '**/api/v1/vtubers/aiko/', {
      id: 1, name: 'Aiko', slug: 'aiko', category: 'gaming', affiliation: 'indie',
      latest_stats: { followers: 95000 },
    }).as('getProfile');
    cy.intercept('GET', '**/api/v1/vtubers/aiko/history/**', { history: [] }).as('getHistory');
    cy.visit('/home?period=monthly&category=views&month=2026-09&affiliation=indie');
    cy.wait('@getRankings');
    cy.get('#ranking-name-search').type('Aiko').should('have.value', 'Aiko');
    cy.location('search').should('include', 'q=Aiko');
    cy.contains('.home-table', 'Aiko').should('be.visible');
    cy.contains('.home-table-heading', 'แสดง 1 จาก 1 ช่อง').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 320);
    cy.contains('button', 'ล้างการค้นหา').should('be.visible').should($button => {
      expect($button[0].getBoundingClientRect().right).to.be.at.most(320);
    });

    cy.get('.home-table a[href="/profile/aiko"]').click();
    cy.wait(['@getProfile', '@getHistory']);
    cy.contains('a', 'กลับไปสำรวจ VTuber').click();
    cy.location('pathname').should('eq', '/home');
    cy.location('search').should(search => {
      const params = new URLSearchParams(search);
      expect(Object.fromEntries(params)).to.deep.equal({
        period: 'monthly', category: 'views', month: '2026-09', affiliation: 'indie', q: 'Aiko',
      });
    });
    cy.get('#ranking-name-search').should('have.value', 'Aiko').clear().type('NotFound');
    cy.contains('ไม่พบช่องที่ตรงกับการค้นหา').should('be.visible');
    cy.contains('button', 'ล้างการค้นหา').click();
    cy.get('#ranking-name-search').should('have.value', '');
    cy.location('search').should('not.include', 'q=');
    cy.location('search').should('include', 'category=views').and('include', 'affiliation=indie');
    cy.contains('.home-table', 'Aiko').should('be.visible');
  });

  it('keeps long Thai names and large metrics readable on narrow screens', () => {
    cy.fixture('rankings.json').then(rankings => {
      const results = rankings.results.map(row => ({
        ...row,
        score: 123456789012,
        vtuber: { ...row.vtuber, name: `วีทูปเบอร์ชื่อยาวสำหรับทดสอบการอ่านบนมือถือ ${row.vtuber.name}` },
      }));
      cy.intercept({ method: 'GET', pathname: '/api/v1/rankings/' }, { ...rankings, results }).as('getLongNameRankings');
    });
    cy.visit('/home');
    cy.wait('@getLongNameRankings');

    [320, 390, 640].forEach(width => {
      cy.viewport(width, 844);
      cy.window().its('innerWidth').should('eq', width);
      cy.document().its('documentElement.scrollWidth').should('be.lte', width);
      cy.get('.home-channel-meta').should($metadata => {
        expect(parseFloat(getComputedStyle($metadata[0]).fontSize)).to.be.at.least(12);
      });
      cy.get('.home-table tbody .home-number').each($cell => {
        expect($cell.text()).to.equal('123,456,789,012');
        expect($cell[0].scrollWidth).to.be.at.most($cell[0].clientWidth);
      });
      cy.get('.home-table-wrap')
        .should('have.attr', 'role', 'region')
        .and('have.attr', 'aria-label', 'ตารางอันดับ เลื่อนแนวนอนเพื่อดูข้อมูลครบ')
        .and('have.attr', 'tabindex', '0')
        .focus().should('have.focus')
        .scrollTo('right').should($region => {
          expect($region[0].scrollLeft).to.be.greaterThan(0);
        });
      cy.contains('เลื่อนตารางแนวนอนเพื่อดูข้อมูลครบ').should('be.visible');
    });

    cy.viewport(1280, 720);
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.contains('เลื่อนตารางแนวนอนเพื่อดูข้อมูลครบ').should('not.be.visible');

    ['light', 'dark'].forEach(theme => {
      cy.get('select[aria-label="ธีมหน้าจอ"]').select(theme);
      cy.get('html').should('have.attr', 'data-theme', theme);
      cy.viewport(390, 844);
      cy.get('.home-table-wrap').scrollTo('left');
      cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
      cy.get('.home-fact-date').should('not.contain', 'กำลังโหลด');
      cy.scrollTo('top');
      cy.screenshot(`ranking-mobile-${theme}-fixture`, { capture: 'viewport' });
      cy.get('.home-table-wrap').screenshot(`ranking-mobile-table-${theme}-fixture`);
      cy.viewport(1280, 720);
      cy.screenshot(`ranking-desktop-${theme}-fixture`, { capture: 'fullPage' });
    });
  });
});
