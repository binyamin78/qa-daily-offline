
import React from 'react';
import { FormData } from '../types';

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;

const RequiredMark = () => <span className="text-red-600 mr-0.5">*</span>;

interface NumberStepperProps {
  name: keyof FormData;
  label: string;
  value: string;
  isError: boolean;
  onUpdate: (name: keyof FormData, delta: number) => void;
  onChange: ChangeHandler;
  min?: number;
  max?: number;
  helper?: string;
  isRequired?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({ name, label, value, isError, onUpdate, onChange, min = 0, max = 999, helper, isRequired = true }) => {
  const current = parseInt(value || '0', 10);
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={name} className="text-[14px] font-extrabold text-gray-900 text-right leading-tight break-words px-1">
        {label} {isRequired && <RequiredMark />}
      </label>
      <div className={`flex items-center justify-between w-full bg-white p-1 rounded-2xl border-2 transition-all shadow-sm ${isError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
        <button
          type="button"
          aria-label="הוסף"
          onClick={() => onUpdate(name, 1)}
          disabled={current >= max}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-green-50 text-green-700 font-bold text-lg hover:bg-green-100 active:scale-90 transition-all disabled:opacity-30"
        >+</button>
        <input
          id={name}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={onChange}
          className="flex-1 text-center font-black text-xl text-gray-900 px-0.5 bg-transparent outline-none w-12 min-w-0"
        />
        <button
          type="button"
          aria-label="הפחת"
          onClick={() => onUpdate(name, -1)}
          disabled={current <= min}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600 font-bold text-lg hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-30"
        >-</button>
      </div>
      {helper && <p className="text-[11px] text-gray-500 font-medium text-right leading-tight pr-1 break-words">{helper}</p>}
    </div>
  );
};

interface FormInputProps {
  name: keyof FormData;
  label: string;
  value: string;
  isError: boolean;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  helper?: React.ReactNode;
  isTextArea?: boolean;
  onChange: ChangeHandler;
  isRequired?: boolean;
  maxLength?: number;
}

export const FormInput: React.FC<FormInputProps> = ({ name, label, value, isError, placeholder, type = "text", inputMode, helper, isTextArea, onChange, isRequired = true, maxLength }) => {
  const fieldClass = `w-full p-4 bg-white border-2 rounded-2xl focus:border-green-600 outline-none transition-all font-bold text-lg text-gray-900 text-right ${isError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;
  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-col px-1 text-right">
        <label htmlFor={name} className="text-lg font-extrabold text-gray-900 break-words">
          {label} {isRequired && <RequiredMark />}
        </label>
      </div>
      {isTextArea ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          rows={3}
          maxLength={maxLength}
          className={`${fieldClass} resize-y min-h-[6rem]`}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className={`${fieldClass} ${type === 'date' ? 'min-h-[3.75rem]' : ''}`}
          placeholder={placeholder}
        />
      )}
      {isError && <p className="text-xs text-red-600 font-bold pr-1 text-right">שדה חובה</p>}
      {helper && <div className="text-xs text-gray-500 font-bold pr-1 text-right break-words">{helper}</div>}
    </div>
  );
};
