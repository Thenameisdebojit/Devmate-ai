import mongoose from 'mongoose'

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required')
}

const MONGODB_URI = process.env.MONGODB_URI

interface CachedConnection {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

let cached: CachedConnection = (global as any).mongoose || { conn: null, promise: null }

if (!(global as any).mongoose) {
  (global as any).mongoose = cached
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    if (!MONGODB_URI) {
      throw new Error('Please define MONGODB_URI environment variable')
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
