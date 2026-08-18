'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Headphones,
  LoaderCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { getCallTokenApi } from '../services/api';
import { getCloudinaryThumbnail } from '../utils/avatarUtils';

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function ControlButton({ onClick, disabled, active, label, children, tone }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
          tone === 'danger'
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600'
            : active
              ? 'bg-white text-slate-900'
              : 'bg-white/12 text-white ring-1 ring-white/15 hover:bg-white/20'
        }`}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium text-white/60">{label}</span>
    </div>
  );
}

export function IncomingCall({ call, onAccept, onDecline }) {
  if (!call) return null;

  const isVideoCall = call.type === 'video';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-7 text-center text-white shadow-2xl">
        <div className="relative mx-auto mb-4 w-fit">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          {call.caller?.avatar ? (
            <Image
              src={getCloudinaryThumbnail(call.caller.avatar, 192)}
              alt={call.caller?.name || 'Caller'}
              width={96}
              height={96}
              className="relative h-24 w-24 rounded-full border-4 border-slate-800 object-cover"
            />
          ) : (
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-slate-800 bg-slate-700 text-3xl font-semibold">
              {call.caller?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Incoming {isVideoCall ? 'video' : 'voice'} call
        </p>
        <h2 className="mt-2 text-xl font-semibold">{call.caller?.name || 'Someone on Wave'}</h2>

        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-2 text-xs text-slate-300"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 transition-transform hover:scale-105">
              <PhoneOff className="h-6 w-6" />
            </span>
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex flex-col items-center gap-2 text-xs text-slate-300"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 transition-transform hover:scale-105">
              {isVideoCall ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </span>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function CallInterface({ call, onEnd }) {
  const roomRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState(
    call.status === 'ringing' ? 'ringing' : 'connecting'
  );
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(call.type === 'video');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callError, setCallError] = useState('');

  const isVideoCall = call.type === 'video';

  useEffect(() => {
    if (call.status === 'ringing') {
      return undefined;
    }

    let cancelled = false;
    let room = null;
    const remoteAudioContainer = remoteAudioRef.current;

    async function setupCall() {
      setConnectionStatus('connecting');
      setCallError('');

      try {
        // Loaded on demand. livekit-client is ~700KB of WebRTC SDK and only a
        // real call needs it, so keeping it out of the initial bundle saves
        // every user who never places one the download and the parse cost.
        const { Room, RoomEvent, Track } = await import('livekit-client');
        if (cancelled) return;

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        const handleTrackSubscribed = (track) => {
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
            setHasRemoteVideo(true);
          }

          if (track.kind === Track.Kind.Audio && remoteAudioContainer) {
            const audioElement = track.attach();
            audioElement.autoplay = true;
            if (sinkIdRef.current) {
              audioElement.setSinkId?.(sinkIdRef.current).catch(() => {});
            }
            remoteAudioContainer.appendChild(audioElement);
          }
        };

        const handleTrackUnsubscribed = (track) => {
          if (track.kind === Track.Kind.Video) {
            if (remoteVideoRef.current) track.detach(remoteVideoRef.current);
            setHasRemoteVideo(false);
          } else {
            track.detach().forEach((element) => element.remove());
          }
        };

        room
          .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
          .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
          .on(RoomEvent.ParticipantDisconnected, () => setHasRemoteVideo(false))
          .on(RoomEvent.AudioPlaybackStatusChanged, () => {
            setCanPlayAudio(room.canPlaybackAudio);
          })
          .on(RoomEvent.Disconnected, () => {
            if (!cancelled) setConnectionStatus('disconnected');
          });

        const { token, url } = await getCallTokenApi(call.conversationId);
        if (cancelled) return;

        await room.connect(url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }

        setConnectionStatus('connected');
        setCanPlayAudio(room.canPlaybackAudio);

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicEnabled(true);
        } catch {
          setIsMicEnabled(false);
          setCallError('Microphone access was blocked. Allow it in your browser to speak.');
        }

        if (isVideoCall) {
          try {
            await room.localParticipant.setCameraEnabled(true);
            const cameraPublication = room.localParticipant.getTrackPublication(
              Track.Source.Camera
            );
            if (localVideoRef.current) {
              cameraPublication?.videoTrack?.attach(localVideoRef.current);
            }
            setIsCameraEnabled(true);
          } catch {
            setIsCameraEnabled(false);
            setCallError('Camera access was blocked. You can continue with audio.');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setConnectionStatus('failed');
          setCallError(error.message || 'Unable to connect to the call');
        }
      }
    }

    setupCall();

    return () => {
      cancelled = true;
      room?.removeAllListeners();
      room?.disconnect();
      roomRef.current = null;
      remoteAudioContainer?.replaceChildren();
    };
  }, [call.conversationId, call.status, isVideoCall]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return undefined;

    const startedAt = Date.now();
    const durationTimer = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(durationTimer);
  }, [connectionStatus]);

  const toggleMicrophone = async () => {
    const nextValue = !isMicEnabled;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(nextValue);
      setIsMicEnabled(nextValue);
      setCallError('');
    } catch {
      setCallError('Unable to access your microphone.');
    }
  };

  const toggleCamera = async () => {
    const nextValue = !isCameraEnabled;
    try {
      const publication = await roomRef.current?.localParticipant.setCameraEnabled(nextValue);
      if (nextValue && localVideoRef.current) {
        publication?.videoTrack?.attach(localVideoRef.current);
      }
      setIsCameraEnabled(nextValue);
      setCallError('');
    } catch {
      setCallError('Unable to access your camera.');
    }
  };

  const enableAudioPlayback = async () => {
    try {
      await roomRef.current?.startAudio();
      setCanPlayAudio(true);
    } catch {
      setCallError('Tap again to enable call audio.');
    }
  };

  // Audio output routing. setSinkId is Chromium-only; on Safari/iOS the browser
  // owns routing entirely, so the control is disabled rather than faked.
  const sinkIdRef = useRef(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [canSwitchOutput, setCanSwitchOutput] = useState(false);

  useEffect(() => {
    setCanSwitchOutput(
      typeof window !== 'undefined' &&
        typeof window.HTMLMediaElement !== 'undefined' &&
        typeof window.HTMLMediaElement.prototype.setSinkId === 'function'
    );
  }, []);

  const applySink = useCallback(async (deviceId) => {
    sinkIdRef.current = deviceId;
    const elements = remoteAudioRef.current?.querySelectorAll('audio') || [];
    await Promise.all(
      [...elements].map((element) => element.setSinkId?.(deviceId).catch(() => {}))
    );
  }, []);

  const toggleSpeaker = useCallback(async () => {
    if (!canSwitchOutput) return;
    const next = !isSpeakerOn;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((device) => device.kind === 'audiooutput');
      const speaker =
        outputs.find((device) => /speaker/i.test(device.label)) ||
        outputs.find((device) => device.deviceId === 'default');
      const earpiece =
        outputs.find((device) => /earpiece|headset|headphone/i.test(device.label)) ||
        outputs.find((device) => device.deviceId === 'communications') ||
        speaker;
      const target = next ? speaker : earpiece;
      if (target) await applySink(target.deviceId);
      setIsSpeakerOn(next);
      setCallError('');
    } catch {
      setCallError('Could not switch the audio output.');
    }
  }, [applySink, canSwitchOutput, isSpeakerOn]);

  const isConnected = connectionStatus === 'connected';
  const statusText = {
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    connected: formatDuration(callDuration),
    disconnected: 'Call ended',
    failed: 'Could not connect',
  }[connectionStatus];

  const initial = call.contact?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-[100] h-dvh overflow-hidden bg-slate-950 text-white">
      <div ref={remoteAudioRef} className="hidden" aria-hidden="true" />

      {/* Stage */}
      {isVideoCall && hasRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,#1e3a5f_0%,#0f172a_48%,#020617_100%)]">
          <div className="flex h-full flex-col items-center justify-center px-6">
            <div className="relative flex items-center justify-center">
              {/* Concentric rings read as "live" while connected, and as an
                  outgoing pulse while the other side is still ringing. */}
              {(isConnected || connectionStatus === 'ringing') && (
                <>
                  <span className="absolute h-44 w-44 animate-ping rounded-full bg-primary/20 [animation-duration:2.4s]" />
                  <span className="absolute h-56 w-56 animate-ping rounded-full bg-primary/10 [animation-duration:2.4s] [animation-delay:0.5s]" />
                </>
              )}
              {call.contact?.avatar ? (
                <Image
                  src={getCloudinaryThumbnail(call.contact.avatar, 288)}
                  alt=""
                  width={144}
                  height={144}
                  className="relative h-32 w-32 rounded-full object-cover ring-4 ring-white/10 sm:h-36 sm:w-36"
                />
              ) : (
                <span className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-5xl font-bold ring-4 ring-white/10 sm:h-36 sm:w-36">
                  {initial}
                </span>
              )}
            </div>

            <h2 className="mt-8 font-display text-3xl font-bold tracking-tight">
              {call.contact?.name}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
              {connectionStatus === 'connecting' && (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              )}
              <span className={isConnected ? 'tabular-nums text-white/80' : ''}>
                {statusText}
              </span>
            </p>

            {isVideoCall && !hasRemoteVideo && isConnected && (
              <p className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/60">
                Camera is off on the other side
              </p>
            )}
          </div>
        </div>
      )}

      {/* Self view */}
      {isVideoCall && (
        <div className="absolute right-4 top-[calc(4.5rem+env(safe-area-inset-top))] h-40 w-28 overflow-hidden rounded-3xl bg-slate-800 ring-1 ring-white/20 sm:h-52 sm:w-36">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full scale-x-[-1] object-cover transition-opacity ${
              isCameraEnabled ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!isCameraEnabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoOff className="h-6 w-6 text-white/40" />
            </div>
          )}
        </div>
      )}

      {/* Top bar — no close control: only the red button may end a call. */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <p className="font-display text-base font-bold">{call.contact?.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
          {isVideoCall ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
          <span>{isVideoCall ? 'Video call' : 'Voice call'}</span>
          {isConnected && <span className="tabular-nums">· {formatDuration(callDuration)}</span>}
        </p>
      </div>

      {(callError || !canPlayAudio) && (
        <div className="absolute left-1/2 top-24 w-[min(90%,420px)] -translate-x-1/2 rounded-2xl bg-black/70 px-4 py-3 text-center text-xs backdrop-blur">
          {callError && <p className="text-white/80">{callError}</p>}
          {!canPlayAudio && (
            <button
              type="button"
              onClick={enableAudioPlayback}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-slate-900"
            >
              <Volume2 className="h-4 w-4" />
              Enable call audio
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto flex w-fit items-end gap-2 rounded-[28px] bg-white/8 p-3 ring-1 ring-white/10 backdrop-blur-xl sm:gap-3">
          <ControlButton
            onClick={toggleMicrophone}
            disabled={!isConnected}
            active={!isMicEnabled}
            label={isMicEnabled ? 'Mute' : 'Unmute'}
          >
            {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </ControlButton>

          <ControlButton
            onClick={toggleSpeaker}
            disabled={!isConnected || !canSwitchOutput}
            active={isSpeakerOn && canSwitchOutput}
            label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
          >
            {isSpeakerOn ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <Headphones className="h-5 w-5" />
            )}
          </ControlButton>

          {isVideoCall && (
            <ControlButton
              onClick={toggleCamera}
              disabled={!isConnected}
              active={!isCameraEnabled}
              label={isCameraEnabled ? 'Video' : 'Video off'}
            >
              {isCameraEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </ControlButton>
          )}

          <ControlButton onClick={onEnd} tone="danger" label="End">
            <PhoneOff className="h-5 w-5" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
