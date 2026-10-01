import React from 'react';
import { useServerStore } from '../store/useServerStore';

function getServerInitials(name) {
  if (!name) return 'S';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const colorMap = [
  'bg-indigo-600',
  'bg-purple-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-[#5865F2]',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-teal-600',
];

function getServerColor(idOrName) {
  let hash = 0;
  const str = idOrName || 'default';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorMap.length;
  return colorMap[index];
}

export default function ServerList({ onOpenCreateServer }) {
  const {
    servers,
    activeServer,
    selectServer,
    isDMMode,
    toggleDMMode,
    openFriendsView,
    unreadChannels,
    mentionChannels,
    channels,
  } = useServerStore();

  return (
    <div className="flex w-18 flex-col items-center space-y-3 bg-[#0c0e17] border-r border-white/5 py-3 select-none z-10">
      {/* Discord Direct Messages Home Icon */}
      <div className="relative flex items-center justify-center">
        {/* Active Pill Indicator */}
        <div
          className={`absolute left-0 w-1 bg-indigo-400 rounded-r shadow-[0_0_8px_rgba(99,102,241,0.8)] transition-all duration-200 ${
            isDMMode ? 'h-10' : 'h-0 group-hover:h-5'
          }`}
        />
        <button
          onClick={() => openFriendsView()}
          className={`group relative flex h-12 w-12 cursor-pointer items-center justify-center transition-all duration-200 ${
            isDMMode
              ? 'rounded-2xl bg-[#4f54e5] text-white shadow-[0_0_15px_rgba(79,84,229,0.5)]'
              : 'rounded-3xl bg-[#161829] text-indigo-400 hover:rounded-2xl hover:bg-[#4f54e5] hover:text-white'
          }`}
          title="Direct Messages / Friends"
        >
          <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </button>
      </div>

      <div className="h-0.5 w-8 rounded bg-white/10" />

      {/* Server Circles */}
      <div className="flex-1 w-full space-y-2 overflow-y-auto px-3 scrollbar-none">
        {servers.map((server) => {
          const isActive = !isDMMode && activeServer?._id === server._id;
          const hasCustomIcon = server.icon && server.icon.trim() !== '';
          const isImageUrl =
            hasCustomIcon &&
            (server.icon.startsWith('http') ||
              server.icon.startsWith('data:') ||
              server.icon.startsWith('/'));

          const colorClass = getServerColor(server._id || server.name);
          const initials = getServerInitials(server.name);

          // Check if server has any unread channel
          const hasServerUnread =
            !isActive &&
            (Object.keys(unreadChannels).some((chId) =>
              channels.some((c) => c._id === chId && c.server === server._id)
            ) ||
              Object.keys(mentionChannels).some((chId) =>
                channels.some((c) => c._id === chId && c.server === server._id)
              ));

          let pillClass = 'h-0 group-hover:h-5';
          if (isActive) {
            pillClass = 'h-10';
          } else if (hasServerUnread) {
            pillClass = 'h-3.5';
          }

          return (
            <div key={server._id} className="relative flex items-center justify-center group">
              {/* Active / Unread Pill Indicator */}
              <div
                className={`absolute left-0 w-1 bg-indigo-400 rounded-r shadow-[0_0_8px_rgba(99,102,241,0.8)] transition-all duration-200 ${pillClass}`}
              />
              <button
                onClick={() => selectServer(server)}
                className={`group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-3xl font-bold transition-all duration-200 hover:rounded-2xl cursor-pointer ${
                  isActive ? 'rounded-2xl shadow-[0_0_15px_rgba(79,84,229,0.5)] ring-2 ring-indigo-400/50' : ''
                } ${isImageUrl ? 'bg-[#161829]' : colorClass} text-white`}
                title={server.name}
              >
                {isImageUrl ? (
                  <img src={server.icon} alt={server.name} className="h-full w-full object-cover" />
                ) : hasCustomIcon ? (
                  <span className="text-2xl leading-none">{server.icon}</span>
                ) : (
                  <span className="text-base tracking-wider">{initials}</span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Button */}
        <button
          onClick={onOpenCreateServer}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#161829] text-emerald-400 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-600 hover:text-white"
          title="Add or Join a Server"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
