/**
 * Document type definitions for frontend
 * These match the backend document structure
 */

export type DocumentType = 'Rebut' | 'NPT' | 'Kosu';

export type VerificationStatus = 
    | 'original' 
    | 'draft' 
    | 'pending_verification' 
    | 'verified' 
    | 'revision_needed';

export interface GenericDocument {
    id: string;
    json_url: string;
    excel_url: string;
    remark: string;
    imageUrl?: string;
    metadata: {
        filename: string;
        document_type: DocumentType;
        processed_at: string;
        file_size: number;
        [key: string]: any;
    };
    retry_used: string;
    verification_status: VerificationStatus;
    verification_history: Array<{
        status: VerificationStatus;
        timestamp: string;
        user: string;
        notes?: string;
    }>;
    verified_by?: string;
    verified_at?: string;
    created_at: string;
    updated_at: string;
    updated_by_user: boolean;
    history: Array<{
        field: string;
        old_value: unknown;
        new_value: unknown;
        updated_at: string;
        updated_by: string;
    }>;
    data: {
        document_type: DocumentType;
        header?: { [key: string]: any };
        [key: string]: any;
    };
}

export interface RebutDocument extends GenericDocument {
    data: {
        document_type: 'Rebut';
        header?: { [key: string]: any };
        items?: Array<{ [key: string]: any }>;
        notes?: Array<any>;
        [key: string]: any;
    };
}

export interface NPTDocument extends GenericDocument {
    data: {
        document_type: 'NPT';
        header?: { [key: string]: any };
        downtime_events?: Array<{ [key: string]: any }>;
        [key: string]: any;
    };
}

export interface KosuDocument extends GenericDocument {
    data: {
        document_type: 'Kosu';
        header?: { [key: string]: any };
        team_summary?: { [key: string]: any };
        remark?: string | null;
        [key: string]: any;
    };
}
