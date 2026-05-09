import { addMonths, endOfMonth, isSaturday, isSunday, subDays, startOfMonth, addDays, format } from "date-fns";
import { es } from "date-fns/locale";

export interface QuincenaRange {
  start: Date;
  end: Date;
  label: string;
}

export function getAdjustedDate(date: Date): Date {
  const day = date.getDay();
  // 0 is Sunday, 6 is Saturday
  if (day === 0) return subDays(date, 2); // Sunday -> Friday
  if (day === 6) return subDays(date, 1); // Saturday -> Friday
  return date;
}

export function getQuincenaRange(referenceDate: Date): QuincenaRange {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  
  const midMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 15);
  const adjustedMid = getAdjustedDate(midMonth);
  const adjustedEnd = getAdjustedDate(monthEnd);

  if (referenceDate <= adjustedMid) {
    return {
      start: monthStart,
      end: adjustedMid,
      label: `1ª Quincena ${format(referenceDate, 'MMMM yyyy', { locale: es })}`
    };
  } else {
    return {
      start: addDays(adjustedMid, 1),
      end: adjustedEnd,
      label: `2ª Quincena ${format(referenceDate, 'MMMM yyyy', { locale: es })}`
    };
  }
}

export function getNextQuincena(currentRange: QuincenaRange): QuincenaRange {
  const nextDay = addDays(currentRange.end, 1);
  return getQuincenaRange(nextDay);
}

export function getPreviousQuincena(currentRange: QuincenaRange): QuincenaRange {
  const prevDay = subDays(currentRange.start, 1);
  return getQuincenaRange(prevDay);
}

export function getNextNQuincenas(startRange: QuincenaRange, n: number): QuincenaRange[] {
  const ranges: QuincenaRange[] = [startRange];
  let current = startRange;
  for (let i = 1; i < n; i++) {
    current = getNextQuincena(current);
    ranges.push(current);
  }
  return ranges;
}
