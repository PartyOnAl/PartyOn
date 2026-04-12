import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Suggestions DJ search (`public.djs`). Column names vary by project; this covers common shapes.
 * If your table uses a different primary key, adjust this entity to match.
 */
@Entity({ name: 'djs', schema: 'public' })
export class Dj {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column('text', { nullable: true })
  name: string | null;

  @Column('text', { name: 'dj_name', nullable: true })
  djName: string | null;

  @Column('text', { name: 'display_name', nullable: true })
  displayName: string | null;

  @Column('text', { nullable: true })
  title: string | null;
}
