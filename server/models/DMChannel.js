import mongoose from 'mongoose';

const dmChannelSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
  },
  { timestamps: true }
);

const DMChannel = mongoose.model('DMChannel', dmChannelSchema);
export default DMChannel;
