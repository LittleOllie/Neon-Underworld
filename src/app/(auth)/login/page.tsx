'use client';

import { SessionProvider } from 'next-auth/react';
import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginForm />
    </SessionProvider>
  );
}
