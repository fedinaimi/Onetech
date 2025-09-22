import type {
    KosuDocument,
    NPTDocument,
    RebutDocument,
} from '@/models/Document';
import { KosuModel, NPTModel, RebutModel } from '@/models/Document';

export type DocumentType = 'Rebut' | 'NPT' | 'Kosu';
export type Document = RebutDocument | NPTDocument | KosuDocument;

export const getModelByType = (type: DocumentType) => {
    switch (type) {
        case 'Rebut':
            return RebutModel;
        case 'NPT':
            return NPTModel;
        case 'Kosu':
            return KosuModel;
        default:
            throw new Error(`Unknown document type: ${type}`);
    }
};

export const saveDocument = async (
    data: Partial<Document>,
    type: DocumentType,
) => {
    const Model = getModelByType(type);
    const document = new Model(data);
    return await document.save();
};

export const updateDocumentField = async (
    id: string,
    type: DocumentType,
    field: string,
    oldValue: unknown,
    newValue: unknown,
) => {
    const Model = getModelByType(type);

    const updateData = {
        updated_at: new Date(),
        updated_by_user: true,
        $push: {
            history: {
                field,
                old_value: oldValue,
                new_value: newValue,
                updated_at: new Date(),
                updated_by: 'user',
            },
        },
    };

    // Build the dynamic field update
    const fieldUpdate: Record<string, unknown> = {};
    fieldUpdate[field] = newValue;

    return await Model.findOneAndUpdate(
        { id },
        { ...updateData, ...fieldUpdate },
        { new: true },
    );
};

export const updateDocumentVerification = async (
    id: string,
    type: DocumentType,
    updates: {
        data?: any;
        metadata?: any;
        verification_status:
            | 'original'
            | 'draft'
            | 'pending_verification'
            | 'verified'
            | 'revision_needed';
        verified_by?: string;
        verified_at?: Date;
        verification_notes?: string;
    },
) => {
    const Model = getModelByType(type);

    const updateData: any = {
        updated_at: new Date(),
        verification_status: updates.verification_status,
        $push: {
            verification_history: {
                status: updates.verification_status,
                timestamp: new Date(),
                user: updates.verified_by || 'user',
                notes: updates.verification_notes,
            },
        },
    };

    // If data is being updated, mark as modified by user
    if (updates.data) {
        updateData.data = updates.data;
        updateData.updated_by_user = true;
    }

    // If metadata is being updated
    if (updates.metadata) {
        updateData.metadata = updates.metadata;
    }

    // Add verification specific fields
    if (updates.verified_by) {
        updateData.verified_by = updates.verified_by;
    }

    if (updates.verified_at) {
        updateData.verified_at = updates.verified_at;
    }

    return await Model.findOneAndUpdate({ id }, updateData, { new: true });
};

export const getDocuments = async (type: DocumentType, limit?: number) => {
    const Model = getModelByType(type);
    const query = Model.find().sort({ created_at: -1 });

    if (limit) {
        query.limit(limit);
    }

    return await query.exec();
};

export const getDocumentById = async (id: string, type: DocumentType) => {
    const Model = getModelByType(type);
    return await Model.findOne({ id }).exec();
};

export const deleteDocument = async (id: string, type: DocumentType) => {
    const Model = getModelByType(type);
    return await Model.deleteOne({ id }).exec();
};

export const exportToCSV = (
    documents: Document[],
    type: DocumentType,
): string => {
    if (documents.length === 0) return '';

    const headers: string[] = [];
    const rows: string[][] = [];

    documents.forEach(doc => {
        if (type === 'Rebut' && doc.data.document_type === 'Rebut') {
            const rebutDoc = doc as RebutDocument;
            if (rebutDoc.data.items && rebutDoc.data.header) {
                rebutDoc.data.items.forEach((item, index) => {
                    if (headers.length === 0) {
                        headers.push(
                            'Document ID',
                            'Date',
                            'Ligne',
                            'OF Number',
                            'Item Index',
                            'Reference',
                            'Designation',
                            'Quantity',
                            'Unit',
                            'Type',
                            'Total Scrapped',
                        );
                    }
                    rows.push([
                        doc.id,
                        rebutDoc.data.header!.date,
                        rebutDoc.data.header!.ligne,
                        rebutDoc.data.header!.of_number,
                        index.toString(),
                        item.reference,
                        item.designation,
                        item.quantity.toString(),
                        item.unit,
                        item.type,
                        item.total_scrapped?.toString() || '',
                    ]);
                });
            }
        } else if (type === 'NPT' && doc.data.document_type === 'NPT') {
            const nptDoc = doc as NPTDocument;
            if (nptDoc.data.downtime_events && nptDoc.data.header) {
                nptDoc.data.downtime_events.forEach((event, index) => {
                    if (headers.length === 0) {
                        headers.push(
                            'Document ID',
                            'Date',
                            'UAP',
                            'Equipe',
                            'Event Index',
                            'Codes Ligne',
                            'Ref PF',
                            'Designation',
                            'NPT Minutes',
                            'Heure Debut',
                            'Heure Fin',
                            'Cause NPT',
                        );
                    }
                    rows.push([
                        doc.id,
                        nptDoc.data.header!.date,
                        nptDoc.data.header!.uap,
                        nptDoc.data.header!.equipe,
                        index.toString(),
                        event.codes_ligne,
                        event.ref_pf,
                        event.designation,
                        event.npt_minutes.toString(),
                        event.heure_debut_d_arret,
                        event.heure_fin_d_arret,
                        event.cause_npt,
                    ]);
                });
            }
        } else if (type === 'Kosu' && doc.data.document_type === 'Kosu') {
            const kosuDoc = doc as KosuDocument;
            if (kosuDoc.data.header && kosuDoc.data.team_summary) {
                if (headers.length === 0) {
                    headers.push(
                        'Document ID',
                        'Date',
                        'Nom Ligne',
                        'Code Ligne',
                        'Numero OF',
                        'Ref PF',
                        'Heures Deposees',
                        'Objectif Qte EQ',
                        'Qte Realisee',
                    );
                }
                rows.push([
                    doc.id,
                    kosuDoc.data.header!.date,
                    kosuDoc.data.header!.nom_ligne,
                    kosuDoc.data.header!.code_ligne,
                    kosuDoc.data.header!.numero_of,
                    kosuDoc.data.header!.ref_pf,
                    kosuDoc.data.team_summary!.heures_deposees.toString(),
                    kosuDoc.data.team_summary!.objectif_qte_eq?.toString() ||
                        '',
                    kosuDoc.data.team_summary!.qte_realisee.toString(),
                ]);
            }
        }
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
    ].join('\n');
    return csvContent;
};
