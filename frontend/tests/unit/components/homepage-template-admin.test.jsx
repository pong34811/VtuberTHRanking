import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/admin/api';
import { HomepageTemplateTab } from '@/admin/tabs/HomepageTemplateTab';

vi.mock('@/admin/api', () => ({ adminApi: vi.fn() }));
vi.mock('@/pages/HomePage', () => ({
  default: ({ templateOverride, previewMode }) => (
    <div data-template-override={templateOverride} data-preview-mode={previewMode} />
  ),
}));

const published = { homepage_template: 'search-first' };

beforeEach(() => {
  vi.clearAllMocks();
  adminApi.mockResolvedValue(published);
});
afterEach(() => cleanup());

function renderTab() {
  return render(<HomepageTemplateTab csrfToken="csrf-test-token" />);
}

function getPublishedMarker(label) {
  return screen.getByText((_, element) =>
    element?.classList.contains('homepage-template-published') && element.textContent === `เผยแพร่อยู่: ${label}`,
  );
}

async function chooseCategory() {
  fireEvent.click(await screen.findByRole('button', { name: /สำรวจกลุ่ม VTuber/ }));
}

describe('Homepage template manager', () => {
  it('published selection loads and marks all curated presets', async () => {
    renderTab();

    expect(await screen.findByText((_, element) => element?.classList.contains('homepage-template-published')
      && element.textContent === 'เผยแพร่อยู่: ค้นหาก่อน')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ค้นหาก่อน/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /สำรวจกลุ่ม VTuber/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /เพิ่มเข้ารายการล่าสุด/ })).toHaveAttribute('aria-pressed', 'false');
    expect(adminApi).toHaveBeenCalledWith('/settings/homepage-template');
  });

  it('draft preset updates the preview but keeps the published marker unchanged', async () => {
    renderTab();
    await chooseCategory();

    expect(screen.getByText('ตัวอย่าง — ยังไม่เผยแพร่')).toBeInTheDocument();
    expect(getPublishedMarker('ค้นหาก่อน')).toBeInTheDocument();
    expect(screen.getByTestId('homepage-preview')).toHaveAttribute('data-template-override', 'category-first');
    expect(screen.getByTestId('homepage-preview')).toHaveAttribute('data-preview-mode', 'true');
    expect(adminApi).toHaveBeenCalledTimes(1);
  });

  it('selects a preset with Enter on its focused button', async () => {
    const user = userEvent.setup();
    renderTab();

    const newest = await screen.findByRole('button', { name: /เพิ่มเข้ารายการล่าสุด/ });
    newest.focus();
    await user.keyboard('{Enter}');

    expect(newest).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('homepage-preview')).toHaveAttribute('data-template-override', 'newest-first');
    expect(getPublishedMarker('ค้นหาก่อน')).toBeInTheDocument();
  });

  it('retries after the published template fails to load', async () => {
    adminApi.mockReset()
      .mockRejectedValueOnce(new Error('Template settings unavailable'))
      .mockResolvedValueOnce(published);
    renderTab();

    expect(await screen.findByRole('alert')).toHaveTextContent('Template settings unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'ลองโหลดอีกครั้ง' }));
    expect(await screen.findByText((_, element) => element?.classList.contains('homepage-template-published')
      && element.textContent === 'เผยแพร่อยู่: ค้นหาก่อน')).toBeInTheDocument();
    expect(adminApi).toHaveBeenCalledTimes(2);
  });

  it('disables save while the draft matches the published preset', async () => {
    renderTab();

    expect(await screen.findByRole('button', { name: 'บันทึกเป็นหน้าแรก' })).toBeDisabled();
  });

  it('saves a draft with the CSRF token and updates the published marker', async () => {
    adminApi.mockResolvedValueOnce(published).mockResolvedValueOnce({ ok: true, homepage_template: 'category-first' });
    renderTab();
    await chooseCategory();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' }));

    await waitFor(() => expect(adminApi).toHaveBeenCalledWith('/settings/homepage-template', {
      method: 'PUT',
      csrfToken: 'csrf-test-token',
      body: { homepage_template: 'category-first' },
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('บันทึกหน้าแรกแล้ว');
    expect(getPublishedMarker('เลือกหมวดหมู่')).toBeInTheDocument();
    expect(screen.queryByText('ตัวอย่าง — ยังไม่เผยแพร่')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' })).toBeDisabled();
  });

  it('prevents duplicate saves while a request is pending', async () => {
    let finishSave;
    adminApi.mockResolvedValueOnce(published).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    renderTab();
    await chooseCategory();
    const save = screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(save).toBeDisabled();
    expect(adminApi).toHaveBeenCalledTimes(2);
    await act(async () => finishSave({ ok: true, homepage_template: 'category-first' }));
    expect(await screen.findByText((_, element) => element?.classList.contains('homepage-template-published')
      && element.textContent === 'เผยแพร่อยู่: เลือกหมวดหมู่')).toBeInTheDocument();
  });

  it('preserves a newer draft selected while publishing the previous draft', async () => {
    let finishSave;
    adminApi.mockResolvedValueOnce(published).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    renderTab();
    await chooseCategory();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' }));
    fireEvent.click(screen.getByRole('button', { name: /เพิ่มเข้ารายการล่าสุด/ }));

    await act(async () => finishSave({ ok: true, homepage_template: 'category-first' }));
    expect(getPublishedMarker('เลือกหมวดหมู่')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /เพิ่มเข้ารายการล่าสุด/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('homepage-preview')).toHaveAttribute('data-template-override', 'newest-first');
    expect(screen.getByText('ตัวอย่าง — ยังไม่เผยแพร่')).toBeInTheDocument();
  });

  it('preserves the published preset and draft preview after save fails', async () => {
    adminApi.mockResolvedValueOnce(published).mockRejectedValueOnce(new Error('Save unavailable'));
    renderTab();
    await chooseCategory();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Save unavailable');
    expect(screen.getByText('ตัวอย่าง — ยังไม่เผยแพร่')).toBeInTheDocument();
    expect(getPublishedMarker('ค้นหาก่อน')).toBeInTheDocument();
    expect(screen.getByTestId('homepage-preview')).toHaveAttribute('data-template-override', 'category-first');
    expect(screen.getByRole('button', { name: 'บันทึกเป็นหน้าแรก' })).toBeEnabled();
  });
});
