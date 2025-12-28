import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Activity, Users } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        calculateStats();
    }, []);

    const calculateStats = async () => {
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch from Backend
        const records = await api.getAttendanceLogs(); 
        const students = await api.getStudents();
        
        const todaysRecords = records.filter(r => r.dateStr === today);
        
        const totalStudents = students.length;
        const presentCount = todaysRecords.length;
        const absentCount = totalStudents - presentCount;

        const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, count: 0 }));
        todaysRecords.forEach(r => {
            const hour = new Date(r.timestamp).getHours();
            hourlyData[hour].count++;
        });

        const activeHours = hourlyData.filter((_, i) => i >= 7 && i <= 18); 

        const statObj = {
            totalStudents,
            presentCount,
            absentCount: absentCount < 0 ? 0 : absentCount,
            attendanceRate: totalStudents ? Math.round((presentCount / totalStudents) * 100) : 0,
            activeHours
        };
        
        setStats(statObj);
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading analytics...</div>;

    const dataPie = [
        { name: 'Present', value: stats.presentCount, color: '#22c55e' },
        { name: 'Absent', value: stats.absentCount, color: '#ef4444' },
    ];

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full pb-20">
            <h2 className="text-2xl font-bold text-white mb-4">Live Dashboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm">Total Students</p>
                            <h3 className="text-3xl font-bold text-white mt-1">{stats.totalStudents}</h3>
                        </div>
                        <div className="p-2 bg-slate-700 rounded-lg text-primary-400"><Users size={20} /></div>
                    </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm">Present Today</p>
                            <h3 className="text-3xl font-bold text-green-400 mt-1">{stats.presentCount}</h3>
                        </div>
                        <div className="p-2 bg-slate-700 rounded-lg text-green-400"><Activity size={20} /></div>
                    </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm">Attendance Rate</p>
                            <h3 className="text-3xl font-bold text-blue-400 mt-1">{stats.attendanceRate}%</h3>
                        </div>
                        <div className="p-2 bg-slate-700 rounded-lg text-blue-400"><Activity size={20} /></div>
                    </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm">Absent</p>
                            <h3 className="text-3xl font-bold text-red-400 mt-1">{stats.absentCount}</h3>
                        </div>
                        <div className="p-2 bg-slate-700 rounded-lg text-red-400"><Activity size={20} /></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Hourly Influx</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.activeHours}>
                                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    cursor={{fill: '#334155'}}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Daily Breakdown</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {dataPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};