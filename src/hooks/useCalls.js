'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startRingtone, stopRingtone } from '../utils/notificationSound';
import {
  acceptCall,
  declineCall,
  endCall,
  inviteCall,
  onCallAccepted,
  onCallDeclined,
  onCallEnded,
  onIncomingCall,
} from '../services/socket';

export function useCalls({ currentUser, isBackendConnected, activeConversation }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callNotice, setCallNotice] = useState('');

  // Mirrors of the two call slots. Deciding "am I already busy?" has to happen
  // outside a state updater: React re-runs updaters (twice in Strict Mode), so
  // any decline emitted from inside one fires spuriously and kills a good call.
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);

  const applyActiveCall = useCallback((call) => {
    activeCallRef.current = call;
    setActiveCall(call);
  }, []);

  const applyIncomingCall = useCallback((call) => {
    incomingCallRef.current = call;
    setIncomingCall(call);
  }, []);

  useEffect(() => {
    if (!currentUser || !isBackendConnected) return undefined;

    const unsubscribeIncoming = onIncomingCall((call) => {
      // Genuinely busy: already on a call, or another invite is still ringing.
      if (activeCallRef.current || incomingCallRef.current) {
        declineCall(call.callId);
        return;
      }
      applyIncomingCall(call);
    });
    const unsubscribeAccepted = onCallAccepted((event) => {
      if (activeCallRef.current?.callId === event.callId) {
        applyActiveCall({ ...activeCallRef.current, status: 'connecting' });
      }
      if (incomingCallRef.current?.callId === event.callId) {
        applyIncomingCall(null);
      }
    });
    const unsubscribeDeclined = onCallDeclined((event) => {
      // Only report a decline for a call we are actually part of, so a stale
      // event cannot clear the slot for an unrelated call.
      const isOurs =
        activeCallRef.current?.callId === event.callId ||
        incomingCallRef.current?.callId === event.callId;
      if (!isOurs) return;

      if (activeCallRef.current?.callId === event.callId) applyActiveCall(null);
      if (incomingCallRef.current?.callId === event.callId) applyIncomingCall(null);
      setCallNotice('Call declined');
    });
    const unsubscribeEnded = onCallEnded((event) => {
      if (activeCallRef.current?.callId === event.callId) applyActiveCall(null);
      if (incomingCallRef.current?.callId === event.callId) applyIncomingCall(null);
      if (event.reason === 'missed') setCallNotice('No answer');
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeAccepted();
      unsubscribeDeclined();
      unsubscribeEnded();
    };
  }, [currentUser, isBackendConnected, applyActiveCall, applyIncomingCall]);

  // Ring while a call is pending, and stop the moment it is answered,
  // declined, missed or torn down — the effect's cleanup covers every exit.
  const soundEnabled = currentUser?.preferences?.soundEnabled !== false;

  useEffect(() => {
    if (!soundEnabled) return undefined;

    const isRingingIn = Boolean(incomingCall);
    const isRingingOut =
      activeCall?.direction === 'outgoing' && activeCall?.status === 'ringing';

    if (!isRingingIn && !isRingingOut) return undefined;

    startRingtone({ outgoing: !isRingingIn });
    return () => stopRingtone();
  }, [incomingCall, activeCall?.direction, activeCall?.status, soundEnabled]);

  // Belt and braces: never leave a ringtone playing if the hook unmounts.
  useEffect(() => () => stopRingtone(), []);

  const startCall = useCallback(
    async (type) => {
      if (!activeConversation || activeCall || incomingCall) return;
      setCallNotice('');
      const response = await inviteCall(activeConversation.id, type);
      if (!response.ok) {
        setCallNotice(response.error || 'Unable to start the call');
        return;
      }
      applyActiveCall({
        ...response.call,
        direction: 'outgoing',
        contact: activeConversation.contact,
      });
    },
    [activeCall, activeConversation, incomingCall, applyActiveCall]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    applyIncomingCall(null);
    applyActiveCall({
      ...call,
      direction: 'incoming',
      status: 'connecting',
      contact: call.caller,
    });
    const response = await acceptCall(call.callId);
    if (!response.ok) {
      applyActiveCall(null);
      setCallNotice(response.error || 'This call is no longer available');
    }
  }, [incomingCall, applyActiveCall, applyIncomingCall]);

  const declineIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const { callId } = incomingCall;
    applyIncomingCall(null);
    await declineCall(callId);
  }, [incomingCall, applyIncomingCall]);

  const endActiveCall = useCallback(() => {
    if (!activeCall) return;
    const { callId } = activeCall;
    applyActiveCall(null);
    endCall(callId);
  }, [activeCall, applyActiveCall]);

  return {
    incomingCall,
    activeCall,
    callNotice,
    setCallNotice,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endActiveCall,
  };
}
