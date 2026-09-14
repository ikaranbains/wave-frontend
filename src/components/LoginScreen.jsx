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
    `w-full rounded-full bg-surface-container py-3 pl-11 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:outline-none ${
      hasError
        ? 'ring-1 ring-red-400 focus:bg-surface-container-high'
        : 'focus:bg-surface-container-high'
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
    <div className="ambient flex min-h-dvh w-full select-none items-center justify-center p-0 sm:p-6">
      <div className="card flex h-dvh w-full flex-col overflow-y-auto rounded-none border-0 sm:h-auto sm:max-w-5xl sm:flex-row sm:overflow-hidden sm:rounded-2xl sm:border md:min-h-[620px]">
        {/* Brand panel */}
        <div className="auth-brand relative shrink-0 overflow-hidden bg-primary px-7 py-8 text-on-primary sm:w-[44%] sm:px-10 sm:py-11 lg:px-12">
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <Image
                src="/wave-mark.png"
                alt=""
                width={40}
                height={40}
                priority
                className="h-10 w-10 rounded-xl bg-on-primary/15 object-contain"
              />
              <span className="font-display text-lg font-semibold tracking-tight">
                Wave
              </span>
            </div>

            <div className="mt-10 sm:mt-14">
              <h1 className="font-display text-[1.75rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.25rem]">
                Your people,
                <br className="hidden sm:block" /> a tap away.
              </h1>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-on-primary/75">
                A quiet little place for the handful of people you actually want
                to hear from. No feeds, no noise — just them.
              </p>
            </div>

            <ul className="mt-8 hidden space-y-5 sm:mt-auto sm:block sm:pt-10">
              {HIGHLIGHTS.map(({ icon: Icon, title, copy }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-on-primary/15">
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold">{title}</span>
                    <span className="block text-xs leading-relaxed text-on-primary/65">
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
            <div className="auth-mode-toggle grid grid-cols-2 gap-1 rounded-full bg-surface-container p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                  isLogin
                    ? 'bg-surface-container-lowest text-primary'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                  !isLogin
                    ? 'bg-surface-container-lowest text-primary'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                Create account
              </button>
            </div>
            )}

            <div className={isReset ? '' : 'mt-7'}>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface sm:text-[1.75rem]">
                {isReset
                  ? 'Reset your password'
                  : isLogin
                  ? 'Welcome back'
                  : isProfileStep
                  ? 'Make it yours'
                  : 'Nice to meet you'}
              </h2>
              <p className="mt-1.5 text-[13px] text-on-surface-variant">
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
                className="mt-5 flex items-start gap-2.5 rounded-2xl bg-emerald-500/10 p-3.5 text-[13px] text-emerald-700 ring-1 ring-emerald-500/25"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {apiError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-[13px] text-red-600 ring-1 ring-red-500/25"
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
                    <label htmlFor="signup-photo" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-3 transition-colors duration-150 hover:border-primary">
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
                className="auth-submit group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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

            <p className="mt-6 text-center text-[13px] text-on-surface-variant">
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
