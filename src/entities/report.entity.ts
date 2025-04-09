import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryPlantCodeType } from './delivery.entity';

export enum PlantCodeType {
  H = 'H',
}

export enum PrivilegeFlagType {
  N = 'N',
}

export enum BarcodeStatusType {
  N = 'N',
}

export enum VatSaleFlagType {
  N = 'N',
}

@Entity('reports')
@Unique(['delNumber'])
export class Report {
  @Column({ type: 'uuid', primary: true, default: () => 'gen_random_uuid()' })
  id: string;

  @Column({
    type: 'varchar',
    // enum: PlantCodeType,
  })
  plantCode!: string;

  @Column({ type: 'varchar', nullable: false })
  venderCode!: string;

  @Column({ type: 'varchar', nullable: false })
  delNumber!: string;

  @Column({
    nullable: false,
    type: 'timestamptz',
  })
  delDate: Date;

  @Column({
    nullable: false,
    type: 'integer',
  })
  delPeriod: number;

  @Column({
    nullable: true,
    type: 'timestamptz',
  })
  delSlideDate?: Date | null;

  @Column({
    nullable: true,
    type: 'integer',
  })
  delSlidePeriod?: number;

  @Column({
    nullable: false,
    type: 'timestamptz',
  })
  receivedDate: Date;

  @Column({ type: 'varchar', nullable: false })
  delCtl!: string;

  @Column({ type: 'varchar', nullable: true })
  workGroup!: string;

  @Column({ type: 'varchar', nullable: true })
  poNo!: string;

  @Column({ type: 'varchar', nullable: false })
  materialName!: string;

  @Column({ type: 'varchar', nullable: false })
  materialNo!: string;

  @Column({
    nullable: false,
    type: 'integer',
  })
  poQty: number;

  @Column({
    nullable: false,
    type: 'integer',
  })
  receiveQty: number;

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
    // enum: PrivilegeFlagType,
    type: 'varchar',
    nullable: false,
  })
  privilegeFlag: string;

  @Column({
    // type: 'enum',
    // enum: BarcodeStatusType,
    type: 'varchar',
    nullable: false,
  })
  barcodeStatus: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  tagId: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  organizeId: string;

  @Column({
    // type: 'enum',
    // enum: VatSaleFlagType,
    type: 'varchar',
    nullable: false,
  })
  vatSaleFlag: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  invoiceDateShipped: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  invoiceInvoiceNo: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  invoiceCustomerOrderNumber: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  invoicePrice: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  invoiceSalesAmount: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryPlantCodeType,
    type: 'varchar',
    nullable: true,
  })
  deliveryPlantCode!: DeliveryPlantCodeType;

  @Column({ type: 'varchar', nullable: true })
  deliveryVenderCode!: string;

  @Column({ type: 'varchar', nullable: true })
  deliveryDeliveryNo!: string;

  @Column({
    nullable: true,
    type: 'timestamptz',
  })
  deliveryDeliveryDate: Date;

  @Column({ type: 'varchar', nullable: true })
  deliveryPartNo!: string;

  @Column({
    // nullable: false,
    // type: 'integer',
    type: 'varchar',
    nullable: true,
  })
  deliveryQty: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  deliveryReceiveArea: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  deliveryFollowingProc: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryVatType,
    type: 'varchar',
    nullable: true,
  })
  deliveryVat: string;

  @Column({
    // type: 'enum',
    // enum: DeliveryPrivilegeFlagType,
    type: 'varchar',
    nullable: true,
  })
  deliveryPrivilegeFlag: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  deliveryReferenceNoTag: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
