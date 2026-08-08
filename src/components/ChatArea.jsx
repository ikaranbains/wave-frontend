'use client';

import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Phone,
  Video,
  Info,
  Send,
  Smile,
  CheckCheck,
  Download,
  X,
  FileText,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  ImagePlus,
  Headphones,
  RotateCcw,
  MoreVertical,
  Reply,
  Clock3,
  Copy,
  Trash2,
  Ban,
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { getInitials, isRealAvatar } from '../utils/avatarUtils';
import { describeCallEvent, formatLastSeen } from '../utils/chatFormatters';

// Messages that are nothing but emoji get rendered large, the way every other
// messenger does it — at body size a lone reaction reads as a typo.
// Every code point allowed in an emoji-only message: the pictographs plus the
// joiners, skin-tone modifiers, variation selectors, regional indicators (flags)
// and keycap bases that combine into one glyph.
const EMOJI_PARTS =
  /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣\s0-9#*]+$/u;
// At least one of these must be present, or "123" would qualify as emoji.
const EMOJI_SIGNAL = /[\p{Extended_Pictographic}\p{Regional_Indicator}⃣]/u;

// Grapheme clusters, so 👨‍👩‍👧‍👦 and 🇮🇳 each count as one emoji rather than
// as their component code points.
const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

function emojiOnlyScale(text) {
  const trimmed = text?.trim();
  if (!trimmed || !EMOJI_PARTS.test(trimmed) || !EMOJI_SIGNAL.test(trimmed)) {
    return null;
  }

  const bare = trimmed.replace(/\s/g, '');
  const count = segmenter
    ? [...segmenter.segment(bare)].length
    : [...bare].length;

  if (count === 0 || count > 6) return null;
  if (count === 1) return 'text-[2.75rem] leading-tight';
  if (count <= 3) return 'text-[2rem] leading-tight';
  return 'text-[1.5rem] leading-tight';
}

/**
 * A finished call, shown inline in the thread. Centred like a day divider
 * rather than sided like a bubble — it is a record of something that happened,
 * not something either person said.
 */
function CallLogEntry({ message }) {
  const isOutgoing = message.isSentByMe;
  const { label, detail, missed } = describeCallEvent(message.callEvent, isOutgoing);
  const isVideo = message.callEvent?.type === 'video';
  const Icon = isVideo ? Video : Phone;

  return (
    <div className="my-1 flex w-full justify-center px-2">
      <div
        className={`flex max-w-[85%] items-center gap-2.5 rounded-2xl border px-3.5 py-2 ${
          missed
            ? 'border-red-200/70 bg-red-50/80 text-red-700'
            : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant'
        }`}
      >
        <span
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
            missed ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 text-xs font-medium">
          <span className="truncate">{label}</span>
          {detail && <span className="opacity-70"> · {detail}</span>}
        </span>
        <span className="flex-shrink-0 text-[11px] text-outline">{message.time}</span>
      </div>
    </div>
  );
}

