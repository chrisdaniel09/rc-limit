// Indian-system words for an amount ("Fifteen lakh rupees"), shown under large CurrencyInputs to catch an extra zero (§8.3).

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore).replace(/ rupees.*$/, '') : belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (n) parts.push(belowThousand(n));
  let words = parts.join(' ');
  if (words) words += rupees === 1 ? ' rupee' : ' rupees';
  if (paise) words += `${words ? ' and ' : ''}${belowHundred(paise)} paise`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
