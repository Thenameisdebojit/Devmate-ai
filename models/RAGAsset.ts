import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IRAGAsset extends Document {
  assetId: string
  filename: string
  filePath: string // Relative path from assets directory
  modality: 'image' | 'pdf' | 'text'
  mimeType: string
  size: number
  userId: string
  groupIds: string[]
  status: 'pending' | 'processing' | 'completed' | 'error'
  extractedText?: string
  caption?: string
  tags?: string[]
  error?: string
  uploadedAt: Date
  processedAt?: Date
}

const RAGAssetSchema: Schema = new Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    modality: {
      type: String,
      enum: ['image', 'pdf', 'text'],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    groupIds: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'error'],
      default: 'pending',
    },
    extractedText: {
      type: String,
    },
    caption: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },
    error: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

RAGAssetSchema.index({ userId: 1, status: 1 })
RAGAssetSchema.index({ groupIds: 1 })
RAGAssetSchema.index({ assetId: 1 })

export default (mongoose.models.RAGAsset as Model<IRAGAsset>) || mongoose.model<IRAGAsset>('RAGAsset', RAGAssetSchema)
