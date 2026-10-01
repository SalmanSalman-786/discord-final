import Event from '../models/Event.js';
import Server from '../models/Server.js';

// @desc    Create a new server event
// @route   POST /api/servers/:serverId/events
// @access  Private
export const createEvent = async (req, res) => {
  try {
    const { serverId } = req.params;
    const {
      name,
      description,
      scheduledStartTime,
      scheduledEndTime,
      locationType,
      channel,
      externalLocation,
      notificationOption,
    } = req.body;

    if (!name || !scheduledStartTime) {
      return res.status(400).json({ message: 'Event name and start time are required' });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    // Check if user is a member of the server
    const isMember = server.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Only server members can create events' });
    }

    const newEvent = await Event.create({
      server: serverId,
      creator: req.user._id,
      name,
      description: description || '',
      scheduledStartTime: new Date(scheduledStartTime),
      scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
      locationType: locationType || 'voice',
      channel: locationType === 'voice' ? channel : null,
      externalLocation: locationType === 'external' ? externalLocation : '',
      notificationOption: notificationOption || 'all',
      interestedUsers: [req.user._id], // Creator automatically interested
      status: 'scheduled',
      remindersSent: [],
    });

    const populatedEvent = await Event.findById(newEvent._id)
      .populate('creator', 'username email avatar')
      .populate('channel', 'name type')
      .populate('interestedUsers', 'username email avatar');

    // Notify server socket room about new event
    const io = req.app.get('io');
    if (io) {
      io.to(serverId).emit('event_created', populatedEvent);
    }

    return res.status(201).json(populatedEvent);
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ message: 'Server error creating event' });
  }
};

// @desc    Get all events for a server
// @route   GET /api/servers/:serverId/events
// @access  Private
export const getServerEvents = async (req, res) => {
  try {
    const { serverId } = req.params;

    const events = await Event.find({ server: serverId })
      .sort({ scheduledStartTime: 1 })
      .populate('creator', 'username email avatar')
      .populate('channel', 'name type')
      .populate('interestedUsers', 'username email avatar');

    return res.json(events);
  } catch (error) {
    console.error('Get server events error:', error);
    return res.status(500).json({ message: 'Server error fetching events' });
  }
};

// @desc    Update an event
// @route   PATCH /api/events/:eventId
// @access  Private
export const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      name,
      description,
      scheduledStartTime,
      scheduledEndTime,
      locationType,
      channel,
      externalLocation,
      notificationOption,
      status,
    } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const server = await Server.findById(event.server);
    const isCreator = event.creator.toString() === req.user._id.toString();
    const isOwner = server && server.owner.toString() === req.user._id.toString();

    if (!isCreator && !isOwner) {
      return res.status(403).json({ message: 'Only creator or server owner can update event' });
    }

    if (name !== undefined) event.name = name;
    if (description !== undefined) event.description = description;
    if (scheduledStartTime !== undefined) event.scheduledStartTime = new Date(scheduledStartTime);
    if (scheduledEndTime !== undefined) event.scheduledEndTime = scheduledEndTime ? new Date(scheduledEndTime) : null;
    if (locationType !== undefined) event.locationType = locationType;
    if (channel !== undefined) event.channel = locationType === 'voice' ? channel : null;
    if (externalLocation !== undefined) event.externalLocation = locationType === 'external' ? externalLocation : '';
    if (notificationOption !== undefined) event.notificationOption = notificationOption;
    if (status !== undefined) event.status = status;

    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate('creator', 'username email avatar')
      .populate('channel', 'name type')
      .populate('interestedUsers', 'username email avatar');

    // Notify server room
    const io = req.app.get('io');
    if (io) {
      io.to(event.server.toString()).emit('event_updated', updatedEvent);
    }

    return res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ message: 'Server error updating event' });
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:eventId
// @access  Private
export const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const server = await Server.findById(event.server);
    const isCreator = event.creator.toString() === req.user._id.toString();
    const isOwner = server && server.owner.toString() === req.user._id.toString();

    if (!isCreator && !isOwner) {
      return res.status(403).json({ message: 'Only creator or server owner can delete event' });
    }

    const serverId = event.server.toString();
    await Event.findByIdAndDelete(eventId);

    const io = req.app.get('io');
    if (io) {
      io.to(serverId).emit('event_deleted', { eventId, serverId });
    }

    return res.json({ message: 'Event deleted successfully', eventId });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ message: 'Server error deleting event' });
  }
};

// @desc    Toggle interested status for an event
// @route   POST /api/events/:eventId/interested
// @access  Private
export const toggleInterested = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isInterested = event.interestedUsers.some(
      (uId) => uId.toString() === userId.toString()
    );

    if (isInterested) {
      event.interestedUsers = event.interestedUsers.filter(
        (uId) => uId.toString() !== userId.toString()
      );
    } else {
      event.interestedUsers.push(userId);
    }

    await event.save();

    const updatedEvent = await Event.findById(eventId)
      .populate('creator', 'username email avatar')
      .populate('channel', 'name type')
      .populate('interestedUsers', 'username email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(event.server.toString()).emit('event_updated', updatedEvent);
    }

    return res.json(updatedEvent);
  } catch (error) {
    console.error('Toggle interested error:', error);
    return res.status(500).json({ message: 'Server error toggling interested' });
  }
};
