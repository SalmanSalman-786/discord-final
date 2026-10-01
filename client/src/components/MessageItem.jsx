import React, { useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

function renderContentWithMentions(content) {
  if (!content) return null;
  const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span
          key={index}
          className="bg-indigo-500/30 text-indigo-300 font-semibold px-1 rounded hover:bg-indigo-500/50 hover:text-indigo-200 transition-colors"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageItem({ msg, renderAttachment, isThreadReply = false }) {
  const { user } = useAuthStore();
  const {
    toggleReaction,
    editMessage,
    deleteMessage,
    onlineUsers,
    activeServer,
    openThread,
    pinMessage,
    unpinMessage,
    highlightedMessageId,
  } = useServerStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const author = msg.author || {};
  const isAuthor = user?._id && author._id && user._id === author._id;
  const isOnline = author._id && onlineUsers.includes(author._id.toString());
  const isHighlighted = highlightedMessageId === msg._id;

  // Check if server owner for delete permission
  const isServerOwner = activeServer?.owner?._id
    ? activeServer.owner._id === user?._id
    : activeServer?.owner === user?._id;
  const canDelete = isAuthor || isServerOwner;

  const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleEditSave = async (e) => {
    e?.preventDefault();
    if (!editContent.trim()) return;
    const res = await editMessage(msg._id, editContent.trim());
    if (res.success) {
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditContent(msg.content || '');
    setIsEditing(false);
  };

  const handleToggleEmoji = (emojiStr) => {
    toggleReaction(msg._id, emojiStr);
    setShowEmojiPicker(false);
  };

  const handleTogglePin = () => {
    if (msg.pinned) {
      unpinMessage(msg._id);
    } else {
      pinMessage(msg._id);
    }
  };

  return (
    <div
      id={`message-${msg._id}`}
      className={`group relative flex items-start space-x-3 -mx-4 px-4 py-1.5 rounded transition-colors ${
        isHighlighted ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'hover:bg-[#2e3035]'
      }`}
    >
      {/* Avatar */}
      <div className="relative mt-0.5 flex-shrink-0">
        {author.avatar ? (
          <img
            src={author.avatar}
            alt={author.username}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {author.username ? author.username.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#313338] ${
            isOnline ? 'bg-green-500' : 'bg-gray-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
            {author.username || 'Unknown User'}
          </span>
          <span className="text-xs text-gray-400">{timeFormatted}</span>
          {msg.pinned && (
            <span className="text-xs text-yellow-400 select-none" title="Pinned Message">
              📌 Pinned
            </span>
          )}
        </div>

        {/* Edit mode vs Normal content */}
        {isEditing ? (
          <form onSubmit={handleEditSave} className="mt-1">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-[#383a40] text-sm text-white rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex items-center space-x-2 mt-1.5 text-xs text-gray-400">
              <span>escape to <button type="button" onClick={handleEditCancel} className="text-indigo-400 hover:underline">cancel</button></span>
              <span>•</span>
              <span>enter to <button type="submit" className="text-indigo-400 hover:underline">save</button></span>
            </div>
          </form>
        ) : (
          <>
            {msg.content && (
              <p className="text-sm text-gray-200 break-words mt-0.5 leading-normal">
                {renderContentWithMentions(msg.content)}
                {msg.edited && (
                  <span className="ml-1 text-[10px] text-gray-400 font-normal select-none">
                    (edited)
                  </span>
                )}
              </p>
            )}
          </>
        )}

        {/* Attachments rendering */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="space-y-2 mt-1">
            {msg.attachments.map((att, idx) => renderAttachment(att, idx))}
          </div>
        )}

        {/* Reactions Pills */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.reactions.map((react, idx) => {
              const userReacted = react.users?.some((u) => {
                const uid = typeof u === 'string' ? u : u._id || u;
                return uid === user?._id;
              });

              return (
                <button
                  key={idx}
                  onClick={() => handleToggleEmoji(react.emoji)}
                  className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    userReacted
                      ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                      : 'bg-[#2b2d31] border-[#3f4147] text-gray-300 hover:bg-[#35373c]'
                  }`}
                  title={`${react.users?.length || 0} reaction(s)`}
                >
                  <span>{react.emoji}</span>
                  <span className="text-[11px] font-semibold">
                    {react.users?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Reply Count Button */}
        {!isThreadReply && msg.replyCount > 0 && (
          <button
            onClick={() => openThread(msg)}
            className="flex items-center space-x-1.5 text-xs text-indigo-400 font-semibold hover:underline mt-1.5 transition-colors"
          >
            <span>💬</span>
            <span>{msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Hover Action Bar */}
      <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-[#2b2d31] border border-[#3f4147] rounded-lg shadow-md px-1 py-0.5 space-x-0.5 z-10">
        {/* Quick Emojis */}
        {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleToggleEmoji(emoji)}
            className="p-1 hover:bg-[#35373c] rounded text-sm transition-colors"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        {/* Emoji Picker Toggle */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1 hover:bg-[#35373c] rounded text-gray-400 hover:text-white transition-colors"
          title="Add Reaction"
        >
          😀
        </button>

        {/* Pin / Unpin Button */}
        {!isThreadReply && (
          <button
            onClick={handleTogglePin}
            className={`p-1 hover:bg-[#35373c] rounded transition-colors ${
              msg.pinned ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-white'
            }`}
            title={msg.pinned ? 'Unpin Message' : 'Pin Message'}
          >
            📌
          </button>
        )}

        {/* Reply in Thread Button */}
        {!isThreadReply && (
          <button
            onClick={() => openThread(msg)}
            className="p-1 hover:bg-[#35373c] rounded text-gray-400 hover:text-white transition-colors"
            title="Reply in Thread"
          >
            💬
          </button>
        )}

        {/* Edit Button */}
        {isAuthor && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 hover:bg-[#35373c] rounded text-gray-400 hover:text-white transition-colors"
            title="Edit Message"
          >
            ✏️
          </button>
        )}

        {/* Delete Button */}
        {canDelete && (
          <button
            onClick={() => deleteMessage(msg._id)}
            className="p-1 hover:bg-[#35373c] rounded text-gray-400 hover:text-red-400 transition-colors"
            title="Delete Message"
          >
            🗑️
          </button>
        )}
      </div>



      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute right-4 top-6 z-50 shadow-2xl rounded-xl">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="absolute -top-2 -right-2 z-10 bg-[#2b2d31] text-gray-400 hover:text-white border border-[#3f4147] rounded-full h-6 w-6 flex items-center justify-center text-xs shadow"
            >
              ✕
            </button>
            <EmojiPicker
              theme="dark"
              width={320}
              height={380}
              onEmojiClick={(emojiData) => handleToggleEmoji(emojiData.emoji)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
