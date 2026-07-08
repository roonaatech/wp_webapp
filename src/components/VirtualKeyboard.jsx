import React, { useState } from 'react';
import { LuArrowUp, LuDelete, LuX, LuEye, LuEyeOff } from 'react-icons/lu';

const VirtualKeyboard = ({ value = '', onChange, onClose, title = 'On-Screen Keyboard' }) => {
    const [layout, setLayout] = useState('default'); // 'default' | 'shift' | 'symbols' | 'moreSymbols'
    const [showPassword, setShowPassword] = useState(false);

    const handleKeyPress = (key) => {
        if (key === 'backspace') {
            onChange(value.slice(0, -1));
        } else if (key === 'clear') {
            onChange('');
        } else if (key === 'space') {
            onChange(value + ' ');
        } else if (key === 'shift') {
            setLayout(prev => prev === 'default' ? 'shift' : 'default');
        } else if (key === '?123') {
            setLayout('symbols');
        } else if (key === 'abc') {
            setLayout('default');
        } else if (key === '#+=') {
            setLayout('moreSymbols');
        } else {
            onChange(value + key);
            // Auto turn off shift after typing a capital letter (standard mobile keyboard behavior)
            if (layout === 'shift') {
                setLayout('default');
            }
        }
    };

    // Prevent losing focus from input when clicking keys
    const handleMouseDown = (e) => {
        e.preventDefault();
    };

    const getRows = () => {
        switch (layout) {
            case 'shift':
                return [
                    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                    ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'backspace'],
                    ['?123', 'space', 'clear', 'close']
                ];
            case 'symbols':
                return [
                    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
                    ['#+=', '.', ',', '?', '!', "'", '_', 'backspace'],
                    ['abc', 'space', 'clear', 'close']
                ];
            case 'moreSymbols':
                return [
                    ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
                    ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
                    ['?123', '.', ',', '?', '!', "'", '_', 'backspace'],
                    ['abc', 'space', 'clear', 'close']
                ];
            case 'default':
            default:
                return [
                    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                    ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
                    ['?123', 'space', 'clear', 'close']
                ];
        }
    };

    const renderKey = (key, index) => {
        let content = key;
        let keyClass = "flex-1 h-12 sm:h-14 flex items-center justify-center rounded-lg text-sm sm:text-base font-bold shadow transition-all active:scale-95 touch-manipulation ";

        // Style overrides based on function keys
        if (key === 'shift') {
            content = <LuArrowUp className={`w-5 h-5 ${layout === 'shift' ? 'text-indigo-400' : 'text-slate-300'}`} />;
            keyClass += layout === 'shift' 
                ? 'bg-slate-700/80 border border-indigo-500/50 text-indigo-400 hover:bg-slate-650' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 border border-slate-700/50';
        } else if (key === 'backspace') {
            content = <LuDelete className="w-5 h-5" />;
            keyClass += 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 border border-slate-700/50 flex-[1.5]';
        } else if (key === 'space') {
            content = 'Space';
            keyClass += 'bg-slate-850 hover:bg-slate-850 border border-slate-700/50 text-white flex-[3]';
        } else if (key === 'clear') {
            content = 'Clear';
            keyClass += 'bg-rose-950/80 border border-rose-900/40 text-rose-300 hover:bg-rose-900/60 flex-[1.2]';
        } else if (key === 'close') {
            content = <div className="flex items-center gap-1"><span>Done</span></div>;
            keyClass += 'bg-emerald-950/80 border border-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 flex-[1.5]';
        } else if (key === '?123' || key === 'abc' || key === '#+=') {
            content = key.toUpperCase();
            keyClass += 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 border border-slate-700/50 flex-[1.2]';
        } else {
            keyClass += 'bg-slate-900/80 border border-slate-850 hover:bg-slate-800 text-white';
        }

        const handleKeyAction = (e) => {
            e.preventDefault();
            if (key === 'close') {
                if (onClose) onClose();
            } else {
                handleKeyPress(key);
            }
        };

        return (
            <button
                key={`${key}-${index}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onClick={handleKeyAction}
                className={keyClass}
                type="button"
            >
                {content}
            </button>
        );
    };

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 z-[100] bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] p-4 sm:p-5 pb-6 sm:pb-8 flex flex-col items-center animate-slide-up"
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
        >
            <div className="w-full max-w-3xl flex flex-col gap-3">
                {/* Keyboard Header / Value Preview */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-1">
                    <div className="flex flex-col text-left">
                        <span className="text-[10px] sm:text-xs font-black text-indigo-400 uppercase tracking-widest">{title}</span>
                        <div className="flex items-center gap-2 mt-1 min-w-[200px]">
                            <span className="text-white font-mono text-sm sm:text-base tracking-wider">
                                {value ? (showPassword ? value : '•'.repeat(value.length)) : <span className="text-slate-500 italic text-xs">Waiting for keypress...</span>}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {value && (
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                            title="Close keyboard"
                        >
                            <LuX size={20} />
                        </button>
                    </div>
                </div>

                {/* Keyboard Keys Grid */}
                <div className="flex flex-col gap-2 select-none">
                    {getRows().map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-1.5 sm:gap-2 justify-center w-full">
                            {row.map((key, keyIndex) => renderKey(key, keyIndex))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VirtualKeyboard;
