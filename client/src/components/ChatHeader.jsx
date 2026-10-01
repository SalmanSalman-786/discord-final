import React, { useState, useRef, useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function ChatHeader() {
  const {
    activeChannel,
    isDMMode,
    activeDM,
    onlineUsers,
    togglePinnedPanel,
    isPinnedPanelOpen,
    searchChannelMessages,
    searchResults,
    isSearching,
    setHighlightedMessageId,
  } = useServerStore();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  const getDMPartner = (dm) => {
    if (!dm || !dm.participants) return null;
    return dm.participants.find((p) => p._id !== user?._id) || dm.participants[0];
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!activeChannel || isDMMode) return;

    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        searchChannelMessages(activeChannel._id, query.trim());
        setShowSearchResults(true);
      } else {
        setShowSearchResults(false);
      }
    }, 300);
  };

  const handleSelectSearchResult = (messageId) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (isDMMode) {
    const partner = getDMPartner(activeDM);
    const isOnline = partner?._id && onlineUsers.includes(partner._id);

    return (
      <div className="flex h-12 items-center justify-between border-b border-[#1c1f3b] bg-[#131528] px-4 font-bold text-white shadow-sm select-none">
        {partner ? (
          <div className="flex items-center space-x-2">
            <span className="text-indigo-400 text-xl font-bold">@</span>
            <span>{partner.username}</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ml-2 ${
                isOnline ? 'bg-green-500' : 'bg-gray-500'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
        ) : (
          <span className="text-gray-400 font-normal text-sm">Select a Direct Message conversation</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center justify-between border-b border-[#1c1f3b] bg-[#131528] px-4 font-bold text-white shadow-sm select-none">
      {activeChannel ? (
        <div className="flex items-center space-x-2">
          <span className="text-indigo-400 text-xl font-bold">#</span>
          <span>{activeChannel.name}</span>
        </div>
      ) : (
        <span className="text-gray-400 font-normal text-sm">Select a channel</span>
      )}

      {activeChannel && (
        <div className="flex items-center space-x-3">
          {/* Search Input Bar */}
          <div className="relative">
            <div className="flex items-center bg-[#1a1d34] rounded-md px-2.5 py-1 text-xs border border-[#262a4a] focus-within:border-indigo-500 transition-all">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                placeholder="Search messages..."
                className="bg-transparent text-gray-200 outline-none w-32 focus:w-48 transition-all placeholder-gray-500"
              />
              <span className="text-gray-400 ml-1 text-xs">🔍</span>
            </div>

            {/* Search Dropdown Results */}
            {showSearchResults && (
              <div className="absolute right-0 top-9 w-72 md:w-80 bg-[#2b2d31] border border-[#3f4147] rounded-lg shadow-2xl z-50 p-2 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-[#3f4147] mb-1">
                  <span>Search Results</span>
                  <button onClick={() => setShowSearchResults(false)} className="hover:text-white">✕</button>
                </div>

                {isSearching ? (
                  <div className="text-center text-xs text-gray-400 py-4">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 py-4">No matching messages found</div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result._id}
                      onClick={() => handleSelectSearchResult(result._id)}
                      className="w-full text-left p-2 rounded hover:bg-[#35373c] transition-colors border-b border-[#3f4147]/30 last:border-0"
                    >
                      <div className="flex items-center justify-between text-xs text-indigo-400 font-semibold mb-0.5">
                        <span>@{result.author?.username || 'User'}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(result.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-200 line-clamp-2 break-words font-normal">
                        {result.content}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Pinned Messages Button */}
          <button
            onClick={togglePinnedPanel}
            className={`p-1.5 rounded transition-colors text-sm ${
              isPinnedPanelOpen
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'text-gray-400 hover:text-white hover:bg-[#35373c]'
            }`}
            title="Pinned Messages"
          >
            📌
          </button>
        </div>
      )}
    </div>
  );
}

