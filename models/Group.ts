import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IGroup extends Document {
  name: string
  description?: string
  createdBy: string // User ID (super user)
  members: Array<{
    userId: string
    role: 'member' | 'admin'
    joinedAt: Date
  }>
  assetIds: string[] // Asset IDs accessible by this group
  isPublic: boolean // All base users can access
  createdAt: Date
  updatedAt: Date
}

const GroupSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    members: [
      {
        userId: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          enum: ['member', 'admin'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assetIds: {
      type: [String],
      default: [],
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

GroupSchema.index({ createdBy: 1, name: 1 })
GroupSchema.index({ 'members.userId': 1 })
GroupSchema.index({ isPublic: 1 })

export default (mongoose.models.Group as Model<IGroup>) || mongoose.model<IGroup>('Group', GroupSchema)
