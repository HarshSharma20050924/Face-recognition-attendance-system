export interface Faculty {
    id: string;
    name: string;
    pin: string; // The pin to unlock the system
    subjects: string[];
}

export interface Subject {
    code: string;
    name: string;
    abbr: string;
}

// Data extracted from Mahakal Institute of Technology Timetable (AI&DS)
export const SUBJECTS: Subject[] = [
    { abbr: 'TOC', code: 'AD-501', name: 'Theory of Computation' },
    { abbr: 'ML', code: 'AD-502', name: 'Machine Learning' },
    { abbr: 'IWT', code: 'AD-503 (A)', name: 'Internet & Web Tech' },
    { abbr: 'GT', code: 'AD-504 (B)', name: 'Game Theory' },
    { abbr: 'IWT LAB', code: 'AD-505', name: 'IWT Lab' },
    { abbr: 'LINUX', code: 'AD-506', name: 'Linux Lab' },
    { abbr: 'MP-I', code: 'AD-508', name: 'Minor Project-I' },
    { abbr: 'APT', code: 'APT', name: 'Aptitude' },
];

export const FACULTY: Faculty[] = [
    { id: 'NS', name: 'Prof. Neeraj Sharma', pin: '1111', subjects: ['TOC'] },
    { id: 'KA', name: 'Dr. Kamlesh Ahuja', pin: '2222', subjects: ['ML'] },
    { id: 'PM', name: 'Prof. Priyanka Maheshwari', pin: '3333', subjects: ['IWT', 'IWT LAB', 'MP-I'] },
    { id: 'CS', name: 'Prof. Chandni Sikarwar', pin: '4444', subjects: ['GT'] },
    { id: 'PD', name: 'Prof. Priya Dohre', pin: '5555', subjects: ['LINUX'] },
    { id: 'MS', name: 'Prof. Manish Shrivastava', pin: '6666', subjects: ['APT'] },
    // Master Pin for Lab Assistants or emergencies
    { id: 'ADMIN', name: 'Lab Admin', pin: '0000', subjects: ['TOC', 'ML', 'IWT', 'GT', 'IWT LAB', 'LINUX', 'MP-I', 'APT'] }
];
