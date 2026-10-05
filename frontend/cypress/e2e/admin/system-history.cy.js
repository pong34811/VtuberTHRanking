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
    cy.intercept('GET', '**/api/v1/admin/directory-sync', { runs: [], candidates: [] });
    cy.visit('/admin/settings');
    cy.wait(['@getMe', '@getSettings', '@getPipelineRuns']);

    cy.contains('สถานะรอบอัปเดตอันดับ').should('exist');
    cy.contains('สำเร็จบางส่วน').should('exist');
    cy.contains('ทุก 7 วัน').should('exist');
    cy.contains('4/6').should('exist');
  });

  it('saves daily profile discovery, displays primary evidence and ignores an unverified candidate', () => {
    const channelId = `UC${'i'.repeat(22)}`;
    let ignored = false;
    let settings = [
      { setting_key: 'site_name', setting_value: 'VTuber Thai' },
      { setting_key: 'current_ranking_period', setting_value: '2026-10' },
      { setting_key: 'ranking_update_frequency', setting_value: 'manual' },
      { setting_key: 'directory_sync_enabled', setting_value: 'false' },
    ];
    cy.loginAs('manager');
    cy.intercept('GET', '**/api/v1/admin/settings', req => req.reply({ results: settings }));
    cy.intercept('GET', '**/api/v1/admin/pipeline-runs', { results: [] });
    cy.intercept('GET', '**/api/v1/admin/directory-sync', req => req.reply({
      runs: [{ id: 'directory-fixture', status: 'partial', started_at: '2026-10-05T02:00:00Z', profiles_checked: 12, channels_added: 2, candidates_pending: 1, error_summary: 'Pixela official roster could not be checked' }],
      candidates: ignored ? [] : [{ channel_id: channelId, name: 'Pending creator', source_url: `https://www.youtube.com/channel/${channelId}`, reason: 'Thai VTuber / independent affiliation needs primary evidence' }],
    })).as('getDirectorySync');
    cy.intercept('PUT', '**/api/v1/admin/settings', req => {
      expect(req.headers['x-csrf-token']).to.eq('test-csrf-token');
      expect(req.body).to.include({ ranking_update_frequency: 'daily', directory_sync_enabled: 'true' });
      settings = Object.entries(req.body).map(([setting_key, setting_value]) => ({ setting_key, setting_value }));
      req.reply({ ok: true });
    }).as('saveDailySettings');
    cy.intercept('POST', `**/api/v1/admin/directory-candidates/${channelId}/ignore`, req => {
      expect(req.headers['x-csrf-token']).to.eq('test-csrf-token'); ignored = true; req.reply({ ok: true });
    }).as('ignoreCandidate');
    cy.visit('/admin/settings'); cy.wait('@getDirectorySync');
    cy.contains('ตรวจโปรไฟล์ 12 · เพิ่มช่อง 2 · รอตรวจ 1').should('be.visible');
    cy.contains('a', 'แหล่งอ้างอิง').should('have.attr', 'href', `https://www.youtube.com/channel/${channelId}`);
    cy.contains('label', 'ความถี่การอัปเดต').find('select').select('daily');
    cy.contains('label', 'ค้นหาและอัปเดตโปรไฟล์').find('select').select('true');
    cy.contains('button', 'บันทึกการตั้งค่า').click(); cy.wait('@saveDailySettings');
    cy.contains('บันทึกการตั้งค่าแล้ว').should('be.visible');
    cy.get('button[aria-label="ข้าม Pending creator"]').click(); cy.wait(['@ignoreCandidate', '@getDirectorySync']);
    cy.contains('Pending creator').should('not.exist');
    cy.reload();
    cy.contains('label', 'ความถี่การอัปเดต').find('select').should('have.value', 'daily');
    cy.contains('label', 'ค้นหาและอัปเดตโปรไฟล์').find('select').should('have.value', 'true');
    cy.viewport(390, 844);
    cy.get('main').should('be.visible');
    cy.document().then(document => expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth));
    cy.screenshot('daily-directory-sync-settings');
  });

  it('redirects staff away from manager-only system pages', () => {
    cy.loginAs('staff');
    cy.intercept('GET', '**/api/v1/admin/vtubers', { fixture: 'admin-vtubers.json' }).as('getChannels');
    cy.visit('/admin/settings');
    cy.wait(['@getMe', '@getChannels']);

    cy.location('pathname').should('eq', '/admin/channels');
  });
});
