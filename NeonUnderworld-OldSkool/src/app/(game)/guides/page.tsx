import { redirect } from 'next/navigation';

/** Legacy route — consolidated into How to Play. */
export default function GuidesPage() {
  redirect('/how-to-play#reference');
}
