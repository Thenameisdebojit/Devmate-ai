import mongoose from 'mongoose'

const SettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    updates: { type: Boolean, default: true }
  },
  privacy: {
    dataCollection: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    shareData: { type: Boolean, default: false }
  },
  accessibility: {
    fontSize: { 
      type: String, 
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    },
    highContrast: { type: Boolean, default: false }
  }
}, {
  timestamps: true
})

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema)
