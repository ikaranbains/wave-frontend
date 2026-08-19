'use client';

import Image from 'next/image';
import React, { memo, useEffect, useState } from 'react';
import {
  User,
  Bell,
  BellOff,
  BellRing,
  Shield,
  Palette,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  AlertCircle,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  Upload,
  X,
} from 'lucide-react';
import { updateSettingsApi, uploadAvatarApi } from '../services/api';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getCloudinaryThumbnail, isRealAvatar } from '../utils/avatarUtils';
import {
  INSTALL_REQUEST_EVENT,
  INSTALL_STATUS_EVENT,
  INSTALL_STATUS_REQUEST_EVENT,
  isStandaloneDisplay,
} from './InstallPrompt';
import { UPDATE_REQUEST_EVENT, UPDATE_STATUS_EVENT } from './PwaRegistrar';

const SECTIONS = [
  { key: 'profile', icon: User, label: 'Profile & Account' },
  { key: 'notifications', icon: Bell, label: 'Notifications & Sounds' },
  { key: 'privacy', icon: Shield, label: 'Privacy & Security' },
  { key: 'appearance', icon: Palette, label: 'Appearance & Theme' },
];

export const SettingsView = memo(function SettingsView({
  currentUser,
  activeSection,
  onSectionChange,
  onSectionBack,
  theme = 'system',
  onThemeChange,
  onUserUpdated,
  onLogout,
}) {
  // null means nothing picked yet: mobile shows the section list, desktop has room
  // for both panes at once and just falls back to the first section.
  const section = activeSection || 'profile';
  const push = usePushNotifications();
  const [isInstalled, setIsInstalled] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

    const handleInstallStatus = (event) => {
      setIsInstalled(Boolean(event.detail?.isInstalled));
      setCanInstall(Boolean(event.detail?.canInstall));
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };
    const handleUpdateStatus = (event) => {
      setIsUpdateAvailable(Boolean(event.detail?.available));
      setIsUpdating(Boolean(event.detail?.updating));
    };

    window.addEventListener(INSTALL_STATUS_EVENT, handleInstallStatus);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener(UPDATE_STATUS_EVENT, handleUpdateStatus);
    window.dispatchEvent(new Event(INSTALL_STATUS_REQUEST_EVENT));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration('/')
        .then((registration) => {
          if (registration?.waiting && navigator.serviceWorker.controller) {
            setIsUpdateAvailable(true);
          }
          return registration?.update();
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener(INSTALL_STATUS_EVENT, handleInstallStatus);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(UPDATE_STATUS_EVENT, handleUpdateStatus);
    };
  }, []);

  const installApp = () => window.dispatchEvent(new Event(INSTALL_REQUEST_EVENT));
  const updateApp = () => {
    setIsUpdating(true);
    window.dispatchEvent(new Event(UPDATE_REQUEST_EVENT));
  };

  // Interactive Form state
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [statusMessage, setStatusMessage] = useState(currentUser?.statusMessage || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    currentUser?.preferences?.notificationsEnabled ?? true
  );
  const [soundEnabled, setSoundEnabled] = useState(
    currentUser?.preferences?.soundEnabled ?? true
  );
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    currentUser?.preferences?.showOnlineStatus ?? true
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Profile photos must be JPG or PNG images.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Profile photos must be 2 MB or smaller.');
      return;
    }

    setPhotoError('');
    setSelectedPhoto(file);
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto || isUploadingPhoto) return;
    setIsUploadingPhoto(true);
    setPhotoProgress(0);
    setPhotoError('');
    try {
      const { user } = await uploadAvatarApi(selectedPhoto, setPhotoProgress);
      onUserUpdated?.(user);
      setSelectedPhoto(null);
      setPhotoProgress(0);
      setSavedSuccess(true);
      window.setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      setPhotoError(error.message || 'Unable to update profile photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSavedSuccess(false);
    try {
      const { user } = await updateSettingsApi({
        name: displayName.trim(),
        statusMessage: statusMessage.trim(),
        preferences: {
          notificationsEnabled,
          soundEnabled,
          showOnlineStatus,
        },
      });
      onUserUpdated?.(user);
      setSavedSuccess(true);
      window.setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      setSaveError(error.message || 'Unable to save your settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ambient flex h-full min-w-0 flex-1 select-none flex-col overflow-hidden md:ml-[100px] md:flex-row">
      {/* Section list. On mobile this is a full screen of its own and the content
          pane replaces it once a section is picked; from md up both are visible. */}
      <div
        className={`scroll-touch w-full min-w-0 flex-col justify-between overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 md:flex md:w-64 md:flex-none md:border-r md:border-outline-variant/40 md:p-6 md:pb-6 md:pt-[calc(1.5rem+env(safe-area-inset-top))] ${
          activeSection ? 'hidden' : 'settings-list-enter flex flex-1'
        }`}
      >
        <div>
          <h1 className="mb-3 font-display text-xl font-bold tracking-tight text-on-surface md:mb-6">
            Settings
          </h1>
          <nav className="space-y-1.5 md:space-y-1">
            {SECTIONS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSectionChange(key)}
                aria-current={section === key ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl border border-outline-variant/40 bg-white px-3.5 py-3.5 text-sm font-semibold transition-all active:scale-[0.99] md:border-0 md:bg-transparent md:px-3 md:py-2.5 md:text-xs md:active:scale-100 ${
                  section === key
                    ? 'md:bg-primary md:text-white md:shadow-sm md:shadow-primary/25'
                    : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 flex-1 text-left">{label}</span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-outline md:hidden" />
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-8 space-y-2 md:mt-6">
          {isUpdateAvailable ? (
            <div className="flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 p-2.5 text-primary md:p-2">
              <RefreshCw className={`h-4 w-4 flex-shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold">New version available</span>
                <span className="block text-[10px] text-on-surface-variant">
                  {isUpdating ? 'Updating Wave…' : 'Install it now'}
                </span>
              </span>
              <button
                type="button"
                onClick={updateApp}
                disabled={isUpdating}
                className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
              >
                {isUpdating ? 'Installing…' : 'Install'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={installApp}
              disabled={isInstalled || !canInstall}
              className="flex w-full items-center gap-2 rounded-xl border border-outline-variant/50 bg-white px-3 py-2.5 text-left text-on-surface-variant transition-all active:scale-[0.98] disabled:cursor-default disabled:opacity-65 md:border-0 md:bg-transparent md:active:scale-100"
            >
              {isInstalled ? (
                <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <Smartphone className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">
                  {isInstalled ? 'Installed' : 'Install app'}
                </span>
                {!isInstalled && !canInstall && (
                  <span className="block text-[10px] text-outline">
                    Install from your browser menu
                  </span>
                )}
              </span>
              {!isInstalled && canInstall && (
                <span className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white">
                  Install
                </span>
              )}
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-all active:scale-[0.98] md:justify-start md:gap-3 md:border-0 md:bg-transparent md:px-3 md:py-2.5 md:text-xs md:hover:bg-red-50 md:active:scale-100"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Form Area */}
      <div
        className={`scroll-touch min-w-0 max-w-3xl flex-1 overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:block md:p-8 md:pb-8 md:pt-[calc(2rem+env(safe-area-inset-top))] ${
          activeSection ? 'block' : 'hidden'
        }`}
      >
        {activeSection && (
          <button
            type="button"
            onClick={onSectionBack}
            className="-ml-2 mb-4 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Settings
          </button>
        )}

        <div key={activeSection || 'default-profile'} className="settings-section-enter">
        {savedSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Your settings have been saved successfully!</span>
          </div>
        )}
        {saveError && (
          <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Profile Section */}
        {section === 'profile' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">Profile Settings</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Update how you appear to the people you talk to.</p>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/40 bg-white p-4 text-center sm:flex-row sm:p-5 sm:text-left">
              {photoPreview || isRealAvatar(currentUser?.avatar) ? (
                <Image
                  src={getCloudinaryThumbnail(photoPreview || currentUser.avatar, 128)}
                  alt={`${currentUser?.name || 'User'} profile photo`}
                  width={64}
                  height={64}
                  unoptimized={Boolean(photoPreview)}
                  className="h-16 w-16 rounded-full border-2 border-surface-container object-cover"
                />
              ) : (
                <span
                  aria-label="No profile photo"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-surface-container bg-surface-container-low text-outline"
                >
                  <User className="h-7 w-7" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <input
                  id="profile-photo-input"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('profile-photo-input')?.click()}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Change Photo
                </button>
                <p className="text-[11px] text-outline mt-1">JPG or PNG, max size 2MB.</p>
                {selectedPhoto && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-container disabled:opacity-50"
                    >
                      {isUploadingPhoto && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                      {isUploadingPhoto ? `Uploading ${photoProgress}%` : 'Confirm photo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(null)}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container-high disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                )}
                {photoError && <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">{photoError}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Status Message</label>
                <input
                  type="text"
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || !displayName.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-primary-container sm:w-auto sm:py-2.5"
            >
              {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Save Settings
            </button>
          </form>
        )}

        {/* Notifications Section */}
        {section === 'notifications' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">Notification Preferences</h2>
              <p className="text-xs text-outline">Choose how you receive alerts and incoming messages.</p>
            </div>

            {/* Web push — per-device, handled by the service worker */}
            <div className="rounded-2xl border border-outline-variant/40 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                      push.isSubscribed
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-secondary-container text-primary'
                    }`}
                  >
                    {push.isSubscribed ? (
                      <BellRing className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-on-surface">
                      Push Notifications On This Device
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-outline">
                      {push.isSubscribed
                        ? 'This device gets a notification when a message arrives while Wave is closed.'
                        : 'Allow notifications so messages reach you when the app is closed or in the background.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
                  disabled={
                    push.isBusy ||
                    !push.isSupported ||
                    !push.isServerConfigured ||
                    push.permission === 'denied'
                  }
                  className={`inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                    push.isSubscribed
                      ? 'border border-outline-variant bg-white text-on-surface-variant'
                      : 'bg-primary text-white'
                  }`}
                >
                  {push.isBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {push.isSubscribed ? 'Turn off' : 'Turn on'}
                </button>
              </div>

              {!push.isAppConfigured && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
                  This build of Wave has no Firebase configuration, so push cannot be
                  enabled. The NEXT_PUBLIC_FIREBASE_* variables must be set where the app
                  is built, not just where it runs.
                </p>
              )}
              {push.isAppConfigured && !push.isSupported && (
                <p className="mt-3 rounded-xl bg-surface-container-low p-3 text-[11px] text-outline">
                  This browser cannot receive web push. On iPhone or iPad, install Wave to
                  the Home Screen first (iOS 16.4 or newer).
                </p>
              )}
              {push.isSupported && !push.isServerConfigured && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
                  Firebase Cloud Messaging is not configured on the server, so push
                  delivery is disabled.
                </p>
              )}
              {push.permission === 'denied' && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-[11px] text-red-700">
                  Notifications are blocked for this site. Re-enable them in your browser
                  settings, then turn them on here.
                </p>
              )}
              {push.error && (
                <p role="alert" className="mt-3 text-[11px] font-medium text-red-600">
                  {push.error}
                </p>
              )}
              {!isInstalled && (
                <p className="mt-3 flex items-start gap-2 text-[11px] text-outline">
                  <Smartphone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Installing Wave to your home screen makes notifications and offline mode
                  work like a native app.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-outline-variant/40 divide-y divide-surface-container">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-on-surface">Message Alerts</h3>
                  <p className="text-[11px] text-outline">
                    Account-wide switch for new-message notifications on every device.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-on-surface">Sound Alerts</h3>
                  <p className="text-[11px] text-outline">Play audio chimes for incoming calls & texts.</p>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Save Preferences
            </button>
          </form>
        )}

        {/* Privacy & Security */}
        {section === 'privacy' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">Privacy & Security</h2>
              <p className="text-xs text-outline">Manage your sign-in and the devices you are signed in on.</p>
            </div>

            <div className="bg-white rounded-2xl border border-outline-variant/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="text-xs font-semibold text-on-surface">Online Presence</h3>
                    <p className="text-[11px] text-outline">Allow contacts to see when you are online.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showOnlineStatus}
                  onChange={(e) => setShowOnlineStatus(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Save Privacy
            </button>
          </form>
        )}

        {/* Appearance */}
        {section === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">Appearance & Design</h2>
              <p className="mt-1 text-sm text-on-surface-variant">How Wave looks on this device.</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-outline-variant/40 bg-white p-4 sm:p-6">
              <div>
                <h3 className="text-xs font-semibold text-on-surface">Appearance</h3>
                <p className="mt-1 text-[11px] text-outline">Choose how Wave looks on this device.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-container p-1">
                {[
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onThemeChange?.(value)}
                    aria-pressed={theme === value}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-all ${
                      theme === value
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        </div>

      </div>
    </div>
  );
});
