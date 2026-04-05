import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('changes year from selector', async () => {
    const user = userEvent.setup();
    render(<App />);

    const selector = screen.getByLabelText('Seleccionar año');
    expect(selector).toHaveValue('2025');

    await user.selectOptions(selector, '2024');
    expect(selector).toHaveValue('2024');
    await user.click(screen.getByRole('button', { name: /Evolución/i }));
    expect(screen.getByText('Ene 2024')).toBeInTheDocument();
  });
});
