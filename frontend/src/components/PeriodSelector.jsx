export default function PeriodSelector({ value, onChange, choices }) {
  return (
    <div className="flex gap-1 bg-[var(--color-card)] rounded-lg p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          onClick={() => onChange(choice.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === choice.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}
