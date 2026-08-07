import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const MIN_PANEL_WIDTH = 288;
const PREFERRED_PANEL_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

/**
 * Collapsed multi-select. Keeps long option lists (e.g. every role) out of the
 * page flow and summarises the current selection on the trigger button.
 *
 * The panel renders through a portal with fixed positioning so it is never
 * clipped by an ancestor's `overflow-hidden` / `overflow-x-auto` — the settings
 * cards use both.
 *
 * options  - [{ value, label, meta }] where meta renders muted on the right
 * selected - array of selected values (strings)
 * onChange - receives the next array of values
 */
export default function MultiSelectDropdown({
    options = [],
    selected = [],
    onChange,
    placeholder = 'Select options',
    emptyHint = null
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);

    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const width = Math.max(rect.width, MIN_PANEL_WIDTH);
        const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
        const spaceAbove = rect.top - VIEWPORT_MARGIN;

        // Flip above only when below is cramped and above genuinely has more room
        const openUp = spaceBelow < PREFERRED_PANEL_HEIGHT && spaceAbove > spaceBelow;
        const available = openUp ? spaceAbove : spaceBelow;

        setPosition({
            left: Math.max(
                VIEWPORT_MARGIN,
                Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)
            ),
            top: openUp ? undefined : rect.bottom + 4,
            bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
            width,
            maxHeight: Math.max(180, Math.min(PREFERRED_PANEL_HEIGHT, available))
        });
    }, []);

    useEffect(() => {
        if (!open) return;

        updatePosition();

        const handlePointerDown = (event) => {
            const inTrigger = triggerRef.current && triggerRef.current.contains(event.target);
            const inPanel = panelRef.current && panelRef.current.contains(event.target);
            if (!inTrigger && !inPanel) setOpen(false);
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        const handleReflow = () => updatePosition();

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        // capture phase so scrolling of any ancestor container repositions too
        window.addEventListener('scroll', handleReflow, true);
        window.addEventListener('resize', handleReflow);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleReflow, true);
            window.removeEventListener('resize', handleReflow);
        };
    }, [open, updatePosition]);

    const toggle = (value) => {
        const val = String(value);
        onChange(
            selected.includes(val)
                ? selected.filter(v => v !== val)
                : [...selected, val]
        );
    };

    const summary = () => {
        if (selected.length === 0) return placeholder;

        const labels = selected
            .map(v => options.find(o => String(o.value) === String(v))?.label)
            .filter(Boolean);

        if (labels.length === 0) return `${selected.length} selected`;
        if (labels.length <= 2) return labels.join(', ');
        return `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
    };

    const panel = position && (
        <div
            ref={panelRef}
            role="listbox"
            style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                width: position.width,
                maxHeight: position.maxHeight
            }}
            className="z-[100] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2">
                <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {selected.length} selected
                </span>
                <div className="flex flex-shrink-0 gap-3">
                    <button
                        type="button"
                        onClick={() => onChange(options.map(o => String(o.value)))}
                        className="whitespace-nowrap text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                        Select all
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="whitespace-nowrap text-[11px] font-semibold text-gray-500 hover:underline"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {options.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">No options available.</p>
                ) : (
                    options.map((option) => {
                        const checked = selected.includes(String(option.value));
                        return (
                            <label
                                key={option.value}
                                role="option"
                                aria-selected={checked}
                                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(option.value)}
                                    className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="min-w-0 flex-1 truncate" title={option.label}>
                                    {option.label}
                                </span>
                                {option.meta && (
                                    <span className="flex-shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                        {option.meta}
                                    </span>
                                )}
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );

    return (
        <div className="w-full">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
                <span className={`truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                    {summary()}
                </span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
            </button>

            {open && typeof document !== 'undefined' && createPortal(panel, document.body)}

            {selected.length === 0 && emptyHint && (
                <p className="mt-1.5 text-[11px] font-medium text-amber-600">{emptyHint}</p>
            )}
            {selected.length > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                    {selected.length} role(s) selected.
                </p>
            )}
        </div>
    );
}
