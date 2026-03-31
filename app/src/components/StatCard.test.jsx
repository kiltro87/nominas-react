import { Landmark } from 'lucide-react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('shows positive trend as green by default', () => {
    render(<StatCard title="Test" value="100" trend={5} icon={Landmark} />);
    expect(screen.getByText('5%')).toHaveClass('text-emerald-600');
  });

  it('shows positive trend as red when inverseTrend is true', () => {
    render(<StatCard title="IRPF" value="30%" trend={5} inverseTrend icon={Landmark} />);
    expect(screen.getByText('5%')).toHaveClass('text-rose-600');
  });
});
