'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import {
  ChevronDown,
  Headphones,
  LoaderCircle,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { emitWebRTCSignal, onWebRTCSignal } from '../services/socket';

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function IncomingCall({ call, onAccept, onDecline }) {
  if (!call) return null;

  const isVideoCall = call.type === 'video';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black p-7 text-center text-white shadow-2xl">
        <div className="relative mx-auto mb-4 w-fit">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Avatar
            src={call.caller?.avatar}
            name={call.caller?.name || 'Caller'}
            size={96}
            className="relative ring-4 ring-white/10"
            fallbackClassName="text-3xl"
          />
        </div>

        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
          Incoming {isVideoCall ? 'video' : 'voice'} call
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">{call.caller?.name || 'Someone on Wave'}</h2>

        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-col items-center gap-2 text-[13px] text-white/70 active:scale-95"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white transition-colors duration-150 hover:bg-red-500">
              <PhoneOff className="h-6 w-6" strokeWidth={1.9} />
            </span>
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex flex-col items-center gap-2 text-[13px] text-white/70 active:scale-95"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors duration-150 hover:bg-emerald-400">
              {isVideoCall ? <Video className="h-6 w-6" strokeWidth={1.9} /> : <Phone className="h-6 w-6" strokeWidth={1.9} />}
            </span>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ onClick, disabled, active, label, children, tone }) {
  return (
    <div className="flex w-14 sm:w-16 flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-pressed={active === undefined ? undefined : active}
        className={`flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full transition-colors duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
          tone === 'danger'
            ? 'bg-red-600 text-white hover:bg-red-500'
            : active
            ? 'bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25 backdrop-blur-md'
            : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/30'
        }`}
      >
        {children}
      </button>
      <span className="max-w-full truncate text-[11px] font-medium text-white/70">{label}</span>
    </div>
  );
}

