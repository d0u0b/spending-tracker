import type { LoanTerms } from '../db/types';
import { monthsBetween, todayStr } from '../lib/date';

/** 本息平均攤還的每月應繳金額 */
export function monthlyPayment({ principal, annualRate, termMonths }: LoanTerms): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** 依本息平均攤還推算某日的剩餘本金（未考慮寬限期與提前還款） */
export function remainingPrincipal(terms: LoanTerms, asOf = todayStr()): number {
  const paid = Math.min(Math.max(monthsBetween(terms.startDate, asOf), 0), terms.termMonths);
  const r = terms.annualRate / 100 / 12;
  if (r === 0) return terms.principal * (1 - paid / terms.termMonths);
  const pmt = monthlyPayment(terms);
  const growth = Math.pow(1 + r, paid);
  return Math.max(terms.principal * growth - (pmt * (growth - 1)) / r, 0);
}
