import React, { useState, useRef, useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';
import MessageItem from './MessageItem';
import api from '../utils/api';

export default function ThreadPanel() {
  const {
    activeThreadParent,
    activeThreadReplies,
    isLoadingReplies,
    closeThread,
    sendReply,
    activeChannel,
  } = useServerStore();

  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const repliesEndRef = useRef(null);

  const scrollToBottom = () => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeThreadReplies]);

  if (!activeThreadParent) return null;

  const renderAttachment = (att, idx) => {
    const url = typeof att === 'string' ? att : att?.url;
    const type = typeof att === 'object' ? att?.type || '' : '';
    const filename = typeof att === 'object' ? att?.filename || 'attachment' : 'attachment';

    const isImage =
      type.startsWith('image/') ||
      url.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);

    if (isImage) {
      return (
        <div key={idx} className="mt-2">
          <img
            src={url}
            alt={filename}
            className="max-h-60 max-w-xs rounded-lg border border-[#3f4147] object-cover hover:opacity-95 cursor-pointer shadow-md transition-opacity"
            onClick={() => window.open(url, '_blank')}
          />
        </div>
      );
    }

    return (
      <div key={idx} className="mt-2 flex items-center space-x-3 bg-[#2b2d31] p-2.5 rounded-lg border border-[#3f4147] max-w-xs">
        <svg className="h-6 w-6 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-semibold text-white truncate">{filename}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={filename}
          className="text-xs text-indigo-400 hover:underline"
        >
          Download
        </a>
      </div>
    );
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments((prev) => [...prev, ...response.data]);
    } catch (err) {
      console.error('File upload error in thread:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;

    const text = content.trim();
    const currentAtts = [...attachments];
    setContent('');
    setAttachments([]);

    await sendReply(activeThreadParent._id, text, currentAtts);
  };

  return (
    <div className="w-80 md:w-96 bg-[#2b2d31] border-l border-[#1f2023] flex flex-col h-full select-none shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2023] bg-[#313338]">
        <div>
          <h3 className="font-bold text-white text-base">Thread</h3>
          <p className="text-xs text-gray-400">#{activeChannel?.name || 'channel'}</p>
        </div>
        <button
          onClick={closeThread}
          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#35373c] transition-colors"
          title="Close Thread"
        >
          ✕
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Pinned Parent Message */}
        <div className="bg-[#313338] p-3 rounded-lg border border-[#3f4147]">
          <MessageItem
            msg={activeThreadParent}
            renderAttachment={renderAttachment}
            isThreadReply={true}
          />
        </div>

        {/* Divider */}
        <div className="flex items-center space-x-2 my-2">
          <div className="flex-1 h-px bg-[#3f4147]" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {activeThreadReplies.length}{' '}
            {activeThreadReplies.length === 1 ? 'Reply' : 'Replies'}
          </span>
          <div className="flex-1 h-px bg-[#3f4147]" />
        </div>

        {/* Replies List */}
        {isLoadingReplies && activeThreadReplies.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-4">
            Loading replies...
          </div>
        ) : activeThreadReplies.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-4">
            No replies yet. Send a reply to start the conversation!
          </div>
        ) : (
          activeThreadReplies.map((reply) => (
            <MessageItem
              key={reply._id}
              msg={reply}
              renderAttachment={renderAttachment}
              isThreadReply={true}
            />
          ))
        )}

        <div ref={repliesEndRef} />
      </div>

      {/* Reply Input Box */}
      <div className="p-3 bg-[#313338] border-t border-[#1f2023]">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b border-[#4e5058] mb-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-1.5 bg-[#2b2d31] px-2 py-1 rounded text-xs text-gray-200"
              >
                <span className="truncate max-w-[100px]">{att.filename || 'file'}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-gray-400 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center space-x-2 bg-[#383a40] rounded-lg px-3 py-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Attach file"
          >
            📎
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
            onChange={(e) => setContent(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 bg-transparent text-xs text-white outline-none placeholder-gray-400"
          />

          <button
            type="submit"
            disabled={(!content.trim() && attachments.length === 0) || isUploading}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
          >
            Reply
          </button>
        </form>
      </div>
    </div>
  );
}
