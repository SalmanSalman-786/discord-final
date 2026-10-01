import React, { useEffect, useRef } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';
import MessageItem from './MessageItem';

export default function MessageList() {
  const {
    messages,
    isLoadingMessages,
    activeChannel,
    isDMMode,
    activeDM,
    typingUsers,
  } = useServerStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);

  const currentChannelId = isDMMode ? activeDM?._id : activeChannel?._id;

  const activeTypers = typingUsers.filter(
    (t) => t.channelId === currentChannelId && t.userId !== user?._id
  );

  const getDMPartner = (dm) => {
    if (!dm || !dm.participants) return null;
    return dm.participants.find((p) => p._id !== user?._id) || dm.participants[0];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTypers.length]);

  const renderTypingIndicator = () => {
    if (activeTypers.length === 0) return null;

    let text = '';
    if (activeTypers.length === 1) {
      text = `${activeTypers[0].username} is typing...`;
    } else if (activeTypers.length === 2) {
      text = `${activeTypers[0].username} and ${activeTypers[1].username} are typing...`;
    } else {
      text = 'Several people are typing...';
    }

    return (
      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400 py-1.5 px-1 animate-pulse">
        <div className="flex space-x-1">
          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>{text}</span>
      </div>
    );
  };

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
            className="max-h-80 max-w-md rounded-lg border border-[#3f4147] object-cover hover:opacity-95 cursor-pointer shadow-md transition-opacity"
            onClick={() => window.open(url, '_blank')}
          />
        </div>
      );
    }

    return (
      <div key={idx} className="mt-2 flex items-center space-x-3 bg-[#2b2d31] p-3 rounded-lg border border-[#3f4147] max-w-sm">
        <svg className="h-8 w-8 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-semibold text-white truncate">{filename}</p>
          <p className="text-[11px] text-gray-400 uppercase">{type.split('/')[1] || 'FILE'}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={filename}
          className="text-xs font-medium text-indigo-400 hover:underline flex items-center space-x-1"
        >
          <span>Download</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    );
  };

  if (isDMMode) {
    const partner = getDMPartner(activeDM);

    if (!activeDM) {
      return (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          <p>Select a Direct Message conversation from the left sidebar to start chatting!</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* DM Welcome Banner */}
        <div className="my-6">
          {partner?.avatar ? (
            <img src={partner.avatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover mb-3" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-indigo-500 flex items-center justify-center text-white text-4xl font-bold mb-3">
              {partner?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <h1 className="text-3xl font-bold text-white">{partner?.username}</h1>
          <p className="text-gray-400 text-sm">This is the beginning of your direct message history with @{partner?.username}.</p>
        </div>

        <div className="h-0.5 w-full bg-[#3f4147]" />

        {/* DM Messages List */}
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No messages in this DM yet. Send a message to start chatting!</p>
        ) : (
          messages.map((msg) => (
            <MessageItem key={msg._id} msg={msg} renderAttachment={renderAttachment} />
          ))
        )}

        {/* Typing indicator */}
        {renderTypingIndicator()}

        <div ref={messagesEndRef} />
      </div>
    );
  }

  if (!activeChannel) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <p>No channel selected. Select a channel from the left sidebar to start chatting!</p>
      </div>
    );
  }

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Welcome Banner */}
      <div className="my-6">
        <div className="h-16 w-16 bg-[#1f2342] border border-white/10 rounded-full flex items-center justify-center text-3xl font-extrabold text-white shadow-[0_0_25px_rgba(99,102,241,0.25)] mb-3">
          #
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome to #{activeChannel.name}!</h1>
        <p className="text-indigo-200/60 text-sm font-medium mt-1">This is the start of the #{activeChannel.name} channel.</p>
      </div>

      <div className="h-[1px] w-full bg-[#1e223d] my-4" />

      {/* Messages List */}
      {messages.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium italic">No messages yet. Be the first to send one!</p>
      ) : (
        messages.map((msg) => (
          <MessageItem key={msg._id} msg={msg} renderAttachment={renderAttachment} />
        ))
      )}

      {/* Typing indicator */}
      {renderTypingIndicator()}

      {/* Invisible element for auto scroll */}
      <div ref={messagesEndRef} />
    </div>
  );
}

