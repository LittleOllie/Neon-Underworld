'use client';

import { signOut } from 'next-auth/react';

export function LogoutLink() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="os-link"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12 }}
    >
      Logout
    </button>
  );
}
