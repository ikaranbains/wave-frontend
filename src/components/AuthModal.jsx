'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  X,
  LogIn,
  UserPlus,
  AlertCircle,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from 'lucide-react';
import { loginApi, signupApi } from '../services/api';
import { useLoginCooldown } from '../hooks/useLoginCooldown';

export const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('login');
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { remainingSeconds, isCoolingDown, startCooldown } = useLoginCooldown();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (formData) => {
    if (isCoolingDown) return;
    setApiError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await loginApi(formData.email, formData.password);
        onSuccess(data.user);
        onClose();
      } else {
        const data = await signupApi(
          formData.name,
          formData.email,
          formData.password
        );
        onSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setApiError(err.message || 'Authentication failed');
      if (mode === 'login') startCooldown(err.retryAfter || 2);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setApiError(null);
    setShowPassword(false);
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex select-none items-center justify-center bg-black/60 p-4">
      <div className="card relative w-full max-w-md rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-outline transition-colors duration-150 hover:bg-surface-container hover:text-on-surface active:scale-95"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>

        <div className="mb-6 flex items-center gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-primary">P.</span>
          <h2 className="font-display text-xl font-semibold tracking-tight text-on-surface">
            {mode === 'login' ? 'Sign in to Wave' : 'Create your Wave account'}
          </h2>
        </div>

        {apiError && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={1.9} />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-on-surface-variant">
                Full Name
              </label>
              <input
                type="text"
                {...register('name', {
                  required: mode === 'signup' ? 'Full name is required' : false,
                })}
                placeholder="e.g. Jordan Lee"
                className={`w-full rounded-full px-4 py-2.5 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:outline-none ${
                  errors.name
                    ? 'bg-red-500/10 ring-1 ring-red-500'
                    : 'bg-surface-container focus:bg-surface-container-high'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] font-medium text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-on-surface-variant">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" strokeWidth={1.9} />
              <input
                type="email"
                {...register('email', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                placeholder="name@example.com"
                className={`w-full rounded-full py-2.5 pl-11 pr-4 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:outline-none ${
                  errors.email
                    ? 'bg-red-500/10 ring-1 ring-red-500'
                    : 'bg-surface-container focus:bg-surface-container-high'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-[11px] font-medium text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-on-surface-variant">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" strokeWidth={1.9} />
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters long',
                  },
                })}
                placeholder="••••••••"
                className={`w-full rounded-full py-2.5 pl-11 pr-12 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:outline-none ${
                  errors.password
                    ? 'bg-red-500/10 ring-1 ring-red-500'
                    : 'bg-surface-container focus:bg-surface-container-high'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-outline transition-colors duration-150 hover:bg-surface-container-high hover:text-on-surface focus:outline-none active:scale-95"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.9} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.9} />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-[11px] font-medium text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || isCoolingDown}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-50"
          >
            {mode === 'login' ? <LogIn className="h-4 w-4" strokeWidth={1.9} /> : <UserPlus className="h-4 w-4" strokeWidth={1.9} />}
            <span>
              {loading
                ? 'Authenticating...'
                : isCoolingDown
                ? `Try again in ${remainingSeconds}s`
                : mode === 'login'
                ? 'Sign In'
                : 'Register Account'}
            </span>
          </button>
        </form>

        <div className="mt-6 border-t border-outline-variant pt-4 text-center">
          {mode === 'login' ? (
            <p className="text-[13px] text-outline">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => switchMode('signup')}
                className="cursor-pointer font-semibold text-primary hover:underline"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-[13px] text-outline">
              Already registered?{' '}
              <button
                onClick={() => switchMode('login')}
                className="cursor-pointer font-semibold text-primary hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