export function CallInterface({
  call,
  onEnd,
  isMinimized = false,
  onMinimize,
  onMaximize,
}) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pipContainerRef = useRef(null);
  const pipLocalVideoRef = useRef(null);
  const pipRemoteVideoRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const pipStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const [connectionStatus, setConnectionStatus] = useState(
    call.status === 'ringing' ? 'ringing' : 'connecting'
  );
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(call.type === 'video');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [selectedSinkId, setSelectedSinkId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callError, setCallError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isVideoCall = call.type === 'video';

  // Ensure both local and remote video streams are attached and actively playing in stage or PiP
  useEffect(() => {
    if (isMinimized && isVideoCall) {
      if (pipRemoteVideoRef.current && remoteStreamRef.current) {
        if (pipRemoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          pipRemoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        pipRemoteVideoRef.current.play?.().catch(() => {});
      }
      if (pipLocalVideoRef.current && localStreamRef.current) {
        if (pipLocalVideoRef.current.srcObject !== localStreamRef.current) {
          pipLocalVideoRef.current.srcObject = localStreamRef.current;
        }
        pipLocalVideoRef.current.play?.().catch(() => {});
      }
    } else if (!isMinimized) {
      if (localVideoRef.current && localStreamRef.current) {
        if (localVideoRef.current.srcObject !== localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        localVideoRef.current.play?.().catch(() => {});
      }
      if (remoteVideoRef.current && remoteStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        remoteVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [hasRemoteVideo, isCameraEnabled, isMinimized, isVideoCall]);

  // Set initial position for floating PiP when entering minimized state
  useEffect(() => {
    if (isMinimized && isVideoCall && pipContainerRef.current) {
      if (!pipContainerRef.current.style.top) {
        const isMobile = window.innerWidth < 768;
        const initialTop = 68; // Just below WhatsApp top bar
        const initialLeft = isMobile ? 16 : Math.max(window.innerWidth - 180, 16);
        pipContainerRef.current.style.top = `${initialTop}px`;
        pipContainerRef.current.style.left = `${initialLeft}px`;
      }
    }
  }, [isMinimized, isVideoCall]);

  // Keep floating PiP inside screen boundaries on window resize
  useEffect(() => {
    if (!isMinimized || !isVideoCall) return undefined;

    const handleResize = () => {
      const el = pipContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxX = window.innerWidth - el.offsetWidth - 12;
      const maxY = window.innerHeight - el.offsetHeight - 12;
      const clampedX = Math.min(Math.max(rect.left, 12), Math.max(maxX, 12));
      const clampedY = Math.min(Math.max(rect.top, 56), Math.max(maxY, 56));
      el.style.left = `${clampedX}px`;
      el.style.top = `${clampedY}px`;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMinimized, isVideoCall]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = pipContainerRef.current;
    if (!el) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    const rect = el.getBoundingClientRect();
    pipStartPosRef.current = { x: rect.left, y: rect.top };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;

    if (Math.hypot(dx, dy) > 6) {
      hasMovedRef.current = true;
    }

    const el = pipContainerRef.current;
    if (!el) return;

    const minX = 8;
    const maxX = window.innerWidth - el.offsetWidth - 8;
    const minY = 56;
    const maxY = window.innerHeight - el.offsetHeight - 8;

    const nextX = Math.min(Math.max(pipStartPosRef.current.x + dx, minX), Math.max(maxX, minX));
    const nextY = Math.min(Math.max(pipStartPosRef.current.y + dy, minY), Math.max(maxY, minY));

    el.style.left = `${nextX}px`;
    el.style.top = `${nextY}px`;
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!hasMovedRef.current) {
      onMaximize?.();
    }
  };

  // Handle mobile / browser back button to minimize call instead of exiting app
  useEffect(() => {
    if (isMinimized) return undefined;

    if (!window.history.state?.waveCallFullscreen) {
      window.history.pushState({ ...window.history.state, waveCallFullscreen: true }, '');
    }

    const handlePopState = (event) => {
      if (!event.state?.waveCallFullscreen) onMinimize?.();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isMinimized, onMinimize]);

  const handleMinimize = useCallback(() => {
    if (window.history.state?.waveCallFullscreen) {
      window.history.back();
    } else {
      onMinimize?.();
    }
  }, [onMinimize]);

  const handleEnd = useCallback(() => {
    if (window.history.state?.waveCallFullscreen) {
      window.history.back();
    }
    onEnd?.();
  }, [onEnd]);

  useEffect(() => {
    if (call.status === 'ringing') {
      return undefined;
    }

    let cancelled = false;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      ],
    });
    peerConnectionRef.current = pc;
    iceCandidatesQueueRef.current = [];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitWebRTCSignal({
          callId: call.callId,
          signal: { type: 'candidate', candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setCallError('');
      } else if (pc.connectionState === 'failed') {
        setCallError('Connection lost. Reconnecting...');
        setConnectionStatus('connecting');
      } else if (pc.connectionState === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    };

    pc.ontrack = (event) => {
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = event.streams[0] || new MediaStream();
        remoteStreamRef.current = stream;
      }
      if (!stream.getTracks().includes(event.track)) {
        stream.addTrack(event.track);
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      if (pipRemoteVideoRef.current) {
        pipRemoteVideoRef.current.srcObject = stream;
        pipRemoteVideoRef.current.play?.().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play?.().catch(() => {});
      }

      if (event.track.kind === 'video') {
        setHasRemoteVideo(true);
        event.track.onmute = () => setHasRemoteVideo(false);
        event.track.onunmute = () => setHasRemoteVideo(true);
        event.track.onended = () => setHasRemoteVideo(false);
      }
    };

    let resolveMedia;
    const mediaReady = new Promise((resolve) => {
      resolveMedia = resolve;
    });

    const unsubscribeSignal = onWebRTCSignal(async ({ callId, signal }) => {
      if (callId !== call.callId || !signal) return;
      try {
        if (signal.type === 'offer') {
          await mediaReady;
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          while (iceCandidatesQueueRef.current.length > 0) {
            const cand = iceCandidatesQueueRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitWebRTCSignal({ callId: call.callId, signal: answer });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          while (iceCandidatesQueueRef.current.length > 0) {
            const cand = iceCandidatesQueueRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            iceCandidatesQueueRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('WebRTC signal handling warning:', err);
      }
    });

    async function startMediaAndCall() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideoCall
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            : false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        // Apply initial mic & camera states
        stream.getAudioTracks().forEach((t) => {
          t.enabled = isMicEnabled;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = isCameraEnabled;
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }
        if (pipLocalVideoRef.current) {
          pipLocalVideoRef.current.srcObject = stream;
          pipLocalVideoRef.current.play?.().catch(() => {});
        }

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        resolveMedia();

        // If caller (outgoing), create and send offer
        if (call.direction === 'outgoing') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          emitWebRTCSignal({ callId: call.callId, signal: offer });
        }
      } catch (err) {
        resolveMedia();
        if (!cancelled) {
          console.error('Media capture error:', err);
          setCallError('Could not access microphone/camera. Please check permissions.');
        }
      }
    }

    startMediaAndCall();

    return () => {
      cancelled = true;
      unsubscribeSignal();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      pc.close();
      peerConnectionRef.current = null;
      iceCandidatesQueueRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.callId, call.direction, call.status, isVideoCall]);

  useEffect(() => {
    if (connectionStatus !== 'connected') return undefined;

    const startedAt = Date.now();
    const durationTimer = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(durationTimer);
  }, [connectionStatus]);

  const toggleMicrophone = () => {
    const nextValue = !isMicEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setIsMicEnabled(nextValue);
  };

  const toggleCamera = () => {
    const nextValue = !isCameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setIsCameraEnabled(nextValue);
  };

  const enableAudioPlayback = async () => {
    try {
      if (remoteVideoRef.current) await remoteVideoRef.current.play();
      if (remoteAudioRef.current) await remoteAudioRef.current.play();
      setCanPlayAudio(true);
    } catch {
      setCallError('Tap again to enable call audio.');
    }
  };

  // Audio output routing. setSinkId is Chromium-only; on Safari/iOS the browser
  // owns routing entirely, so the control is disabled rather than faked.
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [canSwitchOutput] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.HTMLMediaElement !== 'undefined' &&
      typeof window.HTMLMediaElement.prototype?.setSinkId === 'function'
  );

  useEffect(() => {
    if (!selectedSinkId) return;
    if (remoteVideoRef.current && typeof remoteVideoRef.current.setSinkId === 'function') {
      remoteVideoRef.current.setSinkId(selectedSinkId).catch(() => {});
    }
    if (remoteAudioRef.current && typeof remoteAudioRef.current.setSinkId === 'function') {
      remoteAudioRef.current.setSinkId(selectedSinkId).catch(() => {});
    }
  }, [selectedSinkId]);

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
      if (target) {
        setSelectedSinkId(target.deviceId);
      }
      setIsSpeakerOn(next);
      setCallError('');
    } catch {
      setCallError('Could not switch the audio output.');
    }
  }, [canSwitchOutput, isSpeakerOn, setSelectedSinkId]);

  const isConnected = connectionStatus === 'connected';
  const statusText = {
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    connected: formatDuration(callDuration),
    disconnected: 'Call ended',
    failed: 'Could not connect',
  }[connectionStatus];

  return (
    <>
      {/* WhatsApp-Style Call Top Bar (visible when minimized) */}
      {isMinimized && (
        <header
          role="button"
          tabIndex={0}
          onClick={onMaximize}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onMaximize?.();
            }
          }}
          className="fixed top-0 inset-x-0 z-[85] flex h-[calc(3.25rem+env(safe-area-inset-top))] cursor-pointer select-none items-center justify-between border-b border-white/10 bg-black/95 px-3 pt-[env(safe-area-inset-top)] text-white shadow-xl backdrop-blur-md transition-colors duration-150 hover:bg-black/85 sm:px-6"
        >
          {/* Left: Microphone Mute Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMicrophone();
            }}
            aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 active:scale-95 ${
              !isMicEnabled
                ? 'bg-red-500/25 text-red-400 ring-1 ring-red-500/40'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isMicEnabled ? <Mic className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <MicOff className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          </button>

          {/* Center: Video/Audio icon + Contact Name - Status / Timer */}
          <div className="flex items-center gap-2 min-w-0 px-2">
            {isVideoCall ? (
              <Video className="h-4 w-4 flex-shrink-0 fill-emerald-400 text-emerald-400" strokeWidth={1.9} />
            ) : (
              <Phone className="h-4 w-4 flex-shrink-0 fill-emerald-400 text-emerald-400" strokeWidth={1.9} />
            )}
            <span className="truncate text-[13px] font-semibold text-emerald-400">
              {call.contact?.name || 'User'} - {statusText}
            </span>
            {(connectionStatus === 'ringing' || connectionStatus === 'connecting') && (
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>

          {/* Right: End Call Red Circular Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEnd();
            }}
            aria-label="End call"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white transition-colors duration-150 hover:bg-red-500 active:scale-95"
          >
            <PhoneOff className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        </header>
      )}

      {/* WhatsApp-Style Floating Picture-in-Picture Video Card (visible when minimized in video call) */}
      {isMinimized && isVideoCall && (
        <div
          ref={pipContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-label="Floating video call preview. Tap to return to call or drag to move."
          title="Tap to return to call, or drag to move"
          className="fixed z-[80] flex h-44 w-28 cursor-grab select-none touch-none flex-col overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl transition-colors duration-150 hover:border-white/30 active:cursor-grabbing sm:h-50 sm:w-32 md:h-60 md:w-40"
        >
          {/* Main Remote Video Stream in PiP */}
          <div className="relative h-full w-full bg-black">
            <video
              ref={pipRemoteVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover transition-opacity duration-200 pointer-events-none ${
                hasRemoteVideo ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Fallback avatar if remote camera is off or connecting */}
            {!hasRemoteVideo && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-primary)_16%,black)_0%,black_70%)] px-2 text-center">
                <Avatar
                  src={call.contact?.avatar}
                  name={call.contact?.name}
                  size={48}
                  className="ring-2 ring-white/15"
                />
                <span className="mt-2 max-w-full truncate text-[11px] font-medium text-white/70">
                  {connectionStatus === 'connected' ? 'Camera off' : statusText}
                </span>
              </div>
            )}

            {/* Inset Local Self-View in bottom-right corner */}
            <div className="pointer-events-none absolute bottom-2 right-2 h-14 w-10 overflow-hidden rounded-xl border border-white/20 bg-black shadow-lg sm:h-16 sm:w-11 md:h-20 md:w-14">
              <video
                ref={pipLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover scale-x-[-1] transition-opacity ${
                  isCameraEnabled ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {!isCameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white/50">
                  <VideoOff className="h-3.5 w-3.5" strokeWidth={1.9} />
                </div>
              )}
            </div>

            {/* Top-Right Maximize Icon Pill */}
            <div className="pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-sm">
              <Maximize2 className="h-3 w-3" strokeWidth={1.9} />
            </div>

            {/* Bottom-Left Contact Name Pill */}
            <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-52px)] truncate rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
              {call.contact?.name || 'User'}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Call Dialog / Window */}
      <div
        className={
          isMinimized
            ? 'pointer-events-none fixed inset-0 -z-50 opacity-0 overflow-hidden'
            : 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-6 text-white'
        }
      >
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" aria-hidden="true" />

        {/* Call Window: Fixed WhatsApp aspect on Desktop, Fullscreen on Mobile */}
        <div
          className={`relative flex flex-col overflow-hidden bg-black transition-all duration-300 ${
            isFullscreen
              ? 'fixed inset-0 h-dvh w-full rounded-none'
              : 'h-dvh w-full md:h-[560px] md:max-h-[88vh] md:w-[800px] md:max-w-[94vw] md:rounded-2xl md:border md:border-white/15 md:shadow-2xl'
          }`}
        >
          {/* Stage Video & Fallback */}
          <div className="absolute inset-0 z-0 bg-black">
            {/* Remote Video Track */}
            {isVideoCall && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                  hasRemoteVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            )}

            {/* Fallback / Avatar Stage (shown when audio call or remote video is off) */}
            {(!isVideoCall || !hasRemoteVideo) && (
              <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_38%,color-mix(in_srgb,var(--color-primary)_16%,black)_0%,black_62%)]">
                <div className="flex h-full flex-col items-center justify-center px-6">
                  <div className="relative flex items-center justify-center">
                    {(isConnected || connectionStatus === 'ringing') && (
                      <>
                        <span className="absolute h-40 w-40 animate-ping rounded-full bg-primary/20 [animation-duration:2.4s]" />
                        <span className="absolute h-52 w-52 animate-ping rounded-full bg-primary/10 [animation-duration:2.4s] [animation-delay:0.5s]" />
                      </>
                    )}
                    <Avatar
                      src={call.contact?.avatar}
                      name={call.contact?.name}
                      size={120}
                      className="relative ring-4 ring-white/10 shadow-2xl"
                      fallbackClassName="text-4xl"
                    />
                  </div>

                  <h2 className="mt-6 text-center font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    {call.contact?.name}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-[13px] text-white/60">
                    {connectionStatus === 'connecting' && (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
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
          </div>

          {/* Floating Self View (PiP) */}
          {isVideoCall && (
            <div className="absolute right-4 top-16 z-20 h-36 w-26 overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20 sm:top-18 sm:h-44 sm:w-32 md:h-48 md:w-36">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/90 text-white/50">
                  <VideoOff className="h-6 w-6" strokeWidth={1.9} />
                  <span className="text-[11px] font-medium">You</span>
                </div>
              )}
            </div>
          )}

          {/* Top Bar Header */}
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleMinimize}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md transition-colors duration-150 hover:bg-white/20 active:scale-95"
                aria-label="Minimize call and return to chats"
                title="Back to chats"
              >
                <ChevronDown className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </button>
              <div>
                <p className="font-display text-[15px] font-semibold leading-tight tracking-tight">
                  {call.contact?.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
                  {isVideoCall ? (
                    <Video className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.9} />
                  ) : (
                    <Phone className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.9} />
                  )}
                  <span>{isVideoCall ? 'Video call' : 'Voice call'}</span>
                  {isConnected && (
                    <span className="tabular-nums font-medium">· {formatDuration(callDuration)}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Desktop Fullscreen / Window Toggle */}
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md transition-colors duration-150 hover:bg-white/20 active:scale-95"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Maximize2 className="h-[18px] w-[18px]" strokeWidth={1.9} />}
              </button>
            </div>
          </div>

          {/* Error / Audio playback warning badge */}
          {(callError || !canPlayAudio) && (
            <div className="absolute left-1/2 top-20 z-40 w-[min(90%,380px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/80 px-4 py-2.5 text-center text-[13px] shadow-xl backdrop-blur-md">
              {callError && <p className="text-white/90">{callError}</p>}
              {!canPlayAudio && (
                <button
                  type="button"
                  onClick={enableAudioPlayback}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-container active:scale-95"
                >
                  <Volume2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  Enable call audio
                </button>
              )}
            </div>
          )}

          {/* Floating Controls Dock (WhatsApp Style) */}
          <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/80 px-5 py-3 shadow-2xl ring-1 ring-white/15 backdrop-blur-2xl sm:gap-4">
              <ControlButton
                onClick={toggleMicrophone}
                disabled={!isConnected}
                active={isMicEnabled}
                label={isMicEnabled ? 'Mute' : 'Unmuted'}
              >
                {isMicEnabled ? <Mic className="h-5 w-5" strokeWidth={1.9} /> : <MicOff className="h-5 w-5" strokeWidth={1.9} />}
              </ControlButton>

              <ControlButton
                onClick={toggleSpeaker}
                disabled={!isConnected || !canSwitchOutput}
                active={true}
                label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
              >
                {isSpeakerOn ? <Volume2 className="h-5 w-5" strokeWidth={1.9} /> : <Headphones className="h-5 w-5" strokeWidth={1.9} />}
              </ControlButton>

              {isVideoCall && (
                <ControlButton
                  onClick={toggleCamera}
                  disabled={!isConnected}
                  active={isCameraEnabled}
                  label={isCameraEnabled ? 'Stop Video' : 'Start Video'}
                >
                  {isCameraEnabled ? <Video className="h-5 w-5" strokeWidth={1.9} /> : <VideoOff className="h-5 w-5" strokeWidth={1.9} />}
                </ControlButton>
              )}

              <ControlButton onClick={handleEnd} tone="danger" label="End">
                <PhoneOff className="h-5 w-5" strokeWidth={1.9} />
              </ControlButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
