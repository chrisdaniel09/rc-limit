import { COUNTRY_CODE, INDIAN_MOBILE_MESSAGE, INDIAN_MOBILE_PATTERN, isValidIndianMobile } from '../utils/phone';

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function PhoneInput({ label, value, onChange, required, placeholder = '9876543210', disabled }: PhoneInputProps) {
  const showError = value.length > 0 && !isValidIndianMobile(value);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="mt-1 flex">
        <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-700 select-none">
          {COUNTRY_CODE}
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          pattern={INDIAN_MOBILE_PATTERN}
          title={INDIAN_MOBILE_MESSAGE}
          className="block w-full rounded-r-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
          required={required}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {showError && <p className="mt-1 text-sm text-red-600">{INDIAN_MOBILE_MESSAGE}</p>}
    </div>
  );
}
