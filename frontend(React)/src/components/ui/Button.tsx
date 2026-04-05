import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'outline'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={['po-btn', `po-btn--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
