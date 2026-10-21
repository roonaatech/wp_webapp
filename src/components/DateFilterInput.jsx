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
const DateFilterInput = ({
    value,
    onChange,
    className = '',
    wrapperClassName = 'flex flex-col gap-1',
    disabled = false,
    min,
    max,
    placeholder,
    required = false,
    id,
    name,
    title,
    autoFocus = false
}) => {
    const [display, setDisplay] = useState(isoToDisplayDate(value));
    const [error, setError] = useState('');
    const nativeRef = useRef(null);

    const [, setSettingsVersion] = useState(0);

    // Keep the display value in sync when the ISO value changes externally
    // (e.g. "Clear Filters" resetting the range).
    useEffect(() => {
        setDisplay(isoToDisplayDate(value));
        setError('');
    }, [value]);

    useEffect(() => {
        const onSettingsLoaded = () => {
            setSettingsVersion(v => v + 1);
            setDisplay(isoToDisplayDate(value));
        };
        window.addEventListener('settingsLoaded', onSettingsLoaded);
        return () => window.removeEventListener('settingsLoaded', onSettingsLoaded);
    }, [value]);

    const handleChange = (e) => {
        if (disabled) return;
        const formatted = autoFormatDateInput(e.target.value);
        setDisplay(formatted);

        if (formatted.length === 0) {
            setError('');
            if (onChange) onChange('');
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
            } else if (min && parsed < min) {
                setError(`Date cannot be before ${isoToDisplayDate(min)}`);
            } else if (max && parsed > max) {
                setError(`Date cannot be after ${isoToDisplayDate(max)}`);
            } else {
                if (onChange) onChange(parsed);
            }
        }
    };

    // Native date picker (calendar) selection — emits an ISO date directly.
    const handleNativeChange = (e) => {
        if (disabled) return;
        const iso = e.target.value; // '' or 'YYYY-MM-DD'
        if (min && iso && iso < min) {
            setError(`Date cannot be before ${isoToDisplayDate(min)}`);
            return;
        }
        if (max && iso && iso > max) {
            setError(`Date cannot be after ${isoToDisplayDate(max)}`);
            return;
        }
        setError('');
        setDisplay(iso ? isoToDisplayDate(iso) : '');
        if (onChange) onChange(iso || '');
    };

    const openPicker = () => {
        if (disabled) return;
        const el = nativeRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            try {
                el.showPicker();
            } catch (_) {
                el.focus();
                el.click();
            }
        } else {
            el.focus();
            el.click();
        }
    };

    return (
        <div className={wrapperClassName}>
            <div className="relative w-full">
                <input
                    id={id}
                    name={name}
                    title={title}
                    type="text"
                    inputMode="numeric"
                    disabled={disabled}
                    required={required}
                    autoFocus={autoFocus}
                    value={display}
                    onChange={handleChange}
                    placeholder={placeholder || getDateInputPlaceholder()}
                    maxLength={getDateInputMaxLength()}
                    className={className}
                />
                {/* Transparent native date input overlaid on the calendar icon so
                    clicking the icon opens the browser's native calendar picker. */}
                {!disabled && (
                    <input
                        ref={nativeRef}
                        type="date"
                        min={min}
                        max={max}
                        value={value || ''}
                        onChange={handleNativeChange}
                        tabIndex={-1}
                        aria-label="Open calendar"
                        className="absolute right-0 top-0 h-full w-10 opacity-0 cursor-pointer"
                    />
                )}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={openPicker}
                    aria-label="Open calendar"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition ${
                        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-indigo-600 cursor-pointer'
                    }`}
                >
                    <LuCalendar size={16} />
                </button>
            </div>
            {error && <span className="text-[11px] text-rose-500 font-medium">{error}</span>}
        </div>
    );
};

export default DateFilterInput;
