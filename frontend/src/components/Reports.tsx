import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AttendanceRecord, Student, Subject } from '../types';
import { Download, Edit2 } from 'lucide-react';

type ReportMode = 'DAILY' | 'MATRIX' | 'STATS';

export const Reports: React.FC = () => {
  const [mode, setMode] = useState<ReportMode>('DAILY');
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [filterDate]);

  const loadData = async () => {
    const [allLogs, studentList, subList] = await Promise.all([
        api.getAttendanceLogs(),
        api.getStudents(),
        api.getSubjects()
    ]);
    
    setLogs(allLogs);
    setStudents(studentList);
    setSubjects(subList);
  };

  const getDailyLogs = () => {
      return logs
        .filter(l => l.dateStr === filterDate)
        .sort((a, b) => b.timestamp - a.timestamp);
  };

  const toggleStatus = async (log: AttendanceRecord) => {
      const newStatus = log.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      // FIXED: Using window.confirm()
      if(window.confirm(`Manually mark ${log.studentName} as ${newStatus}?`)) {
          await api.updateAttendanceStatus(log.id, newStatus);
          
          // Optimistic update locally
          setLogs(prev => prev.map(l => l.id === log.id ? {...l, status: newStatus} : l));
      }
  };

  const downloadCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (mode === 'DAILY') {
        headers = ['Time', 'Student ID', 'Name', 'Subject', 'Status'];
        rows = getDailyLogs().map(l => [
            new Date(l.timestamp).toLocaleTimeString(),
            l.studentId,
            l.studentName,
            l.subject || 'General',
            l.status
        ]);
    } else {
        // Matrix Export
        headers = ['Student ID', 'Name', ...subjects.map(s => s.abbr), 'Total Present'];
        rows = students.map(s => {
            const studentLogs = logs.filter(l => l.studentId === s.id && l.status === 'PRESENT');
            const subjectCounts = subjects.map(sub => 
                studentLogs.filter(l => l.subject === sub.abbr).length.toString()
            );
            return [s.id, s.name, ...subjectCounts, studentLogs.length.toString()];
        });
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${mode.toLowerCase()}_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- RENDERERS ---

  const renderDaily = () => {
      const dailyLogs = getDailyLogs();
      return (
        <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800 text-slate-200 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dailyLogs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">No records today.</td></tr>
              ) : (
                dailyLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 font-medium text-white">{log.studentId}</td>
                    <td className="px-6 py-4">{log.studentName}</td>
                    <td className="px-6 py-4 text-primary-400">{log.subject}</td>
                    <td className="px-6 py-4">
                        <span className={`font-bold ${log.status === 'PRESENT' ? 'text-green-400' : 'text-red-400'}`}>
                            {log.status}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <button onClick={() => toggleStatus(log)} className="p-2 hover:bg-slate-700 rounded text-slate-500 hover:text-white" title="Manual Adjustment">
                            <Edit2 size={16} />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
      );
  };

  const renderMatrix = () => {
      return (
        <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800 text-slate-200 uppercase font-medium">
              <tr>
                <th className="px-4 py-4 sticky left-0 bg-slate-800 z-10">Name</th>
                {subjects.map(s => <th key={s.code} className="px-4 py-4 text-center">{s.abbr}</th>)}
                <th className="px-4 py-4 text-center text-green-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {students.map(student => {
                    const studentLogs = logs.filter(l => l.studentId === student.id && l.status === 'PRESENT');
                    const total = studentLogs.length;
                    
                    return (
                        <tr key={student.id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-4 sticky left-0 bg-slate-900 z-10 font-medium text-white border-r border-slate-800">
                                {student.name} <span className="block text-xs text-slate-500">{student.id}</span>
                            </td>
                            {subjects.map(sub => {
                                const count = studentLogs.filter(l => l.subject === sub.abbr).length;
                                return (
                                    <td key={sub.code} className="px-4 py-4 text-center">
                                        {count > 0 ? <span className="font-bold text-white">{count}</span> : '-'}
                                    </td>
                                );
                            })}
                            <td className="px-4 py-4 text-center font-bold text-green-400">{total}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      );
  };

  const renderStats = () => {
      return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => {
                  const studentLogs = logs.filter(l => l.studentId === student.id && l.status === 'PRESENT');
                  const total = studentLogs.length;
                  const maxSessions = 50; // Dummy baseline
                  const pct = Math.min(100, Math.round((total / maxSessions) * 100));
                  
                  return (
                      <div key={student.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="font-bold text-white">{student.name}</h3>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${pct < 75 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {pct}%
                              </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-4">{student.id}</p>
                          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${pct < 75 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                                {subjects.map(s => {
                                    const c = studentLogs.filter(l => l.subject === s.abbr).length;
                                    if(c === 0) return null;
                                    return (
                                        <span key={s.code} className="text-xs bg-slate-900 px-2 py-1 rounded border border-slate-600">
                                            {s.abbr}: {c}
                                        </span>
                                    )
                                })}
                          </div>
                      </div>
                  )
              })}
          </div>
      )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-white">Attendance Reports</h2>
            <div className="flex gap-2 mt-2">
                <button onClick={() => setMode('DAILY')} className={`px-3 py-1 text-xs rounded-full border ${mode === 'DAILY' ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-600 text-slate-400'}`}>Daily Log</button>
                <button onClick={() => setMode('MATRIX')} className={`px-3 py-1 text-xs rounded-full border ${mode === 'MATRIX' ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-600 text-slate-400'}`}>Subject Matrix</button>
                <button onClick={() => setMode('STATS')} className={`px-3 py-1 text-xs rounded-full border ${mode === 'STATS' ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-600 text-slate-400'}`}>Overall Stats</button>
            </div>
        </div>
        
        <div className="flex gap-4">
          {mode === 'DAILY' && (
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-primary-500"
              />
          )}
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded transition-colors"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto h-full p-1">
            {mode === 'DAILY' && renderDaily()}
            {mode === 'MATRIX' && renderMatrix()}
            {mode === 'STATS' && renderStats()}
        </div>
      </div>
    </div>
  );
};