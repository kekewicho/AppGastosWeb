import { addMonths, endOfMonth, isSaturday, isSunday, subDays, startOfMonth, addDays, format, startOfDay, endOfDay } from "date-fns";
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
  const monthStart = startOfDay(startOfMonth(referenceDate));
  const monthEnd = endOfDay(endOfMonth(referenceDate));
  
  const midMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 15);
  const adjustedMid = getAdjustedDate(midMonth);
  const adjustedMidEnd = endOfDay(adjustedMid);
  const secondHalfStart = startOfDay(addDays(adjustedMid, 1));

  if (referenceDate <= adjustedMidEnd) {
    return {
      start: monthStart,
      end: adjustedMidEnd,
      label: `1ª Quincena ${format(referenceDate, 'MMMM yyyy', { locale: es })}`
    };
  } else {
    return {
      start: secondHalfStart,
      end: monthEnd,
      label: `2ª Quincena ${format(referenceDate, 'MMMM yyyy', { locale: es })}`
    };
  }
}

export function getNextQuincena(currentRange: QuincenaRange): QuincenaRange {
  const isFirstQuincena = currentRange.start.getDate() === 1;
  if (isFirstQuincena) {
    const dateInSecondHalf = new Date(currentRange.start.getFullYear(), currentRange.start.getMonth(), 16);
    return getQuincenaRange(dateInSecondHalf);
  } else {
    const currentMonthStart = startOfMonth(currentRange.start);
    const nextMonthStart = addMonths(currentMonthStart, 1);
    return getQuincenaRange(nextMonthStart);
  }
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
