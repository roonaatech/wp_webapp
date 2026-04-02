import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api.config';
import ModernLoader from './ModernLoader';
import { getCurrentInAppTimezone } from '../utils/timezone.util';

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

    const exportCSV = () => {
        if (summary.length === 0) return;
        const headers = ['Employee Name', 'Email', 'Leave Days', 'Time-Off (Hours)', 'On-Duty (Hours)'];
        const rows = summary.map(s => [
            `${s.firstname} ${s.lastname}`, s.email, s.leave_days,
            formatHours(s.timeoff_hours, s.timeoff_minutes),
            formatHours(s.onduty_hours, s.onduty_minutes)
        ]);
        rows.push(['TOTAL', '', totals.leave_days,
            formatHours(0, totals.timeoff_minutes),
            formatHours(0, totals.onduty_minutes)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monthly-summary-${MONTHS[month - 1]}-${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
                            onClick={fetchSummary}
                            className="px-6 py-2.5 bg-[#1e1b4b] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-950/20 hover:shadow-[#0ea5e9]/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <div className="w-2 h-2 bg-[#0ea5e9] rounded-full animate-pulse" />
                            Generate
                        </button>
                        <button
                            onClick={exportCSV}
                            disabled={summary.length === 0}
                            className="px-6 py-2.5 bg-white text-[#1e1b4b] border-2 border-[#1e1b4b] rounded-xl font-black text-xs uppercase tracking-widest hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            📥 Export CSV
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
                                <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-widest">#</th>
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
                                <tr key={s.staff_id} className="hover:bg-[#f0f9ff]/50 transition-colors">
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
                            ))}
                            <tr className="bg-[#1e1b4b]/5 font-black">
                                <td colSpan={3} className="px-4 py-3 text-sm text-[#1e1b4b] uppercase tracking-widest text-right">Total (Approved Only)</td>
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
