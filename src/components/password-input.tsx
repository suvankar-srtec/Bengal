"use client";

import { useState, type ChangeEventHandler } from "react";

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  required = false,
  minLength,
  maxLength,
  autoFocus = false,
}: {
  id?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return <div className="password-input-wrap">
    <input
      id={id}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      autoFocus={autoFocus}
    />
    <button
      className="password-visibility-toggle"
      type="button"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      title={visible ? "Hide password" : "Show password"}
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.4 9 8 0 1-.5 2.2-1.5 3.5" />
          <path d="M6.2 6.2C4.1 7.6 3 10.2 3 12c0 2.6 3.5 8 9 8 1.6 0 3-.5 4.2-1.2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      )}
    </button>
  </div>;
}
