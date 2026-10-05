# .agents/Skills Index

Directory นี้เก็บ SKILL.md สำหรับงาน VtuberTHRanking และเครื่องมือเสริมของ Hermes Agent

```
.agents/skills/
├─ agentskill-sh-learn/SKILL.md
├─ agentskill-sh-review-skill/SKILL.md
├─ vtuberthranking/SKILL.md
├─ thai-vtuber-ranking-ops/SKILL.md
└─ vtuberthranking-ops-workflow/SKILL.md
   └─ references/deploy-checklist.md
```

## คำอธิบายโดยย่อ

- **agentskill-sh-learn** – เรียนรู้และจดจำเวิร์กโฟลว์จากโค้ดเบส, สร้างสรุปและบันทึก reference
- **agentskill-sh-review-skill** – ตรวจและให้คะแนน SKILL.md ตาม rubric, ตรวจสอบ frontmatter, platform gating, tests
- **vtuberthranking** – แก้ไขและแผนฟีitur ranking/UX ของ VtuberTHRanking ตาม plan.md และ Issue workflow
- **thai-vtuber-ranking-ops** – ขั้นตอน deploy Cloudflare Pages/Worker/D1, migration, admin API, directory sync Issue #10, CI/CD และ smoke test
- **vtuberthranking-ops-workflow** – workflow ครบรอบ: ตรวจ plan.md, commit/push บน main, deploy Worker, apply D1 migration remote, deploy Pages, smoke production, อัปเดต plan.md, จัดการ skill ใน .agents/skills และดัชนี SKILL_INDEX.md

อัปเดตล่าสุด: 2026-10-05

ลำดับการอ้างอิงหลักของโครงการยึดตาม plan.md และ AGENTS.md
