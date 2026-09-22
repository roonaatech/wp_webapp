import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from './ModernLoader';
import { getCurrentInAppTimezone, formatDateOnly, formatTimeOnly } from '../utils/timezone.util';
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
    const [expandedInnerRows, setExpandedInnerRows] = useState({});

    const toggleRow = (staffId) => {
        setExpandedRows(prev => ({
            ...prev,
            [staffId]: !prev[staffId]
        }));
    };

    const toggleInnerRow = (key) => {
        setExpandedInnerRows(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const getWeekday = (dateStr) => {
        if (!dateStr) return '';
        try {
            const parts = String(dateStr).split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return days[d.getDay()];
            }
        } catch (e) {}
        return '';
    };

    const formatDateWithWeekday = (dateStr) => {
        if (!dateStr) return '—';
        const formatted = formatDateOnly(dateStr);
        const day = getWeekday(dateStr);
        return day ? `${formatted} (${day})` : formatted;
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
        present_days: acc.present_days + (s.present_days || 0),
        work_minutes: acc.work_minutes + (s.work_minutes || 0),
        leave_days: acc.leave_days + (s.leave_days || 0),
        timeoff_minutes: acc.timeoff_minutes + (s.timeoff_minutes || 0),
        onduty_minutes: acc.onduty_minutes + (s.onduty_minutes || 0)
    }), { present_days: 0, work_minutes: 0, leave_days: 0, timeoff_minutes: 0, onduty_minutes: 0 });

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
                { header: 'Present Days', key: 'present', width: 15 },
                { header: 'Work Hours', key: 'work_hours', width: 15 },
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
                    present: s.present_days || 0,
                    work_hours: formatHours(s.work_hours, s.work_minutes),
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
                present: totals.present_days,
                work_hours: formatHours(0, totals.work_minutes),
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

                const attSessions = s.attendance_records || (s.records?.find(r => r.type === 'Attendance')?.sessions) || [];
                const otherRecords = (s.records || []).filter(r => r.type !== 'Attendance');

                sheet.columns = [
                    { key: 'c1', width: 6 },
                    { key: 'c2', width: 24 },
                    { key: 'c3', width: 14 },
                    { key: 'c4', width: 14 },
                    { key: 'c5', width: 16 },
                    { key: 'c6', width: 30 },
                    { key: 'c7', width: 18 },
                    { key: 'c8', width: 14 }
                ];

                let curRowIdx = 5;

                // 1. Attendance Sessions Section
                if (attSessions.length > 0) {
                    sheet.mergeCells(`A${curRowIdx}:H${curRowIdx}`);
                    const attTitle = sheet.getCell(`A${curRowIdx}`);
                    attTitle.value = `ATTENDANCE SESSIONS (${s.present_days || 0} Present Days | Total Work Time: ${formatHours(s.work_hours, s.work_minutes)})`;
                    attTitle.font = { bold: true, color: { argb: 'FF065F46' }, size: 10 };
                    attTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    attTitle.border = borderStyle;
                    curRowIdx++;

                    const attHeaders = ['#', 'Date', 'Check-In', 'Check-Out', 'Duration', 'Terminal / Device', 'IP Address', 'Status'];
                    const hRow = sheet.getRow(curRowIdx);
                    hRow.values = attHeaders;
                    hRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.border = borderStyle;
                    });
                    curRowIdx++;

                    attSessions.forEach((sess, idx) => {
                        const row = sheet.getRow(curRowIdx);
                        row.values = [
                            idx + 1,
                            formatDateWithWeekday(sess.date),
                            sess.check_in_time ? formatTimeOnly(sess.check_in_time) : (sess.check_in_time_str || '—'),
                            sess.check_out_time ? formatTimeOnly(sess.check_out_time) : (sess.check_out_time_str || 'Active'),
                            sess.formatted_duration || sess.duration,
                            sess.phone_model || 'Web / Kiosk',
                            sess.ip_address || 'N/A',
                            sess.status || (sess.check_out_time ? 'Completed' : 'Active')
                        ];
                        row.eachCell(cell => {
                            cell.border = borderStyle;
                            cell.alignment = { vertical: 'middle', wrapText: true };
                        });
                        row.getCell(5).font = { bold: true, color: { argb: 'FF059669' } };
                        curRowIdx++;
                    });

                    curRowIdx++; // empty line spacing
                }

                // 2. Leaves, Time-Off & On-Duty Section
                if (otherRecords.length > 0) {
                    sheet.mergeCells(`A${curRowIdx}:H${curRowIdx}`);
                    const otherTitle = sheet.getCell(`A${curRowIdx}`);
                    otherTitle.value = `LEAVES, TIME-OFF & ON-DUTY RECORDS`;
                    otherTitle.font = { bold: true, color: { argb: 'FF1E1B4B' }, size: 10 };
                    otherTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                    otherTitle.border = borderStyle;
                    curRowIdx++;

                    const oRow = sheet.getRow(curRowIdx);
                    oRow.values = ['Type', 'Date', 'Duration', 'Details'];
                    oRow.eachCell(cell => {
                        cell.fill = headerFill;
                        cell.font = headerFont;
                        cell.border = borderStyle;
                    });
                    curRowIdx++;

                    otherRecords.forEach(rec => {
                        let displayDate = rec.date;
                        let displayDuration = rec.duration;

                        if (rec.type === 'Leave') {
                            displayDate = rec.start_date === rec.end_date 
                                ? formatDateOnly(rec.start_date)
                                : `${formatDateOnly(rec.start_date)} to ${formatDateOnly(rec.end_date)}`;
                        } else if (rec.type === 'Time-Off' || rec.type === 'On-Duty') {
                            displayDate = formatDateOnly(rec.date);
                            const durationMatch = rec.duration.match(/\((.+)\)$/);
                            const durationSuffix = durationMatch ? ` (${durationMatch[1]})` : "";
                            displayDuration = `${formatTimeOnly(rec.start_time)} to ${formatTimeOnly(rec.end_time)}${durationSuffix}`;
                        }

                        const row = sheet.getRow(curRowIdx);
                        row.values = [rec.type, displayDate, displayDuration, rec.detail || 'N/A'];
                        row.eachCell(cell => {
                            cell.border = borderStyle;
                            cell.alignment = { vertical: 'top', wrapText: true };
                        });
                        const typeCell = row.getCell(1);
                        typeCell.font = { bold: true };
                        if (rec.type === 'Leave') typeCell.font.color = { argb: 'FFEA580C' };
                        else if (rec.type === 'Time-Off') typeCell.font.color = { argb: 'FF0F766E' };
                        else if (rec.type === 'On-Duty') typeCell.font.color = { argb: 'FF0284C7' };
                        curRowIdx++;
                    });
                } else if (attSessions.length === 0) {
                    sheet.mergeCells(`A${curRowIdx}:H${curRowIdx}`);
                    const emptyCell = sheet.getCell(`A${curRowIdx}`);
                    emptyCell.value = 'No approved records or attendance found';
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
            {/* Summary Stats */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">Total Records Found:</span> {summary.length}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <button
                            onClick={exportExcel}
                            disabled={summary.length === 0}
                            className="group relative overflow-hidden w-full px-6 py-2.5 bg-white text-[#1e1b4b] border-2 border-[#1e1b4b] rounded-xl font-black text-xs uppercase tracking-widest hover:text-white hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-lg flex items-center justify-center gap-2 z-10"
                        >
                            <div className="absolute inset-0 bg-[#1e1b4b] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out -z-10" />
                            <div className="w-2 h-2 bg-[#0ea5e9] rounded-full animate-pulse" />
                            📥 Export
                        </button>
                    </div>
                </div>
                {period && (
                    <p className="mt-4 text-xs text-gray-500 text-center">
                        Showing approved records and attendance for <span className="font-semibold">{MONTHS[month - 1]} {year}</span> ({period.includes(' to ') ? period.split(' to ').map(d => formatDateOnly(d.trim())).join(' to ') : formatDateOnly(period)})
                    </p>
                )}
            </div>

            {/* Stats Cards */}
            {!loading && summary.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Employees</p>
                        <p className="text-3xl font-black text-[#1e1b4b]">{summary.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Present Days</p>
                        <p className="text-3xl font-black text-emerald-600">{totals.present_days}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Work Hours</p>
                        <p className="text-3xl font-black text-indigo-600">{formatHours(0, totals.work_minutes)}</p>
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
                        <p className="text-gray-400 text-lg font-medium">No records found for {MONTHS[month - 1]} {year}</p>
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
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('present_days')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Present Days<SortIcon col="present_days" /></span>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('work_minutes')}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Work Hours<SortIcon col="work_minutes" /></span>
                                </th>
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
                                            {s.present_days > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    {s.present_days} {s.present_days === 1 ? 'day' : 'days'}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.work_minutes > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    {formatHours(s.work_hours, s.work_minutes)}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
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
                                            <td colSpan={9} className="px-8 py-3 bg-[#f8fafc] border-b border-gray-100">
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
                                                            {s.records.map((rec, rIdx) => {
                                                                if (rec.type === 'Attendance') {
                                                                    const innerKey = `${s.staff_id}_attendance`;
                                                                    const isInnerOpen = Boolean(expandedInnerRows[innerKey]); // default collapsed
                                                                    const sessions = rec.sessions || s.attendance_records || [];
                                                                    const presentDaysCount = rec.present_days !== undefined ? rec.present_days : s.present_days;

                                                                    return (
                                                                        <React.Fragment key={`att-${rIdx}`}>
                                                                            <tr 
                                                                                className="hover:bg-emerald-50/50 cursor-pointer transition-colors bg-emerald-50/20"
                                                                                onClick={() => toggleInnerRow(innerKey)}
                                                                            >
                                                                                <td className="px-4 py-2.5 align-middle">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <button 
                                                                                            type="button"
                                                                                            onClick={(e) => { e.stopPropagation(); toggleInnerRow(innerKey); }}
                                                                                            className="text-emerald-600 hover:text-emerald-800 transition-colors focus:outline-none"
                                                                                            title={isInnerOpen ? "Collapse inner attendance rows" : "Expand inner attendance rows"}
                                                                                        >
                                                                                            {isInnerOpen ? <FiMinusCircle size={15}/> : <FiPlusCircle size={15}/>}
                                                                                        </button>
                                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-200">
                                                                                            Attendance
                                                                                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/90 text-emerald-950 text-[10px] font-black">
                                                                                                {presentDaysCount} {presentDaysCount === 1 ? 'day' : 'days'}
                                                                                            </span>
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-xs text-gray-700 font-semibold align-middle">
                                                                                    {rec.start_date && rec.end_date 
                                                                                        ? (rec.start_date === rec.end_date ? formatDateOnly(rec.start_date) : `${formatDateOnly(rec.start_date)} to ${formatDateOnly(rec.end_date)}`)
                                                                                        : formatDateOnly(rec.date)}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-xs text-emerald-800 font-black align-middle">
                                                                                    {rec.duration}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-xs text-gray-600 align-middle">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-gray-600 font-medium">
                                                                                            {sessions.length} session(s) logged
                                                                                        </span>
                                                                                        <span className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
                                                                                            {isInnerOpen ? 'Hide Daily Details ▲' : 'Show Daily Details ▼'}
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>

                                                                            {/* Inner Child Row for Attendance */}
                                                                            {isInnerOpen && sessions.length > 0 && (
                                                                                <tr className="bg-emerald-50/10">
                                                                                    <td colSpan={4} className="px-6 py-3 border-t border-b border-emerald-100">
                                                                                        <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                                                                                            <div className="bg-gradient-to-r from-emerald-50 via-teal-50/30 to-white px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                                                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                                                                                                        Daily Attendance Breakdown ({sessions.length} Sessions)
                                                                                                    </span>
                                                                                                </div>
                                                                                                <span className="text-[11px] text-emerald-700 font-bold">
                                                                                                    Total: {presentDaysCount} Days • {rec.duration}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="overflow-x-auto">
                                                                                                <table className="min-w-full divide-y divide-gray-100 text-xs">
                                                                                                    <thead className="bg-slate-50 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                                                                        <tr>
                                                                                                            <th className="px-3 py-2 text-center w-10">#</th>
                                                                                                            <th className="px-4 py-2 text-left">Date</th>
                                                                                                            <th className="px-4 py-2 text-left">Check-In</th>
                                                                                                            <th className="px-4 py-2 text-left">Check-Out</th>
                                                                                                            <th className="px-4 py-2 text-left">Duration</th>
                                                                                                            <th className="px-4 py-2 text-left">Terminal / Device</th>
                                                                                                            <th className="px-4 py-2 text-left">IP Address</th>
                                                                                                            <th className="px-3 py-2 text-center">Status</th>
                                                                                                        </tr>
                                                                                                    </thead>
                                                                                                    <tbody className="divide-y divide-gray-50 bg-white">
                                                                                                        {sessions.map((sess, sIdx) => (
                                                                                                            <tr key={sess.id || sIdx} className="hover:bg-emerald-50/30 transition-colors">
                                                                                                                <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px]">{sIdx + 1}</td>
                                                                                                                <td className="px-4 py-2 font-semibold text-gray-900 whitespace-nowrap">
                                                                                                                    {formatDateWithWeekday(sess.date)}
                                                                                                                </td>
                                                                                                                <td className="px-4 py-2 font-mono text-gray-700 whitespace-nowrap">
                                                                                                                    {sess.check_in_time ? formatTimeOnly(sess.check_in_time) : (sess.check_in_time_str || '—')}
                                                                                                                </td>
                                                                                                                <td className="px-4 py-2 font-mono text-gray-700 whitespace-nowrap">
                                                                                                                    {sess.check_out_time ? formatTimeOnly(sess.check_out_time) : (
                                                                                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                                                                            Active
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </td>
                                                                                                                <td className="px-4 py-2 font-black text-emerald-700 whitespace-nowrap">
                                                                                                                    {sess.formatted_duration || sess.duration}
                                                                                                                </td>
                                                                                                                <td className="px-4 py-2 text-gray-600">
                                                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-gray-700 text-[11px] font-medium border border-gray-200">
                                                                                                                        {sess.phone_model || 'Web / Kiosk'}
                                                                                                                    </span>
                                                                                                                </td>
                                                                                                                <td className="px-4 py-2 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                                                                                                                    {sess.ip_address || '—'}
                                                                                                                </td>
                                                                                                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                                                                    {sess.status === 'Completed' ? (
                                                                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                                                            ✓ Done
                                                                                                                        </span>
                                                                                                                    ) : (
                                                                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                                                                            • Active
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        ))}
                                                                                                    </tbody>
                                                                                                </table>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </React.Fragment>
                                                                    );
                                                                }

                                                                return (
                                                                    <tr key={rIdx} className="hover:bg-gray-50/50">
                                                                        <td className="px-4 py-2 align-top">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                                rec.type === 'Leave' 
                                                                                    ? 'bg-orange-50 text-orange-600 border-orange-100' 
                                                                                    : rec.type === 'Time-Off' 
                                                                                    ? 'bg-teal-50 text-teal-600 border-teal-100' 
                                                                                    : 'bg-sky-50 text-[#0ea5e9] border-sky-100'
                                                                            }`}>
                                                                                {rec.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-xs text-gray-600 font-medium align-top">
                                                                            {rec.type === 'Leave' 
                                                                                ? (rec.start_date === rec.end_date ? formatDateOnly(rec.start_date) : `${formatDateOnly(rec.start_date)} to ${formatDateOnly(rec.end_date)}`)
                                                                                : formatDateOnly(rec.date)}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-xs text-gray-800 font-bold align-top">
                                                                            {rec.type === 'Leave' 
                                                                                ? rec.duration 
                                                                                : `${formatTimeOnly(rec.start_time)} to ${formatTimeOnly(rec.end_time)}${rec.duration.match(/\((.+)\)$/) ? ` (${rec.duration.match(/\((.+)\)$/)[1]})` : ""}`}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-xs text-gray-600 align-top break-words">{rec.detail}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            <tr className="bg-[#1e1b4b]/5 font-black">
                                <td colSpan={4} className="px-4 py-3 text-sm text-[#1e1b4b] uppercase tracking-widest text-right">Total</td>
                                <td className="px-4 py-3 text-center text-sm text-emerald-600">{totals.present_days} {totals.present_days === 1 ? 'day' : 'days'}</td>
                                <td className="px-4 py-3 text-center text-sm text-indigo-600">{formatHours(0, totals.work_minutes)}</td>
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
