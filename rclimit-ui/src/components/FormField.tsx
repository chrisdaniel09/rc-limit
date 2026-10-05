interface Option {
  value: string;
  label: string;
}

interface FormFieldProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  options?: Option[];
  placeholder?: string;
  disabled?: boolean;
}

export default function FormField({ label, type = 'text', value, onChange, error, required, options, placeholder, disabled }: FormFieldProps) {
  const baseClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed';

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          required={required}
          disabled={disabled}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
