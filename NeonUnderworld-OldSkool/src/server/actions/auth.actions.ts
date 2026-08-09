'use server';

import { registerAction as coreRegisterAction } from '@core/server/actions/auth.actions';

export type { ActionResult } from '@core/server/actions/auth.actions';

export async function registerAction(formData: FormData) {
  return coreRegisterAction(formData);
}
