import React from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function DMList() {
  const { dms, activeDM, selectDM, openDM, openFriendsView, isDMMode, onlineUsers, servers } = useServerStore();
  const { user, logout } = useAuthStore();

  // Helper to get partner participant in DM
  const getDMPartner = (dm) => {
    if (!dm || !dm.participants) return null;
    return dm.participants.find((p) => p._id !== user?._id) || dm.participants[0];
  };

  // Collect all unique users from user's servers to allow starting a DM
  const availableUsersMap = new Map();
  servers.forEach((srv) => {
    if (srv.members) {
      srv.members.forEach((m) => {
        if (m.user && m.user._id !== user?._id) {
          availableUsersMap.set(m.user._id, m.user);
        }
      });
    }
  });
  const availableUsers = Array.from(availableUsersMap.values());

  const isFriendsActive = isDMMode && !activeDM;

  return (
    <div className="flex w-60 flex-col bg-[#111322] select-none border-r border-[#1a1d33]">
      {/* Search Header / Header Bar */}
      <div className="flex h-12 items-center border-b border-[#1c1f3b] px-3 shadow-sm bg-[#111322]">
        <button
          onClick={openFriendsView}
          className="flex w-full items-center justify-between rounded-md bg-[#1a1d34] border border-[#262a4a] px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
        >
          <span>Find or start a conversation</span>
        </button>
      </div>

      {/* DM Conversations & Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Friends Tab Link */}
        <button
          onClick={openFriendsView}
          className={`flex w-full items-center space-x-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all cursor-pointer ${
            isFriendsActive
              ? 'bg-[#242946] text-white font-medium border-l-2 border-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
              : 'text-gray-400 hover:bg-[#1a1d33] hover:text-gray-200'
          }`}
        >
          <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Friends</span>
        </button>

        {/* Active Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200/40 uppercase tracking-wider mb-2 px-1">
            <span>Direct Messages</span>
            <button
              onClick={openFriendsView}
              className="text-gray-400 hover:text-white cursor-pointer"
              title="Add DM"
            >
              +
            </button>
          </div>
          <div className="space-y-1">
            {dms.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 italic">No DM conversations yet.</p>
            ) : (
              dms.map((dm) => {
                const partner = getDMPartner(dm);
                const isActive = activeDM?._id === dm._id;
                const isOnline = partner?._id && onlineUsers.includes(partner._id);

                return (
                  <button
                    key={dm._id}
                    onClick={() => selectDM(dm)}
                    className={`flex w-full items-center space-x-2.5 rounded-md px-2 py-2 text-sm transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#242946] text-white font-medium border-l-2 border-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                        : 'text-gray-400 hover:bg-[#1a1d33] hover:text-gray-200'
                    }`}
                  >
                    <div className="relative">
                      {partner?.avatar ? (
                        <img src={partner.avatar} alt="Avatar" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {partner?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111322] ${
                          isOnline ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <span className="truncate">{partner?.username || 'User'}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Start a DM with Server Members Section */}
        {availableUsers.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-indigo-200/40 uppercase tracking-wider mb-2 px-1">
              Start a DM
            </div>
            <div className="space-y-1">
              {availableUsers.map((memberUser) => {
                const isOnline = onlineUsers.includes(memberUser._id);
                return (
                  <button
                    key={memberUser._id}
                    onClick={() => openDM(memberUser._id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-400 hover:bg-[#1a1d33] hover:text-gray-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div className="relative">
                        {memberUser.avatar ? (
                          <img src={memberUser.avatar} alt="Avatar" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
                            {memberUser.username?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#111322] ${
                            isOnline ? 'bg-green-500' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      <span className="truncate">{memberUser.username}</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-semibold hover:underline">Message</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
                user?._id && onlineUsers.includes(user._id) ? 'bg-green-500' : 'bg-gray-500'
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
