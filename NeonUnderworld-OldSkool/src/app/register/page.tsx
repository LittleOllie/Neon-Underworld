import { PublicHomeLayout } from '@local/features/auth/OldSkoolAuth';
import { RegisterForm } from '@local/features/auth/RegisterForm';
import { loadPublicPageData } from '@local/lib/public-page-data';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const data = await loadPublicPageData({ includeDistricts: true });

  if (!data.ok) {
    return (
      <PublicHomeLayout leaders={[]} seasonLabel="Neon Underworld">
        <div className="os-section">
          <div className="os-section-title">Registration Unavailable</div>
          <div className="os-section-body">
            <p role="alert" style={{ color: 'var(--os-red)', lineHeight: 1.5 }}>
              {data.message}
            </p>
          </div>
        </div>
      </PublicHomeLayout>
    );
  }

  return (
    <PublicHomeLayout leaders={data.leaders} seasonLabel={data.seasonLabel}>
      <RegisterForm
        districts={data.districts.map((d) => ({
          slug: d.slug,
          name: d.name,
          description: d.description,
        }))}
      />
    </PublicHomeLayout>
  );
}
