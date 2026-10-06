describe('Synthetic manager approval queue', () => {
  const id = `UC${'a'.repeat(22)}`;
  const row = {channel_id:id,name:'Synthetic creator',checked_at:'2026-10-05 00:00:00',profile_json:JSON.stringify({name:'Synthetic creator',bio:'Primary text requiring review'}),review_json:JSON.stringify({affiliation:'indie'}),evidence_json:JSON.stringify([{kind:'youtube-profile',source:`https://www.youtube.com/channel/${id}`,description:'Synthetic primary evidence'}])};
  it('searches, pages, reviews with explicit affiliation, approves and ignores', () => {
    let removed = false;
    cy.loginAs('manager');
    cy.intercept('GET','**/api/v1/admin/agencies',{results:[]});
    cy.intercept('GET','**/api/v1/admin/directory-sync',{runs:[{candidates_checked:5,candidates_new:2,candidates_duplicate:3,candidates_unavailable:0}],candidates:[],sweep:{query_index:4,completed:0,remaining_items:2}});
    cy.intercept('GET','**/api/v1/admin/directory-candidates?*',req => { if (req.query.offset === '20') req.alias = 'page'; if (req.query.q) req.alias = 'search'; req.reply({results:removed ? [] : [row],total:removed ? 0 : req.query.q ? 1 : 21,limit:20,offset:Number(req.query.offset)}); }).as('queue');
    cy.intercept('POST',`**/directory-candidates/${id}/approve`,req => {
      expect(req.body).to.include({affiliation:'indie',platform:'youtube',youtube_url:`https://www.youtube.com/channel/${id}`});
      expect(req.headers['x-csrf-token']).to.eq('test-csrf-token');
      removed = true; req.reply({statusCode:201,body:{ok:true,id:9,channel_id:id,snapshot:false}});
    }).as('approve');
    cy.visit('/admin/channel-approvals'); cy.wait(['@getMe','@queue']);
    cy.contains('button','หน้าถัดไป').click(); cy.wait('@page').its('request.query.offset').should('eq','20');
    cy.get('input').first().type('Synthetic'); cy.contains('button','ค้นหา').click(); cy.wait('@search').its('request.query.offset').should('eq','0');
    cy.contains('button','ตรวจและอนุมัติ').click();
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button','อนุมัติช่อง').should('be.disabled');
      cy.contains('label','YouTube URL').find('input').should('have.attr','readonly');
      cy.contains('label','ประเภทสังกัด').find('select').select('indie');
      cy.contains('button','อนุมัติช่อง').click();
    });
    cy.wait(['@approve','@queue']); cy.contains('อนุมัติข้อมูลช่องแล้ว ยังไม่มีสถิติ YouTube ที่พร้อมใช้งาน').should('be.visible');
    cy.contains('ไม่พบช่องรออนุมัติ').should('be.visible');
    cy.then(() => { removed = false; }); cy.contains('button','รีเฟรชคิว').click(); cy.wait('@queue');
    cy.intercept('POST',`**/directory-candidates/${id}/ignore`,{statusCode:409,body:{message:'stale'}}).as('stale');
    cy.contains('button','ข้ามรายการ').click(); cy.wait('@stale'); cy.contains('รายการนี้เปลี่ยนไปแล้ว กรุณารีเฟรชคิว').should('be.visible');
    cy.intercept('POST',`**/directory-candidates/${id}/ignore`,req => {removed = true;req.reply({ok:true});}).as('ignore');
    cy.contains('button','ข้ามรายการ').click(); cy.wait(['@ignore','@queue']); cy.contains('ข้ามรายการแล้ว').should('be.visible');
  });
  it('recovers list errors and supports Escape focus restoration and mobile layout', () => {
    cy.loginAs('manager'); cy.intercept('GET','**/api/v1/admin/agencies',{results:[]});
    cy.intercept('GET','**/api/v1/admin/directory-sync',{runs:[],candidates:[],sweep:null});
    cy.intercept('GET','**/api/v1/admin/directory-candidates?*',{statusCode:503,body:{message:'Synthetic unavailable'}}).as('queue');
    cy.visit('/admin/channel-approvals');cy.wait('@queue');cy.contains('Synthetic unavailable').should('be.visible');
    cy.intercept('GET','**/api/v1/admin/directory-candidates?*',{results:[row],total:1,limit:20,offset:0}).as('retry');
    cy.contains('button','ลองอีกครั้ง').click();cy.wait('@retry');
    cy.viewport(390,844);cy.contains('button','ตรวจและอนุมัติ').click();
    cy.get('[role="dialog"]').should('be.visible');cy.get('body').type('{esc}');cy.get('[role="dialog"]').should('not.exist');
    cy.focused().should('contain','ตรวจและอนุมัติ');
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
    cy.screenshot('channel-approvals-synthetic-mobile');
  });
  it('guards direct staff access and omits the manager menu', () => {
    cy.loginAs('staff');cy.intercept('GET','**/api/v1/admin/vtubers',{results:[]});
    cy.visit('/admin/channel-approvals');cy.wait('@getMe');cy.location('pathname').should('eq','/admin/channels');cy.get('nav[aria-label="เมนูผู้ดูแล"]').should('not.contain','ช่องรออนุมัติ');
  });
});
