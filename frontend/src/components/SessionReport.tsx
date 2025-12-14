import React from 'react';
import { SessionStats } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Check, X, Clock, Users, ArrowRight, Download } from 'lucide-react';

interface SessionReportProps {
    stats: SessionStats;
    onClose: () => void;
}

export const SessionReport: React.FC<SessionReportProps> = ({ stats, onClose }) => {
    const data = [
        { name: 'Present', value: stats.presentCount, color: '#22c55e' },
        { name: 'Absent', value: stats.absentStudents.length, color: '#ef4444' },
    ];

    const duration = Math.round((stats.endTime - stats.startTime) / 1000 / 60);

    const downloadSessionCSV = () => {
        const headers = ['Student ID', 'Name', 'Department', 'Status', 'Date', 'Subject'];
        const dateStr = new Date(stats.endTime).toLocaleDateString();
        
        const presentRows = stats.presentStudents.map(s => [
            s.id, s.name, s.department, 'PRESENT', dateStr, stats.subject
        ]);
        
        const absentRows = stats.absentStudents.map(s => [
            s.id, s.name, s.department, 'ABSENT', dateStr, stats.subject
        ]);

        const rows = [...presentRows, ...absentRows];
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SessionReport_${stats.subject}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex items-center justify-center bg-slate-950 p-6 animate-in zoom-in-95 duration-500">
            <div className="max-w-6xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 h-[90vh]">
                
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-1">Session Report</h2>
                        <p className="text-primary-400 font-mono text-lg">{stats.subject}</p>
                    </div>
                    <button 
                        onClick={downloadSessionCSV}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                    >
                        <Download size={20} /> Export CSV
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                        <div className="text-slate-400 text-xs">Total Class Size</div>
                        <div className="text-3xl font-bold text-white flex items-center gap-2 mt-2">
                            <Users size={24} /> {stats.totalStudents}
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                        <div className="text-slate-400 text-xs">Duration</div>
                        <div className="text-3xl font-bold text-white flex items-center gap-2 mt-2">
                            <Clock size={24} /> {duration}m
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center gap-6">
                        <div className="h-20 w-20 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data} innerRadius={25} outerRadius={40} paddingAngle={5} dataKey="value">
                                        {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                             <div className="text-3xl font-bold text-white">{Math.round((stats.presentCount / stats.totalStudents) * 100)}%</div>
                             <div className="text-sm text-slate-400">Attendance Rate</div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    {/* Present Column */}
                    <div className="flex-1 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-700 bg-green-500/10">
                            <h3 className="font-bold text-green-400 flex items-center gap-2">
                                <Check size={18} /> Present ({stats.presentCount})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-auto p-2 space-y-2">
                            {stats.presentStudents.map(student => (
                                <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                                        <img src={student.photoBase64} className="w-full h-full object-cover" alt={student.name} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-200 truncate">{student.name}</div>
                                        <div className="text-xs text-slate-500">{student.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Absent Column */}
                    <div className="flex-1 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-700 bg-red-500/10">
                            <h3 className="font-bold text-red-400 flex items-center gap-2">
                                <X size={18} /> Absent ({stats.absentStudents.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-auto p-2 space-y-2">
                            {stats.absentStudents.map(student => (
                                <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 opacity-70">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                                        <img src={student.photoBase64} className="w-full h-full object-cover grayscale" alt={student.name} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-200 truncate">{student.name}</div>
                                        <div className="text-xs text-slate-500">{student.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl flex items-center gap-2"
                    >
                        Close & Return to Home <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
