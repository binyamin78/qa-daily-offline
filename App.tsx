
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import { FormData, AppSettings } from './types';
import { generateOfflineReport } from './services/offlineReportService';

// --- Sub-components ---

interface NumberStepperProps {
  name: keyof FormData;
  label: string;
  value: string;
  isError: boolean;
  onUpdate: (name: keyof FormData, delta: number) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  min?: number;
  helper?: string;
  isRequired?: boolean;
}

const NumberStepper: React.FC<NumberStepperProps> = ({ name, label, value, isError, onUpdate, onChange, min = 0, helper, isRequired = true }) => (
  <div className="flex flex-col gap-2 min-w-0">
    <label className="text-[14px] font-extrabold text-gray-900 text-right leading-tight break-words px-1">
      {label} {isRequired && <span className="text-red-600 mr-0.5">*</span>}
    </label>
    <div className={`flex items-center justify-between w-full bg-white p-1 rounded-2xl border-2 transition-all shadow-sm ${isError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
      <button 
        type="button"
        onClick={() => onUpdate(name, -1)} 
        disabled={parseInt(value || '0') <= min}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600 font-bold text-lg hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-30"
      >-</button>
      <input 
        name={name}
        type="number"
        value={value}
        onChange={onChange}
        className="flex-1 text-center font-black text-xl text-gray-900 px-0.5 bg-transparent outline-none w-12 min-w-0"
      />
      <button 
        type="button"
        onClick={() => onUpdate(name, 1)} 
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-50 text-green-700 font-bold text-lg hover:bg-green-100 active:scale-90 transition-all"
      >+</button>
    </div>
    {helper && <p className="text-[11px] text-gray-500 font-medium text-right leading-tight pr-1 break-words">{helper}</p>}
  </div>
);

interface FormInputProps {
  name: keyof FormData;
  label: string;
  value: string;
  isError: boolean;
  placeholder: string;
  type?: string;
  helper?: string;
  isTextArea?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  isRequired?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ name, label, value, isError, placeholder, type = "text", helper, isTextArea, onChange, isRequired = true }) => (
  <div className="space-y-2 w-full">
    <div className="flex flex-col px-1 text-right">
      <label className="text-lg font-extrabold text-gray-900 break-words">
        {label} {isRequired && <span className="text-red-600 mr-0.5">*</span>}
      </label>
    </div>
    {isTextArea ? (
      <textarea 
        name={name} 
        value={value} 
        onChange={onChange} 
        rows={3} 
        className={`w-full p-4 bg-white border-2 rounded-2xl focus:border-green-600 outline-none transition-all font-bold text-lg text-gray-900 text-right resize-none ${isError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} 
        placeholder={placeholder} 
      />
    ) : (
      <input 
        name={name} 
        type={type}
        value={value} 
        onChange={onChange} 
        className={`w-full p-4 bg-white border-2 rounded-2xl focus:border-green-600 outline-none transition-all font-bold text-lg text-gray-900 text-right ${isError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} 
        placeholder={placeholder} 
      />
    )}
    {helper && <p className="text-xs text-gray-500 font-bold pr-1 text-right break-words">{helper}</p>}
  </div>
);

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('qa_app_settings');
    return saved ? JSON.parse(saved) : { defaultProjectName: '', defaultVersion: '', customProjects: [] };
  });

  const getInitialFormData = (): FormData => ({
    projectName: settings.defaultProjectName || '',
    version: settings.defaultVersion || '',
    checkedAreas: '',
    newJiraBugs: '0',
    blockers: 'אין',
    openIssues: '',
    estimatedCompletion: '',
    progressPercentage: '0'
  });

  const [formData, setFormData] = useState<FormData>(() => {
    const saved = localStorage.getItem('daily_qa_form_draft');
    if (saved) return JSON.parse(saved);
    return getInitialFormData();
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [progressStep, setProgressStep] = useState<'tens' | 'ones'>('tens');
  const [tempTens, setTempTens] = useState(0);
  const [newProjectName, setNewProjectName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editableText, setEditableText] = useState('');

  const allProjects = settings.customProjects || [];

  useEffect(() => { localStorage.setItem('daily_qa_form_draft', JSON.stringify(formData)); }, [formData]);
  useEffect(() => { localStorage.setItem('qa_app_settings', JSON.stringify(settings)); }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    if (name === 'version') {
      value = value.replace(/\D/g, '').split('').join('.');
    }

    const numericFields = ['newJiraBugs', 'progressPercentage'];
    if (numericFields.includes(name)) {
      value = value.replace(/\D/g, '');
      if (name === 'progressPercentage') {
        const val = parseInt(value, 10);
        if (val > 100) value = '100';
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => prev.filter(f => f !== name));
  };

  const executeClearForm = () => {
    setFormData(getInitialFormData());
    setValidationErrors([]);
    localStorage.removeItem('daily_qa_form_draft');
    setShowClearConfirm(false);
    setErrorMessage("הטופס נוקה בהצלחה 🧹");
    setTimeout(() => setErrorMessage(null), 2000);
  };

  const updateNumber = (name: keyof FormData, delta: number) => {
    const current = parseInt(formData[name] || '0', 10);
    let next = isNaN(current) ? 0 : current + delta;
    if (name === 'progressPercentage') next = Math.max(0, Math.min(100, next));
    else next = Math.max(0, next);
    setFormData(prev => ({ ...prev, [name]: next.toString() }));
    setValidationErrors(prev => prev.filter(f => f !== name));
  };

  const selectTens = (val: number) => {
    if (val === 100) {
      setFormData(prev => ({ ...prev, progressPercentage: '100' }));
      setShowProgressModal(false);
    } else {
      setTempTens(val);
      setProgressStep('ones');
    }
  };

  const selectOnes = (val: number) => {
    const total = tempTens + val;
    setFormData(prev => ({ ...prev, progressPercentage: total.toString() }));
    setShowProgressModal(false);
  };

  const deleteProject = (proj: string) => {
    setSettings(prev => ({
      ...prev,
      customProjects: prev.customProjects.filter(p => p !== proj)
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editableText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSendToWhatsApp = () => {
    const encodedText = encodeURIComponent(editableText);
    const whatsappUrl = `whatsapp://send?text=${encodedText}`;
    navigator.clipboard.writeText(editableText);
    window.location.href = whatsappUrl;
  };

  const prepareForReview = () => {
    const required: (keyof FormData)[] = ['projectName', 'checkedAreas', 'estimatedCompletion', 'progressPercentage'];
    const missing = required.filter(key => !formData[key] || formData[key].toString().trim() === '');
    
    if (missing.length > 0) {
      setValidationErrors(missing);
      setErrorMessage("נא למלא את שדות החובה (*)");
      return;
    }

    setErrorMessage(null);
    const result = generateOfflineReport(formData);
    setEditableText(result);
    setIsReviewMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col w-full max-w-lg mx-auto bg-gray-50 border-x border-gray-200 pb-40 relative font-['Assistant'] overflow-x-hidden">
      <Header />
      
      <div className="px-4 py-4 flex flex-wrap gap-2 justify-between items-center z-10">
        {!showClearConfirm ? (
          <button onClick={() => setShowClearConfirm(true)} className="bg-red-50 text-red-600 text-xs font-black py-2.5 px-5 rounded-full border border-red-100 active:scale-95">🗑️ נקה</button>
        ) : (
          <div className="flex gap-2 animate-in">
            <button onClick={executeClearForm} className="bg-red-600 text-white text-xs font-black py-2.5 px-5 rounded-full active:scale-95">בטוח? מחק!</button>
            <button onClick={() => setShowClearConfirm(false)} className="bg-gray-100 text-gray-600 text-xs font-black py-2.5 px-5 rounded-full active:scale-95">ביטול</button>
          </div>
        )}
        <button onClick={() => setShowSettings(true)} className="bg-white border border-gray-300 text-xs font-black py-2.5 px-5 rounded-full active:scale-95">⚙️ הגדרות</button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 animate-in shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black mb-6 text-right">הגדרות פרויקטים</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 text-right">גרסת ברירת מחדל</label>
                <input type="text" value={settings.defaultVersion} onChange={(e) => setSettings(s => ({...s, defaultVersion: e.target.value}))} className="w-full p-3 bg-gray-50 border-2 rounded-xl font-bold text-right" placeholder="1.2.3" />
              </div>
              <div className="pt-4 border-t">
                <label className="block text-sm font-bold text-gray-600 mb-2 text-right">ניהול רשימת פרויקטים</label>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="שם הפרויקט..." className="flex-1 p-3 bg-gray-50 border-2 rounded-xl text-right font-bold" />
                  <button onClick={() => { if(newProjectName.trim()) { setSettings(s => ({...s, customProjects: [...(s.customProjects || []), newProjectName.trim()]})); setNewProjectName(''); }}} className="bg-green-600 text-white px-5 rounded-xl font-black text-xl">+</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {settings.customProjects?.length > 0 ? settings.customProjects.map(p => (
                    <div key={p} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <span className="font-bold truncate ml-2 text-right w-full text-gray-800">{p}</span>
                      <button onClick={() => deleteProject(p)} className="text-red-500 text-xs font-black px-3 py-1.5 bg-red-50 rounded-lg border border-red-100 active:scale-90">מחק</button>
                    </div>
                  )) : (
                    <p className="text-center text-gray-400 py-4 font-bold italic">אין פרויקטים ברשימה</p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg">סגור ושמור</button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-xs rounded-[40px] p-8 animate-in shadow-2xl text-center">
            <h3 className="text-2xl font-black mb-6">{progressStep === 'tens' ? 'בחר עשרות' : `בחר יחידות ל-${tempTens}%`}</h3>
            <div className="grid grid-cols-3 gap-3">
              {progressStep === 'tens' ? (
                <>
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => (
                    <button key={v} onClick={() => selectTens(v)} className="p-4 bg-gray-100 rounded-2xl font-black text-xl hover:bg-green-100">{v}</button>
                  ))}
                  <button onClick={() => selectTens(100)} className="col-span-2 p-4 bg-green-600 text-white rounded-2xl font-black text-xl">100%</button>
                </>
              ) : (
                <>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => (
                    <button key={v} onClick={() => selectOnes(v)} className="p-4 bg-gray-100 rounded-2xl font-black text-xl hover:bg-green-100">{v}</button>
                  ))}
                  <button onClick={() => setProgressStep('tens')} className="col-span-2 p-4 bg-gray-200 rounded-2xl font-bold">חזור</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 space-y-6" dir="rtl">
        {!isReviewMode ? (
          <div className="space-y-6 animate-in">
            {/* סעיף 1: כללי */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">פרטים וגרסה</h2></div>
              <div className="space-y-2 text-right">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-lg font-extrabold text-gray-900 px-1">שם פרויקט <span className="text-red-600">*</span></label>
                  {allProjects.length === 0 && (
                    <button onClick={() => setShowSettings(true)} className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100 underline decoration-2">לחץ להוספת פרויקט</button>
                  )}
                </div>
                <select name="projectName" value={formData.projectName} onChange={handleInputChange} className={`w-full p-4 bg-white border-2 rounded-2xl font-bold text-lg appearance-none text-right ${validationErrors.includes('projectName') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                  <option value="">{allProjects.length === 0 ? '-- אין פרויקטים ברשימה --' : 'בחר פרויקט...'}</option>
                  {allProjects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <FormInput name="version" label="גרסה" value={formData.version} isError={false} placeholder="1.2.3" onChange={handleInputChange} isRequired={false} />
            </div>

            {/* סעיף 2: התקדמות וצפי */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">התקדמות וזמנים</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 text-right">
                  <label className="text-lg font-extrabold text-gray-900 px-1">אחוז התקדמות <span className="text-red-600">*</span></label>
                  <div className="flex gap-2">
                    <input name="progressPercentage" type="number" value={formData.progressPercentage} onChange={handleInputChange} className={`flex-1 min-w-0 p-4 bg-white border-2 rounded-2xl font-bold text-lg text-center ${validationErrors.includes('progressPercentage') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                    <button onClick={() => { setProgressStep('tens'); setShowProgressModal(true); }} className="bg-green-50 text-green-700 border-2 border-green-200 rounded-2xl px-4 font-black">🔢</button>
                  </div>
                </div>
                <FormInput name="estimatedCompletion" type="date" label="צפי סיום" value={formData.estimatedCompletion} isError={validationErrors.includes('estimatedCompletion')} placeholder="" onChange={handleInputChange} />
              </div>
            </div>

            {/* סעיף 3: מה נעשה היום */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-green-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">מה נבדק היום?</h2></div>
              <FormInput name="checkedAreas" label="אזורים שנבדקו" value={formData.checkedAreas} isError={validationErrors.includes('checkedAreas')} placeholder="פירוט תהליכים ומסכים..." isTextArea onChange={handleInputChange} helper="מה בדקת בפועל במהלך היום?" />
            </div>

            {/* סעיף 4: באגים וסיכונים */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-200 shadow-sm space-y-6">
              <div className="border-r-4 border-red-600 pr-3 text-right"><h2 className="text-lg font-black text-gray-900">באגים וסיכונים</h2></div>
              <NumberStepper name="newJiraBugs" label="באגים חדשים ב-Jira" value={formData.newJiraBugs} isError={false} onUpdate={updateNumber} onChange={handleInputChange} isRequired={false} />
              <FormInput name="blockers" label="חוסמים (Blockers)" value={formData.blockers} isError={false} placeholder="פרט חוסמים או 'אין'" onChange={handleInputChange} isRequired={false} helper="מה מפריע לך להתקדם?" />
              <FormInput name="openIssues" label="נושאים פתוחים" value={formData.openIssues} isError={false} placeholder="נושאים למעקב..." isTextArea onChange={handleInputChange} isRequired={false} helper="דברים שעדיין מחכים למענה." />
            </div>

            <button onClick={prepareForReview} className="w-full bg-green-600 text-white font-black py-6 rounded-[24px] shadow-xl active:scale-95 transition-all text-xl">תצוגה מקדימה וייצור דוח ✨</button>
          </div>
        ) : (
          <div className="space-y-6 animate-in">
            <div className="bg-white p-6 rounded-[40px] border-4 border-green-600 shadow-2xl space-y-6">
              <h3 className="text-xl font-black text-center">הדוח המקוצר מוכן! 🚀</h3>
              <textarea value={editableText} onChange={(e) => setEditableText(e.target.value)} className="w-full h-80 p-5 bg-gray-50 border-2 rounded-2xl font-bold text-lg text-right leading-relaxed" dir="rtl" />
              <div className="flex flex-col gap-3">
                <button onClick={copyToClipboard} className={`w-full py-5 rounded-2xl font-black text-lg shadow-md transition-all ${copySuccess ? 'bg-yellow-400 text-green-900' : 'bg-gray-800 text-white'}`}>
                  {copySuccess ? 'הועתק! ✅' : 'העתק דוח ללוח 📋'}
                </button>
                <button onClick={handleSendToWhatsApp} className="w-full py-5 rounded-2xl font-black text-lg shadow-md bg-green-600 text-white">שתף בוואטסאפ 🚀</button>
                <button onClick={() => setIsReviewMode(false)} className="w-full text-gray-500 font-bold py-2">← חזור לעריכה</button>
              </div>
            </div>
          </div>
        )}
      </main>
      {errorMessage && (
        <div className="fixed bottom-24 left-4 right-4 bg-gray-900/90 text-white p-4 rounded-2xl shadow-lg z-[250] text-center font-bold animate-in">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default App;
