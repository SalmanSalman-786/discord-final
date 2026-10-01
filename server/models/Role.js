import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
    },
    color: {
      type: String,
      default: '#99aab5',
    },
    permissions: [
      {
        type: String,
      },
    ],
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
    },
  },
  { timestamps: true }
);

const Role = mongoose.model('Role', roleSchema);
export default Role;
