'use client';

import { Avatar } from './Avatar';
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
    <div className="card flex h-full min-w-0 flex-1 select-none flex-col overflow-hidden rounded-none border-0 md:flex-row md:rounded-2xl md:border">
      {/* Section list. On mobile this is a full screen of its own and the content
          pane replaces it once a section is picked; from md up both are visible. */}
      <div
        className={`scroll-touch w-full min-w-0 flex-col justify-between overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6 md:flex md:w-64 md:flex-none md:border-r md:border-outline-variant md:p-6 md:pb-6 md:pt-[calc(1.5rem+env(safe-area-inset-top))] ${
          activeSection ? 'hidden' : 'settings-list-enter flex flex-1'
        }`}
      >
        <div>
          <h1 className="mb-3 font-display text-xl font-semibold tracking-tight text-on-surface md:mb-6">
            Settings
          </h1>
          <nav className="space-y-1.5 md:space-y-1">
            {SECTIONS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSectionChange(key)}
                aria-current={section === key ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3.5 text-[13px] font-medium transition-colors duration-150 active:scale-95 md:border-0 md:bg-transparent md:px-3 md:py-2.5 md:active:scale-100 ${
                  section === key
                    ? 'md:bg-primary md:text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.9} />
                <span className="min-w-0 flex-1 text-left">{label}</span>
                <ChevronRight
                  className="h-4 w-4 flex-shrink-0 text-outline md:hidden"
                  strokeWidth={1.9}
                />
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-8 space-y-2 md:mt-6">
          {isUpdateAvailable ? (
            <div className="flex w-full items-center gap-2 rounded-2xl bg-primary/12 p-2.5 text-primary md:p-2">
              <RefreshCw
                className={`h-[17px] w-[17px] flex-shrink-0 ${isUpdating ? 'animate-spin' : ''}`}
                strokeWidth={1.9}
              />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-semibold">New version available</span>
                <span className="block text-[11px] text-on-surface-variant">
                  {isUpdating ? 'Updating Wave…' : 'Install it now'}
                </span>
              </span>
              <button
                type="button"
                onClick={updateApp}
                disabled={isUpdating}
                className="flex-shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-60"
              >
                {isUpdating ? 'Installing…' : 'Install'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={installApp}
              disabled={isInstalled || !canInstall}
              className="flex w-full items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-left text-on-surface-variant transition-colors duration-150 active:scale-95 disabled:cursor-default disabled:opacity-65 md:border-0 md:bg-transparent md:active:scale-100"
            >
              {isInstalled ? (
                <Check className="h-[17px] w-[17px] flex-shrink-0 text-emerald-600" strokeWidth={1.9} />
              ) : (
                <Smartphone className="h-[17px] w-[17px] flex-shrink-0 text-primary" strokeWidth={1.9} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-on-surface">
                  {isInstalled ? 'Installed' : 'Install app'}
                </span>
                {!isInstalled && !canInstall && (
                  <span className="block text-[11px] text-outline">
                    Install from your browser menu
                  </span>
                )}
              </span>
              {!isInstalled && canInstall && (
                <span className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary">
                  Install
                </span>
              )}
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-xl border border-error/25 bg-error-container px-3 py-2.5 text-left text-[13px] font-semibold text-error transition-colors duration-150 hover:bg-error/15 active:scale-95 md:border-0 md:bg-transparent md:active:scale-100"
            >
              <LogOut className="h-[17px] w-[17px]" strokeWidth={1.9} />
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
            className="-ml-2 mb-4 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[13px] font-medium text-outline transition-colors duration-150 hover:bg-surface-container hover:text-on-surface md:hidden"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.9} />
            Settings
          </button>
        )}

        <div key={activeSection || 'default-profile'} className="settings-section-enter">
        {savedSuccess && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800">
            <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={1.9} />
            <span>Your settings have been saved successfully!</span>
          </div>
        )}
        {saveError && (
          <div role="alert" className="mb-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={1.9} />
            <span>{saveError}</span>
          </div>
        )}

        {/* Profile Section */}
        {section === 'profile' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-on-surface">Profile Settings</h2>
              <p className="mt-1 text-[13px] text-on-surface-variant">Update how you appear to the people you talk to.</p>
            </div>

            <div className="card flex flex-col items-center gap-4 rounded-2xl p-4 text-center sm:flex-row sm:p-5 sm:text-left">
              <Avatar
                src={photoPreview || currentUser?.avatar}
                name={currentUser?.name}
                size={64}
                unoptimized={Boolean(photoPreview)}
                className="border-2 border-surface-container"
              />
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-4 py-2 text-[13px] font-medium text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" strokeWidth={1.9} />
                  Change Photo
                </button>
                <p className="mt-1.5 text-[11px] text-outline">JPG or PNG, max size 2MB.</p>
                {selectedPhoto && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[11px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-50"
                    >
                      {isUploadingPhoto && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                      {isUploadingPhoto ? `Uploading ${photoProgress}%` : 'Confirm photo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto(null)}
                      disabled={isUploadingPhoto}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-semibold text-outline transition-colors duration-150 hover:bg-surface-container hover:text-on-surface active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.9} />
                      Cancel
                    </button>
                  </div>
                )}
                {photoError && <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">{photoError}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-on-surface">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-full bg-surface-container px-4 py-2.5 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:bg-surface-container-high focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-on-surface">Status Message</label>
                <input
                  type="text"
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  className="w-full rounded-full bg-surface-container px-4 py-2.5 text-[13px] text-on-surface placeholder-outline transition-colors duration-150 focus:bg-surface-container-high focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || !displayName.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-50 sm:w-auto"
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
              <h2 className="font-display text-xl font-semibold tracking-tight text-on-surface">Notification Preferences</h2>
              <p className="mt-1 text-[13px] text-on-surface-variant">Choose how you receive alerts and incoming messages.</p>
            </div>

            {/* Web push — per-device, handled by the service worker */}
            <div className="card rounded-2xl p-4">
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
                      <BellRing className="h-[17px] w-[17px]" strokeWidth={1.9} />
                    ) : (
                      <BellOff className="h-[17px] w-[17px]" strokeWidth={1.9} />
                    )}
                  </span>
                  <div>
                    <h3 className="text-[13px] font-medium text-on-surface">
                      Push Notifications On This Device
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-outline">
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
                  className={`inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150 active:scale-95 disabled:opacity-50 ${
                    push.isSubscribed
                      ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  {push.isBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {push.isSubscribed ? 'Turn off' : 'Turn on'}
                </button>
              </div>

              {!push.isAppConfigured && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  This build of Wave has no Firebase configuration, so push cannot be
                  enabled. The NEXT_PUBLIC_FIREBASE_* variables must be set where the app
                  is built, not just where it runs.
                </p>
              )}
              {push.isAppConfigured && !push.isSupported && (
                <p className="mt-3 rounded-xl bg-surface-container p-3 text-xs text-outline">
                  This browser cannot receive web push. On iPhone or iPad, install Wave to
                  the Home Screen first (iOS 16.4 or newer).
                </p>
              )}
              {push.isSupported && !push.isServerConfigured && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  Firebase Cloud Messaging is not configured on the server, so push
                  delivery is disabled.
                </p>
              )}
              {push.permission === 'denied' && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
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
                <p className="mt-3 flex items-start gap-2 text-xs text-outline">
                  <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.9} />
                  Installing Wave to your home screen makes notifications and offline mode
                  work like a native app.
                </p>
              )}
            </div>

            <div className="card divide-y divide-outline-variant rounded-2xl">
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-on-surface">Message Alerts</h3>
                  <p className="mt-0.5 text-xs text-outline">
                    Account-wide switch for new-message notifications on every device.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-on-surface">Sound Alerts</h3>
                  <p className="mt-0.5 text-xs text-outline">Play audio chimes for incoming calls & texts.</p>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-50"
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
              <h2 className="font-display text-xl font-semibold tracking-tight text-on-surface">Privacy & Security</h2>
              <p className="mt-1 text-[13px] text-on-surface-variant">Manage your sign-in and the devices you are signed in on.</p>
            </div>

            <div className="card divide-y divide-outline-variant rounded-2xl">
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Lock className="h-[18px] w-[18px] flex-shrink-0 text-primary" strokeWidth={1.9} />
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-medium text-on-surface">Online Presence</h3>
                    <p className="mt-0.5 text-xs text-outline">Allow contacts to see when you are online.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showOnlineStatus}
                  onChange={(e) => setShowOnlineStatus(e.target.checked)}
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[13px] font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95 disabled:opacity-50"
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
              <h2 className="font-display text-xl font-semibold tracking-tight text-on-surface">Appearance & Design</h2>
              <p className="mt-1 text-[13px] text-on-surface-variant">How Wave looks on this device.</p>
            </div>

            <div className="card space-y-4 rounded-2xl p-4 sm:p-6">
              <div>
                <h3 className="text-[13px] font-medium text-on-surface">Appearance</h3>
                <p className="mt-0.5 text-xs text-outline">Choose how Wave looks on this device.</p>
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
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-colors duration-150 ${
                      theme === value
                        ? 'bg-primary/12 text-primary'
                        : 'text-outline hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
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
