import './PartyOnLogo.css'

type PartyOnLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  /** When false, only the wordmark is shown (matches header typography without the disco ball). */
  showDiscoBall?: boolean
  className?: string
}

export function PartyOnLogo({
  size = 'md',
  centered = false,
  showDiscoBall = true,
  className = '',
}: PartyOnLogoProps) {
  const classes = [
    'partyon-logo',
    `partyon-logo--${size}`,
    !showDiscoBall ? 'partyon-logo--text-only' : '',
    centered ? 'partyon-logo--centered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} aria-label="PartyOn logo">
      {showDiscoBall ? (
        <span className="partyon-logo__ball-wrap" aria-hidden="true">
          <span className="partyon-logo__ball-glow" />
          <span className="partyon-logo__ball-shell">
            <img className="partyon-logo__ball-image" src="/disco-ball.png" alt="" />
          </span>
        </span>
      ) : null}

      <span className="partyon-logo__text">
        <span className="partyon-logo__party">Party</span>
        <span className="partyon-logo__on">On</span>
      </span>
    </div>
  )
}
