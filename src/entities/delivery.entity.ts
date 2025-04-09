import { Column, CreateDateColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Entity } from 'typeorm/decorator/entity/Entity';

export enum DeliveryPlantCodeType {
  F = 'F',
  D = 'D',
}

export enum DeliveryVatType {
  VAT = 'VAT',
  NOVAT = 'NO-VAT',
}

export enum DeliveryPrivilegeFlagType {
  N = 'N',
}

@Entity('delivery_reports')
@Unique(['deliveryNo'])
export class Delivery {
  @Column({ type: 'uuid', primary: true, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryPlantCodeType,
    type: 'varchar',
  })
  plantCode!: DeliveryPlantCodeType;

  @Column({ type: 'varchar', nullable: false })
  venderCode!: string;

  @Column({ type: 'varchar', nullable: false })
  deliveryNo!: string;

  @Column({
    nullable: false,
    type: 'timestamptz',
  })
  deliveryDate: Date;

  @Column({ type: 'varchar', nullable: false })
  partNo!: string;

  @Column({
    // nullable: false,
    // type: 'integer',
    type: 'varchar',
    nullable: false,
  })
  qty: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  receiveArea: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  followingProc: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryVatType,
    type: 'varchar',
    nullable: false,
  })
  vat: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryPrivilegeFlagType,
    type: 'varchar',
    nullable: false,
  })
  privilegeFlag: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  referenceNoTag: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
