import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    avatar: {
      type: String,
      default: 'https://cdn.discordapp.com/embed/avatars/0.png',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'idle'],
      default: 'offline',
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
