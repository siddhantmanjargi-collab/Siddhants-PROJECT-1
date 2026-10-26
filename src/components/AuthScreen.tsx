import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Clock, Layers, Camera, ArrowRight } from 'lucide-react';
import { VaultDial } from './VaultDial';
import { User } from '../types/asset';
import { setStoredUser } from '../utils/storage';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

type Step = 'auth' | 'name' | 'intro';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<Step>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (mode === 'signup') {
      setStep('name');
    } else {
      const userName = email.split('@')[0];
      const capitalized = userName.charAt(0).toUpperCase() + userName.slice(1);
      completeAuth({
        id: `user-${Date.now()}`,
        email,
        name: capitalized,
        isGuest: false,
      });
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setStep('intro');
  };

  const handleGuestLogin = () => {
    completeAuth({
      id: 'guest-user',
      email: 'guest@assetwallet.app',
      name: 'Guest User',
      isGuest: true,
    });
  };

  const completeAuth = (user: User) => {
    setUnlocked(true);
    setStoredUser(user);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 600);
  };

  const finishIntro = () => {
    const finalUser: User = {
      id: `user-${Date.now()}`,
      email,
      name: name.trim() || 'Vault Owner',
      isGuest: false,
    };
    completeAuth(finalUser);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col items-center justify-center min-h-[85vh]">
      <VaultDial unlocked={unlocked} size={96} />

      <div className="w-full bg-[#16261F] border border-[#2A3B33] rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        {step === 'auth' && (
          <div>
            <p className="font-mono text-[12px] tracking-[0.12em] uppercase text-[#C9A15D] text-center mb-2">
              Asset Wallet
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-center font-medium text-[#EDEDE1] mb-2">
              Open your vault
            </h1>
            <p className="text-[#8FA79B] text-sm text-center mb-6">
              Sign in to manage your tracked assets, documents, and renewal alerts.
            </p>

            <div className="flex bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'signin'
                    ? 'bg-[#C9A15D] text-[#14211B] font-semibold shadow'
                    : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'signup'
                    ? 'bg-[#C9A15D] text-[#14211B] font-semibold shadow'
                    : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8FA79B] mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-3.5 py-3 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8FA79B] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-3.5 py-3 pr-10 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8FA79B] hover:text-[#C9A15D]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#8FA79B] mb-1.5 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-3.5 py-3 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                  />
                </div>
              )}

              {error && <p className="text-[#C97B6B] text-xs font-medium">{error}</p>}

              <button
                type="submit"
                className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold py-3 rounded-lg transition-colors shadow-md mt-2"
              >
                {mode === 'signin' ? 'Sign In & Enter Vault' : 'Continue'}
              </button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#2A3B33]"></div>
              </div>
              <span className="relative bg-[#16261F] px-3 font-mono text-xs text-[#8FA79B] uppercase">
                OR
              </span>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="w-full border border-[#2A3B33] hover:border-[#C9A15D] text-[#EDEDE1] hover:text-[#E4C98A] font-medium py-2.5 rounded-lg text-sm transition-all"
            >
              Continue as Guest (Demo Vault)
            </button>
          </div>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="font-mono text-xs tracking-widest text-[#C9A15D] text-center uppercase">
              Almost there
            </p>
            <h1 className="font-serif text-2xl text-center text-[#EDEDE1] font-medium">
              What should we call you?
            </h1>
            <p className="text-[#8FA79B] text-sm text-center mb-4">
              Your name will personalize your asset vault.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#8FA79B] mb-1.5 uppercase tracking-wider">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Siddhant"
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-3.5 py-3 text-[#EDEDE1] text-base focus:outline-none focus:border-[#C9A15D]"
                autoFocus
              />
            </div>

            {error && <p className="text-[#C97B6B] text-xs">{error}</p>}

            <button
              type="submit"
              className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold py-3 rounded-lg transition-colors mt-4"
            >
              Next
            </button>
          </form>
        )}

        {step === 'intro' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <p className="font-mono text-xs tracking-widest text-[#C9A15D] uppercase">
                Features Overview
              </p>
              <button
                type="button"
                onClick={finishIntro}
                className="text-xs text-[#8FA79B] hover:text-[#EDEDE1]"
              >
                Skip →
              </button>
            </div>

            <h1 className="font-serif text-2xl text-[#EDEDE1] font-medium">
              What this vault does
            </h1>

            <div className="space-y-4 my-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#1C2E26] border border-[#2A3B33] text-[#C9A15D] shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDE1]">Never miss a renewal</h3>
                  <p className="text-xs text-[#8FA79B]">
                    Insurance, warranties, subscriptions — get expiry warnings before they lapse.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#1C2E26] border border-[#2A3B33] text-[#C9A15D] shrink-0">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDE1]">One place for everything</h3>
                  <p className="text-xs text-[#8FA79B]">
                    Vehicles, gadgets, health cards, property deeds, and financial accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#1C2E26] border border-[#2A3B33] text-[#C9A15D] shrink-0">
                  <Camera size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDE1]">Scan with Gemini AI</h3>
                  <p className="text-xs text-[#8FA79B]">
                    Upload invoices or photos — automatically extract serials, prices & dates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#1C2E26] border border-[#2A3B33] text-[#C9A15D] shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDE1]">Private & Encrypted</h3>
                  <p className="text-xs text-[#8FA79B]">
                    Stored locally in your vault with instant offline document viewing.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={finishIntro}
              className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Enter Vault <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
