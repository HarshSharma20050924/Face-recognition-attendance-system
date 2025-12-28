import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Subject } from '../types';
import { Plus, Trash2, CalendarClock, Book } from 'lucide-react';

export const TimetableManager: React.FC = () => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    
    // Form State
    const [newCode, setNewCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newAbbr, setNewAbbr] = useState('');

    useEffect(() => {
        loadSubjects();
    }, []);

    const loadSubjects = async () => {
        const list = await api.getSubjects();
        setSubjects(list);
    };

    const handleSave = async () => {
        if (!newCode || !newName || !newAbbr) return;
        
        const sub: Subject = {
            code: newCode,
            name: newName,
            abbr: newAbbr.toUpperCase()
        };

        await api.addSubject(sub);
        
        setNewCode('');
        setNewName('');
        setNewAbbr('');
        setIsAdding(false);
        loadSubjects();
    };

    const handleDelete = async (abbr: string) => {
        // FIX: Use window.confirm to bypass no-restricted-globals
        if(window.confirm(`Delete subject ${abbr}? This may affect attendance records.`)) {
            await api.deleteSubject(abbr);
            loadSubjects();
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CalendarClock /> Subject Management
                </h2>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    {isAdding ? 'Cancel' : <><Plus size={18} /> Add Subject</>}
                </button>
            </div>

            {isAdding && (
                <div className="bg-slate-850 border border-slate-700 p-6 rounded-xl animate-in slide-in-from-top-4 shadow-lg">
                    <h3 className="text-lg font-semibold text-primary-400 mb-4 flex items-center gap-2"><Book size={18}/> New Subject Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Abbreviation</label>
                            <input 
                                value={newAbbr}
                                onChange={e => setNewAbbr(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500 font-mono"
                                placeholder="e.g. TOC"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Subject Code</label>
                            <input 
                                value={newCode}
                                onChange={e => setNewCode(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500"
                                placeholder="e.g. AD-501"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Full Name</label>
                            <input 
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500"
                                placeholder="e.g. Theory of Computation"
                            />
                        </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                        <button 
                            disabled={!newCode || !newName || !newAbbr}
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-8 py-2.5 rounded-lg font-bold transition-colors shadow-lg"
                        >
                            Save Subject
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map(sub => (
                    <div key={sub.code} className="bg-slate-850 p-6 rounded-xl border border-slate-800 flex items-start justify-between group hover:border-slate-600 transition-all">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-xs text-primary-400 px-2 py-0.5 bg-primary-900/30 rounded border border-primary-900/50">
                                    {sub.code}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-white">{sub.abbr}</h3>
                            <p className="text-sm text-slate-400">{sub.name}</p>
                        </div>
                        <button 
                            onClick={() => handleDelete(sub.abbr)}
                            className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full hover:bg-red-500/10"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>
            
            {subjects.length === 0 && (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                    No subjects defined. Add one to get started.
                </div>
            )}
        </div>
    );
};