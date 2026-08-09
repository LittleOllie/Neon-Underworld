'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="min-h-[44px] w-full text-sm text-muted transition-colors hover:text-foreground"
    >
      Sign out
    </button>
  );
}
