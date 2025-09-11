import mongoose, { Schema, Document } from 'mongoose';

// Base interface for all documents
interface BaseDocument extends Document {
    id: string;
    json_url: string;
    excel_url: string;
    remark: string;
    metadata: {
        filename: string;
        document_type: string;
        processed_at: string;
        file_size: number;
        [key: string]: any; // Allow additional metadata fields
    };
    retry_used: string;
    created_at: Date;
    updated_at: Date;
    updated_by_user: boolean;
    history: Array<{
        field: string;
        old_value: unknown;
        new_value: unknown;
        updated_at: Date;
        updated_by: string;
    }>;
}

// Generic Document Interface - Completely flexible
export interface GenericDocument extends BaseDocument {
    data: {
        document_type: 'Rebut' | 'NPT' | 'Kosu';
        header?: { [key: string]: any };
        [key: string]: any; // Allow any additional data fields
    };
}

// Legacy interfaces kept for backward compatibility but made more flexible
export interface RebutDocument extends BaseDocument {
    data: {
        document_type: 'Rebut';
        header?: { [key: string]: any };
        items?: Array<{ [key: string]: any }>;
        notes?: Array<any>;
        [key: string]: any; // Allow any additional data fields
    };
}

// NPT Document Interface - Flexible
export interface NPTDocument extends BaseDocument {
    data: {
        document_type: 'NPT';
        header?: { [key: string]: any };
        downtime_events?: Array<{ [key: string]: any }>;
        [key: string]: any; // Allow any additional data fields
    };
}

// Kosu Document Interface - Flexible
export interface KosuDocument extends BaseDocument {
    data: {
        document_type: 'Kosu';
        header?: { [key: string]: any };
        team_summary?: { [key: string]: any };
        remark?: string | null;
        [key: string]: any; // Allow any additional data fields
    };
}

// Base Schema
const baseSchema = {
    id: { type: String, required: true, unique: true },
    json_url: { type: String, required: true },
    excel_url: { type: String, required: true },
    remark: { type: String, required: true },
    metadata: {
        filename: { type: String, required: true },
        document_type: { type: String, required: true },
        processed_at: { type: String, required: true },
        file_size: { type: Number, required: true },
        // Allow additional metadata fields
        type: Schema.Types.Mixed,
    },
    retry_used: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    updated_by_user: { type: Boolean, default: false },
    history: [
        {
            field: { type: String, required: true },
            old_value: { type: Schema.Types.Mixed },
            new_value: { type: Schema.Types.Mixed },
            updated_at: { type: Date, default: Date.now },
            updated_by: { type: String, default: 'user' },
        },
    ],
};

// Generic Schema - Completely flexible for any document type
const genericSchema = new Schema<GenericDocument>({
    ...baseSchema,
    data: {
        document_type: {
            type: String,
            required: true,
            enum: ['Rebut', 'NPT', 'Kosu'],
        },
        // Everything else is completely flexible
        type: Schema.Types.Mixed,
    },
});

// Flexible Rebut Schema
const rebutSchema = new Schema<RebutDocument>({
    ...baseSchema,
    data: {
        document_type: { type: String, required: true, default: 'Rebut' },
        // All fields are flexible Mixed types
        header: { type: Schema.Types.Mixed, default: {} },
        items: { type: Schema.Types.Mixed, default: [] },
        notes: { type: Schema.Types.Mixed, default: [] },
        // Allow any additional fields
        type: Schema.Types.Mixed,
    },
});

// Flexible NPT Schema
const nptSchema = new Schema<NPTDocument>({
    ...baseSchema,
    data: {
        document_type: { type: String, required: true, default: 'NPT' },
        // All fields are flexible Mixed types
        header: { type: Schema.Types.Mixed, default: {} },
        downtime_events: { type: Schema.Types.Mixed, default: [] },
        // Allow any additional fields
        type: Schema.Types.Mixed,
    },
});

// Flexible Kosu Schema
const kosuSchema = new Schema<KosuDocument>({
    ...baseSchema,
    data: {
        document_type: { type: String, required: true, default: 'Kosu' },
        // All fields are flexible Mixed types
        header: { type: Schema.Types.Mixed, default: {} },
        team_summary: { type: Schema.Types.Mixed, default: {} },
        remark: { type: Schema.Types.Mixed, default: null },
        // Allow any additional fields
        type: Schema.Types.Mixed,
    },
});

// Create models
export const GenericDocumentModel =
    mongoose.models.GenericDocument ||
    mongoose.model<GenericDocument>('GenericDocument', genericSchema);

export const RebutModel =
    mongoose.models.Rebut ||
    mongoose.model<RebutDocument>('Rebut', rebutSchema);

export const NPTModel =
    mongoose.models.NPT || mongoose.model<NPTDocument>('NPT', nptSchema);

export const KosuModel =
    mongoose.models.Kosu || mongoose.model<KosuDocument>('Kosu', kosuSchema);

// Utility function to get the appropriate model based on document type
export function getDocumentModel(documentType: string) {
    switch (documentType.toLowerCase()) {
        case 'rebut':
            return RebutModel;
        case 'npt':
            return NPTModel;
        case 'kosu':
            return KosuModel;
        default:
            return GenericDocumentModel;
    }
}

// Type guard functions
export function isRebutDocument(doc: any): doc is RebutDocument {
    return doc?.data?.document_type === 'Rebut';
}

export function isNPTDocument(doc: any): doc is NPTDocument {
    return doc?.data?.document_type === 'NPT';
}

export function isKosuDocument(doc: any): doc is KosuDocument {
    return doc?.data?.document_type === 'Kosu';
}
