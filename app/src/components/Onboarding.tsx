import { useState } from 'react';

const STEPS = [
  {
    icon: 'waving_hand',
    title: 'Welcome to Basil Daily',
    body: 'Your all-in-one personal productivity app. Tasks, notes, habits, finance, calendar — all in one place, all private.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: 'task_alt',
    title: 'Tasks like Jira, but for life',
    body: 'Organize work into Epics → Stories → Tasks. Use sprints to plan your week, drag to reorder, and track due dates on the calendar.',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
  },
  {
    icon: 'sync',
    title: 'Your data, on your Google Drive',
    body: 'Connect a Google account to sync across devices. Your backup lives in your own Drive — no third-party servers ever see your data.',
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  {
    icon: 'dark_mode',
    title: 'A few quick tips',
    body: 'Pull down to sync • Toggle dark/light mode in Settings • Search across everything with the 🔍 button • Set habit reminder times to get nudged at the right moment.',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
];

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-6 animate-fade-in">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-3xl ${current.bg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-[40px] ${current.color} icon-fill`}>
            {current.icon}
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="font-manrope font-bold text-2xl text-on-surface">{current.title}</h1>
          <p className="font-work-sans text-base text-on-surface-variant leading-relaxed">{current.body}</p>
        </div>

        {/* Step dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-outline-variant'}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => {
              if (isLast) onDone();
              else setStep(s => s + 1);
            }}
            className="w-full py-3.5 bg-primary text-on-primary rounded-2xl font-inter font-semibold text-base"
          >
            {isLast ? "Let's go!" : 'Next'}
          </button>
          {!isLast && (
            <button
              onClick={onDone}
              className="w-full py-2 font-inter text-sm text-on-surface-variant"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