export const ChatArea = memo(function ChatArea({
  conversation,
  messages = [],
  isLoading = false,
  isContactTyping = false,
  onSendMessage,
  onRetryMessage,
  onDeleteMessage,
  onStartCall,
  onBack,
  onTypingStart,
  onTypingStop,
}) {
  const [inputText, setInputText] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendError, setSendError] = useState('');
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);

  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const mediaInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const selectedFilePreview = useMemo(
    () => (selectedFile?.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : null),
    [selectedFile]
  );
  const sharedImages = useMemo(
    () =>
      messages
        .filter((message) => message.attachment?.type === 'image' && message.attachment?.url)
        .map((message) => message.attachment),
    [messages]
  );

  useEffect(
    () => () => {
      if (selectedFilePreview) URL.revokeObjectURL(selectedFilePreview);
    },
    [selectedFilePreview]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setIsEmojiPickerOpen(false);
      }
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target)
      ) {
        setIsAttachmentMenuOpen(false);
      }
      if (
        messageMenuRef.current &&
        !messageMenuRef.current.contains(event.target)
      ) {
        setActiveMenuMessageId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsEmojiPickerOpen(false);
        setIsAttachmentMenuOpen(false);
        setActiveMenuMessageId(null);
        inputRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const needed = el.scrollHeight;
    el.style.height = `${Math.min(needed, 140)}px`;
    // Only scroll once the composer has actually hit its ceiling, otherwise
    // a stray scrollbar shows up next to a single line of text.
    el.style.overflowY = needed > 140 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversation?.id]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);
    if (sendError) setSendError('');

    if (conversation?.id && onTypingStart && onTypingStop) {
      onTypingStart(conversation.id);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        onTypingStop(conversation.id);
      }, 2500);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const normalizedText = inputText.trim();
    if ((!normalizedText && !selectedFile) || isSending) return;

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (conversation?.id && onTypingStop) {
      onTypingStop(conversation.id);
    }

    setIsSending(true);
    setUploadProgress(0);
    setSendError('');

    const replyData = replyingToMessage
      ? {
          id: replyingToMessage.id,
          senderName: replyingToMessage.isSentByMe
            ? 'You'
            : conversation?.contact?.name || 'Contact',
          text: replyingToMessage.text || '',
          attachmentType: replyingToMessage.attachment?.type,
          attachmentName: replyingToMessage.attachment?.name,
          attachmentUrl: replyingToMessage.attachment?.url,
        }
      : undefined;

    try {
      await onSendMessage(normalizedText, selectedFile, setUploadProgress, replyData);
      setInputText('');
      setSelectedFile(null);
      setReplyingToMessage(null);
      setIsEmojiPickerOpen(false);
      setIsAttachmentMenuOpen(false);
    } catch (error) {
      setSendError(error.message || 'Unable to send this message');
    } finally {
      setIsSending(false);
      setUploadProgress(0);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    if (!attachment?.url) return;
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.name || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(attachment.url, '_blank');
    }
  };

  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? inputText.length;
    const selectionEnd = input?.selectionEnd ?? inputText.length;
    const nextValue =
      inputText.slice(0, selectionStart) + emoji + inputText.slice(selectionEnd);
    const nextCursorPosition = selectionStart + emoji.length;

    setInputText(nextValue);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setSendError('Files must be 25 MB or smaller.');
      return;
    }

    setSelectedFile(file);
    setSendError('');
    setIsAttachmentMenuOpen(false);
    inputRef.current?.focus();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!conversation) {
    return (
      <main className="hidden h-full flex-1 items-center justify-center bg-white md:flex">
        <div className="max-w-sm px-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container text-primary">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold text-on-surface">Select a chat</h2>
          <p className="mt-2 text-xs leading-relaxed text-outline">
            Choose a conversation from the list to view messages and start chatting.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 bg-white h-full relative overflow-hidden">
      {/* Primary Chat Window */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Header */}
        <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] flex-shrink-0 items-center justify-between border-b border-outline-variant/40 bg-surface px-3 pt-[env(safe-area-inset-top)] sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="md:hidden -ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-shrink-0">
              {isRealAvatar(conversation.contact?.avatar) ? (
                <Image
                  src={conversation.contact.avatar}
                  alt={conversation.contact?.name || 'Contact'}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container font-bold text-sm text-primary select-none">
                  {getInitials(conversation.contact?.name)}
                </span>
              )}
              {conversation.isOnline && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-on-surface truncate">
                {conversation.contact?.name}
              </h2>
              {conversation.isOnline ? (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Online
                </span>
              ) : (
                <span className="text-[11px] text-outline">
                  {formatLastSeen(conversation.contact?.lastSeen)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onStartCall?.('voice')}
              className="w-9 h-9 flex items-center justify-center text-primary hover:bg-surface-container-high rounded-full transition-all active:scale-95"
              title="Start Voice Call"
              aria-label={`Voice call ${conversation.contact?.name}`}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStartCall?.('video')}
              className="w-9 h-9 flex items-center justify-center text-primary hover:bg-surface-container-high rounded-full transition-all active:scale-95"
              title="Start Video Call"
              aria-label={`Video call ${conversation.contact?.name}`}
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowInfoDrawer(!showInfoDrawer)}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 ${
                showInfoDrawer
                  ? 'bg-secondary-container text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
              title="Toggle Details Drawer"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Message History Area */}
        <div className="scroll-touch flex flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-outline">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="rounded-2xl border border-dashed border-outline-variant bg-surface px-8 py-6 text-center">
                <h3 className="text-sm font-semibold text-on-surface">No messages yet</h3>
                <p className="mt-1 text-xs text-outline">
                  Send the first message to {conversation.contact?.name}.
                </p>
              </div>
            </div>
          ) : messages.map((msg) => (
            msg.callEvent ? (
              <CallLogEntry key={msg.id} message={msg} />
            ) : (
            <div
              key={msg.id}
              className={`group/msg flex items-start gap-1.5 max-w-[85%] sm:max-w-[75%] ${
                msg.isSentByMe ? 'self-end flex-row-reverse' : 'self-start flex-row'
              }`}
            >
              <div className="flex flex-col min-w-0">
                <div
                  className={`p-1.5 rounded-2xl text-xs leading-relaxed shadow-xs relative ${
                    msg.isDeleted
                      ? 'bg-surface-container-low text-outline italic rounded-2xl border border-outline-variant/40'
                      : msg.isSentByMe
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-surface-container-low text-on-surface rounded-tl-xs border border-surface-container-highest/60'
                  }`}
                >
                  {msg.isDeleted ? (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs italic opacity-80">
                      <Ban className="w-3.5 h-3.5 flex-shrink-0 opacity-75" />
                      <span>This message was deleted</span>
                    </div>
                  ) : (
                    <>
                      {/* Quoted reply block (nested inside bubble, WhatsApp style) */}
                      {Boolean(msg.replyTo && (msg.replyTo.id || msg.replyTo.senderName || msg.replyTo.text || msg.replyTo.attachmentUrl)) && (
                        <div
                          className={`mb-1 flex items-stretch gap-2 overflow-hidden rounded-lg ${
                            msg.isSentByMe ? 'bg-black/20' : 'bg-primary/8'
                          }`}
                        >
                          <span
                            className={`w-[3px] flex-shrink-0 rounded-full ${
                              msg.isSentByMe ? 'bg-white' : 'bg-primary'
                            }`}
                          />
                          <div className="min-w-0 flex-1 py-1.5 pr-1">
                            <span
                              className={`block truncate text-[11px] font-semibold leading-tight ${
                                msg.isSentByMe ? 'text-white' : 'text-primary'
                              }`}
                            >
                              {msg.replyTo.senderName || 'Replied message'}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-80">
                              {msg.replyTo.text ||
                                (msg.replyTo.attachmentName
                                  ? `[${(msg.replyTo.attachmentType || 'File').toUpperCase()}] ${msg.replyTo.attachmentName}`
                                  : 'Attachment')}
                            </span>
                          </div>
                          {msg.replyTo.attachmentUrl && msg.replyTo.attachmentType === 'image' && (
                            <Image
                              src={msg.replyTo.attachmentUrl}
                              alt="Replying photo thumbnail"
                              width={44}
                              height={44}
                              className="h-11 w-11 flex-shrink-0 object-cover"
                            />
                          )}
                        </div>
                      )}

                      <div className="px-2 pb-1 pt-0.5">
                      {msg.text && (
                        <p
                          className={`whitespace-pre-wrap break-words ${
                            emojiOnlyScale(msg.text) || ''
                          }`}
                        >
                          {msg.text}
                        </p>
                      )}

                      {/* Attachment Render */}
                      {msg.attachment && (
                        <div className={msg.text ? 'mt-2' : ''}>
                          {msg.attachment.type === 'image' ? (
                            <div className="relative group/img rounded-lg overflow-hidden border border-white/20">
                              <Image
                                src={msg.attachment.url}
                                alt={msg.attachment.name || 'Attachment'}
                                width={224}
                                height={144}
                                onClick={() => setPreviewImage(msg.attachment?.url || null)}
                                className="w-56 h-36 object-cover cursor-pointer hover:scale-105 transition-transform"
                              />
                            </div>
                          ) : msg.attachment.type === 'video' ? (
                            <video
                              src={msg.attachment.url}
                              controls
                              preload="metadata"
                              className="max-h-64 w-64 rounded-lg bg-black"
                            >
                              Your browser does not support video playback.
                            </video>
                          ) : msg.attachment.type === 'audio' ? (
                            <div className="min-w-64 rounded-xl bg-black/10 p-2">
                              <div className="mb-1.5 flex items-center gap-2">
                                <Headphones className="h-4 w-4 flex-shrink-0" />
                                <span className="max-w-48 truncate text-[11px]">
                                  {msg.attachment.name || 'Audio'}
                                </span>
                              </div>
                              <audio
                                src={msg.attachment.url}
                                controls
                                preload="metadata"
                                className="h-9 w-full"
                              >
                                Your browser does not support audio playback.
                              </audio>
                            </div>
                          ) : (
                            <a
                              href={msg.attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              download={msg.attachment.name}
                              className="flex min-w-56 items-center gap-2 rounded-lg bg-black/10 p-2 text-xs transition-colors hover:bg-black/15"
                            >
                              <FileText className="w-4 h-4 flex-shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{msg.attachment.name}</span>
                                {msg.attachment.size && (
                                  <span className="block text-[10px] opacity-75">
                                    {msg.attachment.size}
                                  </span>
                                )}
                              </span>
                              <Download className="w-3.5 h-3.5 ml-auto cursor-pointer" />
                            </a>
                          )}
                        </div>
                      )}
                      </div>
                    </>
                  )}
                </div>

                {/* Timestamp & Status Icon */}
                <div
                  className={`flex items-center gap-1 mt-1 text-[10px] text-outline ${
                    msg.isSentByMe ? 'self-end mr-1' : 'self-start ml-1'
                  }`}
                >
                  <span>{msg.time}</span>
                  {msg.isSentByMe && msg.status === 'sending' && (
                    <LoaderCircle className="h-3 w-3 animate-spin text-outline" />
                  )}
                  {msg.isSentByMe && msg.status === 'queued' && (
                    <span
                      title="Waiting for a connection — this sends automatically"
                      className="inline-flex items-center gap-1 font-medium text-amber-600"
                    >
                      <Clock3 className="h-3 w-3" />
                      Queued
                    </span>
                  )}
                  {msg.isSentByMe && msg.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => onRetryMessage?.(msg)}
                      title={msg.error || 'Message was not delivered'}
                      className="inline-flex items-center gap-1 font-semibold text-red-600 hover:text-red-700"
                      aria-label="Retry sending message"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Failed · Retry
                    </button>
                  )}
                  {msg.isSentByMe &&
                    msg.status !== 'sending' &&
                    msg.status !== 'queued' &&
                    msg.status !== 'failed' && (
                      <CheckCheck className="w-3.5 h-3.5 text-primary" />
                    )}
                </div>
              </div>

              {/* 3-Dots Menu Trigger Button */}
              {!msg.isDeleted && (
                <div className="relative self-center opacity-70 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMessageId(
                        activeMenuMessageId === msg.id ? null : msg.id
                      );
                    }}
                    className="p-1.5 rounded-full text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    title="Message options"
                    aria-label="Message options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {activeMenuMessageId === msg.id && (
                    <div
                      ref={messageMenuRef}
                      className={`absolute z-50 bottom-full mb-1 w-44 rounded-2xl border border-outline-variant/60 bg-white p-1.5 shadow-2xl ${
                        msg.isSentByMe ? 'right-0' : 'left-0'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToMessage(msg);
                          setActiveMenuMessageId(null);
                          inputRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-on-surface rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer"
                      >
                        <Reply className="w-4 h-4 text-primary" />
                        <span>Reply</span>
                      </button>

                      {msg.attachment && (
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadAttachment(msg.attachment);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-on-surface rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                          <span>Download file</span>
                        </button>
                      )}

                      {msg.text && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            setActiveMenuMessageId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-on-surface rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4 text-outline" />
                          <span>Copy text</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMessage?.(msg);
                          setActiveMenuMessageId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <span>Delete message</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          ))}

          {/* Real-time Typing Bubble Animation */}
          {isContactTyping && (
            <div className="mb-2 flex items-center gap-2 self-start px-1 duration-200 animate-in fade-in slide-in-from-left-2">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs border border-surface-container-highest/60 bg-surface-container-low px-3 py-2.5 shadow-xs">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.16s]" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.32s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box Bar */}
        <div className="mobile-safe-composer safe-x flex-shrink-0 border-t border-outline-variant/40 bg-surface">
          {/* Replying Preview Bar */}
          {replyingToMessage && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-l-primary border border-outline-variant/60 bg-white p-2.5 shadow-xs text-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {replyingToMessage.attachment?.url && replyingToMessage.attachment?.type === 'image' && (
                    <Image
                      src={replyingToMessage.attachment.url}
                      alt="Reply thumbnail"
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-outline-variant/60"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-primary mb-0.5">
                      <Reply className="w-3.5 h-3.5" />
                      <span>
                        Replying to{' '}
                        {replyingToMessage.isSentByMe ? 'yourself' : conversation.contact?.name || 'user'}
                      </span>
                    </div>
                    <p className="truncate text-on-surface-variant text-[11px]">
                      {replyingToMessage.text ||
                        (replyingToMessage.attachment
                          ? `[${(replyingToMessage.attachment.type || 'File').toUpperCase()}] ${replyingToMessage.attachment.name || 'Attachment'}`
                          : 'Message')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  className="rounded-full p-1 text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  aria-label="Cancel reply"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {selectedFile && (
            <div className="px-4 pt-3">
              <div className="flex max-w-md items-center gap-3 rounded-xl border border-outline-variant/60 bg-white p-2.5 shadow-xs">
                {selectedFilePreview ? (
                  <Image
                    src={selectedFilePreview}
                    alt="Selected attachment preview"
                    width={44}
                    height={44}
                    unoptimized
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                ) : selectedFile.type.startsWith('audio/') ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Headphones className="h-5 w-5" />
                  </div>
                ) : selectedFile.type.startsWith('video/') ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <Video className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-on-surface">
                    {selectedFile.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-outline">
                    {isSending && uploadProgress > 0
                      ? `Uploading ${uploadProgress}%`
                      : formatFileSize(selectedFile.size)}
                  </p>
                  {isSending && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setSelectedFile(null)}
                  aria-label="Remove attachment"
                  className="rounded-full p-1.5 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {sendError && (
            <p role="alert" className="px-4 pt-2 text-[11px] font-medium text-red-600">
              {sendError}
            </p>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
            <div ref={attachmentMenuRef} className="relative">
              {isAttachmentMenuOpen && (
                <div
                  role="menu"
                  aria-label="Attach a file"
                  className="absolute bottom-12 left-0 z-50 w-52 overflow-hidden rounded-2xl border border-outline-variant/60 bg-white p-2 shadow-2xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => mediaInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-on-surface hover:bg-surface-container-low"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
                      <ImagePlus className="h-4 w-4" />
                    </span>
                    Photos & videos
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => documentInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-on-surface hover:bg-surface-container-low"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    Document
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => audioInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-on-surface hover:bg-surface-container-low"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                      <Headphones className="h-4 w-4" />
                    </span>
                    Audio
                  </button>
                </div>
              )}

              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                disabled={isSending}
                onClick={() => {
                  setIsAttachmentMenuOpen((isOpen) => !isOpen);
                  setIsEmojiPickerOpen(false);
                }}
                title="Attach a file"
                aria-label="Attach a file"
                aria-expanded={isAttachmentMenuOpen}
                className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${
                  isAttachmentMenuOpen
                    ? 'bg-secondary-container text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                }`}
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
              placeholder={`Message ${conversation.contact?.name}...`}
              className="flex-1 bg-white border border-outline-variant rounded-lg px-4 py-2.5 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none min-h-[42px] max-h-[140px] overflow-y-hidden leading-relaxed break-words"
            />

            <div ref={emojiPickerRef} className="relative">
              {isEmojiPickerOpen && <EmojiPicker onSelect={handleEmojiSelect} />}
              <button
                type="button"
                disabled={isSending}
                onClick={() => {
                  setIsEmojiPickerOpen((isOpen) => !isOpen);
                  setIsAttachmentMenuOpen(false);
                }}
                title="Choose an emoji"
                aria-label="Choose an emoji"
                aria-expanded={isEmojiPickerOpen}
                className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                  isEmojiPickerOpen
                    ? 'bg-secondary-container text-primary'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedFile) || isSending}
              aria-label={isSending ? 'Sending message' : 'Send message'}
              className="p-2.5 bg-primary hover:bg-primary-container text-white rounded-lg disabled:opacity-40 disabled:hover:bg-primary transition-all active:scale-95"
            >
              {isSending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Optional Info Drawer */}
      {showInfoDrawer && (
        <aside className="scroll-touch safe-top fixed inset-0 z-40 flex w-full flex-col gap-6 overflow-y-auto bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-right md:static md:inset-auto md:w-72 md:flex-shrink-0 md:border-l md:pb-6 border-outline-variant/40">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">
              Contact Details
            </h3>
            <button
              onClick={() => setShowInfoDrawer(false)}
              className="text-outline hover:text-on-surface"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center text-center">
            {isRealAvatar(conversation.contact?.avatar) ? (
              <Image
                src={conversation.contact.avatar}
                alt={conversation.contact?.name || 'Contact'}
                width={80}
                height={80}
                className="mb-3 h-20 w-20 rounded-full border-2 border-white object-cover shadow-xs"
              />
            ) : (
              <span className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-container text-xl font-bold text-primary select-none">
                {getInitials(conversation.contact?.name)}
              </span>
            )}
            <h4 className="text-sm font-semibold text-on-surface">
              {conversation.contact?.name}
            </h4>
            <p className="text-xs text-outline">{conversation.contact?.email}</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-outline">Email:</span>
              <p className="text-on-surface font-medium">{conversation.contact?.email}</p>
            </div>
            {conversation.contact?.phone && (
              <div>
                <span className="text-outline">Phone:</span>
                <p className="text-on-surface font-medium">{conversation.contact?.phone}</p>
              </div>
            )}
          </div>

          <div className="border-t border-outline-variant/40 pt-4">
            <h4 className="text-xs font-semibold text-on-surface mb-3">Shared Media</h4>
            {sharedImages.length === 0 ? (
              <p className="text-xs text-outline">No shared media yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {sharedImages.map((attachment, index) => (
                  <Image
                    key={`${attachment.url}-${index}`}
                    src={attachment.url}
                    alt={attachment.name || 'Shared image'}
                    width={80}
                    height={64}
                    className="w-full h-16 object-cover rounded-md cursor-pointer hover:opacity-80"
                    onClick={() => setPreviewImage(attachment.url)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6"
        >
          <div className="relative max-h-[85dvh] max-w-3xl overflow-hidden rounded-xl bg-black">
            <Image
              src={previewImage}
              alt="Full resolution"
              width={1200}
              height={900}
              sizes="(max-width: 768px) 92vw, 768px"
              className="max-h-[85dvh] max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
});
