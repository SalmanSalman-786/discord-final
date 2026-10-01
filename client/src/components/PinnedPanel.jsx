import React, { useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';

export default function PinnedPanel() {
  const {
    pinnedMessages,
    isPinnedPanelOpen,
    togglePinnedPanel,
    unpinMessage,
    activeChannel,
    fetchPinnedMessages,
    setHighlightedMessageId,
  } = useServerStore();

  useEffect(() => {
    if (isPinnedPanelOpen && activeChannel) {
      fetchPinnedMessages(activeChannel._id);
    }
  }, [isPinnedPanelOpen, activeChannel?._id]);

  if (!isPinnedPanelOpen) return null;

  const handleJumpToMessage = (messageId) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="w-80 md:w-96 bg-[#2b2d31] border-l border-[#1f2023] flex flex-col h-full select-none shadow-2xl z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2023] bg-[#313338]">
        <div className="flex items-center space-x-2">
          <span className="text-yellow-400 text-lg">📌</span>
          <div>
            <h3 className="font-bold text-white text-base">Pinned Messages</h3>
            <p className="text-xs text-gray-400">#{activeChannel?.name || 'channel'}</p>
          </div>
        </div>
        <button
          onClick={togglePinnedPanel}
          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#35373c] transition-colors"
          title="Close Pinned Messages"
        >
          ✕
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pinnedMessages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">
            No pinned messages yet. Hover over any message and click 📌 to pin it!
          </div>
        ) : (
          pinnedMessages.map((msg) => {
            const author = msg.author || {};
            const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg._id}
                className="bg-[#313338] p-3 rounded-lg border border-[#3f4147] hover:border-yellow-400/40 transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    {author.avatar ? (
                      <img
                        src={author.avatar}
                        alt="Avatar"
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
                        {author.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="font-semibold text-white text-xs">
                      {author.username}
                    </span>
                    <span className="text-[10px] text-gray-400">{timeFormatted}</span>
                  </div>

                  <button
                    onClick={() => unpinMessage(msg._id)}
                    className="text-gray-400 hover:text-red-400 text-xs transition-colors"
                    title="Unpin Message"
                  >
                    Unpin
                  </button>
                </div>

                {msg.content && (
                  <p className="text-xs text-gray-200 break-words mb-2 leading-relaxed">
                    {msg.content}
                  </p>
                )}

                <button
                  onClick={() => handleJumpToMessage(msg._id)}
                  className="text-[11px] font-semibold text-indigo-400 hover:underline flex items-center space-x-1"
                >
                  <span>Jump to message</span>
                  <span>→</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
