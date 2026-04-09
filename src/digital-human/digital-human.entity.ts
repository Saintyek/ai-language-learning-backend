import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DigitalHumanStatus =
  | 'not_created'
  | 'training'
  | 'ready'
  | 'failed';

@Entity('digital_humans')
export class DigitalHuman {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 20 })
  langCode: string;

  @Column({ type: 'varchar', length: 32, default: 'not_created' })
  status: DigitalHumanStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vid: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alphaVid: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  taskId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  @Column({ type: 'text', nullable: true })
  frontendPicUrl: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ default: true })
  interactionOptimise: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
