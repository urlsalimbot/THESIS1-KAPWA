import { v7 as uuidv7 } from 'uuid';
import { PrimaryColumn, BeforeInsert } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }
}
