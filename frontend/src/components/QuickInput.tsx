import React, { useEffect, useRef, useState } from 'react';

interface QuickInputProps {
  isOpen: boolean;
  type: 'input' | 'confirm';
  title: string;
  placeholder?: string;
  defaultValue?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

export default function QuickInput({
  isOpen,
  type,
  title,
  placeholder = '',
  defaultValue = '',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: QuickInputProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (type === 'input') {
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="quick-input-overlay" onClick={onCancel}>
      <div 
        className="quick-input-container" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-input-title">{title}</div>
        
        {message && <div className="quick-input-body">{message}</div>}

        {type === 'input' && (
          <input
            ref={inputRef}
            type="text"
            className="quick-input-textbox"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
          />
        )}

        <div className="quick-input-actions">
          <button 
            type="button"
            className="quick-input-btn secondary" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            type="button"
            className={`quick-input-btn ${type === 'confirm' ? 'danger' : 'primary'}`}
            onClick={handleSubmit}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
