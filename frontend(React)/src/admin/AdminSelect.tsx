import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

export type AdminSelectOption<T extends string = string> = {
  value: T
  label: string
}

type AdminSelectProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: readonly AdminSelectOption<T>[]
  className?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={open ? 'admin-select__chevron-svg admin-select__chevron-svg--open' : 'admin-select__chevron-svg'}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AdminSelect<T extends string>({
  value,
  onChange,
  options,
  className,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: AdminSelectProps<T>) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 8
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      zIndex: 10000,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    const onReflow = () => updateMenuPosition()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onOtherOpen = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail !== listId) setOpen(false)
    }
    document.addEventListener('admin-select-open', onOtherOpen)
    document.dispatchEvent(new CustomEvent('admin-select-open', { detail: listId }))
    return () => document.removeEventListener('admin-select-open', onOtherOpen)
  }, [open, listId])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      const menu = document.getElementById(listId)
      if (menu?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, listId])

  const pickOption = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      onChange(option.value)
      setOpen(false)
      setHighlightIndex(-1)
      triggerRef.current?.focus()
    },
    [onChange, options],
  )

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0)
        return
      }
      if (event.key === 'ArrowDown') {
        setHighlightIndex((current) => {
          const next = current < 0 ? 0 : Math.min(options.length - 1, current + 1)
          return next
        })
      }
    }
    if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      setHighlightIndex((current) => Math.max(0, current <= 0 ? 0 : current - 1))
    }
    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((current) => Math.min(options.length - 1, (current < 0 ? -1 : current) + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((current) => Math.max(0, current - 1))
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (highlightIndex >= 0) pickOption(highlightIndex)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const rootClass = ['admin-select', open ? 'admin-select--open' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  const menu = open ? (
    <ul
      id={listId}
      role="listbox"
      className="admin-select__menu"
      style={menuStyle}
      aria-label={ariaLabel}
      onKeyDown={onMenuKeyDown}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        const isHighlighted = index === highlightIndex
        return (
          <li key={option.value} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className={[
                'admin-select__option',
                isSelected ? 'admin-select__option--selected' : '',
                isHighlighted ? 'admin-select__option--highlighted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => pickOption(index)}
            >
              <span>{option.label}</span>
              {isSelected ? (
                <span className="admin-select__check" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  ) : null

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="admin-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? selected?.label}
        onClick={() => {
          if (disabled) return
          setOpen((wasOpen) => {
            const next = !wasOpen
            if (next) {
              document.dispatchEvent(new CustomEvent('admin-select-open', { detail: listId }))
              setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0)
            }
            return next
          })
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="admin-select__value">{selected?.label ?? value}</span>
        <span className="admin-select__chevron" aria-hidden>
          <IconChevronDown open={open} />
        </span>
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
