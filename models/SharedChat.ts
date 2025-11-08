import mongoose from 'mongoose'

const sharedChatSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: false,
    },
    title: {
      type: String,
      required: true,
    },
    messages: {
      type: Array,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

const SharedChat = mongoose.models.SharedChat || mongoose.model('SharedChat', sharedChatSchema)

export default SharedChat
