'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Heart,
  Lock,
  Video,
  Mail,
  LockKeyhole,
  User,
  Eye,
  EyeOff,
  Loader2,
  Camera,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { loginApi, resetPasswordApi, signupWithProfileApi } from '../services/api';
import { useLoginCooldown } from '../hooks/useLoginCooldown';

const HIGHLIGHTS = [
  {
    icon: Lock,
    title: 'Just between you two',
    copy: 'No feeds, no followers, no one else in the room.',
  },
  {
    icon: Heart,
    title: 'Little moments, shared',
    copy: 'Photos, voice notes, and half-thoughts at 1am.',
  },
  {
    icon: Video,
    title: 'Hear their voice',
    copy: 'Call in a tap when texting is not enough.',
  },
];

export const LoginScreen = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState('login');
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [notice, setNotice] = useState('');
  const { remainingSeconds, isCoolingDown, startCooldown } = useLoginCooldown();

  const isReset = mode === 'reset';
  // The cooldown belongs to failed sign-ins. Resetting is not rate limited, so a
  // cooldown left over from /login must not block it.
  const isBlocked = isCoolingDown && !isReset;
  const isLogin = mode === 'login';
  const isProfileStep = !isLogin && !isReset && signupStep === 2;

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
      statusMessage: '',
      backupCode: '',
    },
  });

  const onSubmit = async (formData) => {
    if (isBlocked) return;
    setApiError(null);
    setLoading(true);

    try {
      if (isReset) {
        await resetPasswordApi(
          formData.email,
          formData.backupCode.trim(),
          formData.password
        );
        // Straight back to sign-in rather than auto-signing them in: whoever holds the
        // code is not necessarily at this keyboard, so the new password gets typed once
        // more before it grants a session.
        switchMode('login');
        setNotice('Password updated. Sign in with your new password.');
      } else if (isLogin) {
        const data = await loginApi(formData.email, formData.password);
        await onLoginSuccess(data.user);
      } else if (signupStep === 1) {
        setSignupStep(2);
        return;
      } else {
        const data = await signupWithProfileApi({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          bio: formData.statusMessage,
          photo: profilePhoto,
        });
        await onLoginSuccess(data.user);
      }
    } catch (err) {
      setApiError(err.message || 'Authentication failed');
      if (isLogin) startCooldown(err.retryAfter || 2);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setMode(newMode);
    setApiError(null);
    setNotice('');
    setShowPassword(false);
    setSignupStep(1);
    setProfilePhoto(null);
    setPhotoPreview('');
    reset();
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setApiError('Profile photos must be JPG or PNG images.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setApiError('Profile photos must be 2 MB or smaller.');
      return;
    }
    setApiError(null);
    setProfilePhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const fieldClass = (hasError) =>
    `w-full rounded-2xl border bg-surface-container-lowest py-3.5 pl-11 text-sm text-on-surface placeholder:text-outline/70 transition-all focus:outline-none focus:ring-4 ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
        : 'border-outline-variant/70 hover:border-outline/60 focus:border-primary focus:ring-primary/10'
    }`;

  const submitLabel = loading
    ? 'Just a moment…'
    : isBlocked
    ? `Try again in ${remainingSeconds}s`
    : isReset
    ? 'Reset password'
    : isLogin
    ? 'Sign in'
    : signupStep === 1
    ? 'Continue'
    : 'Create my space';

  return (
    <div className="flex min-h-dvh w-full select-none items-center justify-center bg-surface p-0 sm:p-6">
      <div className="flex h-dvh w-full flex-col overflow-y-auto border-0 bg-surface-container-lowest shadow-2xl shadow-black/5 sm:h-auto sm:max-w-5xl sm:flex-row sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-outline-variant/60 md:min-h-[620px]">
        {/* Brand panel */}
        <div className="auth-brand relative shrink-0 overflow-hidden bg-primary px-7 py-8 text-white sm:w-[44%] sm:px-10 sm:py-11 lg:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_55%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          />

          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <Image
                src="/wave-mark.png"
                alt=""
                width={44}
                height={44}
                priority
                className="h-11 w-11 rounded-2xl bg-white object-contain shadow-lg shadow-black/10 ring-1 ring-white/40"
              />
              <span className="font-display text-lg font-bold tracking-tight">
                Wave
              </span>
            </div>

            <div className="mt-10 sm:mt-14">
              <h1 className="font-display text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">
                Your people,
                <br className="hidden sm:block" /> a tap away.
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
                A quiet little place for the handful of people you actually want
                to hear from. No feeds, no noise — just them.
              </p>
            </div>

            <ul className="mt-8 hidden space-y-5 sm:mt-auto sm:block sm:pt-10">
              {HIGHLIGHTS.map(({ icon: Icon, title, copy }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs leading-relaxed text-white/65">
                      {copy}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:overflow-y-auto sm:px-10 sm:py-11 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            {!isReset && (
            <div className="auth-mode-toggle grid grid-cols-2 gap-1 rounded-2xl bg-surface-container p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  isLogin
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Log in 
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  !isLogin
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Create account
              </button>
            </div>
            )}

            <div className={isReset ? '' : 'mt-7'}>
              <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-on-surface sm:text-[1.75rem]">
                {isReset
                  ? 'Reset your password'
                  : isLogin
                  ? 'Welcome back'
                  : isProfileStep
                  ? 'Make it yours'
                  : 'Nice to meet you'}
              </h2>
              <p className="mt-1.5 text-sm text-on-surface-variant">
                {isReset
                  ? 'Enter the backup code you were given, along with the email on your account.'
                  : isLogin
                  ? "They've been waiting to hear from you."
                  : 'Set up your space in under a minute. It’s free.'}
              </p>
            </div>

            {notice && (
              <div
                role="status"
                className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {apiError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-4"
              noValidate
            >
              {!isLogin && isProfileStep && (
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                  >
                    What should we call you?
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      {...register('name', {
                        required: 'Your friends need a name to look for',
                      })}
                      placeholder="The name your friends use"
                      className={`${fieldClass(errors.name)} pr-4`}
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      {errors.name.message}
                    </p>
                  )}
                </div>
              )}

              {(!isProfileStep || isLogin) && <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email', {
                      required: 'We need your email to find you',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'That email looks a little off',
                      },
                    })}
                    placeholder="you@email.com"
                    className={`${fieldClass(errors.email)} pr-4`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>}

              {isReset && (
                <div>
                  <label
                    htmlFor="backupCode"
                    className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                  >
                    Backup code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                    <input
                      id="backupCode"
                      type="text"
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      spellCheck={false}
                      {...register('backupCode', {
                        required: 'Enter the backup code you were given',
                      })}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className={`${fieldClass(errors.backupCode)} pr-4 font-mono tracking-wide`}
                    />
                  </div>
                  {errors.backupCode ? (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      {errors.backupCode.message}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-outline">
                      Codes are issued by hand and work once. Ask for one if you do not
                      have it.
                    </p>
                  )}
                </div>
              )}

              {(!isProfileStep || isLogin) && <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold text-on-surface-variant"
                >
                  {isReset ? 'New password' : 'Password'}
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    {...register('password', {
                      required: 'Almost there — your password',
                      minLength: {
                        value: 6,
                        message: 'Make it at least 6 characters',
                      },
                    })}
                    placeholder={
                      isReset
                        ? 'Your new password'
                        : isLogin
                        ? 'Your password'
                        : 'Something only you know'
                    }
                    className={`${fieldClass(errors.password)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-outline transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {errors.password.message}
                  </p>
                )}
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="mt-2 cursor-pointer text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot your password?
                  </button>
                )}
              </div>}

              {isProfileStep && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      Profile photo <span className="font-normal text-outline">(optional)</span>
                    </label>
                    <input id="signup-photo" type="file" accept="image/jpeg,image/png" onChange={handlePhotoSelect} className="sr-only" />
                    <label htmlFor="signup-photo" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-outline-variant/70 bg-surface-container-lowest p-3 transition-colors hover:border-primary">
                      {photoPreview ? (
                        <Image src={photoPreview} alt="Profile preview" width={52} height={52} unoptimized className="h-[52px] w-[52px] rounded-full object-cover" />
                      ) : (
                        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-secondary-container text-primary"><Camera className="h-5 w-5" /></span>
                      )}
                      <span className="text-xs text-on-surface-variant">Choose a JPG or PNG, up to 2 MB</span>
                    </label>
                  </div>
                  <div>
                    <label htmlFor="statusMessage" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      Bio <span className="font-normal text-outline">(optional)</span>
                    </label>
                    <input id="statusMessage" type="text" maxLength={160} {...register('statusMessage')} placeholder="A little line about you" className={`${fieldClass(false)} pl-4 pr-4`} />
                  </div>
                  <button type="button" onClick={() => { setSignupStep(1); setApiError(null); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                </>
              )}

              <button
                type="submit"
                disabled={loading || isBlocked}
                className="auth-submit group flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                <span>{submitLabel}</span>
                {!loading && !isBlocked && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-on-surface-variant">
              {isReset
                ? 'Remembered it?'
                : isLogin
                ? `Don't have an account?`
                : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(isLogin ? 'signup' : 'login')}
                className="cursor-pointer font-semibold text-primary hover:underline"
              >
                {isLogin ? 'Create here' : 'Log in'}
              </button>
            </p>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-outline">
              <ShieldCheck className="h-3.5 w-3.5" />
              Encrypted in transit. Your conversations stay yours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
