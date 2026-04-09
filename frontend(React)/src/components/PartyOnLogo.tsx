import './PartyOnLogo.css'

type PartyOnLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  className?: string
}

export function PartyOnLogo({ size = 'md', centered = false, className = '' }: PartyOnLogoProps) {
  const classes = [
    'partyon-logo',
    `partyon-logo--${size}`,
    centered ? 'partyon-logo--centered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} aria-label="PartyOn logo">
      <span className="partyon-logo__ball-wrap" aria-hidden="true">
        <span className="partyon-logo__ball-glow" />
        <span className="partyon-logo__ball-shell">
          <img className="partyon-logo__ball-image" src="/disco-ball.png" alt="" />
        </span>
      </span>

      <span className="partyon-logo__text">
        <span className="partyon-logo__party">Party</span>
        <span className="partyon-logo__on">On</span>
      </span>
    </div>
  )
}
