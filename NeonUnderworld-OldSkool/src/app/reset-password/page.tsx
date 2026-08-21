import { Suspense } from 'react';
import { ResetPasswordForm } from '@local/features/auth/ResetPasswordForm';

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token ?? '';

  return (
    <Suspense fallback={null}>
      <ResetPasswordForm token={token} />
    </Suspense>
  );
}
