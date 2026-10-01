import Event from '../models/Event.js';

export const startReminderScheduler = (io) => {
  console.log('Event Reminder Scheduler started');

  const checkEvents = async () => {
    try {
      const now = new Date();
      // Find all scheduled events
      const scheduledEvents = await Event.find({ status: 'scheduled' })
        .populate('creator', 'username email avatar')
        .populate('channel', 'name type');

      for (const event of scheduledEvents) {
        const diffMs = new Date(event.scheduledStartTime).getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        const serverIdStr = event.server.toString();
        let updated = false;

        const opt = event.notificationOption || 'all';

        // 1. Check Event Start (time arrived or passed)
        if (diffMs <= 0) {
          event.status = 'active';
          if (!event.remindersSent.includes('start')) {
            event.remindersSent.push('start');
          }
          updated = true;

          const startPayload = {
            eventId: event._id,
            serverId: event.server,
            name: event.name,
            description: event.description,
            message: `🎉 Event "${event.name}" is starting now!`,
            locationType: event.locationType,
            channel: event.channel,
            externalLocation: event.externalLocation,
            interestedUserIds: event.interestedUsers.map((u) => u.toString()),
          };

          if (io) {
            io.to(serverIdStr).emit('event_started', startPayload);
          }
        }
        // 2. Check 1 minute reminder
        else if (diffMinutes <= 1.05 && !event.remindersSent.includes('1m') && (opt === 'all' || opt === '1m')) {
          event.remindersSent.push('1m');
          updated = true;

          const reminderPayload = {
            eventId: event._id,
            serverId: event.server,
            name: event.name,
            description: event.description,
            minutesLeft: 1,
            message: `⏰ Event "${event.name}" starts in 1 minute!`,
            locationType: event.locationType,
            channel: event.channel,
            externalLocation: event.externalLocation,
            interestedUserIds: event.interestedUsers.map((u) => u.toString()),
          };

          if (io) {
            io.to(serverIdStr).emit('event_reminder', reminderPayload);
          }
        }
        // 3. Check 15 minutes reminder
        else if (diffMinutes <= 15.05 && diffMinutes > 1.05 && !event.remindersSent.includes('15m') && (opt === 'all' || opt === '15m')) {
          event.remindersSent.push('15m');
          updated = true;

          const reminderPayload = {
            eventId: event._id,
            serverId: event.server,
            name: event.name,
            description: event.description,
            minutesLeft: 15,
            message: `⏰ Event "${event.name}" starts in 15 minutes!`,
            locationType: event.locationType,
            channel: event.channel,
            externalLocation: event.externalLocation,
            interestedUserIds: event.interestedUsers.map((u) => u.toString()),
          };

          if (io) {
            io.to(serverIdStr).emit('event_reminder', reminderPayload);
          }
        }
        // 4. Check 1 hour reminder
        else if (diffMinutes <= 60.05 && diffMinutes > 15.05 && !event.remindersSent.includes('1h') && (opt === 'all' || opt === '1h')) {
          event.remindersSent.push('1h');
          updated = true;

          const reminderPayload = {
            eventId: event._id,
            serverId: event.server,
            name: event.name,
            description: event.description,
            minutesLeft: 60,
            message: `⏰ Event "${event.name}" starts in 1 hour!`,
            locationType: event.locationType,
            channel: event.channel,
            externalLocation: event.externalLocation,
            interestedUserIds: event.interestedUsers.map((u) => u.toString()),
          };

          if (io) {
            io.to(serverIdStr).emit('event_reminder', reminderPayload);
          }
        }

        if (updated) {
          await event.save();
        }
      }
    } catch (err) {
      console.error('Error in checkEvents scheduler:', err.message);
    }
  };

  // Run check every 5 seconds for fast response & testing
  const intervalId = setInterval(checkEvents, 5000);
  checkEvents(); // Initial run

  return intervalId;
};
