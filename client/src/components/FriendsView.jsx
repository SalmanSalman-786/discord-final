import React, { useState, useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function FriendsView() {
  const [activeTab, setActiveTab] = useState('online'); // 'online' | 'all' | 'add'
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { allUsers, onlineUsers, fetchAllUsers, openDM, startDMByQuery, servers } = useServerStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  // Combine users from servers + allUsers list, removing duplicates and current user
  const userMap = new Map();
  
  allUsers.forEach((u) => {
    if (u._id !== currentUser?._id) {
      userMap.set(u._id, u);
    }
  });

  servers.forEach((srv) => {
    if (srv.members) {
      srv.members.forEach((m) => {
        if (m.user && m.user._id !== currentUser?._id) {
          if (!userMap.has(m.user._id)) {
            userMap.set(m.user._id, m.user);
          }
        }
      });
    }
  });

  const combinedUsers = Array.from(userMap.values());

  const onlineList = combinedUsers.filter((u) => onlineUsers.includes(u._id));
  const allList = combinedUsers;

  const currentList = activeTab === 'online' ? onlineList : allList;

  const filteredUsers = currentList.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const handleAddFriendSubmit = async (e) => {
    e.preventDefault();
    if (!addFriendInput.trim()) return;

    setIsSubmitting(true);
    setStatusMessage({ text: '', type: '' });

    const result = await startDMByQuery(addFriendInput.trim());
    setIsSubmitting(false);

    if (result.success) {
      setStatusMessage({ text: `Direct Message started successfully with "${addFriendInput.trim()}"!`, type: 'success' });
      setAddFriendInput('');
    } else {
      setStatusMessage({ text: result.error || 'User not found. Check email or username.', type: 'error' });
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-[#101222] overflow-hidden">
      {/* Friends Header */}
      <div className="flex h-12 items-center justify-between border-b border-[#1c1f3b] bg-[#131528] px-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 font-bold text-white pr-4 border-r border-[#262a4a]">
            <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Friends</span>
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('online')}
              className={`rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'online'
                  ? 'bg-[#242946] text-white font-bold border border-indigo-500/30'
                  : 'text-gray-400 hover:bg-[#1a1d34] hover:text-gray-200'
              }`}
            >
              Online ({onlineList.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#242946] text-white font-bold border border-indigo-500/30'
                  : 'text-gray-400 hover:bg-[#1a1d34] hover:text-gray-200'
              }`}
            >
              All ({allList.length})
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`rounded-md px-3 py-1.5 font-bold transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-[#248046] text-white shadow-md'
                  : 'bg-[#248046] text-white hover:bg-[#1a6334]'
              }`}
            >
              Add Friend / Direct Message
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'add' ? (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wide">Add Friend or Start Direct Message</h2>
              <p className="mt-1 text-xs text-indigo-200/60 font-medium">
                You can start a direct message with any user by entering their registered email address or username.
              </p>
            </div>

            <form onSubmit={handleAddFriendSubmit} className="space-y-4">
              <div className="relative flex items-center rounded-xl bg-[#1a1d34] p-3 border border-[#262a4a] focus-within:border-indigo-500 shadow-xl">
                <input
                  type="text"
                  placeholder="Enter an Email or Username"
                  value={addFriendInput}
                  onChange={(e) => setAddFriendInput(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none pr-36"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !addFriendInput.trim()}
                  className="absolute right-2 rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(79,84,229,0.4)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Searching...' : 'Send Direct Message'}
                </button>
              </div>
            </form>

            {statusMessage.text && (
              <div
                className={`rounded-lg p-3 text-xs font-semibold ${
                  statusMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}
              >
                {statusMessage.text}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search filter input */}
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search friends by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* List Header */}
            <div className="text-[11px] font-bold text-indigo-200/40 uppercase tracking-wider pt-2">
              {activeTab === 'online' ? `Online — ${filteredUsers.length}` : `All Users — ${filteredUsers.length}`}
            </div>

            {/* User Items */}
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="h-16 w-16 text-indigo-400/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-400 text-sm font-medium">No users found matching your query.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1c1f3b]">
                {filteredUsers.map((u) => {
                  const isOnline = onlineUsers.includes(u._id);
                  return (
                    <div
                      key={u._id}
                      className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[#161829] transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {u.avatar ? (
                            <img src={u.avatar} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {u.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#101222] ${
                              isOnline ? 'bg-green-500' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">{u.username}</span>
                            <span className="text-xs text-indigo-200/50">{u.email}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {isOnline ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openDM(u._id)}
                          className="flex items-center space-x-1.5 rounded-full bg-[#1e233d] hover:bg-[#4f54e5] px-3.5 py-1.5 text-xs font-semibold text-indigo-200 hover:text-white border border-indigo-500/20 shadow-sm transition-all cursor-pointer"
                          title="Message User"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>Message</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
