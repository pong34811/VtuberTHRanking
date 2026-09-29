import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RetryAvatar from '@/components/RetryAvatar';

afterEach(() => vi.useRealTimers());

it('retries a failed avatar once without a page refresh, then shows the initial', () => {
  vi.useFakeTimers();
  const { container, rerender } = render(<RetryAvatar src="https://example.com/a.png" alt="" fallback={<span>A</span>} />);
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('A')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(500));
  expect(container.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/^https:\/\/example\.com\/a\.png\?_avatar_retry=/));
  fireEvent.error(container.querySelector('img'));
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('A')).toBeInTheDocument();
  rerender(<RetryAvatar src="https://example.com/b.png" alt="" fallback={<span>B</span>} />);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/b.png');
});
