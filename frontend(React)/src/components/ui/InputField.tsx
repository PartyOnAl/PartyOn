import type { InputHTMLAttributes } from 'react'
import './InputField.css'

export type InputFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id'
> & {
  id: string
  label: string
}

export function InputField({ id, label, className = '', ...rest }: InputFieldProps) {
  return (
    <div className={['po-field', className].filter(Boolean).join(' ')}>
      <label className="po-field__label" htmlFor={id}>
        {label}
      </label>
      <input className="po-field__input" id={id} {...rest} />
    </div>
  )
}
