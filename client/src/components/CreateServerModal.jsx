import React, { useState, useRef } from 'react';
import { useServerStore } from '../store/useServerStore';
import api from '../utils/api';

const PRESET_ICONS = [
  { label: 'Gaming', icon: '🎮' },
  { label: 'Music', icon: '🎵' },
  { label: 'Tech & Code', icon: '🚀' },
  { label: 'Community', icon: '💬' },
  { label: 'Esports', icon: '🏆' },
  { label: 'Art & Design', icon: '🎨' },
  { label: 'Study & Science', icon: '📚' },
  { label: 'AI & Robots', icon: '🤖' },
  { label: 'Chill', icon: '⚡' },
  { label: 'Trending', icon: '🔥' },
  { label: 'Anime & Movies', icon: '🍿' },
  { label: 'Global', icon: '🌐' },
];

export default function CreateServerModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [serverIdToJoin, setServerIdToJoin] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const fileInputRef = useRef(null);
  const { createServer, joinServer } = useServerStore();

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('files', file);

    setUploadingFile(true);
    setFormError(null);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data && res.data.length > 0) {
        const uploadedUrl = res.data[0].url;
        setServerIcon(uploadedUrl);
        setSelectedEmoji(null);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setFormError('Failed to upload image file from computer.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSelectPreset = (emoji) => {
    // We store emoji or data URL
    setSelectedEmoji(emoji);
    setServerIcon('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setLoading(true);
    setFormError(null);

    // Final icon value is uploaded image URL, custom URL, or preset emoji badge
    const finalIcon = selectedEmoji || serverIcon.trim();

    const res = await createServer(serverName.trim(), finalIcon);
    setLoading(false);

    if (res.success) {
      setServerName('');
      setServerIcon('');
      setSelectedEmoji(null);
      onClose();
    } else {
      setFormError(res.error);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!serverIdToJoin.trim()) return;

    setLoading(true);
    setFormError(null);
    const res = await joinServer(serverIdToJoin.trim());
    setLoading(false);

    if (res.success) {
      setServerIdToJoin('');
      onClose();
    } else {
      setFormError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#131528] p-6 shadow-2xl border border-[#262a4a]">
        {/* Modal Tabs */}
        <div className="flex border-b border-[#262a4a] mb-5">
          <button
            className={`pb-2.5 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
              tab === 'create'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => {
              setTab('create');
              setFormError(null);
            }}
          >
            Create Server
          </button>
          <button
            className={`pb-2.5 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
              tab === 'join'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => {
              setTab('join');
              setFormError(null);
            }}
          >
            Join Server
          </button>
        </div>

        {formError && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-xs font-semibold text-red-200">
            {formError}
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Server Name */}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
                Server Name *
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="My Awesome Server"
                required
                className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-white outline-none focus:border-indigo-500 text-sm transition-all placeholder-gray-500"
              />
            </div>

            {/* Server Icon Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
                Server Icon <span className="text-gray-400 font-normal">(Optional)</span>
              </label>

              {/* Icon Preview & Computer Upload Button */}
              <div className="flex items-center space-x-4 mb-3 p-3 bg-[#1a1d34] rounded-xl border border-[#262a4a]">
                {/* Live Preview Circle */}
                <div className="h-14 w-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-inner flex-shrink-0 border-2 border-indigo-400/50">
                  {serverIcon ? (
                    <img src={serverIcon} alt="Server Icon" className="h-full w-full object-cover" />
                  ) : selectedEmoji ? (
                    <span>{selectedEmoji}</span>
                  ) : (
                    <span>{serverName?.charAt(0).toUpperCase() || 'S'}</span>
                  )}
                </div>

                {/* Upload Action */}
                <div className="flex flex-col space-y-1.5 flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>{uploadingFile ? 'Uploading...' : 'Upload from Computer'}</span>
                  </button>
                  <p className="text-[10px] text-gray-400">Select PNG, JPG, WebP, or SVG from your device</p>
                </div>
              </div>

              {/* Preset Icons Selection */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-400">Or choose a preset category icon:</span>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_ICONS.map((item) => {
                    const isSelected = selectedEmoji === item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleSelectPreset(item.icon)}
                        className={`h-10 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white scale-105 shadow-md border border-white/40'
                            : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle URL input */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                >
                  {showUrlInput ? '— Hide URL input' : '+ Or paste an image URL'}
                </button>
                {showUrlInput && (
                  <input
                    type="url"
                    value={serverIcon}
                    onChange={(e) => {
                      setServerIcon(e.target.value);
                      setSelectedEmoji(null);
                    }}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-lg bg-[#1e1f22] p-2 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-xs mt-1.5"
                  />
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-[#3f4147]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploadingFile || !serverName.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-md"
              >
                {loading ? 'Creating...' : 'Create Server'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-300">
                Server ID or Invite Code *
              </label>
              <input
                type="text"
                value={serverIdToJoin}
                onChange={(e) => setServerIdToJoin(e.target.value)}
                placeholder="e.g. 6ab5388bcb91186fc0d148fe"
                required
                className="w-full rounded-lg bg-[#1e1f22] p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Paste the Server ID shared by the server owner or members.
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-3 border-t border-[#3f4147]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !serverIdToJoin.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shadow-md"
              >
                {loading ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
