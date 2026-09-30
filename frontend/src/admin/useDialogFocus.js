import { useRef } from 'react';

const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

// Capture before Radix mounts/moves focus, including a row removed in this render.
export function useDialogFocus(open) {
  const wasOpen = useRef(false);
  const origin = useRef(null);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    const opener = document.activeElement;
    const root = opener?.closest('.admin-card, .channel-console, .admin-app, main') || opener?.parentElement;
    origin.current = { opener, root, alternatives: Array.from(root?.querySelectorAll(focusable) || []).filter(node => node !== opener) };
  }
  wasOpen.current = open;
  return event => {
    event.preventDefault();
    // An old editor must never steal focus from a newly opened editor.
    if (document.querySelector('[role="dialog"]')) return;
    const { opener, root, alternatives = [] } = origin.current || {};
    const target = opener?.isConnected && opener !== document.body && !opener.disabled
      ? opener : alternatives.find(node => node.isConnected && !node.disabled && !node.closest('[hidden]'));
    if (target) { target.focus(); return; }
    const fallback = root?.isConnected && root !== document.body ? root : document.querySelector('.admin-app main, main');
    if (fallback) { fallback.setAttribute('tabindex', '-1'); fallback.focus(); }
  };
}
