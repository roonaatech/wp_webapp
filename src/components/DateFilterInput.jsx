import React, { useState, useEffect } from 'react';
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
                <LuCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
            {error && <span className="text-[11px] text-rose-500 font-medium">{error}</span>}
        </div>
    );
};

export default DateFilterInput;
