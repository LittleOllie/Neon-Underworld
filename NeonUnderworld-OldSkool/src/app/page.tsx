import { redirect } from 'next/navigation';

/** Root entry — middleware redirects before this renders in normal flow. */
export default function HomePage() {
  redirect('/login');
}
