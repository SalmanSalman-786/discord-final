import mongoose from 'mongoose';

const readStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  { timestamps: true }
);

readStateSchema.index({ user: 1, channel: 1 }, { unique: true });

const ReadState = mongoose.model('ReadState', readStateSchema);
export default ReadState;
