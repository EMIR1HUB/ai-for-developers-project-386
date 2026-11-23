import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should render title and API status when backend responds ok', async () => {
    // given
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok' })),
    );

    // when
    render(<App />);

    // then
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });
});
