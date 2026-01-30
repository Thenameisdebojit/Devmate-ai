import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  avatar?: string
  provider?: string
  providerId?: string
  role?: 'base_user' | 'super_user' | 'admin'
  createdAt: Date
  updatedAt: Date
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ['credentials', 'google'],
      default: 'credentials',
    },
    providerId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['base_user', 'super_user', 'admin'],
      default: 'base_user',
    },
  },
  {
    timestamps: true,
  }
)

UserSchema.index({ email: 1 })

export default (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
