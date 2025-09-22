import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Only enforce MONGODB_URI at runtime, not during build
if (
    !MONGODB_URI &&
    process.env.NODE_ENV !== 'development' &&
    typeof window === 'undefined'
) {
    console.warn('MONGODB_URI is not defined. Database operations will fail.');
}

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
    global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
    if (cached.conn) {
        return cached.conn;
    }

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts);
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default dbConnect;
