import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from './ModernLoader';
import { getCurrentInAppTimezone } from '../utils/timezone.util';
import { FiPlusCircle, FiMinusCircle } from 'react-icons/fi';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const MonthlySummaryReport = () => {
    const now = getCurrentInAppTimezone().full;
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [summary, setSummary] = useState([]);
    const [period, setPeriod] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'firstname', direction: 'asc' });
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (staffId) => {
        setExpandedRows(prev => ({
            ...prev,
            [staffId]: !prev[staffId]
        }));
    };

    const years = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);

    useEffect(() => { fetchSummary(); }, [month, year]);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/admin/reports/monthly-summary`, {
                headers: { 'x-access-token': token },
                params: { month, year }
            });
            setSummary(res.data.summary || []);
            setPeriod(res.data.period || '');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch monthly summary');
            setSummary([]);
        } finally {
            setLoading(false);
        }
    };

    const formatHours = (hours, minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m}m`;
        return '0h';
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedSummary = [...summary].sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'name') {
            aVal = `${a.firstname} ${a.lastname}`.toLowerCase();
            bVal = `${b.firstname} ${b.lastname}`.toLowerCase();
        } else {
            aVal = a[sortConfig.key]; bVal = b[sortConfig.key];
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Totals
    const totals = summary.reduce((acc, s) => ({
        leave_days: acc.leave_days + s.leave_days,
        timeoff_minutes: acc.timeoff_minutes + s.timeoff_minutes,
        onduty_minutes: acc.onduty_minutes + s.onduty_minutes
    }), { leave_days: 0, timeoff_minutes: 0, onduty_minutes: 0 });

    const exportExcel = async () => {
        if (summary.length === 0) return;
        
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'WorkPulse';
            workbook.created = new Date();

            const sanitizeSheetName = (name) => {
                let clean = name.replace(/[\[\]\*\?\/\\\:]/g, '').substring(0, 31);
                return clean || 'Staff';
            };

            const headerFill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E1B4B' }
            };
            const headerFont = {
                color: { argb: 'FFFFFFFF' },
                bold: true
            };
            const borderStyle = {
                top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
            };

            // 1. Create Summary Sheet
            const summarySheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
            
            summarySheet.columns = [
                { header: 'Employee Name', key: 'name', width: 25 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Leave Days', key: 'leave', width: 15 },
                { header: 'Time-Off', key: 'timeoff', width: 15 },
                { header: 'On-Duty', key: 'onduty', width: 15 }
            ];

            summarySheet.getRow(1).eachCell((cell) => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = borderStyle;
            });

            const sheetNames = new Set();
            
            summary.forEach((s) => {
                let baseName = sanitizeSheetName(`${s.firstname} ${s.lastname}`);
                let sheetName = baseName;
                let counter = 1;
                while (sheetNames.has(sheetName)) {
                    sheetName = `${baseName.substring(0, 27)}_${counter}`;
                    counter++;
                }
                sheetNames.add(sheetName);
                s.sheetName = sheetName;

                const row = summarySheet.addRow({
                    name: `${s.firstname} ${s.lastname}`,
                    email: s.email,
                    leave: s.leave_days,
                    timeoff: formatHours(s.timeoff_hours, s.timeoff_minutes),
                    onduty: formatHours(s.onduty_hours, s.onduty_minutes)
                });
                
                const nameCell = row.getCell(1);
                nameCell.value = {
                    text: `${s.firstname} ${s.lastname}`,
                    hyperlink: `#'${s.sheetName}'!A1`,
                    tooltip: 'Click to view employee details'
                };
                nameCell.font = {
                    color: { argb: 'FF0563C1' },
                    underline: true
                };

                row.eachCell(cell => { cell.border = borderStyle; });
            });
            
            const totalRow = summarySheet.addRow({
                name: 'TOTAL',
                leave: totals.leave_days,
                timeoff: formatHours(0, totals.timeoff_minutes),
                onduty: formatHours(0, totals.onduty_minutes)
            });
            totalRow.font = { bold: true };
            totalRow.eachCell(cell => {
                cell.border = borderStyle;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            });

            // 2. Create Individual Sheets
            summary.forEach((s) => {
                const sheet = workbook.addWorksheet(s.sheetName);
                
                sheet.mergeCells('A1:D1');
                const backCell = sheet.getCell('A1');
                backCell.value = { text: '← Back to Summary', hyperlink: `#'Summary'!A1`, tooltip: 'Go back to Summary sheet' };
                backCell.font = { color: { argb: 'FF0563C1' }, underline: true, bold: true };
                backCell.alignment = { vertical: 'middle', horizontal: 'left' };

                sheet.mergeCells('A3:B3');
                sheet.getCell('A3').value = `Employee: ${s.firstname} ${s.lastname}`;
                sheet.getCell('A3').font = { bold: true, size: 12, color: { argb: 'FF1E1B4B' } };
                
                sheet.mergeCells('C3:D3');
                sheet.getCell('C3').value = `Email: ${s.email}`;
                sheet.getCell('C3').font = { color: { argb: 'FF4B5563' } };

                const startRow = 5;
                const headerRow = sheet.getRow(startRow);
                headerRow.values = ['Type', 'Date', 'Duration', 'Details'];
                headerRow.eachCell((cell) => {
                    cell.fill = headerFill;
                    cell.font = headerFont;
                    cell.border = borderStyle;
                });

                sheet.columns = [
                    { key: 'type', width: 15 },
                    { key: 'date', width: 25 },
                    { key: 'duration', width: 20 },
                    { key: 'detail', width: 45 }
                ];

                if (s.records && s.records.length > 0) {
                    s.records.forEach(rec => {
                        const row = sheet.addRow({
                            type: rec.type,
                            date: rec.date,
                            duration: rec.duration,
                            detail: rec.detail || 'N/A'
                        });
                        row.eachCell(cell => {
                            cell.border = borderStyle;
                            cell.alignment = { vertical: 'top', wrapText: true };
                        });
                        
                        const typeCell = row.getCell(1);
                        typeCell.font = { bold: true };
                        if (rec.type === 'Leave') typeCell.font.color = { argb: 'FFEA580C' };
                        else if (rec.type === 'Time-Off') typeCell.font.color = { argb: 'FF0F766E' };
                        else typeCell.font.color = { argb: 'FF0284C7' };
                    });
                } else {
                    sheet.mergeCells(`A${startRow + 1}:D${startRow + 1}`);
                    const emptyCell = sheet.getCell(`A${startRow + 1}`);
                    emptyCell.value = 'No approved records found';
                    emptyCell.alignment = { horizontal: 'center' };
                    emptyCell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
                    emptyCell.border = borderStyle;
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const dateObj = new Date();
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            const hh = String(dateObj.getHours()).padStart(2, '0');
            const mmm = String(dateObj.getMinutes()).padStart(2, '0');
            const sss = String(dateObj.getSeconds()).padStart(2, '0');
            const formattedDate = `${dd}-${mm}-${yy}_${hh}${mmm}${sss}`;
            
            saveAs(blob, `WorkPulse_Monthly_Report_${formattedDate}.xlsx`);
        } catch (error) {
            console.error("Error generating Excel:", error);
            setError("Failed to generate Excel file.");
        }
    };

    const SortIcon = ({ col }) => {
        if (sortConfig.key !== col) return <span className="text-gray-400 ml-1">↕</span>;
        return <span className="text-[#0ea5e9] ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div>
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-black text-[#1e1b4b] mb-2 uppercase tracking-widest">Month</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] text-sm font-medium bg-gray-50"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-black text-[#1e1b4b] mb-2 uppercase tracking-widest">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/30 focus:border-[#0ea5e9] text-sm font-medium bg-gray-50"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3">

                        <button
                            onClick={exportExcel}
                            disabled={summary.length === 0}
                            className="px-6 py-2.5 bg-white text-[#1e1b4b] border-2 border-[#1e1b4b] rounded-xl font-black text-xs uppercase tracking-widest hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            📥 Export
                        </button>
                    </div>
                </div>
                {period && (
                    <p className="mt-3 text-xs text-gray-400 font-medium">
                        Showing approved records for <span className="text-[#0ea5e9] font-black">{MONTHS[month - 1]} {year}</span> ({period})
                    </p>
                )}
            </div>

            {/* Stats Cards */}
            {!loading && summary.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Employees</p>
                        <p className="text-3xl font-black text-[#1e1b4b]">{summary.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Approved Leave Days</p>
                        <p className="text-3xl font-black text-orange-500">{totals.leave_days}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Approved Time-Off</p>
                        <p className="text-3xl font-black text-teal-500">{formatHours(0, totals.timeoff_minutes)}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Approved On-Duty</p>
                        <p className="text-3xl font-black text-[#0ea5e9]">{formatHours(0, totals.onduty_minutes)}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-800 font-medium text-sm">⚠️ {error}</p>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
                {loading ? (
                    <div className="p-8"><ModernLoader size="lg" message="Generating summary..." fullScreen={false} /></div>
                ) : summary.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 text-lg font-medium">No approved records found for {MONTHS[month - 1]} {year}</p>
                        <p className="text-gray-300 text-sm mt-1">Try selecting a different month or year</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#1e1b4b]">
                            <tr>
                                <th className="px-4 py-3 text-left w-12"></th>
                                <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-widest w-12">#</th>
                                <th className="px-4 py-3 text-left cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('name')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Employee<SortIcon col="name" /></span>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-widest">Email</th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('leave_days')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Leave Days<SortIcon col="leave_days" /></span>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('timeoff_minutes')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Time-Off<SortIcon col="timeoff_minutes" /></span>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('onduty_minutes')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">On-Duty<SortIcon col="onduty_minutes" /></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedSummary.map((s, idx) => (
                                <React.Fragment key={s.staff_id}>
                                    <tr className={`hover:bg-[#f0f9ff]/50 transition-colors ${expandedRows[s.staff_id] ? 'bg-[#f0f9ff]/30' : ''}`}>
                                        <td className="px-4 py-3 text-center">
                                            {s.records && s.records.length > 0 && (
                                                <button onClick={() => toggleRow(s.staff_id)} className="text-[#0ea5e9] hover:text-blue-700 transition-colors inline-flex items-center font-black">
                                                    {expandedRows[s.staff_id] ? <FiMinusCircle size={16}/> : <FiPlusCircle size={16}/>}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400 font-medium">{idx + 1}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{s.firstname} {s.lastname}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
                                        <td className="px-4 py-3 text-center">
                                            {s.leave_days > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-orange-50 text-orange-600 border border-orange-100">
                                                    {s.leave_days} {s.leave_days === 1 ? 'day' : 'days'}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.timeoff_minutes > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-teal-50 text-teal-600 border border-teal-100">
                                                    {formatHours(s.timeoff_hours, s.timeoff_minutes)}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.onduty_minutes > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-sky-50 text-[#0ea5e9] border border-sky-100">
                                                    {formatHours(s.onduty_hours, s.onduty_minutes)}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                    </tr>
                                    {expandedRows[s.staff_id] && s.records && s.records.length > 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-8 py-3 bg-[#f8fafc] border-b border-gray-100">
                                                <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white inline-block w-full">
                                                    <table className="min-w-full divide-y divide-gray-100">
                                                        <thead className="bg-[#1e1b4b]/5">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-1/6">Type</th>
                                                                <th className="px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-1/4">Date</th>
                                                                <th className="px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-1/4">Duration</th>
                                                                <th className="px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Details</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {s.records.map((rec, rIdx) => (
                                                                <tr key={rIdx} className="hover:bg-gray-50/50">
                                                                    <td className="px-4 py-2 align-top">
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${rec.type === 'Leave' ? 'bg-orange-50 text-orange-600 border-orange-100' : rec.type === 'Time-Off' ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-sky-50 text-[#0ea5e9] border-sky-100'}`}>
                                                                            {rec.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs text-gray-600 font-medium align-top">{rec.date}</td>
                                                                    <td className="px-4 py-2 text-xs text-gray-800 font-bold align-top">{rec.duration}</td>
                                                                    <td className="px-4 py-2 text-xs text-gray-600 align-top break-words">{rec.detail}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            <tr className="bg-[#1e1b4b]/5 font-black">
                                <td colSpan={4} className="px-4 py-3 text-sm text-[#1e1b4b] uppercase tracking-widest text-right">Total (Approved Only)</td>
                                <td className="px-4 py-3 text-center text-sm text-orange-600">{totals.leave_days} {totals.leave_days === 1 ? 'day' : 'days'}</td>
                                <td className="px-4 py-3 text-center text-sm text-teal-600">{formatHours(0, totals.timeoff_minutes)}</td>
                                <td className="px-4 py-3 text-center text-sm text-[#0ea5e9]">{formatHours(0, totals.onduty_minutes)}</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
};

export default MonthlySummaryReport;
