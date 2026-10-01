import React, { useEffect } from 'react';
import { useServerStore } from '../store/useServerStore';

export default function EventToastNotification() {
  const { eventToastNotification, selectChannel, channels } = useServerStore();

  // Request Web Browser Push Notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fire system push notification when event toast triggers
  useEffect(() => {
    if (eventToastNotification && 'Notification' in window && Notification.permission === 'granted') {
      const isStarted = eventToastNotification.type === 'started';
      const title = isStarted
        ? `🎉 Event Started: ${eventToastNotification.name}`
        : `⏰ Event Reminder: ${eventToastNotification.name}`;
      
      try {
        const notif = new Notification(title, {
          body: eventToastNotification.message || 'Click to view event in Discord',
          tag: `event-${eventToastNotification.eventId}`,
          renotify: true,
        });

        notif.onclick = () => {
          window.focus();
          if (eventToastNotification.channel?._id) {
            const targetChannel = channels.find((c) => c._id === eventToastNotification.channel._id);
            if (targetChannel) {
              selectChannel(targetChannel);
            }
          }
        };
      } catch (e) {
        console.log('Browser Push Notification error:', e);
      }
    }
  }, [eventToastNotification, channels, selectChannel]);

  if (!eventToastNotification) return null;

  const isStarted = eventToastNotification.type === 'started';

  const handleJoinVoice = () => {
    if (eventToastNotification.channel?._id) {
      const targetChannel = channels.find((c) => c._id === eventToastNotification.channel._id);
      if (targetChannel) {
        selectChannel(targetChannel);
      }
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex max-w-md items-start space-x-3 rounded-xl bg-[#1e1f22] p-4 text-white shadow-2xl border border-indigo-500/40 animate-bounce-short">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isStarted ? 'bg-green-500' : 'bg-indigo-600'}`}>
        {isStarted ? (
          <span className="text-xl">🎉</span>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            {isStarted ? 'Event Started' : 'Event Reminder'}
          </span>
          <button
            onClick={() => useServerStore.setState({ eventToastNotification: null })}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="font-bold text-sm text-white">{eventToastNotification.name}</div>
        <p className="text-xs text-gray-300">{eventToastNotification.message}</p>

        {eventToastNotification.channel && (
          <div className="pt-2">
            <button
              onClick={handleJoinVoice}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow"
            >
              🔊 Join {eventToastNotification.channel.name || 'Voice Channel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
