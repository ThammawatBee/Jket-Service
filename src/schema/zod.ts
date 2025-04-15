import { DateTime } from 'luxon';
import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

const CreateReportSchema = z.object({
  plantCode: z.string(),
  venderCode: z.string(),
  delNumber: z.string(),
  delDate: z
    .string()
    .refine(
      (date) => {
        return DateTime.fromFormat(date, 'dd/MM/yyyy').isValid;
      },
      { message: 'delDate is invalid date' },
    )
    .transform((date) => DateTime.fromFormat(date, 'dd/MM/yyyy').toJSDate()),
  delPeriod: z.number(),
  delSlideDate: z
    .string()
    .nullable()
    .refine(
      (date) => {
        if (date) {
          return DateTime.fromFormat(date, 'dd/MM/yyyy').isValid;
        }
        return true;
      },
      { message: 'delSlideDate is invalid date' },
    )
    .transform((date) =>
      date ? DateTime.fromFormat(date, 'dd/MM/yyyy').toJSDate() : null,
    ),
  delSlidePeriod: z.number().nullable(),
  receivedDate: z
    .string()
    .refine(
      (receivedDate) => {
        if (receivedDate) {
          return DateTime.fromFormat(receivedDate, 'dd/MM/yyyy').isValid;
        }
        return true;
      },
      { message: 'receivedDate is invalid date' },
    )
    .transform((date) => DateTime.fromFormat(date, 'dd/MM/yyyy').toJSDate()),
  delCtl: z.string(),
  workGroup: z.string().nullable().default(null),
  poNo: z.string().nullable().default(null),
  materialName: z.string(),
  materialNo: z.string(),
  poQty: z.number(),
  receiveQty: z.number(),
  receiveArea: z.string(),
  followingProc: z.string(),
  privilegeFlag: z.string(),
  barcodeStatus: z.string(),
  tagId: z.string(),
  organizeId: z.string(),
  vatSaleFlag: z.string(),
});

export class CreateReport extends createZodDto(
  z.object({ reports: z.array(CreateReportSchema) }),
) {}

const CreateDeliveryReportSchema = z.object({
  venderCode: z.string(),
  plantCode: z.enum(['F', 'D']),
  deliveryNo: z.string(),
  deliveryDate: z
    .string()
    .refine(
      (deliveryDate) => {
        if (deliveryDate) {
          return DateTime.fromFormat(deliveryDate, 'yyyy/MM/dd').isValid;
        }
        return true;
      },
      { message: 'deliveryDate: is invalid date' },
    )
    .transform((date) => DateTime.fromFormat(date, 'yyyy/MM/dd').toJSDate()),
  partNo: z.string(),
  qty: z.string(),
  receiveArea: z.string(),
  followingProc: z.string(),
  vat: z.string(),
  privilegeFlag: z.string(),
  referenceNoTag: z.string(),
});

export class CreateDeliveryReport extends createZodDto(
  z.object({ deliveryReports: z.array(CreateDeliveryReportSchema) }),
) {}

const CreateInvoiceReportSchema = z.object({
  dateShipped: z.string(),
  invoiceNo: z.string(),
  customerOrderNumber: z.string(),
  price: z.string(),
  salesAmount: z.string(),
});

export class CreateInvoiceReport extends createZodDto(
  z.object({ invoiceReports: z.array(CreateInvoiceReportSchema) }),
) {}

const ListReportSchema = z.object({
  offset: z.string().optional(),
  limit: z.string().optional(),
  monthly: z.string().refine(
    (deliveryDate) => {
      if (deliveryDate) {
        return DateTime.fromFormat(deliveryDate, 'MM/yyyy').isValid;
      }
      return true;
    },
    { message: 'deliveryDate: is invalid date' },
  ),
});

export class ListReports extends createZodDto(ListReportSchema) {}

const ListDeliveryReportSchema = z.object({
  offset: z.string().optional(),
  limit: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
});

export class ListDeliveryReport extends createZodDto(
  ListDeliveryReportSchema,
) {}
