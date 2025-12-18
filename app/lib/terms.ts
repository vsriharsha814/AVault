/**
 * Utility functions for determining current academic term based on CU Boulder calendar
 * 
 * CU Boulder Academic Terms:
 * - Fall: Late August - Mid December
 * - Winter: Mid December - Mid January
 * - Spring: Mid January - Early May
 * - Summer: Early May - Mid August
 */

import type { TermType } from '../types';

export interface CurrentTermInfo {
  term: TermType;
  year: number;
  name: string;
}

/**
 * Determines the current academic term based on the current date
 * Following CU Boulder's academic calendar
 */
export function getCurrentTerm(date: Date = new Date()): CurrentTermInfo {
  const month = date.getMonth() + 1; // 1-12 (Jan-Dec)
  const day = date.getDate();
  const year = date.getFullYear();

  // Fall: August 20 - December 15
  if (month === 8 && day >= 20) {
    return { term: 'FALL', year, name: `FALL ${year}` };
  }
  if (month >= 9 && month <= 11) {
    return { term: 'FALL', year, name: `FALL ${year}` };
  }
  if (month === 12 && day < 16) {
    return { term: 'FALL', year, name: `FALL ${year}` };
  }

  // Winter: December 16 - January 15 (December dates use current year, January uses next year)
  if (month === 12 && day >= 16) {
    return { term: 'WINTER', year, name: `WINTER ${year}` };
  }
  if (month === 1 && day <= 15) {
    // January dates belong to the previous year's winter term
    return { term: 'WINTER', year, name: `WINTER ${year}` };
  }

  // Spring: January 16 - May 5
  if (month === 1 && day >= 16) {
    return { term: 'SPRING', year, name: `SPRING ${year}` };
  }
  if (month >= 2 && month <= 4) {
    return { term: 'SPRING', year, name: `SPRING ${year}` };
  }
  if (month === 5 && day <= 5) {
    return { term: 'SPRING', year, name: `SPRING ${year}` };
  }

  // Summer: May 6 - August 19
  if (month === 5 && day >= 6) {
    return { term: 'SUMMER', year, name: `SUMMER ${year}` };
  }
  if (month >= 6 && month <= 7) {
    return { term: 'SUMMER', year, name: `SUMMER ${year}` };
  }
  if (month === 8 && day < 20) {
    return { term: 'SUMMER', year, name: `SUMMER ${year}` };
  }

  // Default fallback (shouldn't reach here)
  return { term: 'FALL', year, name: `Fall ${year}` };
}

/**
 * Gets the display name for a term
 */
export function getTermDisplayName(term: TermType, year: number): string {
  return `${term} ${year}`;
}

