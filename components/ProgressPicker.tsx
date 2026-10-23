
import React, { useState } from 'react';

interface ProgressPickerProps {
  onSelect: (value: number) => void;
  onClose: () => void;
}

// Two taps: tens, then ones (or 100 directly)
const ProgressPicker: React.FC<ProgressPickerProps> = ({ onSelect, onClose }) => {
  const [tens, setTens] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white w-full max-w-xs rounded-[40px] p-8 animate-in shadow-2xl text-center" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="text-2xl font-black mb-6">{tens === null ? 'בחר עשרות' : `בחר יחידות ל-${tens}%`}</h3>
        <div className="grid grid-cols-3 gap-3" dir="ltr">
          {tens === null ? (
            <>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
                <button key={v} onClick={() => setTens(v)} className="p-4 bg-gray-100 rounded-2xl font-black text-xl hover:bg-green-100 active:scale-95">{v}</button>
              ))}
              <button onClick={() => onSelect(100)} className="col-span-2 p-4 bg-green-600 text-white rounded-2xl font-black text-xl active:scale-95">100%</button>
            </>
          ) : (
            <>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => (
                <button key={v} onClick={() => onSelect(tens + v)} className="p-4 bg-gray-100 rounded-2xl font-black text-xl hover:bg-green-100 active:scale-95">{tens + v}</button>
              ))}
              <button onClick={() => setTens(null)} className="col-span-2 p-4 bg-gray-200 rounded-2xl font-bold">חזור</button>
            </>
          )}
        </div>
        <button onClick={onClose} className="mt-5 w-full text-gray-500 font-bold py-2">ביטול</button>
      </div>
    </div>
  );
};

export default ProgressPicker;
