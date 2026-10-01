import React, { useState } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function ChannelList({ onOpenCreateChannel, onOpenServerSettings, onOpenInvite }) {
  const {
    activeServer,
    channels,
    activeChannel,
    selectChannel,
    onlineUsers,
    unreadChannels,
    mentionChannels,
    voiceStates = {},
    events = [],
    openEventsModal,
  } = useServerStore();
  const { user, logout } = useAuthStore();

  const textChannels = channels.filter((c) => c.type === 'text' || !c.type);
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const isUserOnline = user?._id && onlineUsers.includes(user._id);
  const activeEventsCount = events.filter((e) => e.status !== 'completed' && e.status !== 'cancelled').length;

  return (
    <div className="flex w-60 flex-col bg-[#111322] border-r border-[#1a1d33] select-none">
      {/* Server Header */}
      <div className="flex h-12 items-center justify-between border-b border-[#1c1f3b] px-4 font-bold text-white shadow-sm bg-[#111322]">
        <span className="truncate text-sm tracking-wide">{activeServer ? activeServer.name : 'No Server Selected'}</span>
        {activeServer && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenInvite}
              className="flex items-center space-x-1 rounded-full bg-[#1e233d] hover:bg-[#282d4d] text-indigo-300 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
              title="Invite friends via Email or Class Link"
            >
              <span>Invite</span>
            </button>
            <button
              onClick={onOpenServerSettings}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Server Settings (Roles & Permissions)"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeServer ? (
          <>
            {/* Events Button Row */}
            <button
              onClick={openEventsModal}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-indigo-200/80 hover:bg-[#1a1d33] hover:text-white transition-all group mb-1 cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Events</span>
              </div>
              {activeEventsCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {activeEventsCount}
                </span>
              )}
            </button>

            {/* Text Channels Section */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200/40 uppercase tracking-wider mb-1 px-1">
                <span>Text Channels</span>
                <button
                  onClick={onOpenCreateChannel}
                  className="hover:text-white transition-colors"
                  title="Create Channel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1">
                {textChannels.map((channel) => {
                  const isActive = activeChannel?._id === channel._id;
                  const isUnread = !isActive && unreadChannels[channel._id];
                  const isMentioned = !isActive && mentionChannels[channel._id];

                  let textClass = 'text-gray-400 hover:bg-[#1a1d33] hover:text-gray-200';
                  if (isActive) {
                    textClass = 'bg-[#242946] text-white font-medium border-l-2 border-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]';
                  } else if (isMentioned) {
                    textClass = 'bg-indigo-500/10 text-white font-bold hover:bg-[#1a1d33]';
                  } else if (isUnread) {
                    textClass = 'text-white font-bold hover:bg-[#1a1d33]';
                  }

                  return (
                    <button
                      key={channel._id}
                      onClick={() => selectChannel(channel)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-all ${textClass}`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-indigo-400 text-sm font-bold">#</span>
                        <span className="truncate">{channel.name}</span>
                      </div>

                      {/* Unread / Mention Badge */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {isMentioned && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                            @
                          </span>
                        )}
                        {isUnread && !isMentioned && (
                          <span className="h-2 w-2 rounded-full bg-white shadow-sm" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Channels Section */}
            {voiceChannels.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200/40 uppercase tracking-wider mb-1 px-1">
                  <span>Voice Channels</span>
                </div>
                <div className="space-y-1">
                  {voiceChannels.map((channel) => {
                    const isActive = activeChannel?._id === channel._id;
                    const channelParticipants = voiceStates[channel._id] || [];

                    return (
                      <div key={channel._id} className="space-y-0.5">
                        <button
                          onClick={() => selectChannel(channel)}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-all ${
                            isActive
                              ? 'bg-[#242946] text-white font-medium border-l-2 border-indigo-400'
                              : 'text-gray-400 hover:bg-[#1a1d33] hover:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <svg className="h-4 w-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                              />
                            </svg>
                            <span className="truncate">{channel.name}</span>
                          </div>
                          {channelParticipants.length > 0 && (
                            <span className="text-[10px] font-semibold bg-[#0c0e17] px-1.5 py-0.5 rounded-full text-indigo-300">
                              {channelParticipants.length}
                            </span>
                          )}
                        </button>

                        {/* Active voice channel participants nested list */}
                        {channelParticipants.length > 0 && (
                          <div className="pl-6 space-y-1 py-0.5">
                            {channelParticipants.map((p) => (
                              <div key={p.socketId} className="flex items-center space-x-2 text-xs text-gray-300 py-0.5 px-1 rounded hover:bg-[#1a1d33]">
                                {p.avatar ? (
                                  <img src={p.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                                ) : (
                                  <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">
                                    {p.username?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                )}
                                <span className="truncate font-medium">{p.username}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-400 p-2">Select or create a server to view channels</div>
        )}
      </div>

      {/* Active Voice Connection Bar */}
      {activeChannel?.type === 'voice' && (
        <div className="flex items-center justify-between bg-[#0e101d] px-3 py-2 border-t border-[#181a2e]">
          <div className="flex flex-col truncate pr-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Voice Connected</span>
            </div>
            <span className="text-[11px] text-gray-400 truncate">{activeChannel.name}</span>
          </div>
          <button
            onClick={() => {
              const textChannel = channels.find((c) => c.type === 'text' || !c.type);
              if (textChannel) {
                selectChannel(textChannel);
              } else {
                useServerStore.setState({ activeChannel: null });
              }
            }}
            className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
            title="Disconnect from voice channel"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      )}

      {/* User Footer Bar */}
      <div className="flex h-14 items-center justify-between bg-[#0e101d] border-t border-[#181a2e] px-3">
        <div className="flex items-center space-x-2 overflow-hidden">
          <div className="relative">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0e101d] ${
                isUserOnline ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
          </div>
          <div className="text-xs truncate">
            <div className="font-semibold text-white leading-tight truncate">
              {user?.username || 'User'}
            </div>
            <div className="text-[10px] text-gray-400">Online</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="bg-[#4a1525] hover:bg-[#6b1d35] text-red-200 border border-red-500/30 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          title="Log out"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
