import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Safely parses a date string (ISO format) and returns a Date object.
 * Returns null if the string is falsy or results in an invalid date.
 * @param {string|null|undefined} dateStr
 * @returns {Date|null}
 */
export function safeParseISO(dateStr) {
    if (!dateStr) return null;
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
}

/**
 * Safely formats a date string. Returns a fallback string if the date is invalid.
 * @param {string|null|undefined} dateStr - ISO date string from the database
 * @param {string} [formatStr="dd/MM/yyyy"] - date-fns format string
 * @param {string} [fallback="Data inválida"] - value to return if date is invalid
 * @returns {string}
 */
export function safeFormatDate(dateStr, formatStr = "dd/MM/yyyy", fallback = "--/--/----") {
    if (!dateStr) return fallback;
    try {
        const d = parseISO(dateStr);
        if (!isValid(d)) return fallback;
        return format(d, formatStr, { locale: ptBR });
    } catch {
        return fallback;
    }
}

/**
 * Checks if an ISO date string is valid.
 * @param {string|null|undefined} dateStr
 * @returns {boolean}
 */
export function isValidDateStr(dateStr) {
    if (!dateStr) return false;
    const d = parseISO(dateStr);
    return isValid(d);
}
