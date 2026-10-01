import React, { useState, useRef } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';
import api from '../utils/api';

export default function MessageInput() {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]); // [{ url, type, filename }]
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const stopTypingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const {
    activeServer,
    activeChannel,
    isDMMode,
    activeDM,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    rateLimitWarning,
  } = useServerStore();
  const { user } = useAuthStore();

  const currentMember =
    !isDMMode && activeServer?.members
      ? activeServer.members.find(
          (m) => (m.user?._id || m.user) === user?._id
        )
      : null;
  const isMuted =
    currentMember?.mutedUntil && new Date(currentMember.mutedUntil) > new Date();
  const mutedUntilTime = isMuted
    ? new Date(currentMember.mutedUntil).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const currentChannelId = isDMMode ? activeDM?._id : activeChannel?._id;

  const getDMPartner = (dm) => {
    if (!dm || !dm.participants) return null;
    return dm.participants.find((p) => p._id !== user?._id) || dm.participants[0];
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setContent(val);

    if (!currentChannelId) return;

    if (val.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTypingStart(currentChannelId);
      }

      // Reset 2-second stop-typing timer
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
      }

      stopTypingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTypingStop(currentChannelId);
      }, 2000);
    } else {
      if (isTypingRef.current) {
        if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
        isTypingRef.current = false;
        sendTypingStop(currentChannelId);
      }
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments((prev) => [...prev, ...response.data]);
    } catch (err) {
      console.error('File upload error:', err);
      alert(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;
    if (!isDMMode && !activeChannel) return;
    if (isDMMode && !activeDM) return;

    // Clear typing state on send
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    isTypingRef.current = false;
    sendTypingStop(currentChannelId);

    const textToSend = content;
    const currentAttachments = [...attachments];

    setContent('');
    setAttachments([]);
    setIsSending(true);

    await sendMessage(textToSend, currentAttachments);

    setTimeout(() => {
      setIsSending(false);
    }, 500);
  };

  if (!isDMMode && !activeChannel) return null;
  if (isDMMode && !activeDM) return null;

  const partner = isDMMode ? getDMPartner(activeDM) : null;
  const placeholderText = isDMMode
    ? `Message @${partner?.username || 'user'}`
    : `Message #${activeChannel?.name || 'channel'}`;

  return (
    <div className="p-4 bg-[#101222] space-y-2">
      {/* Inline Rate Limit Warning */}
      {rateLimitWarning && (
        <div className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs text-amber-200 font-semibold flex items-center space-x-2 animate-pulse">
          <span>⚠️</span>
          <span>{rateLimitWarning}</span>
        </div>
      )}

      {isMuted ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-center text-xs font-semibold text-red-300 flex items-center justify-center space-x-2">
          <span>🔇</span>
          <span>You are muted until {mutedUntilTime}</span>
        </div>
      ) : (
        <div className="rounded-xl bg-[#1a1d34] border border-[#262a4a] px-4 py-2.5 space-y-2 shadow-xl">
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 pb-2 border-b border-[#262a4a]">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="relative group flex items-center space-x-2 bg-[#242946] px-2.5 py-1.5 rounded-md text-xs text-gray-200"
                >
                  {att.type && att.type.startsWith('image/') ? (
                    <img src={att.url} alt="preview" className="h-8 w-8 object-cover rounded" />
                  ) : (
                    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  <span className="max-w-[120px] truncate">{att.filename || 'file'}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-gray-400 hover:text-red-400 ml-1"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            {/* Paperclip Attach Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#242946] hover:bg-[#2e3458] text-indigo-300 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
              title="Attach file or image"
            >
              {isUploading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/*,.pdf,.txt,.doc,.docx,.zip"
            />

            <input
              type="text"
              value={content}
              onChange={handleInputChange}
              placeholder={placeholderText}
              disabled={isSending}
              className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={(!content.trim() && attachments.length === 0) || isUploading || isSending}
              className="bg-[#4f54e5] hover:bg-[#4347d9] text-white font-bold px-4 py-1.5 rounded-lg shadow-[0_0_15px_rgba(79,84,229,0.4)] transition-all cursor-pointer disabled:opacity-30 flex-shrink-0 text-xs"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
