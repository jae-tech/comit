/**
 * All TypeORM entities in a single file to avoid circular import issues
 * with SWC's CommonJS output and emitDecoratorMetadata.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Citation } from '@orbit/shared';

// ─── User ────────────────────────────────────────────────────────────────────

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Workspace, (w) => w.owner)
  workspaces: Workspace[];

  @OneToMany(() => AiProvider, (p) => p.user)
  providers: AiProvider[];
}

// ─── AiProvider ──────────────────────────────────────────────────────────────

export type ProviderType = 'openai' | 'anthropic' | 'gemini';

@Entity('ai_providers')
export class AiProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  provider: ProviderType;

  @Column({ name: 'encrypted_key' })
  encryptedKey: string;

  @Column()
  iv: string;

  @Column()
  model: string;

  @ManyToOne(() => User, (u) => u.providers)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─── Workspace ────────────────────────────────────────────────────────────────

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'persona_name', type: 'varchar', length: 100, nullable: true })
  personaName: string | null;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string | null;

  @ManyToOne(() => User, (u) => u.workspaces)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Document, (d) => d.workspace)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─── Document ────────────────────────────────────────────────────────────────

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column()
  filename: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: DocumentStatus;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'file_path' })
  filePath: string;

  @ManyToOne(() => Workspace, (w) => w.documents)
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @OneToMany(() => DocumentChunk, (c) => c.document, { cascade: true })
  chunks: DocumentChunk[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─── DocumentChunk ────────────────────────────────────────────────────────────

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  // pgvector: vector(768) — OpenAI text-embedding-3-small (dimensions:768) / Gemini text-embedding-004 (기본 768)
  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  @ManyToOne(() => Document, (d) => d.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;
}

// ─── ChatSession ──────────────────────────────────────────────────────────────

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToMany(() => ChatMessage, (m) => m.session, { cascade: true })
  messages: ChatMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

// ─── ChatMessage ──────────────────────────────────────────────────────────────

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar' })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'citations_json', type: 'jsonb', default: '[]' })
  citations: Citation[];

  @ManyToOne(() => ChatSession, (s) => s.messages)
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
