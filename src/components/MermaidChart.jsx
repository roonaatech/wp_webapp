import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

const MermaidChart = ({ chart, uniqueId }) => {
    const containerRef = useRef(null);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
                primaryColor: '#EFF6FF', // blue-50
                primaryTextColor: '#1E3A8A', // blue-900
                primaryBorderColor: '#3B82F6', // blue-500
                lineColor: '#9CA3AF', // gray-400
                secondaryColor: '#ffffff',
                tertiaryColor: '#ffffff',
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis',
            }
        });
    }, []);

    useEffect(() => {
        const renderChart = async () => {
            if (!chart || !containerRef.current) return;

            try {
                // Unique ID is needed for mermaid to distinct multiple charts on page
                const id = `mermaid-${uniqueId || Math.random().toString(36).substr(2, 9)}`;
                const { svg: renderedSvg } = await mermaid.render(id, chart);
                setSvg(renderedSvg);
            } catch (err) {
                console.error("Mermaid Failed to render:", err);
                setError(err.message);
                // Mermaid keeps the error div in DOM, which can look ugly.
                const errorElement = document.querySelector(`#d${uniqueId}`);
                if (errorElement) errorElement.remove(); 
            }
        };

        renderChart();
    }, [chart, uniqueId]);

    if (error) {
        return <div className="text-red-500 text-xs text-center p-2">Failed to render chart</div>;
    }

    return (
        <div 
            ref={containerRef}
            className="mermaid-chart flex justify-center w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

export default MermaidChart;
