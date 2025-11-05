import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  action?: 'generate' | 'explain' | 'rewrite' | 'fix'
  domain?: string
  timestamp: number
}

export interface IChat extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  messages: IMessage[]
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  action: { type: String, enum: ['generate', 'explain', 'rewrite', 'fix'] },
  domain: { type: String },
  timestamp: { type: Number, required: true },
}, { _id: false })

const ChatSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
)

ChatSchema.index({ userId: 1, createdAt: -1 })

export default (mongoose.models.Chat as Model<IChat>) || mongoose.model<IChat>('Chat', ChatSchema)
