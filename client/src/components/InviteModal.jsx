import React, { useState } from 'react';
import { useServerStore } from '../store/useServerStore';
import api from '../utils/api';

export default function InviteModal({ isOpen, onClose }) {
  const { activeServer } = useServerStore();
  const [tab, setTab] = useState('email'); // 'email' | 'link'
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !activeServer) return null;

  const joinLink = `${window.location.origin}/app?join=${activeServer._id}`;
  const serverCode = activeServer._id;

  const handleSendEmailInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post(`/servers/${activeServer._id}/invite-email`, {
        email: email.trim(),
      });
      setMsg(res.data?.message || 'Invite sent successfully!');
      setEmail('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send invite.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(serverCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#131528] p-6 shadow-2xl border border-[#262a4a]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#262a4a] pb-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center space-x-2 tracking-tight">
              <span>Invite Friends to</span>
              <span className="text-indigo-400 truncate max-w-[150px]">{activeServer.name}</span>
            </h2>
            <p className="text-xs text-indigo-200/60 font-medium">Choose email invite or shareable class group link</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-[#262a4a] mb-4 space-x-2">
          <button
            className={`pb-2 px-3 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              tab === 'email'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => {
              setTab('email');
              setMsg(null);
              setErrorMsg(null);
            }}
          >
            📧 Invite via Email
          </button>
          <button
            className={`pb-2 px-3 font-bold text-xs border-b-2 transition-colors cursor-pointer ${
              tab === 'link'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => {
              setTab('link');
              setMsg(null);
              setErrorMsg(null);
            }}
          >
            🔗 Class / Group Share Link
          </button>
        </div>

        {/* Success Alert */}
        {msg && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-500/40 p-2.5 text-xs font-semibold text-green-200 flex items-center space-x-2">
            <span>✅</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 p-2.5 text-xs font-semibold text-red-200 flex items-center space-x-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {tab === 'email' ? (
          /* TAB 1: EMAIL INVITE */
          <form onSubmit={handleSendEmailInvite} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
                Recipient Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@gmail.com"
                required
                className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-white outline-none focus:border-indigo-500 text-sm transition-all placeholder-gray-500"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                An instant server invitation will be sent to their account email.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] px-5 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(79,84,229,0.4)] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Sending Invite...' : 'Send Invite Email'}
              </button>
            </div>
          </form>
        ) : (
          /* TAB 2: CLASS / GROUP LINK METHOD */
          <div className="space-y-4">
            {/* Shareable Group Join Link */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
                Class / Group Direct Join Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={joinLink}
                  className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-xs text-gray-300 outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2.5 rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] text-white text-xs font-bold transition-all cursor-pointer flex-shrink-0 shadow-[0_0_15px_rgba(79,84,229,0.4)]"
                >
                  {copiedLink ? 'Copied Link!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Server Code */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
                Server Code
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={serverCode}
                  className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-xs text-gray-300 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-2.5 rounded-lg bg-[#242946] hover:bg-[#2e3458] text-white text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                >
                  {copiedCode ? 'Copied Code!' : 'Copy Code'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Anyone with this class link or server code can paste it under <b>Join Server</b> to enter immediately.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
