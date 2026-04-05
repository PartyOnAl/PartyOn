import { useState, type FormEvent } from 'react'
import { Card, Button, InputField, SocialButton } from './components/ui'
import './User.css'

export default function User() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
  }

  return (
    <div className="user-page">
      <header className="user-page__header">
        <p className="user-logo" aria-label="PartyOn">
          <span className="user-logo__party">Party</span>
          <span className="user-logo__on">On</span>
        </p>
        <h1 className="user-page__title">Create your account</h1>
        <p className="user-page__subtitle">Join and start your night</p>
      </header>

      <Card className="user-page__card">
        <form className="user-form" onSubmit={handleSubmit}>
          <InputField
            id="user-full-name"
            label="Full name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <InputField
            id="user-email"
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <InputField
            id="user-password"
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" className="user-form__submit">
            Create Account
          </Button>
        </form>

        <div className="user-divider" role="presentation">
          <span className="user-divider__line" />
          <span className="user-divider__text">or continue with</span>
          <span className="user-divider__line" />
        </div>

        <div className="user-social">
          <SocialButton
            type="button"
            provider="google"
            label="Continue with Google"
          />
          <SocialButton
            type="button"
            provider="apple"
            label="Continue with Apple"
          />
        </div>
      </Card>

      <footer className="user-page__footer">
        <p className="user-page__login">
          Already have an account?{' '}
          <a className="user-page__login-link" href="/login">
            Log in
          </a>
        </p>
      </footer>
    </div>
  )
}
