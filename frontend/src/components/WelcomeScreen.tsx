
import React from 'react';
import { Play } from 'lucide-react';
import { IS_DEMO_MODE } from '../services/api';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  // Use logo.svg for Demo/Vercel, fall back to logo.png for local dev
  const logoSrc = IS_DEMO_MODE ? "/logo.svg" : "/logo.png";

  return (
    <div className="h-full flex flex-col items-center justify-between bg-white text-slate-900 p-8 animate-in fade-in duration-700">
      
      {/* Top Spacer to center content visually */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-12">
        
        {/* Logo & Header Section */}
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo Container */}
          <div className="w-40 h-40 md:w-56 md:h-56 relative flex items-center justify-center">
             <img 
               src={logoSrc} 
               alt="College Logo" 
               className="max-w-full max-h-full object-contain drop-shadow-lg"
               onError={(e) => {
                   // If logo fails (e.g. local logo.png missing), fallback to SVG or placeholder
                   if (e.currentTarget.src.includes('png')) {
                       e.currentTarget.src = '/logo.svg';
                   } else {
                       e.currentTarget.style.display = 'none';
                       const parent = e.currentTarget.parentElement;
                       if (parent && !parent.querySelector('.placeholder')) {
                            const div = document.createElement('div');
                            div.className = "placeholder w-full h-full flex items-center justify-center bg-gray-100 rounded-full border-4 border-red-600 text-red-600 font-bold p-4 text-xs";
                            div.innerText = "Logo";
                            parent.appendChild(div);
                       }
                   }
               }}
             />
          </div>

          {/* Text Section */}
          <div className="space-y-2 max-w-2xl">
             <h1 className="text-xl md:text-3xl font-serif font-bold text-slate-900 tracking-wide">
                Department of Artificial Intelligence and Data Science
             </h1>
             {/* Only show college name if NOT in demo/vercel mode */}
             {!IS_DEMO_MODE && (
                 <h2 className="text-lg md:text-2xl font-medium text-slate-700 mt-2">
                    Mahakal Institute of Technology, Ujjain
                 </h2>
             )}
          </div>
        </div>

        {/* Start Button */}
        <button 
          onClick={onStart}
          className="group relative px-10 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-full shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 text-xl tracking-wider uppercase"
        >
          <span>Start Attendance</span>
          <div className="bg-white/20 rounded-full p-1 group-hover:bg-white/30 transition-colors">
            <Play size={24} fill="currentColor" />
          </div>
        </button>

      </div>

      {/* Footer */}
      <div className="text-slate-400 text-sm font-mono tracking-widest border-t border-slate-100 w-full text-center pt-6 pb-2">
        Created by Harsh batch 2023 AD
      </div>
    </div>
  );
};
