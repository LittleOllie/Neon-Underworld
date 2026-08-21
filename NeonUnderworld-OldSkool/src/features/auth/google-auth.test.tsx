import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoogleSignInButton, AuthDivider } from '@local/features/auth/GoogleSignInButton';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

describe('GoogleSignInButton', () => {
  it('renders Continue with Google when enabled', () => {
    const html = renderToStaticMarkup(<GoogleSignInButton enabled />);
    expect(html).toContain('Continue with Google');
    expect(html).toContain('g-google-signin');
  });

  it('does not render when disabled', () => {
    const html = renderToStaticMarkup(<GoogleSignInButton enabled={false} />);
    expect(html).toBe('');
  });
});

describe('AuthDivider', () => {
  it('renders or divider', () => {
    const html = renderToStaticMarkup(<AuthDivider />);
    expect(html).toContain('g-auth-divider');
    expect(html).toContain('or');
  });
});
