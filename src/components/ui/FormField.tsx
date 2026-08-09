interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  children?: React.ReactNode;
}

export function FormField({
  label,
  name,
  type = 'text',
  error,
  required,
  placeholder,
  autoComplete,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm text-muted">
        {label}
        {required && <span className="text-red"> *</span>}
      </label>
      {children ?? (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:border-gold focus:outline-none"
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      )}
      {error && (
        <p id={`${name}-error`} className="text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
