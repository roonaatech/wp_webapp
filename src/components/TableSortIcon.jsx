import React from 'react';
import { LuArrowUpDown, LuArrowUp, LuArrowDown } from "react-icons/lu";

const TableSortIcon = ({ column, sortConfig, className = "ml-1 inline-block" }) => {
    const isActive = sortConfig?.key === column;
    const direction = sortConfig?.direction;

    if (!isActive) {
        return <LuArrowUpDown className={`w-4 h-4 opacity-40 ${className}`} />;
    }

    return direction === 'asc' ? (
        <LuArrowUp className={`w-4 h-4 ${className}`} />
    ) : (
        <LuArrowDown className={`w-4 h-4 ${className}`} />
    );
};

export default TableSortIcon;
