import React, { useState, useEffect, useRef } from 'react';
import { LuCalendar } from 'react-icons/lu';
import {
    isoToDisplayDate,
    autoFormatDateInput,
    validatePartialDateInput,
    validateAndParseDate,
    getDateInputPlaceholder,
    getDateInputMaxLength,
} from '../utils/timezone.util';

/**
 * A text date input that displays and accepts dates in the application's
 * configured date format (system settings), while emitting a plain ISO
 * (YYYY-MM-DD) string to the parent via onChange.
 *
 * Native <input type="date"> always renders in the browser locale and cannot
 * honour the app's date-format setting, so we use a formatted text input instead.
 */
const DateFilterInput = ({ value, onChange, className = '' }) => {
    const [display, setDisplay] = useState(isoToDisplayDate(value));
    const [error, setError] = useState('');
    const nativeRef = useRef(null);

    // Keep the display value in sync when the ISO value changes externally
    // (e.g. "Clear Filters" resetting the range).
    useEffect(() => {
        setDisplay(isoToDisplayDate(value));
        setError('');
    }, [value]);

    const handleChange = (e) => {
        const formatted = autoFormatDateInput(e.target.value);
        setDisplay(formatted);

        if (formatted.length === 0) {
            setError('');
            onChange('');
            return;
        }

        const partialError = validatePartialDateInput(formatted);
        if (partialError) {
            setError(partialError);
            return;
        }
        setError('');

        if (formatted.length === getDateInputMaxLength()) {
            const { parsed, error: parseError } = validateAndParseDate(formatted, { allowFuture: true });
            if (parseError) {
                setError(parseError);
            } else {
                onChange(parsed);
            }
        }
    };

    // Native date picker (calendar) selection — emits an ISO date directly.
    const handleNativeChange = (e) => {
        const iso = e.target.value; // '' or 'YYYY-MM-DD'
        setError('');
        setDisplay(iso ? isoToDisplayDate(iso) : '');
        onChange(iso || '');
    };

    const openPicker = () => {
        const el = nativeRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            el.showPicker();
        } else {
            el.focus();
            el.click();
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="relative">
                <input
                    type="text"
                    inputMode="numeric"
                    value={display}
                    onChange={handleChange}
                    placeholder={getDateInputPlaceholder()}
                    maxLength={getDateInputMaxLength()}
                    className={className}
                />
                {/* Transparent native date input overlaid on the calendar icon so
                    clicking the icon opens the browser's native calendar picker. */}
                <input
                    ref={nativeRef}
                    type="date"
                    value={value || ''}
                    onChange={handleNativeChange}
                    tabIndex={-1}
                    aria-label="Open calendar"
                    className="absolute right-0 top-0 h-full w-10 opacity-0 cursor-pointer"
                />
                <button
                    type="button"
                    onClick={openPicker}
                    aria-label="Open calendar"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition"
                >
                    <LuCalendar size={16} />
                </button>
            </div>
            {error && <span className="text-[11px] text-rose-500 font-medium">{error}</span>}
        </div>
    );
};

export default DateFilterInput;
