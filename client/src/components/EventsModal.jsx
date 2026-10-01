import React, { useState } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';

export default function EventsModal({ isOpen, onClose }) {
  const {
    activeServer,
    events,
    channels,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleEventInterested,
    selectChannel,
  } = useServerStore();
  const { user: currentUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [isCreating, setIsCreating] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationType, setLocationType] = useState('voice');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [externalLocation, setExternalLocation] = useState('');
  const [notificationOption, setNotificationOption] = useState('all');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !activeServer) return null;

  const voiceChannels = channels.filter((c) => c.type === 'voice');
  const isOwnerOrCreator = (evt) => {
    return (
      evt.creator?._id === currentUser?._id ||
      activeServer.owner === currentUser?._id
    );
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setLocationType('voice');
    setSelectedChannelId(voiceChannels[0]?._id || '');
    setExternalLocation('');
    setNotificationOption('all');
    setStartTime('');
    setEndTime('');
    setFormError('');
    setIsCreating(false);
    setEditingEventId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setSelectedChannelId(voiceChannels[0]?._id || '');
    // Default start time to 5 mins in future formatted for datetime-local
    const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
    setStartTime(formatDateTimeLocal(defaultDate));
    setIsCreating(true);
  };

  const handleQuickOneMinuteTest = () => {
    // Set start time to exactly 1 minute and 15 seconds in the future
    const oneMinDate = new Date(Date.now() + 75 * 1000);
    setStartTime(formatDateTimeLocal(oneMinDate));
    setNotificationOption('1m');
  };

  const handleOpenEdit = (evt) => {
    resetForm();
    setEditingEventId(evt._id);
    setName(evt.name || '');
    setDescription(evt.description || '');
    setLocationType(evt.locationType || 'voice');
    setSelectedChannelId(evt.channel?._id || voiceChannels[0]?._id || '');
    setExternalLocation(evt.externalLocation || '');
    setNotificationOption(evt.notificationOption || 'all');
    if (evt.scheduledStartTime) {
      setStartTime(formatDateTimeLocal(new Date(evt.scheduledStartTime)));
    }
    if (evt.scheduledEndTime) {
      setEndTime(formatDateTimeLocal(new Date(evt.scheduledEndTime)));
    }
    setIsCreating(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !startTime) {
      setFormError('Event name and start time are required');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload = {
      name: name.trim(),
      description: description.trim(),
      scheduledStartTime: new Date(startTime).toISOString(),
      scheduledEndTime: endTime ? new Date(endTime).toISOString() : null,
      locationType,
      channel: locationType === 'voice' ? selectedChannelId : null,
      externalLocation: locationType === 'external' ? externalLocation.trim() : '',
      notificationOption,
    };

    let res;
    if (editingEventId) {
      res = await updateEvent(editingEventId, payload);
    } else {
      res = await createEvent(activeServer._id, payload);
    }

    setIsSubmitting(false);

    if (res.success) {
      resetForm();
    } else {
      setFormError(res.error || 'Failed to save event');
    }
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await deleteEvent(eventId);
    }
  };

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.scheduledStartTime) >= now && e.status !== 'completed' && e.status !== 'cancelled');
  const pastEvents = events.filter((e) => new Date(e.scheduledStartTime) < now || e.status === 'completed' || e.status === 'cancelled');

  const currentDisplayEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-[#131528] text-white shadow-2xl overflow-hidden border border-[#262a4a]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262a4a] bg-[#131528] px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold leading-tight tracking-tight">Events</h2>
              <p className="text-xs text-indigo-200/60 font-medium">{activeServer.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {!isCreating && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center space-x-1.5 rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(79,84,229,0.4)] transition-all cursor-pointer"
              >
                <span>+ Create Event</span>
              </button>
            )}
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded p-1 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            /* Create / Edit Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#3f4147] pb-3">
                <h3 className="text-md font-bold text-white uppercase tracking-wider">
                  {editingEventId ? 'Edit Event' : 'Create Event'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-white underline"
                >
                  Back to Events
                </button>
              </div>

              {formError && (
                <div className="rounded bg-red-500/20 p-3 text-xs text-red-300 border border-red-500/30">
                  {formError}
                </div>
              )}

              {/* Event Name */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Game Night, Study Session"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white placeholder-gray-500 outline-none border border-[#2b2d31] focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Tell people what your event is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white placeholder-gray-500 outline-none border border-[#2b2d31] focus:border-indigo-500"
                />
              </div>

              {/* Location Type */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-2">
                  Where is it happening?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocationType('voice')}
                    className={`flex items-center space-x-2 rounded border p-3 text-left transition-colors ${
                      locationType === 'voice'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#2b2d31] bg-[#1e1f22] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <div>
                      <div className="text-sm font-semibold">Voice Channel</div>
                      <div className="text-[11px] text-gray-400">In server voice room</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocationType('external')}
                    className={`flex items-center space-x-2 rounded border p-3 text-left transition-colors ${
                      locationType === 'external'
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#2b2d31] bg-[#1e1f22] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <div className="text-sm font-semibold">External Location</div>
                      <div className="text-[11px] text-gray-400">Address or link</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Specific Location Details */}
              {locationType === 'voice' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    Select Voice Channel
                  </label>
                  {voiceChannels.length === 0 ? (
                    <p className="text-xs text-yellow-400">No voice channels available in this server.</p>
                  ) : (
                    <select
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white outline-none border border-[#2b2d31] focus:border-indigo-500"
                    >
                      {voiceChannels.map((c) => (
                        <option key={c._id} value={c._id}>
                          🔊 {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    External Location / URL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://zoom.us/j/12345 or Room 302"
                    value={externalLocation}
                    onChange={(e) => setExternalLocation(e.target.value)}
                    className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white placeholder-gray-500 outline-none border border-[#2b2d31] focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Date & Time Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-300 uppercase">
                    Start Date & Time *
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickOneMinuteTest}
                    className="rounded bg-indigo-600/30 px-2 py-0.5 text-[11px] font-bold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                    title="Set start time to 1 minute from now for testing reminders!"
                  >
                    ⚡ Set Start to +1 Minute (Fast Test)
                  </button>
                </div>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white outline-none border border-[#2b2d31] focus:border-indigo-500"
                />
              </div>

              {/* Notification & Reminder Option */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  🔔 Notification & Reminder Preference
                </label>
                <select
                  value={notificationOption}
                  onChange={(e) => setNotificationOption(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] p-2.5 text-sm text-white outline-none border border-[#2b2d31] focus:border-indigo-500"
                >
                  <option value="all">🔔 All Reminders (1 Hour, 15 Mins, 1 Min & At Start)</option>
                  <option value="1m">⚡ 1 Minute Before & At Start (Fast Test)</option>
                  <option value="15m">⏰ 15 Minutes Before & At Start</option>
                  <option value="1h">🕒 1 Hour Before & At Start</option>
                  <option value="start">🎉 At Start Time Only</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#3f4147]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-md"
                >
                  {isSubmitting ? 'Saving...' : editingEventId ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          ) : (
            /* Events List View */
            <div className="space-y-4">
              {/* Navigation Tabs */}
              <div className="flex items-center space-x-4 border-b border-[#3f4147] pb-2 text-sm font-semibold">
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`pb-1 transition-colors ${
                    activeTab === 'upcoming'
                      ? 'border-b-2 border-indigo-500 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Upcoming Events ({upcomingEvents.length})
                </button>
                <button
                  onClick={() => setActiveTab('past')}
                  className={`pb-1 transition-colors ${
                    activeTab === 'past'
                      ? 'border-b-2 border-indigo-500 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Past Events ({pastEvents.length})
                </button>
              </div>

              {/* Events Cards */}
              {currentDisplayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-16 w-16 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm font-medium">
                    No {activeTab} events scheduled yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentDisplayEvents.map((evt) => {
                    const isInterested = evt.interestedUsers?.some(
                      (u) => u._id === currentUser?._id || u === currentUser?._id
                    );
                    const canEdit = isOwnerOrCreator(evt);
                    const isLive = evt.status === 'active';

                    const notifLabelMap = {
                      all: 'All Reminders',
                      '1m': '1 Min Before & Start',
                      '15m': '15 Mins Before & Start',
                      '1h': '1 Hour Before & Start',
                      start: 'At Start Only',
                    };

                    return (
                      <div
                        key={evt._id}
                        className="rounded-lg bg-[#2b2d31] p-4 border border-[#3f4147] hover:border-indigo-500/50 transition-all space-y-3"
                      >
                        {/* Event Top Bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                              📅 {formatEventDate(evt.scheduledStartTime)}
                            </span>
                            <span className="rounded bg-[#1e1f22] px-2 py-0.5 text-[10px] font-medium text-gray-300 border border-[#35373c]">
                              🔔 {notifLabelMap[evt.notificationOption] || 'All Reminders'}
                            </span>
                            {isLive && (
                              <span className="flex items-center space-x-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/30">
                                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                <span>LIVE NOW</span>
                              </span>
                            )}
                          </div>

                          {canEdit && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleOpenEdit(evt)}
                                className="text-xs text-gray-400 hover:text-white"
                                title="Edit Event"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(evt._id)}
                                className="text-xs text-red-400 hover:text-red-300"
                                title="Delete Event"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-lg font-bold text-white">{evt.name}</h3>
                          {evt.description && (
                            <p className="mt-1 text-xs text-gray-300">{evt.description}</p>
                          )}
                        </div>

                        {/* Location Badge & Channel Join */}
                        <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                          <div className="flex items-center space-x-1.5">
                            {evt.locationType === 'voice' ? (
                              <div className="flex items-center space-x-1.5 text-indigo-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span className="font-semibold">
                                  🔊 {evt.channel?.name || 'Voice Channel'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 text-emerald-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                <span className="font-semibold">
                                  📍 {evt.externalLocation || 'External Location'}
                                </span>
                              </div>
                            )}
                          </div>

                          {evt.locationType === 'voice' && evt.channel && (
                            <button
                              onClick={() => {
                                selectChannel(evt.channel);
                                onClose();
                              }}
                              className="rounded bg-indigo-600/30 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
                            >
                              Join Channel
                            </button>
                          )}
                        </div>

                        {/* Footer: Creator & Interested toggle */}
                        <div className="flex items-center justify-between border-t border-[#3f4147] pt-3">
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            {evt.creator?.avatar ? (
                              <img src={evt.creator.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">
                                {evt.creator?.username?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            )}
                            <span>Created by <strong className="text-white">{evt.creator?.username || 'User'}</strong></span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400 font-medium">
                              ⭐ {evt.interestedUsers?.length || 0} Interested
                            </span>
                            <button
                              onClick={() => toggleEventInterested(evt._id)}
                              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                                isInterested
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'
                              }`}
                            >
                              {isInterested ? '⭐ Interested' : 'Interested?'}
                            </button>
                          </div>
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
    </div>
  );
}

// Helpers
function formatDateTimeLocal(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatEventDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
