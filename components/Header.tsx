import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-green-600 text-white p-6 shadow-lg rounded-b-[32px] mb-2 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">QA Offline</h1>
          <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest">100% Offline Reporting</p>
        </div>
      </div>
    </header>
  );
};

export default Header;