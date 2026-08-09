'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerAction } from '@/server/actions/auth.actions';
import { BrandMark } from '@/components/game/BrandMark';
import { FormField } from '@/components/ui/FormField';

interface RegisterFormProps {
  districts: Array<{ slug: string; name: string; description: string }>;
}

export function RegisterForm({ districts }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await registerAction(formData);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/command');
    router.refresh();
  }

  return (
    <div className="game-shell-bg flex min-h-dvh flex-col px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandMark className="justify-center" />
          <h1 className="font-display mt-4 text-2xl font-semibold">Establish your empire</h1>
          <p className="mt-2 text-sm text-muted-foreground">Invite-only registration</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Invite code" name="inviteCode" required placeholder="NEON-ALPHA-2026" />
          <FormField label="Email" name="email" type="email" required autoComplete="email" />
          <FormField label="Password" name="password" type="password" required autoComplete="new-password" />
          <FormField label="Confirm password" name="confirmPassword" type="password" required autoComplete="new-password" />
          <FormField label="Alias" name="alias" required placeholder="Your empire name" autoComplete="username" />

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Select district</legend>
            {districts.map((d) => {
              const selected = selectedDistrict === d.slug;
              return (
                <label
                  key={d.slug}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                    selected ? 'border-gold/40 bg-gold-muted' : 'border-border-subtle bg-surface hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="districtSlug"
                    value={d.slug}
                    required
                    className="mt-1 accent-[var(--gold)]"
                    onChange={() => setSelectedDistrict(d.slug)}
                  />
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.description}</p>
                  </div>
                </label>
              );
            })}
          </fieldset>

          {error && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[48px] w-full rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Enter the underworld'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
