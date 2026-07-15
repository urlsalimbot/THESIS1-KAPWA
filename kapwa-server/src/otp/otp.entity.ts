import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('otp_codes')
export class OtpCode extends BaseEntity {

  @Column()
  phone!: string;

  @Column()
  code!: string;

  @Column({ default: false })
  verified!: boolean;

  @Column()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
