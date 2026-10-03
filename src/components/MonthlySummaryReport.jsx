import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from './ModernLoader';
import { getCurrentInAppTimezone, formatDateOnly, formatTimeOnly } from '../utils/timezone.util';
import { FiPlusCircle, FiMinusCircle, FiChevronLeft, FiChevronRight, FiDownload, FiAlertTriangle, FiDollarSign, FiCalendar, FiClock, FiTarget, FiFileText, FiCheck, FiX } from 'react-icons/fi';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getComplianceHours } from '../utils/attendanceConfig';

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
    const [expandedTab, setExpandedTab] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const toggleRow = (staffId) => {
        setExpandedRows(prev => ({
            ...prev,
            [staffId]: !prev[staffId]
        }));
    };

    const setTab = (staffId, tab) => {
        setExpandedTab(prev => ({
            ...prev,
            [staffId]: tab
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
        } catch (e) { }
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

    const [apiComplianceHours, setApiComplianceHours] = useState(null);
    const [apiAllowedLeave, setApiAllowedLeave] = useState(null);
    const [apiAllowedTimeOff, setApiAllowedTimeOff] = useState(null);
    const [, setSettingsVersion] = useState(0);

    const complianceHours = apiComplianceHours || getComplianceHours();

    const getSessionCompliance = (sess, threshold = complianceHours) => {
        // Active session: currently checked in without checkout
        if (!sess.check_out_time || sess.status === 'Active' || sess.check_out_time_str === 'Active') {
            return {
                isCompliant: false,
                isActive: true,
                hours: 0,
                label: 'In Progress'
            };
        }

        let hours = 0;
        if (sess.work_minutes !== undefined && sess.work_minutes > 0) {
            hours = sess.work_minutes / 60;
        } else if (sess.check_in_time && sess.check_out_time) {
            const diffMs = new Date(sess.check_out_time).getTime() - new Date(sess.check_in_time).getTime();
            if (diffMs > 0) hours = diffMs / (1000 * 60 * 60);
        }

        const isCompliant = hours >= threshold;
        return {
            isCompliant,
            isActive: false,
            hours,
            label: isCompliant ? 'Compliant' : 'Non-Compliant'
        };
    };

    const getModalComplianceDayCounts = (sessions = [], thresholdHours = complianceHours) => {
        const dayTotals = {};
        const activeDays = new Set();
        sessions.forEach(sess => {
            const d = sess.date || 'unknown';
            if (!dayTotals[d]) {
                dayTotals[d] = 0;
            }
            let mins = 0;
            if (sess.work_minutes !== undefined && sess.work_minutes > 0) {
                mins = sess.work_minutes;
            } else if (sess.check_in_time && sess.check_out_time) {
                const diffMs = new Date(sess.check_out_time).getTime() - new Date(sess.check_in_time).getTime();
                if (diffMs > 0) mins = Math.floor(diffMs / 60000);
            } else if (sess.check_in_time && !sess.check_out_time) {
                activeDays.add(d);
            }
            dayTotals[d] += mins;
        });

        let compliantDays = 0;
        let nonCompliantDays = 0;
        let inProgressDays = 0;
        const thresholdMins = thresholdHours * 60;

        Object.entries(dayTotals).forEach(([d, totalMins]) => {
            if (totalMins >= thresholdMins) {
                compliantDays++;
            } else if (activeDays.has(d)) {
                inProgressDays++;
            } else {
                nonCompliantDays++;
            }
        });

        return { compliantDays, nonCompliantDays, inProgressDays };
    };

    const getModalAverageDuration = (sessions = [], presentDaysCount = 1) => {
        let totalMins = 0;
        const dayTotals = {};
        sessions.forEach(sess => {
            const d = sess.date || 'unknown';
            if (!dayTotals[d]) {
                dayTotals[d] = 0;
            }
            let mins = 0;
            if (sess.work_minutes !== undefined && sess.work_minutes > 0) {
                mins = sess.work_minutes;
            } else if (sess.check_in_time && sess.check_out_time) {
                const diffMs = new Date(sess.check_out_time).getTime() - new Date(sess.check_in_time).getTime();
                if (diffMs > 0) mins = Math.floor(diffMs / 60000);
            } else if (sess.check_in_time) {
                const diffMs = new Date().getTime() - new Date(sess.check_in_time).getTime();
                if (diffMs > 0) mins = Math.floor(diffMs / 60000);
            }
            dayTotals[d] += mins;
            totalMins += mins;
        });

        const uniqueDays = Object.keys(dayTotals).filter(k => k !== 'unknown').length;
        const days = (presentDaysCount && presentDaysCount > 0) ? presentDaysCount : (uniqueDays > 0 ? uniqueDays : 1);

        if (totalMins <= 0) return '0h 0m';
        const avgMins = Math.round(totalMins / days);
        if (avgMins <= 0 && totalMins > 0) return '< 1m';
        const hrs = Math.floor(avgMins / 60);
        const mins = avgMins % 60;
        return `${hrs}h ${mins}m`;
    };

    useEffect(() => {
        fetchSummary();
        setCurrentPage(1);
    }, [month, year]);

    useEffect(() => {
        const handleSettingsChanged = () => {
            setSettingsVersion(v => v + 1);
            fetchSummary();
        };

        window.addEventListener('settingsLoaded', handleSettingsChanged);
        return () => window.removeEventListener('settingsLoaded', handleSettingsChanged);
    }, [month, year]);

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
            if (res.data.compliance_hours) {
                setApiComplianceHours(parseFloat(res.data.compliance_hours));
            }
            if (res.data.allowed_leave_per_month !== undefined) {
                setApiAllowedLeave(parseFloat(res.data.allowed_leave_per_month));
            }
            if (res.data.allowed_time_off_per_month !== undefined) {
                setApiAllowedTimeOff(parseFloat(res.data.allowed_time_off_per_month));
            }
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
        setCurrentPage(1);
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

    const totalItems = sortedSummary.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedSummary = sortedSummary.slice(startIndex, endIndex);

    // Totals
    const totals = summary.reduce((acc, s) => ({
        present_days: acc.present_days + (s.present_days || 0),
        absent_days: Math.round((acc.absent_days + (s.absent_days || 0)) * 10) / 10,
        work_minutes: acc.work_minutes + (s.work_minutes || 0),
        leave_days: Math.round((acc.leave_days + (s.leave_days || 0)) * 10) / 10,
        timeoff_minutes: acc.timeoff_minutes + (s.timeoff_minutes || 0),
        onduty_minutes: acc.onduty_minutes + (s.onduty_minutes || 0),
        holidays: acc.holidays + (s.holidays_count || 0),
        compliant_days: Math.round((acc.compliant_days + (s.compliant_days || 0)) * 10) / 10
    }), { present_days: 0, absent_days: 0, work_minutes: 0, leave_days: 0, timeoff_minutes: 0, onduty_minutes: 0, holidays: 0, compliant_days: 0 });

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
                { header: 'Absent Days', key: 'absent', width: 15 },
                { header: 'Leave Days', key: 'leave', width: 15 },
                { header: 'Time-Off', key: 'timeoff', width: 15 },
                { header: 'On-Duty', key: 'onduty', width: 15 },
                { header: 'Holidays', key: 'holidays', width: 14 },
                { header: 'Compliant Days (Salary Days)', key: 'compliant_days', width: 26 }
            ];

            summarySheet.getRow(1).eachCell((cell) => {
                cell.fill = headerFill;
                cell.font = headerFont;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = borderStyle;
            });

            // Excel worksheet names are case-insensitive and restricted in length/characters
            const usedSheetNamesLower = new Set(['summary', 'history']);

            const getUniqueSheetName = (rawName, fallbackId) => {
                let clean = (rawName || `Staff_${fallbackId || '1'}`)
                    .replace(/[\[\]\*\?\/\\\:]/g, '')
                    .replace(/^'+|'+$/g, '')
                    .trim();
                if (!clean) clean = `Staff_${fallbackId || '1'}`;
                clean = clean.substring(0, 31).trim();

                let candidate = clean;
                let counter = 1;
                while (
                    usedSheetNamesLower.has(candidate.toLowerCase()) ||
                    workbook.worksheets.some(ws => ws.name.toLowerCase() === candidate.toLowerCase())
                ) {
                    const suffix = `_${counter}`;
                    const maxBaseLen = 31 - suffix.length;
                    candidate = `${clean.substring(0, maxBaseLen).trim()}${suffix}`;
                    counter++;
                }
                usedSheetNamesLower.add(candidate.toLowerCase());
                return candidate;
            };

            const dataToExport = sortedSummary.length > 0 ? sortedSummary : summary;

            let totalCompliantDays = 0;

            dataToExport.forEach((s) => {
                const fullName = `${s.firstname || ''} ${s.lastname || ''}`.trim() || 'Employee';
                s.sheetName = getUniqueSheetName(fullName, s.staff_id);

                const compDays = s.compliant_days !== undefined ? s.compliant_days : 0;
                totalCompliantDays = Math.round((totalCompliantDays + compDays) * 10) / 10;

                const row = summarySheet.addRow({
                    name: fullName,
                    email: s.email,
                    present: s.present_days || 0,
                    absent: s.absent_days || 0,
                    leave: s.leave_days || 0,
                    timeoff: formatHours(s.timeoff_hours, s.timeoff_minutes),
                    onduty: formatHours(s.onduty_hours, s.onduty_minutes),
                    holidays: s.holidays_count || 0,
                    compliant_days: compDays
                });

                const nameCell = row.getCell(1);
                nameCell.value = {
                    text: fullName,
                    hyperlink: `#'${s.sheetName}'!A1`,
                    tooltip: 'Click to view employee details'
                };
                nameCell.font = {
                    color: { argb: 'FF0563C1' },
                    underline: true
                };

                row.eachCell((cell, colNumber) => {
                    cell.border = borderStyle;
                    if ([3, 4, 5, 6, 7, 8, 9].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                    if (colNumber === 4 && (s.absent_days || 0) > 0) {
                        cell.font = { color: { argb: 'FFE11D48' }, bold: true };
                    }
                    if (colNumber === 9 && compDays > 0) {
                        cell.font = { color: { argb: 'FF15803D' }, bold: true };
                    }
                });
            });

            const totalRow = summarySheet.addRow({
                name: 'TOTAL',
                email: '',
                present: totals.present_days,
                absent: totals.absent_days,
                leave: totals.leave_days,
                timeoff: formatHours(0, totals.timeoff_minutes),
                onduty: formatHours(0, totals.onduty_minutes),
                holidays: totals.holidays,
                compliant_days: totals.compliant_days
            });
            totalRow.font = { bold: true };
            totalRow.eachCell((cell, colNumber) => {
                cell.border = borderStyle;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                if ([3, 4, 5, 6, 7, 8, 9].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                }
                if (colNumber === 4 && totals.absent_days > 0) cell.font = { bold: true, color: { argb: 'FFE11D48' } };
                if (colNumber === 9) cell.font = { bold: true, color: { argb: 'FF15803D' } };
            });

            // 2. Create Individual Sheets
            dataToExport.forEach((s) => {
                let sheet;
                try {
                    sheet = workbook.addWorksheet(s.sheetName);
                } catch (e) {
                    const fallbackName = getUniqueSheetName(`Staff_${s.staff_id || Math.random().toString(36).substring(7)}`);
                    sheet = workbook.addWorksheet(fallbackName);
                }

                sheet.mergeCells('A1:D1');
                const backCell = sheet.getCell('A1');
                backCell.value = { text: '← Back to Summary', hyperlink: `#'Summary'!A1`, tooltip: 'Go back to Summary sheet' };
                backCell.font = { color: { argb: 'FF0563C1' }, underline: true, bold: true };
                backCell.alignment = { vertical: 'middle', horizontal: 'left' };

                sheet.mergeCells('A3:C3');
                sheet.getCell('A3').value = `Employee: ${s.firstname} ${s.lastname}`;
                sheet.getCell('A3').font = { bold: true, size: 12, color: { argb: 'FF1E1B4B' } };

                sheet.mergeCells('D3:G3');
                sheet.getCell('D3').value = `Email: ${s.email}`;
                sheet.getCell('D3').font = { color: { argb: 'FF4B5563' } };

                // Salary Consideration Executive Summary Banner
                sheet.mergeCells('A4:I4');
                const salBanner = sheet.getCell('A4');
                const allowedLv = s.quota_summary?.allowed_leave_days ?? (apiAllowedLeave || 1);
                const allowedTo = (s.quota_summary?.allowed_timeoff_minutes ?? ((apiAllowedTimeOff || 2) * 60)) / 60;
                const holText = s.holidays_count > 0 ? ` | ${s.holidays_count} Paid Holiday${s.holidays_count === 1 ? '' : 's'}` : '';
                salBanner.value = `SALARY CONSIDERATION: ${s.compliant_days || 0} COMPLIANT DAYS (SALARY PAYABLE) | ${s.absent_days || 0} ABSENT DAYS | ${s.non_compliant_days || 0} NON-COMPLIANT DAYS${holText} | Monthly Quotas: ${allowedLv}d Leave Allowed, ${allowedTo}h Time-Off Allowed | Target: ${complianceHours}h/day`;
                salBanner.font = { bold: true, color: { argb: 'FF065F46' }, size: 10 };
                salBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                salBanner.border = borderStyle;
                salBanner.font = { bold: true, color: { argb: 'FF065F46' }, size: 10 };
                salBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                salBanner.border = borderStyle;

                sheet.columns = [
                    { key: 'c1', width: 6 },
                    { key: 'c2', width: 22 },
                    { key: 'c3', width: 14 },
                    { key: 'c4', width: 16 },
                    { key: 'c5', width: 16 },
                    { key: 'c6', width: 16 },
                    { key: 'c7', width: 18 },
                    { key: 'c8', width: 22 },
                    { key: 'c9', width: 48 }
                ];

                let curRowIdx = 6;

                // 1. Daily Salary & Compliance Breakdown Section
                const dailyList = s.daily_breakdown || [];
                if (dailyList.length > 0) {
                    sheet.mergeCells(`A${curRowIdx}:I${curRowIdx}`);
                    const secTitle = sheet.getCell(`A${curRowIdx}`);
                    secTitle.value = `DAILY SALARY & COMPLIANCE BREAKDOWN (${s.compliant_days || 0} Days for Salary Processing)`;
                    secTitle.font = { bold: true, color: { argb: 'FF1E1B4B' }, size: 10 };
                    secTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                    secTitle.border = borderStyle;
                    curRowIdx++;

                    const dHeaders = ['#', 'Date', 'Type', 'Attendance Time', 'On-Duty Time', 'Time-Off (Req)', 'Time-Off (Credit)', 'Effective Work Time', 'Salary Status & Remarks'];
                    const dRow = sheet.getRow(curRowIdx);
                    dRow.values = dHeaders;
                    dRow.eachCell(cell => {
                        cell.fill = headerFill;
                        cell.font = headerFont;
                        cell.border = borderStyle;
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                    curRowIdx++;

                    dailyList.forEach((day, idx) => {
                        const row = sheet.getRow(curRowIdx);
                        const statusText = day.is_compliant 
                            ? 'Compliant (1 Day)' 
                            : (day.compliant_day_value > 0 ? `Partial (${day.compliant_day_value} Day)` : 'Non-Compliant (0 Days)');
                        const fullRemark = `[${statusText}] ${day.remarks || ''}`;

                        row.values = [
                            idx + 1,
                            formatDateWithWeekday(day.date),
                            day.type,
                            day.attendance_minutes > 0 ? formatHours(0, day.attendance_minutes) : '—',
                            day.onduty_minutes > 0 ? formatHours(0, day.onduty_minutes) : '—',
                            day.timeoff_requested_minutes > 0 ? formatHours(0, day.timeoff_requested_minutes) : '—',
                            day.timeoff_credited_minutes > 0 ? formatHours(0, day.timeoff_credited_minutes) : '—',
                            day.type === 'Leave' || day.type === 'Holiday' ? '—' : formatHours(0, day.effective_work_minutes),
                            fullRemark
                        ];

                        row.eachCell((cell, colNumber) => {
                            cell.border = borderStyle;
                            cell.alignment = { vertical: 'middle', wrapText: true };
                            if ([1, 2, 3, 4, 5, 6, 7, 8].includes(colNumber)) {
                                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                            }
                        });

                        const statusCell = row.getCell(9);
                        if (day.is_compliant) {
                            statusCell.font = { color: { argb: 'FF15803D' }, bold: true };
                        } else if (day.compliant_day_value > 0) {
                            statusCell.font = { color: { argb: 'FFB45309' }, bold: true };
                        } else {
                            statusCell.font = { color: { argb: 'FFBE123C' } };
                        }

                        curRowIdx++;
                    });

                    curRowIdx++; // empty line spacing
                }

                const attSessions = s.attendance_records || (s.records?.find(r => r.type === 'Attendance')?.sessions) || [];
                const otherRecords = (s.records || []).filter(r => r.type !== 'Attendance' && r.type !== 'Absent');

                // 2. Attendance Sessions Section
                if (attSessions.length > 0) {
                    sheet.mergeCells(`A${curRowIdx}:I${curRowIdx}`);
                    const attTitle = sheet.getCell(`A${curRowIdx}`);
                    const compCounts = getModalComplianceDayCounts(attSessions, complianceHours);
                    attTitle.value = `ATTENDANCE SESSIONS (${s.present_days || 0} Present Days | ${s.absent_days || 0} Absent Days | ${compCounts.compliantDays} Compliant | ${compCounts.nonCompliantDays} Non-Compliant${compCounts.inProgressDays > 0 ? ` | ${compCounts.inProgressDays} In Progress` : ''} | Total Work Time: ${formatHours(s.work_hours, s.work_minutes)})`;
                    attTitle.font = { bold: true, color: { argb: 'FF065F46' }, size: 10 };
                    attTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    attTitle.border = borderStyle;
                    curRowIdx++;

                    const attHeaders = ['#', 'Date', 'Check-In', 'Check-Out', 'Duration', 'Compliance', 'Terminal / Device', 'IP Address', 'Status'];
                    const hRow = sheet.getRow(curRowIdx);
                    hRow.values = attHeaders;
                    hRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.border = borderStyle;
                    });
                    curRowIdx++;

                    attSessions.forEach((sess, idx) => {
                        const comp = getSessionCompliance(sess);
                        const row = sheet.getRow(curRowIdx);
                        row.values = [
                            idx + 1,
                            formatDateWithWeekday(sess.date),
                            sess.check_in_time ? formatTimeOnly(sess.check_in_time) : (sess.check_in_time_str || '—'),
                            sess.check_out_time ? formatTimeOnly(sess.check_out_time) : (sess.check_out_time_str || 'Active'),
                            sess.formatted_duration || sess.duration,
                            comp.label,
                            sess.phone_model || 'Web / Kiosk',
                            sess.ip_address || 'N/A',
                            sess.status || (sess.check_out_time ? 'Completed' : 'Active')
                        ];
                        row.eachCell(cell => {
                            cell.border = borderStyle;
                            cell.alignment = { vertical: 'middle', wrapText: true };
                        });
                        row.getCell(5).font = { bold: true, color: { argb: 'FF059669' } };
                        if (comp.isCompliant) {
                            row.getCell(6).font = { bold: true, color: { argb: 'FF15803D' } }; // Green
                        } else if (comp.isActive) {
                            row.getCell(6).font = { bold: true, color: { argb: 'FFB45309' } }; // Amber
                        } else {
                            row.getCell(6).font = { bold: true, color: { argb: 'FFBE123C' } }; // Red
                        }
                        curRowIdx++;
                    });

                    curRowIdx++; // empty line spacing
                }

                // 2. Leaves, Absent, Time-Off & On-Duty Section
                if (otherRecords.length > 0) {
                    sheet.mergeCells(`A${curRowIdx}:I${curRowIdx}`);
                    const otherTitle = sheet.getCell(`A${curRowIdx}`);
                    otherTitle.value = `LEAVES, TIME-OFF, ON-DUTY & HOLIDAY RECORDS`;
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
                        } else if (rec.type === 'Holiday' || rec.type === 'Absent') {
                            displayDate = formatDateOnly(rec.date);
                            displayDuration = rec.duration || '1 day';
                        } else if (rec.type === 'Time-Off' || rec.type === 'On-Duty') {
                            displayDate = formatDateOnly(rec.date);
                            const durationMatch = rec.duration && rec.duration.match(/\((.+)\)$/);
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
                        else if (rec.type === 'Absent') typeCell.font.color = { argb: 'FFE11D48' };
                        else if (rec.type === 'Holiday') typeCell.font.color = { argb: 'FF0D9488' };
                        else if (rec.type === 'Time-Off') typeCell.font.color = { argb: 'FF7E22CE' };
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

            const dateObj = getCurrentInAppTimezone().full;
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


            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-center justify-center gap-6 max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Month</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white text-sm font-medium min-w-[150px]"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white text-sm font-medium min-w-[110px]"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={exportExcel}
                        disabled={summary.length === 0}
                        className="group relative overflow-hidden px-6 py-2.5 bg-white text-[#1e1b4b] border-2 border-[#1e1b4b] rounded-xl font-black text-xs uppercase tracking-widest hover:text-white hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow-lg flex items-center justify-center gap-2 z-10 shrink-0 cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-[#1e1b4b] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out -z-10" />
                        <div className="w-2 h-2 bg-[#0ea5e9] rounded-full animate-pulse" />
                        <FiDownload className="w-3.5 h-3.5 mr-1" />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Summary Section (Single Line) */}
            {!loading && summary.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employees:</span>
                            <span className="text-base font-black text-[#1e1b4b]">{summary.length}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Present Days:</span>
                            <span className="text-base font-black text-blue-600">{totals.present_days}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Absent Days:</span>
                            <span className="text-base font-black text-rose-600">{totals.absent_days}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Salary Processed Days:</span>
                            <span className="text-base font-black text-emerald-700">{totals.compliant_days} {totals.compliant_days === 1 ? 'day' : 'days'}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approved Leave Days:</span>
                            <span className="text-base font-black text-orange-500">{totals.leave_days}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approved Time-Off:</span>
                            <span className="text-base font-black text-purple-600">{formatHours(0, totals.timeoff_minutes)}</span>
                        </div>
                        <div className="hidden xl:block h-4 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approved On-Duty:</span>
                            <span className="text-base font-black text-[#0ea5e9]">{formatHours(0, totals.onduty_minutes)}</span>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
                    <FiAlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <p className="text-red-800 font-medium text-sm">{error}</p>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
                {loading ? (
                    <div className="p-8"><ModernLoader size="lg" message="Generating summary..." fullScreen={false} /></div>
                ) : summary.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-400 text-lg font-medium">No records found for {MONTHS[month - 1]} {year}</p>
                        <p className="text-gray-300 text-sm mt-1">Try selecting a different month or year</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
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
                                        <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('absent_days')} title="Unexcused absent working days till current date">
                                            <span className="text-xs font-black text-white uppercase tracking-widest">Absent Days<SortIcon col="absent_days" /></span>
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
                                        <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('holidays_count')}>
                                            <span className="text-xs font-black text-white uppercase tracking-widest">Holidays<SortIcon col="holidays_count" /></span>
                                        </th>
                                        <th className="px-4 py-3 text-center cursor-pointer hover:text-[#0ea5e9] transition-colors" onClick={() => handleSort('compliant_days')} title="Days considered for salary processing">
                                            <span className="text-xs font-black text-white uppercase tracking-widest">Compliant Days<SortIcon col="compliant_days" /></span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedSummary.map((s, idx) => (
                                        <React.Fragment key={s.staff_id}>
                                            <tr className={`hover:bg-[#f0f9ff]/50 transition-colors ${expandedRows[s.staff_id] ? 'bg-[#f0f9ff]/30' : ''}`}>
                                                <td className="px-4 py-3 text-center">
                                                    {s.records && s.records.length > 0 && (
                                                        <button onClick={() => toggleRow(s.staff_id)} className="text-[#0ea5e9] hover:text-blue-700 transition-colors inline-flex items-center font-black">
                                                            {expandedRows[s.staff_id] ? <FiMinusCircle size={16} /> : <FiPlusCircle size={16} />}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-400 font-medium">{startIndex + idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900">{s.firstname} {s.lastname}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.present_days > 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                            {s.present_days} {s.present_days === 1 ? 'day' : 'days'}
                                                        </span>
                                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.absent_days > 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs" title={`${s.absent_days} day(s) absent till current date`}>
                                                            {s.absent_days} {s.absent_days === 1 ? 'day' : 'days'}
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
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
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
                                                <td className="px-4 py-3 text-center">
                                                    {s.holidays_count > 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs" title={`${s.holidays_count} company holiday(s) in this month (Paid)`}>
                                                            {s.holidays_count} {s.holidays_count === 1 ? 'day' : 'days'}
                                                        </span>
                                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.compliant_days > 0 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs" title="Days considered for salary processing">
                                                            {s.compliant_days} {s.compliant_days === 1 ? 'day' : 'days'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-600 border border-rose-200">
                                                            0 days
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedRows[s.staff_id] && (() => {
                                                const attSessions = s.attendance_records || (s.records?.find(r => r.type === 'Attendance')?.sessions) || [];
                                                const otherRecords = (s.records || []).filter(r => r.type !== 'Attendance' && r.type !== 'Absent');

                                                // Map attendance sessions by date (YYYY-MM-DD)
                                                const sessionsByDate = {};
                                                attSessions.forEach(sess => {
                                                    const d = sess.date ? (sess.date.includes('T') ? sess.date.split('T')[0] : sess.date) : (sess.check_in_time ? formatDateOnly(sess.check_in_time) : '');
                                                    if (d) {
                                                        if (!sessionsByDate[d]) sessionsByDate[d] = [];
                                                        sessionsByDate[d].push(sess);
                                                    }
                                                });

                                                // Combined daily list: Ensure all daily_breakdown days, plus any attendance sessions not in daily_breakdown
                                                const dailyDates = new Set((s.daily_breakdown || []).map(d => d.date));
                                                const extraDays = Object.keys(sessionsByDate)
                                                    .filter(d => !dailyDates.has(d))
                                                    .map(d => {
                                                        const dayMins = (sessionsByDate[d] || []).reduce((sum, sess) => sum + (sess.work_minutes || 0), 0);
                                                        return {
                                                            date: d,
                                                            type: 'Attendance',
                                                            attendance_minutes: dayMins,
                                                            onduty_minutes: 0,
                                                            timeoff_requested_minutes: 0,
                                                            timeoff_credited_minutes: 0,
                                                            timeoff_excess_minutes: 0,
                                                            effective_work_minutes: dayMins,
                                                            leave_days: 0,
                                                            leave_credited: 0,
                                                            leave_excess: 0,
                                                            is_compliant: dayMins >= (complianceHours * 60),
                                                            compliant_day_value: dayMins >= (complianceHours * 60) ? 1.0 : 0.0,
                                                            remarks: `${(sessionsByDate[d] || []).length} session(s) logged`
                                                        };
                                                    });
                                                const combinedDays = [...(s.daily_breakdown || []), ...extraDays].sort((a, b) => (a.date > b.date ? 1 : -1));
                                                const currentTab = (expandedTab[s.staff_id] || 'salary') === 'records' ? 'records' : 'salary';

                                                return (
                                                    <tr>
                                                        <td colSpan={11} className="px-6 py-4 bg-[#f8fafc] border-b border-gray-100">
                                                            <div className="space-y-4">
                                                            {/* Executive Salary & Quota Summary Cards */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-2xs flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                                        <FiDollarSign className="w-5 h-5 text-emerald-700" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Salary Consideration</div>
                                                                        <div className="text-base font-black text-emerald-700">
                                                                            {s.compliant_days ?? 0} {s.compliant_days === 1 ? 'Day' : 'Days'}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 font-medium">
                                                                            {s.non_compliant_days ?? 0} Non-Compliant {s.non_compliant_days === 1 ? 'day' : 'days'}{(s.absent_days || 0) > 0 ? ` (incl. ${s.absent_days} absent)` : ''}{s.holidays_count > 0 ? ` • ${s.holidays_count} Paid Holiday${s.holidays_count === 1 ? '' : 's'}` : ''}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-2xs flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                                                        <FiCalendar className="w-5 h-5 text-orange-600" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monthly Leave Quota</div>
                                                                        <div className="text-sm font-bold text-gray-900">
                                                                            {s.quota_summary?.credited_leave_days ?? s.leave_days} paid • {Math.max(0, (s.quota_summary?.used_leave_days || s.leave_days || 0) - (s.quota_summary?.credited_leave_days || 0))} unpaid
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 font-medium">
                                                                            {s.quota_summary?.allowed_leave_days ?? (apiAllowedLeave || 1)} {(s.quota_summary?.allowed_leave_days ?? 1) === 1 ? 'day' : 'days'} allowed
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-2xs flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                                                        <FiClock className="w-5 h-5 text-purple-600" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monthly Time-Off Quota</div>
                                                                        <div className="text-sm font-bold text-gray-900">
                                                                            {formatHours(0, s.quota_summary?.credited_timeoff_minutes ?? 0)} credited • {formatHours(0, Math.max(0, (s.quota_summary?.used_timeoff_minutes || s.timeoff_minutes || 0) - (s.quota_summary?.credited_timeoff_minutes || 0)))} excess
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 font-medium">
                                                                            {(s.quota_summary?.allowed_timeoff_minutes ?? ((apiAllowedTimeOff || 2) * 60)) / 60}h allowed
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-2xs flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                                        <FiTarget className="w-5 h-5 text-indigo-600" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Daily Compliance Target</div>
                                                                        <div className="text-sm font-bold text-gray-900">
                                                                            {complianceHours}h / day required
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-500 font-medium">
                                                                            Att + OD + Credited Time-Off
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Sub-tab Switcher: Daily Breakdown & Attendance vs Leave, Time-off and On-duty Records */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setTab(s.staff_id, 'salary')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                                                            currentTab === 'salary'
                                                                                ? 'bg-[#1e1b4b] text-white shadow-2xs'
                                                                                : 'text-gray-600 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        <FiCalendar className="w-3.5 h-3.5" />
                                                                        <span>Daily Breakdown & Attendance ({combinedDays.length})</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setTab(s.staff_id, 'records')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                                                            currentTab === 'records'
                                                                                ? 'bg-[#1e1b4b] text-white shadow-2xs'
                                                                                : 'text-gray-600 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        <FiFileText className="w-3.5 h-3.5" />
                                                                        <span>Leave, Time-off, On-duty & Holiday Records ({otherRecords.length})</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Tab 1: Combined Daily Breakdown & Attendance Table */}
                                                            {currentTab === 'salary' && (
                                                                <div className="rounded-xl overflow-hidden shadow-2xs border border-gray-200 bg-white">
                                                                    <table className="min-w-full divide-y divide-gray-100 text-xs">
                                                                        <thead className="bg-[#1e1b4b]/5 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                                                            <tr>
                                                                                <th className="px-3 py-2.5 text-center w-10">#</th>
                                                                                <th className="px-3 py-2.5 text-left">Date</th>
                                                                                <th className="px-3 py-2.5 text-left">Check In / Out</th>
                                                                                <th className="px-3 py-2.5 text-center">Type</th>
                                                                                <th className="px-3 py-2.5 text-left">Components (Att / OD / TO)</th>
                                                                                <th className="px-3 py-2.5 text-center">Effective Work</th>
                                                                                <th className="px-3 py-2.5 text-center">Salary Status</th>
                                                                                <th className="px-3 py-2.5 text-left">Calculation & HR Remark</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-50 bg-white">
                                                                            {combinedDays.length === 0 ? (
                                                                                <tr>
                                                                                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400 italic">
                                                                                        No logged activity found for this period
                                                                                    </td>
                                                                                </tr>
                                                                            ) : (
                                                                                combinedDays.map((day, dIdx) => {
                                                                                    const daySessions = sessionsByDate[day.date] || [];
                                                                                    return (
                                                                                        <tr key={dIdx} className="hover:bg-gray-50/50 transition-colors">
                                                                                            <td className="px-3 py-2.5 text-center text-gray-400 font-mono text-[11px]">{dIdx + 1}</td>
                                                                                            <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                                                                                                {formatDateWithWeekday(day.date)}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                                                                {day.type === 'Holiday' ? (
                                                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                                                                                        Company Holiday
                                                                                                    </span>
                                                                                                ) : daySessions.length === 0 ? (
                                                                                                    <span className="text-gray-400 font-mono text-[11px]">—</span>
                                                                                                ) : (
                                                                                                    <div className="space-y-1">
                                                                                                        {daySessions.map((sess, sIdx) => {
                                                                                                            const checkIn = sess.check_in_time ? formatTimeOnly(sess.check_in_time) : (sess.check_in_time_str || '—');
                                                                                                            const isCheckOutActive = !sess.check_out_time || sess.status === 'Active';
                                                                                                            const checkOut = !isCheckOutActive 
                                                                                                                ? formatTimeOnly(sess.check_out_time) 
                                                                                                                : (sess.check_out_time ? formatTimeOnly(sess.check_out_time) : (sess.check_out_time_str && sess.check_out_time_str !== 'Active' ? sess.check_out_time_str : null));

                                                                                                            return (
                                                                                                                <div key={sess.id || sIdx} className="flex items-center gap-1.5 font-mono text-[11px]">
                                                                                                                    <span className="font-semibold text-gray-800">{checkIn}</span>
                                                                                                                    <span className="text-gray-400 font-sans">→</span>
                                                                                                                    {checkOut ? (
                                                                                                                        <span className="font-semibold text-gray-800">{checkOut}</span>
                                                                                                                    ) : (
                                                                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                                                                            Active
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            );
                                                                                                        })}
                                                                                                    </div>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-center">
                                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                                                    day.type === 'Holiday'
                                                                                                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                                                                                                        : day.type === 'Absent'
                                                                                                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                                                                                                        : day.type === 'Leave'
                                                                                                        ? 'bg-orange-50 text-orange-600 border-orange-100'
                                                                                                        : day.type === 'Time-Off'
                                                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                                                        : day.type === 'On-Duty'
                                                                                                        ? 'bg-sky-50 text-[#0ea5e9] border-sky-100'
                                                                                                        : day.type === 'Combined'
                                                                                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                                                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                                                }`}>
                                                                                                    {day.type}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-gray-700">
                                                                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                                                                    {day.type === 'Holiday' && (
                                                                                                        <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                                                                            Holiday: {day.holiday_name || 'Paid Holiday'}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {day.type === 'Absent' && (
                                                                                                        <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                                                                                            Unexcused Absence
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {day.attendance_minutes > 0 && (
                                                                                                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                                                            Att: {formatHours(0, day.attendance_minutes)}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {day.onduty_minutes > 0 && (
                                                                                                        <span className="font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                                                                                                            OD: {formatHours(0, day.onduty_minutes)}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {day.timeoff_requested_minutes > 0 && (
                                                                                                        <span className={`font-semibold px-1.5 py-0.5 rounded ${
                                                                                                            day.timeoff_credited_minutes > 0 
                                                                                                                ? 'text-purple-700 bg-purple-50' 
                                                                                                                : 'text-gray-500 bg-gray-100 line-through'
                                                                                                        }`}>
                                                                                                            TO: {formatHours(0, day.timeoff_credited_minutes)}{day.timeoff_excess_minutes > 0 ? ` (+${formatHours(0, day.timeoff_excess_minutes)} uncredited)` : ''}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {day.leave_days > 0 && (
                                                                                                        <span className="font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                                                                                                            Leave: {day.leave_days}d {day.leave_credited > 0 ? '(Paid)' : '(Unpaid)'}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-center font-bold text-gray-800 whitespace-nowrap">
                                                                                                {day.type === 'Leave' || day.type === 'Holiday' || day.type === 'Absent' ? '—' : formatHours(0, day.effective_work_minutes)}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                                                {day.type === 'Absent' ? (
                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                                                                        <FiX className="w-3 h-3 text-rose-700" /> Absent (0 Days)
                                                                                                    </span>
                                                                                                ) : day.is_compliant ? (
                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                                                        <FiCheck className="w-3 h-3 text-emerald-700" /> Compliant (1 Day)
                                                                                                    </span>
                                                                                                ) : day.compliant_day_value > 0 ? (
                                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                                                                                        Partial ({day.compliant_day_value} Day)
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                                                                        <FiX className="w-3 h-3 text-rose-700" /> Non-Compliant
                                                                                                    </span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-3 py-2.5 text-gray-600 font-medium text-[11px]">
                                                                                                {day.remarks}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}

                                                            {/* Tab 2: Leave, Time-off and On-duty Records Table */}
                                                            {currentTab === 'records' && (
                                                                <div className="rounded-xl overflow-hidden shadow-2xs border border-gray-200 bg-white">
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
                                                                            {otherRecords.length === 0 ? (
                                                                                <tr>
                                                                                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic text-xs">
                                                                                        No leave, time-off, on-duty or holiday records found
                                                                                    </td>
                                                                                </tr>
                                                                            ) : (
                                                                                otherRecords.map((rec, rIdx) => {
                                                                                    return (
                                                                                        <tr key={rIdx} className="hover:bg-gray-50/50">
                                                                                            <td className="px-4 py-2 align-top">
                                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${rec.type === 'Leave'
                                                                                                    ? 'bg-orange-50 text-orange-600 border-orange-100'
                                                                                                    : rec.type === 'Absent'
                                                                                                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                                                                                                    : rec.type === 'Time-Off'
                                                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                                                    : rec.type === 'Holiday'
                                                                                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
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
                                                                                                    : rec.type === 'Holiday' || rec.type === 'Absent'
                                                                                                    ? (rec.duration || '1 day')
                                                                                                    : `${formatTimeOnly(rec.start_time)} to ${formatTimeOnly(rec.end_time)}${rec.duration && rec.duration.match(/\((.+)\)$/) ? ` (${rec.duration.match(/\((.+)\)$/)[1]})` : ""}`}
                                                                                            </td>
                                                                                            <td className="px-4 py-2 text-xs text-gray-600 align-top break-words">{rec.detail}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })()}
                                    </React.Fragment>
                                    ))}
                                    <tr className="bg-[#1e1b4b]/5 font-black">
                                        <td colSpan={4} className="px-4 py-3 text-sm text-[#1e1b4b] uppercase tracking-widest text-right">Total</td>
                                        <td className="px-4 py-3 text-center text-sm text-blue-600">{totals.present_days} {totals.present_days === 1 ? 'day' : 'days'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-rose-600">{totals.absent_days} {totals.absent_days === 1 ? 'day' : 'days'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-orange-600">{totals.leave_days} {totals.leave_days === 1 ? 'day' : 'days'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-purple-600">{formatHours(0, totals.timeoff_minutes)}</td>
                                        <td className="px-4 py-3 text-center text-sm text-[#0ea5e9]">{formatHours(0, totals.onduty_minutes)}</td>
                                        <td className="px-4 py-3 text-center text-sm text-teal-700">{totals.holidays} {totals.holidays === 1 ? 'day' : 'days'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-emerald-700">{totals.compliant_days} {totals.compliant_days === 1 ? 'day' : 'days'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalItems > 0 && (
                            <div className="bg-gray-50/80 border-t border-gray-100 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                                {/* Left: Info & Rows per page */}
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-600 order-2 sm:order-1">
                                    <span>
                                        Showing <strong className="text-gray-900 font-bold">{startIndex + 1}</strong>–<strong className="text-gray-900 font-bold">{endIndex}</strong> of <strong className="text-gray-900 font-bold">{totalItems}</strong> employees
                                    </span>
                                    <div className="flex items-center gap-2 pl-3 sm:pl-4 border-l border-gray-200">
                                        <span className="text-gray-500 font-medium">Rows:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#1e1b4b] cursor-pointer shadow-2xs"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Right: Page Navigation */}
                                <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safeCurrentPage === 1}
                                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 border border-gray-300 bg-white rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        <FiChevronLeft size={14} />
                                        <span>Previous</span>
                                    </button>

                                    {/* Smart page numbers with ellipsis */}
                                    <div className="flex items-center gap-1">
                                        {(() => {
                                            const pageButtons = [];
                                            const maxButtons = 5;
                                            if (totalPages <= maxButtons) {
                                                for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
                                            } else {
                                                pageButtons.push(1);
                                                if (safeCurrentPage > 3) pageButtons.push('ellipsis-left');
                                                const start = Math.max(2, safeCurrentPage - 1);
                                                const end = Math.min(totalPages - 1, safeCurrentPage + 1);
                                                for (let i = start; i <= end; i++) {
                                                    if (!pageButtons.includes(i)) pageButtons.push(i);
                                                }
                                                if (safeCurrentPage < totalPages - 2) pageButtons.push('ellipsis-right');
                                                if (!pageButtons.includes(totalPages)) pageButtons.push(totalPages);
                                            }

                                            return pageButtons.map((btn, bIdx) => {
                                                if (btn === 'ellipsis-left' || btn === 'ellipsis-right') {
                                                    return <span key={`main-ell-${bIdx}`} className="px-1 text-gray-400 text-xs font-bold">...</span>;
                                                }
                                                const isActive = btn === safeCurrentPage;
                                                return (
                                                    <button
                                                        key={btn}
                                                        type="button"
                                                        onClick={() => setCurrentPage(btn)}
                                                        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${isActive
                                                            ? 'bg-[#1e1b4b] text-white shadow-xs'
                                                            : 'text-gray-700 bg-white hover:bg-gray-100 border border-gray-300'
                                                            }`}
                                                    >
                                                        {btn}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safeCurrentPage === totalPages}
                                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 border border-gray-300 bg-white rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        <span>Next</span>
                                        <FiChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MonthlySummaryReport;
