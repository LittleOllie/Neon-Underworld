export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 className="g-section-label" id={id}>
      {children}
    </h2>
  );
}
