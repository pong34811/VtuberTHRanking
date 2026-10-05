import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import IntroPage, { Sculpture } from '../../pages/IntroPage';
import { INTRO_HOMEPAGE_TEMPLATES, normalizeIntroHomepageTemplate } from '../../../../shared/intro-homepage-templates.js';

export default function IntroHomepageTemplateTab({ csrfToken }) {
  const [publishedId, setPublishedId] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    adminApi('/settings/intro-homepage-template').then(response => {
      if (!active) return;
      const selected = normalizeIntroHomepageTemplate(response?.intro_homepage_template);
      setPublishedId(selected); setDraftId(selected);
    }).catch(error => { if (active) setLoadError(error?.message || 'โหลดการตั้งค่าหน้าแรกไม่สำเร็จ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const save = async () => {
    if (!draftId || draftId === publishedId || saving) return;
    const savingId = draftId;
    setSaving(true); setSaveError(''); setSuccess('');
    try {
      const response = await adminApi('/settings/intro-homepage-template', {
        method: 'PUT', csrfToken, body: { intro_homepage_template: savingId },
      });
      const savedId = normalizeIntroHomepageTemplate(response?.intro_homepage_template ?? savingId);
      setPublishedId(savedId);
      setDraftId(current => current === savingId ? savedId : current);
      setSuccess('บันทึกหน้าแรกแล้ว');
    } catch (error) { setSaveError(error?.message || 'บันทึกหน้าแรกไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setSaving(false); }
  };
  if (loading) return <p className="admin-state" role="status">กำลังโหลดการตั้งค่าหน้าแรก…</p>;
  if (loadError) return <section className="admin-card"><h2>เลือกแม่แบบหน้าแรก</h2><p role="alert">{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>ลองโหลดอีกครั้ง</button></section>;
  const hasDraft = draftId !== publishedId;
  return <section className="admin-card homepage-template-manager">
    <header className="homepage-template-header"><div><h2>เลือกแม่แบบหน้าแรก</h2><p>เลือกหนึ่งใน 5 แบบ ตรวจดูตัวอย่าง แล้วบันทึกเพื่อใช้กับหน้าแรก /</p></div><p className="homepage-template-published" aria-live="polite">เผยแพร่อยู่: <strong>{INTRO_HOMEPAGE_TEMPLATES.find(template => template.id === publishedId)?.label}</strong></p></header>
    <div className="homepage-template-options intro-template-options" role="group" aria-label="แม่แบบหน้าแรก">
      {INTRO_HOMEPAGE_TEMPLATES.map(template => <button key={template.id} type="button" className={`homepage-template-option${draftId === template.id ? ' is-selected' : ''}`} aria-pressed={draftId === template.id} onClick={() => { setDraftId(template.id); setSaveError(''); setSuccess(''); }}>
        <span className="intro-thumbnail intro-page" data-template={template.id} aria-hidden="true"><Sculpture compact /></span>
        <span className="homepage-template-option-copy"><span className="homepage-template-option-title"><strong>{template.label}</strong>{publishedId === template.id && <small>เผยแพร่อยู่</small>}</span><span className="homepage-template-description">{template.description}</span></span>
      </button>)}
    </div>
    {hasDraft && <p className="homepage-template-draft-label">ตัวอย่าง — ยังไม่เผยแพร่</p>}
    <section className="intro-template-preview" aria-label="ตัวอย่างหน้าแรก" data-testid="intro-homepage-preview" data-template-override={draftId}><IntroPage templateOverride={draftId} previewMode /></section>
    {saveError && <p className="homepage-template-feedback" role="alert">{saveError}</p>}
    {success && <p className="homepage-template-success" role="status">{success}</p>}
    <div className="homepage-template-actions"><button type="button" className="primary" onClick={save} disabled={!hasDraft || saving} aria-busy={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกหน้าแรก'}</button></div>
  </section>;
}
