export type EntityType = 'Person' | 'Organization' | 'Property' | 'Document';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  metadata?: Record<string, any>; // Store arbitrary OSINT metadata here
}

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  description?: string;
}

export interface Evidence {
  id: string;
  title: string;
  type: 'Document' | 'Link' | 'Transaction' | 'Financial';
  url?: string;
  content?: string;
  entityIds: string[]; // Linked entities
  createdAt: string;
}
