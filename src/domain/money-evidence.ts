export function amountAppearsInText(amount: number, text: string): boolean {
  if (!Number.isFinite(amount) || amount < 0) {
    return false;
  }
  const compact = text.replace(/[\s,\u066C\u060C]/g, '');
  return digitForms(amount).some((form) => bounded(compact, form));
}

function digitForms(amount: number): string[] {
  const [whole, fraction] = amount.toFixed(2).split('.');
  const forms = new Set<string>([whole, reverse(whole)]);
  if (fraction !== '00') {
    forms.add(`${whole}.${fraction}`);
    forms.add(`${whole}${fraction}`);
    forms.add(reverse(`${whole}${fraction}`));
  }
  return [...forms];
}

function reverse(value: string): string {
  return [...value].reverse().join('');
}

function bounded(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\D)${escaped}(\\D|$)`).test(text);
}
