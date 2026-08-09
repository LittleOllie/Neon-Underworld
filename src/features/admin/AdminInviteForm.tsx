'use client';

import { useState } from 'react';
import { createInviteCodeAction } from '@/server/actions/admin.actions';
import { FormField } from '@/components/ui/FormField';
import { ActionButton } from '@/components/ui/ActionButton';

export function AdminInviteForm() {
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await createInviteCodeAction(formData);
    setMessage(result.success ? `Created code: ${result.data?.code}` : result.error);
    if (result.success) e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <FormField label="Code" name="code" required placeholder="NEON-BETA-001" />
      <FormField label="Label" name="label" placeholder="Beta wave 2" />
      <FormField label="Max uses" name="maximumUses" type="number" />
      <ActionButton type="submit">Create</ActionButton>
      {message && <p className="w-full text-sm text-muted">{message}</p>}
    </form>
  );
}
