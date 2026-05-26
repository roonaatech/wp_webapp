import React, { useRef, useState, useEffect } from 'react';

const SignaturePad = ({ onSave, onClear }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1e1b4b'; // Sleek dark indigo line
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Support High-DPI screens
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = 180 * 2;
        ctx.scale(2, 2);
    }, []);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches[0]) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSigned(true);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Re-scale on clear just to be safe
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = 180 * 2;
        ctx.scale(2, 2);
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        setHasSigned(false);
        onClear();
    };

    return (
        <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-4 transition-all duration-300 hover:border-indigo-400">
            <canvas
                ref={canvasRef}
                className="w-full h-[180px] bg-white rounded-xl cursor-crosshair touch-none shadow-inner border border-slate-200"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-xs font-semibold text-slate-500">Sign inside the white canvas</span>
                <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
                >
                    Clear Signature
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
