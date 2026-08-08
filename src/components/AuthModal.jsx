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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-outline-variant p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-outline hover:text-on-surface cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl font-bold text-primary">P.</span>
          <h2 className="text-xl font-semibold text-on-surface">
            {mode === 'login' ? 'Sign in to Wave' : 'Create your Wave account'}
          </h2>
        </div>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Full Name
              </label>
              <input
                type="text"
                {...register('name', {
                  required: mode === 'signup' ? 'Full name is required' : false,
                })}
                placeholder="e.g. Jordan Lee"
                className={`w-full bg-surface border rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:outline-none ${
                  errors.name
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-outline-variant focus:border-primary'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">
                  {errors.name.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
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
                className={`w-full bg-surface border rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-on-surface focus:outline-none ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-outline-variant focus:border-primary'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
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
                className={`w-full bg-surface border rounded-xl py-2.5 pl-10 pr-10 text-xs text-on-surface focus:outline-none ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-outline-variant focus:border-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || isCoolingDown}
            className="w-full py-2.5 bg-primary hover:bg-primary-container text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
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

        <div className="mt-6 border-t border-surface-container pt-4 text-center">
          {mode === 'login' ? (
            <p className="text-xs text-outline">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => switchMode('signup')}
                className="text-primary font-semibold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-xs text-outline">
              Already registered?{' '}
              <button
                onClick={() => switchMode('login')}
                className="text-primary font-semibold hover:underline cursor-pointer"
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
