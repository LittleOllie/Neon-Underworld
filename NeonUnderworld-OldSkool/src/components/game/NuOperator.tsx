'use client';

import { useState } from 'react';
import { nuOperatorUrl } from '@local/config/nu-characters';

type Props = {
  className?: string;
};

/**
 * Master NU Operator — decorative layer composited over gameplay environments.
 * Replace public/images/nu/characters/operator.png to update everywhere.
 */
export function NuOperator({ className }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- character asset; natural aspect ratio
    <img
      src={nuOperatorUrl()}
      alt=""
      className={['nu-operator', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      decoding="async"
      fetchPriority="low"
      onError={() => setFailed(true)}
    />
  );
}
