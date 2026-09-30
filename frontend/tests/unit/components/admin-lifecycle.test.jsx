import { useState } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Modal, useSubmit, Field as LegacyField } from '@/admin/ui';
import { Dialog } from '@/admin/components/ui/dialog';
import { Field, Input } from '@/admin/components/ui/field';
import { Avatar } from '@/admin/components/ui/feedback';
import { ChannelForm } from '@/admin/channels/ChannelForm';
import { blank } from '@/admin/channels/options';

afterEach(() => vi.unstubAllGlobals());
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

it('does not complete an abandoned editor submission after unmount', async () => {
  const pending = deferred(), success = vi.fn();
  const view = renderHook(() => useSubmit(() => pending.promise, success));
  let submission;
  act(() => { submission = view.result.current.submit(); });
  view.unmount();
  await act(async () => { pending.resolve({ ok: true }); await submission; });
  expect(success).not.toHaveBeenCalled();
});

function ModalHarness({ kind, removeOpener = false }) {
  const [open, setOpen] = useState(false);
  return <main className="admin-app">
    {(!open || !removeOpener) && <button onClick={() => setOpen(true)}>Edit Alpha</button>}
    <button>Fallback action</button>
    {kind === 'legacy' ? open && <Modal title="Editor" onClose={() => setOpen(false)}><input aria-label="Draft" /><button>Save</button></Modal>
      : <Dialog open={open} wide={kind === 'sheet'} title="Editor" onClose={() => setOpen(false)}><input aria-label="Draft" /><button>Save</button></Dialog>}
  </main>;
}

it.each(['legacy', 'dialog', 'sheet'])('restores the actual %s opener after Escape and traps keyboard focus', async (kind) => {
  const user = userEvent.setup();
  render(<ModalHarness kind={kind} />);
  const opener = screen.getByRole('button', { name: 'Edit Alpha' });
  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Editor' });
  for (let i = 0; i < 5; i++) { await user.tab(); expect(dialog).toContainElement(document.activeElement); }
  await user.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
});

it.each(['legacy', 'dialog', 'sheet'])('restores a local fallback when the %s opener was removed', async (kind) => {
  const user = userEvent.setup();
  render(<ModalHarness kind={kind} removeOpener />);
  await user.click(screen.getByRole('button', { name: 'Edit Alpha' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Fallback action' })).toHaveFocus());
});

it.each([['shared', Field, Input], ['legacy', LegacyField, 'input']])('links %s field hints and errors to its control', (_, FieldComponent, Control) => {
  const view = render(<FieldComponent label="Channel slug" hint="Lowercase only"><Control /></FieldComponent>);
  expect(screen.getByRole('textbox', { name: 'Channel slug' })).toHaveAccessibleDescription('Lowercase only');
  view.rerender(<FieldComponent label="Channel slug" hint="Lowercase only" error="Invalid slug"><Control /></FieldComponent>);
  const input = screen.getByRole('textbox', { name: 'Channel slug' });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Invalid slug');
});

it('gives a new avatar URL another load attempt after a failed image', () => {
  const view = render(<Avatar src="https://example.test/broken.png" name="Alpha" />);
  fireEvent.error(view.container.querySelector('img'));
  expect(view.container.querySelector('img')).toBeNull();
  view.rerender(<Avatar src="https://example.test/new.png" name="Alpha" />);
  expect(view.container.querySelector('img')).toHaveAttribute('src', 'https://example.test/new.png');
});

it('does not let the pending channel A save close channel B after an identity switch', async () => {
  const pending = deferred(), saved = vi.fn();
  vi.stubGlobal('fetch', vi.fn((_, options) => options.method === 'PUT' ? pending.promise : Promise.resolve(Response.json({ results: [] }))));
  const a = { ...blank, id: 1, name: 'Alpha', slug: 'alpha' }, b = { ...blank, id: 2, name: 'Beta', slug: 'beta' };
  const view = render(<ChannelForm value={a} onSaved={saved} onClose={() => {}} />);
  fireEvent.submit(view.container.querySelector('form'));
  view.rerender(<ChannelForm value={b} onSaved={saved} onClose={() => {}} />);
  expect(screen.getByRole('textbox', { name: 'ชื่อช่อง' })).toHaveValue('Beta');
  await act(async () => { pending.resolve(Response.json({ ok: true })); });
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'ชื่อช่อง' })).toHaveValue('Beta');
});

it('does not emit a duplicate unauthorized event from a form submission', async () => {
  const expired = vi.fn();
  window.addEventListener('admin:unauthorized', expired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Expired' }, { status: 401 })));
  const { adminApi } = await import('@/admin/api');
  const view = renderHook(() => useSubmit(() => adminApi('/users', { method: 'POST', body: {} })));
  try { await act(async () => { await view.result.current.submit(); }); expect(expired).toHaveBeenCalledTimes(1); }
  finally { window.removeEventListener('admin:unauthorized', expired); }
});
