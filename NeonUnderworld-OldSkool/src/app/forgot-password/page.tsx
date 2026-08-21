import { Suspense } from 'react';
import { ForgotPasswordForm } from '@local/features/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
