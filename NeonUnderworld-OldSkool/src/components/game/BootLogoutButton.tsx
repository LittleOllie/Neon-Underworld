'use client';

import { signOut } from 'next-auth/react';

/** Corner logout on the intro screen — only shown for authenticated sessions. */
export function BootLogoutButton() {
  return (
    <button
      type="button"
      className="nu-boot__logout"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Log out
    </button>
  );
}
