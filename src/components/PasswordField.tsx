import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string | null
}

export function PasswordField({ label, error, id, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className="text-field"
          style={{ paddingRight: 44 }}
          autoComplete="current-password"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            padding: 8,
            display: 'flex',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
