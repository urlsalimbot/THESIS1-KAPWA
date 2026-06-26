import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Smartphone } from 'lucide-react';
import '../index.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const { login, resolveMfa, cancelMfa, mfaChallenge } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (!result?.mfaRequired) navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await resolveMfa(mfaCode);
      navigate('/');
    } catch (err) {
      setError('Invalid verification code');
    }
  }

  if (mfaChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-text-primary">Two-Factor Auth</h1>
            <p className="text-sm text-text-secondary mt-1">Enter code from authenticator app</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label className="form-label">Verification Code</label>
              <input type="text" className="form-input text-center text-2xl tracking-widest" maxLength={6} placeholder="000000" aria-label="Verification Code" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={mfaCode.length !== 6} aria-label="Verify">Verify</button>
            <button type="button" onClick={() => { cancelMfa(); setMfaCode(''); }} className="w-full text-sm text-gray-500 hover:text-gray-700" aria-label="Cancel">Cancel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">KAPWA</h1>
          <p className="text-sm text-text-secondary mt-1">MSWDO Norzagaray Social Welfare System</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary w-full">Sign In</button>
        </form>
      </div>
    </div>
  );
}
