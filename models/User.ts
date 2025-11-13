import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  avatar?: string
  provider?: string
  providerId?: string
  subscription?: {
    plan: 'free' | 'pro' | 'pro_plus'
    status: 'active' | 'cancelled' | 'expired'
    startDate?: Date
    endDate?: Date
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  }
  usageQuota?: {
    monthlyGenerations: number
    usedGenerations: number
    resetDate: Date
  }
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
    subscription: {
      type: {
        plan: {
          type: String,
          enum: ['free', 'pro', 'pro_plus'],
          default: 'free',
        },
        status: {
          type: String,
          enum: ['active', 'cancelled', 'expired'],
          default: 'active',
        },
        startDate: Date,
        endDate: Date,
        stripeCustomerId: String,
        stripeSubscriptionId: String,
      },
      default: {
        plan: 'free',
        status: 'active',
      },
    },
    usageQuota: {
      type: {
        monthlyGenerations: {
          type: Number,
          default: 10,
        },
        usedGenerations: {
          type: Number,
          default: 0,
        },
        resetDate: {
          type: Date,
          default: () => {
            const date = new Date()
            date.setMonth(date.getMonth() + 1)
            return date
          },
        },
      },
      default: {
        monthlyGenerations: 10,
        usedGenerations: 0,
        resetDate: () => {
          const date = new Date()
          date.setMonth(date.getMonth() + 1)
          return date
        },
      },
    },
  },
  {
    timestamps: true,
  }
)

UserSchema.index({ email: 1 })

export default (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
