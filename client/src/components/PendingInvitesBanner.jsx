import React, { useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';

export default function PendingInvitesBanner() {
  const { pendingInvites, fetchMyPendingInvites, acceptServerInvite, declineServerInvite } = useServerStore();

  useEffect(() => {
    fetchMyPendingInvites();
  }, [fetchMyPendingInvites]);

  if (!pendingInvites || pendingInvites.length === 0) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2 flex flex-col space-y-2 z-40 border-b border-indigo-700 shadow-md">
      {pendingInvites.map((invite) => {
        const serverName = invite.server?.name || 'a Server';
        const senderName = invite.sender?.username || 'Someone';

        return (
          <div key={invite._id} className="flex items-center justify-between text-xs max-w-6xl mx-auto w-full">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📩</span>
              <div>
                <span className="font-bold">{senderName}</span>
                <span> invited you to join </span>
                <span className="font-bold underline">{serverName}</span>
                <span className="text-indigo-200 ml-1">({invite.recipientEmail})</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => acceptServerInvite(invite._id)}
                className="px-3 py-1 rounded bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors shadow-sm cursor-pointer"
              >
                Accept & Join
              </button>
              <button
                onClick={() => declineServerInvite(invite._id)}
                className="px-2.5 py-1 rounded bg-indigo-800 text-indigo-200 font-semibold hover:bg-indigo-900 transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
