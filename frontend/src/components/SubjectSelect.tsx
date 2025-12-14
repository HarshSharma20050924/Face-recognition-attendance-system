import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Faculty, Subject } from '../types';
import { BookOpen, ArrowRight, Loader2 } from 'lucide-react';

interface SubjectSelectProps {
    faculty: Faculty;
    onSelect: (subject: string) => void;
}

export const SubjectSelect: React.FC<SubjectSelectProps> = ({ faculty, onSelect }) => {
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const subs = await api.getSubjects();
                setAllSubjects(subs);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Filter subjects:
    // If Admin (ID=ADMIN), show all subjects.
    // Otherwise show only subjects assigned to this faculty.
    const availableSubjects = faculty.id === 'ADMIN' 
        ? allSubjects 
        : allSubjects.filter(s => faculty.subjects.includes(s.abbr));

    if (loading) {
        return (
            <div className="h-full bg-slate-950 flex items-center justify-center text-slate-500">
                <Loader2 className="animate-spin mr-2" /> Loading Subjects...
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-950 p-8 flex flex-col items-center justify-center">
            <div className="max-w-5xl w-full">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-white mb-2">Welcome, {faculty.name}</h2>
                    <p className="text-slate-400">Select the lecture to start attendance session</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableSubjects.map(sub => (
                        <button
                            key={sub.code}
                            onClick={() => onSelect(sub.abbr)}
                            className="group relative bg-slate-900 border border-slate-800 hover:border-primary-500 p-8 rounded-3xl text-left transition-all hover:shadow-2xl hover:shadow-primary-900/20 hover:-translate-y-1"
                        >
                            <div className="absolute top-8 right-8 text-slate-700 group-hover:text-primary-500 transition-colors bg-slate-800 group-hover:bg-primary-900/20 p-3 rounded-full">
                                <BookOpen size={24} />
                            </div>
                            <div className="text-xs font-mono text-primary-500 mb-3 bg-primary-900/10 inline-block px-2 py-1 rounded border border-primary-900/30">{sub.code}</div>
                            <h3 className="text-2xl font-bold text-white mb-2">{sub.abbr}</h3>
                            <p className="text-slate-400 text-sm font-medium">{sub.name}</p>
                            
                            <div className="mt-8 flex items-center gap-2 text-sm text-slate-500 group-hover:text-white transition-colors font-bold uppercase tracking-wider">
                                Start Session <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}
                    
                    {availableSubjects.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-center text-slate-500 py-16 border-2 border-dashed border-slate-800 rounded-3xl">
                            <BookOpen size={48} className="mb-4 text-slate-700"/>
                            <p className="text-lg text-slate-400">No subjects assigned.</p>
                            <p className="text-sm">Please contact the Administrator to assign subjects to your ID.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};