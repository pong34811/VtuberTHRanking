import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import HomePage from '@/pages/HomePage';
import { HOMEPAGE_TEMPLATES } from '@/pages/homepageTemplates';
import { normalizeHomepageTemplate } from '../../../../shared/homepage-templates.js';

const templates = Object.values(HOMEPAGE_TEMPLATES);

export function HomepageTemplateTab({ csrfToken }) {
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
    setLoading(true);
    setLoadError('');
    adminApi('/settings/homepage-template')
      .then(response => {
        if (!active) return;
        const selected = normalizeHomepageTemplate(response?.homepage_template);
        setPublishedId(selected);
        setDraftId(selected);
      })
      .catch(error => {
        if (active) setLoadError(error?.message || 'โหลดการตั้งค่าแม่แบบหน้าแรกไม่สำเร็จ');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const selectDraft = id => {
    setDraftId(id);
    setSaveError('');
    setSuccess('');
  };

  const save = async () => {
    if (!draftId || draftId === publishedId || saving) return;
    const savingId = draftId;
    setSaving(true);
    setSaveError('');
    setSuccess('');
    try {
      const response = await adminApi('/settings/homepage-template', {
        method: 'PUT',
        csrfToken,
        body: { homepage_template: savingId },
      });
      const savedId = normalizeHomepageTemplate(response?.homepage_template ?? savingId);
      setPublishedId(savedId);
      setDraftId(current => current === savingId ? savedId : current);
      setSuccess('บันทึกหน้าแรกแล้ว');
    } catch (error) {
      setSaveError(error?.message || 'บันทึกหน้าแรกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="admin-state" role="status">กำลังโหลดการตั้งค่าแม่แบบหน้าแรก…</p>;
  if (loadError) {
    return (
      <section className="admin-card homepage-template-manager" aria-labelledby="homepage-template-title">
        <h2 id="homepage-template-title">เลือกแม่แบบหน้าแรก</h2>
        <div className="homepage-template-feedback" role="alert">โหลดการตั้งค่าแม่แบบหน้าแรกไม่สำเร็จ: {loadError}</div>
        <button type="button" onClick={() => setRetry(value => value + 1)}>ลองโหลดอีกครั้ง</button>
      </section>
    );
  }

  const publishedTemplate = HOMEPAGE_TEMPLATES[publishedId];
  const draftTemplate = HOMEPAGE_TEMPLATES[draftId];
  const hasDraft = draftId !== publishedId;

  return (
    <section className="admin-card homepage-template-manager" aria-labelledby="homepage-template-title">
      <header className="homepage-template-header">
        <div>
          <h2 id="homepage-template-title">เลือกแม่แบบหน้าแรก</h2>
          <p>เลือกรูปแบบที่เหมาะกับผู้เข้าชม แล้วตรวจดูตัวอย่างก่อนเผยแพร่</p>
        </div>
        <p className="homepage-template-published" aria-live="polite">
          เผยแพร่อยู่: <strong>{publishedTemplate.label}</strong>
        </p>
      </header>

      <div className="homepage-template-options" role="group" aria-label="แม่แบบหน้าแรก">
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            className={`homepage-template-option${draftId === template.id ? ' is-selected' : ''}${publishedId === template.id ? ' is-published' : ''}`}
            aria-pressed={draftId === template.id}
            onClick={() => selectDraft(template.id)}
          >
            <span className={`homepage-template-thumbnail homepage-template-thumbnail--${template.id}`} aria-hidden="true">
              {template.id === 'search-first' && <>
                <span className="thumbnail-search-bar" />
                <span className="thumbnail-card-row"><i /><i /><i /></span>
              </>}
              {template.id === 'category-first' && <>
                <span className="thumbnail-category-tiles"><i /><i /><i /><i /></span>
                <span className="thumbnail-category-group"><i /><i /><i /></span>
                <span className="thumbnail-category-group"><i /><i /><i /></span>
              </>}
              {template.id === 'newest-first' && <>
                <span className="thumbnail-date-heading" />
                <span className="thumbnail-newest-entry"><i /><b /><b /></span>
                <span className="thumbnail-newest-entry"><i /><b /><b /></span>
                <span className="thumbnail-newest-entry"><i /><b /><b /></span>
              </>}
            </span>
            <span className="homepage-template-option-copy">
              <span className="homepage-template-option-title">
                <strong>{template.label}</strong>
                {publishedId === template.id && <small>เผยแพร่อยู่</small>}
              </span>
              <span className="homepage-template-description">{template.description}</span>
            </span>
          </button>
        ))}
      </div>

      {hasDraft && <p className="homepage-template-draft-label">ตัวอย่าง — ยังไม่เผยแพร่</p>}
      <section
        className="homepage-template-preview"
        aria-label="ตัวอย่างหน้าแรก"
        data-testid="homepage-preview"
        data-template-override={draftId}
        data-preview-mode="true"
      >
        <HomePage templateOverride={draftId} previewMode />
      </section>

      {saveError && <p className="homepage-template-feedback" role="alert">{saveError}</p>}
      {success && <p className="homepage-template-success" role="status">{success}</p>}
      <div className="homepage-template-actions">
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!hasDraft || saving}
          aria-busy={saving}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกเป็นหน้าแรก'}
        </button>
      </div>
    </section>
  );
}

export default HomepageTemplateTab;
