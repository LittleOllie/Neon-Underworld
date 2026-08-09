'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { BrandMark } from '@/components/game/BrandMark';
import { FormField } from '@/components/ui/FormField';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: form.get('email') as string,
      password: form.get('password') as string,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError('Invalid credentials. Check your email and password.');
      return;
    }
    router.push('/command');
    router.refresh();
  }

  return (
    <div className="game-shell-bg flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <BrandMark className="justify-center" />
          <h1 className="font-display mt-4 text-2xl font-semibold">Neon Underworld</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your command terminal
          </p>
          <p className="mt-1 text-xs text-muted">Invite-only alpha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email" name="email" type="email" required autoComplete="email" />
          <FormField
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-[48px] w-full rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Have an invite?{' '}
          <Link href="/register" className="font-medium text-gold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
