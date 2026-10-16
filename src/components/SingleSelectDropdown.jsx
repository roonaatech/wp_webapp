import React, { useState, useRef, useEffect } from 'react';
import { LuChevronDown, LuCheck } from 'react-icons/lu';

/**
 * SingleSelectDropdown
 * A custom dropdown component that supports SVG icons for options and selected state.
 *
 * @param {string|number} value - currently selected value
 * @param {function} onChange - callback when selection changes: (val) => void
 * @param {Array<{value: string, label: string, icon?: React.ComponentType, iconClass?: string}>} options
 * @param {string} [placeholder='Select...']
 * @param {string} [className='']
 */
const SingleSelectDropdown = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0];
    const SelectedIcon = selectedOption?.icon;

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition flex items-center justify-between gap-2 text-left cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2 truncate">
                    {SelectedIcon && (
                        <SelectedIcon
                            size={16}
                            className={selectedOption?.iconClass || 'text-slate-500 shrink-0'}
                        />
                    )}
                    <span className="truncate">{selectedOption?.label || placeholder}</span>
                </div>
                <LuChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div
                    className="absolute z-50 left-0 top-full mt-1.5 w-full min-w-[190px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden py-1"
                    role="listbox"
                >
                    {options.map((option) => {
                        const isSelected = String(option.value) === String(value);
                        const OptionIcon = option.icon;
                        return (
                            <button
                                key={String(option.value)}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-sm flex items-center justify-between gap-2.5 transition text-left cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <div className="flex items-center gap-2.5 truncate">
                                    {OptionIcon && (
                                        <OptionIcon
                                            size={16}
                                            className={option.iconClass || (isSelected ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0')}
                                        />
                                    )}
                                    <span className="truncate">{option.label}</span>
                                </div>
                                {isSelected && (
                                    <LuCheck size={15} className="text-indigo-600 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SingleSelectDropdown;
