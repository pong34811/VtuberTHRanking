import { render, screen } from '@testing-library/react';
import RankBadge from '@/components/RankBadge.jsx';

describe('RankBadge', () => {
  it('shows the supplied rank to users', () => {
    render(<RankBadge rank={1} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
