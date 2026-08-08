'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { getCallTokenApi } from '../services/api';

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
              src={call.caller.avatar}
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
      return;
    }

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    const remoteAudioContainer = remoteAudioRef.current;
    roomRef.current = room;

    const handleTrackSubscribed = (track) => {
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
        setHasRemoteVideo(true);
      }

      if (track.kind === Track.Kind.Audio && remoteAudioContainer) {
        const audioElement = track.attach();
        audioElement.autoplay = true;
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

    async function connectToCall() {
      setConnectionStatus('connecting');
      setCallError('');

      try {
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

    connectToCall();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.disconnect();
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

  const statusText = {
    ringing: `Calling ${call.contact?.name || 'contact'}…`,
    connecting: 'Connecting securely…',
    connected: formatDuration(callDuration),
    disconnected: 'Call disconnected',
    failed: 'Unable to connect',
  }[connectionStatus];

  return (
    <div className="fixed inset-0 z-[100] h-dvh overflow-hidden bg-slate-950 text-white">
      <div ref={remoteAudioRef} className="hidden" aria-hidden="true" />

      {isVideoCall ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`h-full w-full object-cover transition-opacity ${
              hasRemoteVideo ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!hasRemoteVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950">
              {call.contact?.avatar ? (
                <Image
                  src={call.contact.avatar}
                  alt={call.contact?.name || 'Contact'}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-full border-4 border-white/10 object-cover shadow-2xl"
                />
              ) : (
                <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/10 bg-slate-700 text-4xl font-semibold">
                  {call.contact?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
              <h2 className="mt-5 text-2xl font-semibold">{call.contact?.name}</h2>
              <p className="mt-2 text-sm text-slate-300">{statusText}</p>
            </div>
          )}

          <div className="absolute right-4 top-[calc(1.25rem+env(safe-area-inset-top))] h-36 w-24 overflow-hidden rounded-2xl border border-white/20 bg-slate-800 shadow-2xl sm:right-5 sm:h-52 sm:w-40">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full scale-x-[-1] object-cover ${
                isCameraEnabled ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!isCameraEnabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="h-7 w-7 text-slate-400" />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_#1e3a5f_0%,_#0f172a_45%,_#020617_100%)]">
          <div className="relative">
            {connectionStatus === 'connected' && (
              <div className="absolute -inset-5 animate-pulse rounded-full bg-primary/20" />
            )}
            {call.contact?.avatar ? (
              <Image
                src={call.contact.avatar}
                alt={call.contact?.name || 'Contact'}
                width={144}
                height={144}
                className="relative h-36 w-36 rounded-full border-4 border-white/10 object-cover shadow-2xl"
              />
            ) : (
              <span className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-white/10 bg-slate-700 text-4xl font-semibold">
                {call.contact?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <h2 className="mt-6 text-2xl font-semibold">{call.contact?.name}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
            {connectionStatus === 'connecting' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <span>{statusText}</span>
          </div>
        </div>
      )}

      <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div>
          <p className="text-sm font-semibold">{call.contact?.name}</p>
          <p className="text-xs text-white/70">{isVideoCall ? 'Video call' : 'Voice call'}</p>
        </div>
        <button
          type="button"
          onClick={onEnd}
          aria-label="Close call"
          className="rounded-full bg-black/25 p-2 hover:bg-black/40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {(callError || !canPlayAudio) && (
        <div className="absolute left-1/2 top-20 w-[min(90%,420px)] -translate-x-1/2 rounded-xl bg-black/65 px-4 py-3 text-center text-xs backdrop-blur">
          {callError && <p>{callError}</p>}
          {!canPlayAudio && (
            <button
              type="button"
              onClick={enableAudioPlayback}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 font-semibold text-slate-900"
            >
              <Volume2 className="h-4 w-4" />
              Enable call audio
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/45 p-3 shadow-2xl backdrop-blur-xl sm:gap-4">
        <button
          type="button"
          onClick={toggleMicrophone}
          disabled={connectionStatus !== 'connected'}
          aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
            isMicEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-slate-900'
          }`}
        >
          {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        {isVideoCall && (
          <button
            type="button"
            onClick={toggleCamera}
            disabled={connectionStatus !== 'connected'}
            aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              isCameraEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-slate-900'
            }`}
          >
            {isCameraEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </button>
        )}

        {!isVideoCall && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Headphones className="h-5 w-5" />
          </div>
        )}

        <button
          type="button"
          onClick={onEnd}
          aria-label="End call"
          className="flex h-12 w-14 items-center justify-center rounded-full bg-red-500 transition-transform hover:scale-105 hover:bg-red-600"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
