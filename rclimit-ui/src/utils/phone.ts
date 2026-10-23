export const COUNTRY_CODE = '+91';
export const INDIAN_MOBILE_PATTERN = '[6-9][0-9]{9}';
export const INDIAN_MOBILE_MESSAGE = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9';

const INDIAN_MOBILE_REGEX = new RegExp(`^${INDIAN_MOBILE_PATTERN}$`);

export const isValidIndianMobile = (nationalNumber: string): boolean => INDIAN_MOBILE_REGEX.test(nationalNumber);

// Joins the fixed country code with the national number. Empty input becomes null.
export const toPhoneNumber = (nationalNumber: string): string | null =>
  nationalNumber ? `${COUNTRY_CODE}${nationalNumber}` : null;
