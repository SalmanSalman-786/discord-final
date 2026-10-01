import React, { useState } from 'react';
import { useServerStore } from '../store/useServerStore';

export default function CreateChannelModal({ isOpen, onClose }) {
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('text');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const { createChannel } = useServerStore();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    setLoading(true);
    setFormError(null);
    const res = await createChannel(channelName, channelType);
    setLoading(false);

    if (res.success) {
      setChannelName('');
      onClose();
    } else {
      setFormError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#131528] p-6 shadow-2xl border border-[#262a4a]">
        <h2 className="mb-4 text-xl font-extrabold text-white tracking-tight">Create Channel</h2>

        {formError && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 p-2.5 text-xs font-semibold text-red-200">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
              Channel Type
            </label>
            <div className="flex space-x-3">
              <label
                className={`flex-1 flex items-center justify-center p-3 rounded-xl cursor-pointer border transition-all ${
                  channelType === 'text'
                    ? 'border-indigo-500 bg-[#242946] text-white font-bold shadow-md'
                    : 'border-[#262a4a] bg-[#1a1d34] text-gray-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="text"
                  checked={channelType === 'text'}
                  onChange={() => setChannelType('text')}
                  className="sr-only"
                />
                <span className="text-sm font-semibold"># Text</span>
              </label>
              <label
                className={`flex-1 flex items-center justify-center p-3 rounded-xl cursor-pointer border transition-all ${
                  channelType === 'voice'
                    ? 'border-indigo-500 bg-[#242946] text-white font-bold shadow-md'
                    : 'border-[#262a4a] bg-[#1a1d34] text-gray-400 hover:text-white'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="voice"
                  checked={channelType === 'voice'}
                  onChange={() => setChannelType('voice')}
                  className="sr-only"
                />
                <span className="text-sm font-semibold">🔊 Voice</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
              Channel Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="new-channel"
              required
              className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-white outline-none focus:border-indigo-500 text-sm transition-all placeholder-gray-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !channelName.trim()}
              className="rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] px-4 py-2 text-sm font-bold text-white shadow-[0_0_15px_rgba(79,84,229,0.4)] disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
