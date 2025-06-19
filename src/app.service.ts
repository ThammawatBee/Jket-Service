import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
  ListBilling,
  ListDeliveryReport,
  ListReports,
} from './schema/zod';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { Report } from 'src/entities/report.entity';
import { DateTime, Settings } from 'luxon';
import chunk from 'lodash/chunk';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Delivery, DeliveryPlantCodeType } from './entities/delivery.entity';
import get from 'lodash/get';
import { groupBy, sortBy, sumBy, values } from 'lodash';
import { PassThrough } from 'stream';

Settings.defaultZone = 'Asia/Bangkok';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) { }
  getHello(): string {
    return 'Service is already on';
  }
  public async createReports(payload: CreateReport) {
    const reports = payload.reports;
    const cleanReports = this.deduplicateHandle(reports, 'delNumber');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const batch of chunk(cleanReports, 200)) {
        await this.reportRepository
          .createQueryBuilder()
          .insert()
          .values(batch as Partial<Report>)
          .orUpdate({
            conflict_target: ['del_number'],
            overwrite: [
              'plant_code',
              'vender_code',
              'del_number',
              'del_date',
              'del_period',
              'del_slide_date',
              'del_slide_period',
              'received_date',
              'del_ctl',
              'work_group',
              'po_no',
              'material_name',
              'material_no',
              'po_qty',
              'receive_qty',
              'receive_area',
              'following_proc',
              'privilege_flag',
              'barcode_status',
              'tag_id',
              'organize_id',
              'vat_sale_flag',
              'updated_at',
            ],
          })
          .execute();
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.log('err', err);
      await queryRunner.rollbackTransaction();
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          detail: err.detail || '',
        },
        HttpStatus.BAD_REQUEST,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private deduplicateHandle = <T extends Record<string, any>>(
    payloads: T[],
    key: keyof T,
  ): T[] => {
    const map = new Map<string, any>();

    for (const payload of payloads) {
      map.set(payload[key], payload); // keeps the *last* one
    }

    return Array.from(map.values());
  };

  public async createDeliveryReport(payload: CreateDeliveryReport) {
    const deliveryReports = payload.deliveryReports;
    const queryRunner = this.dataSource.createQueryRunner();
    const cleanDeliveryReports = this.deduplicateHandle(
      deliveryReports,
      'deliveryNo',
    );
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const batch of chunk(cleanDeliveryReports, 200)) {
        await this.deliveryRepository
          .createQueryBuilder()
          .insert()
          .values(batch as Partial<Delivery>)
          .orUpdate({
            conflict_target: ['delivery_no'],
            overwrite: [
              'vender_code',
              'plant_code',
              'delivery_no',
              'delivery_date',
              'part_no',
              'qty',
              'receive_area',
              'following_proc',
              'vat',
              'privilege_flag',
              'reference_no_tag',
              'updated_at',
            ],
          })
          .execute();
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      console.log('err', err);
      await queryRunner.rollbackTransaction();
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          detail: err.detail || '',
        },
        HttpStatus.BAD_REQUEST,
      );
    } finally {
      await queryRunner.release();
    }
  }
  public async mergeInvoiceWithReport(payload: CreateInvoiceReport) {
    const invoiceReports = payload.invoiceReports;
    const customerOrderNumbers = invoiceReports.map(
      (invoiceReport) => `'${invoiceReport.customerOrderNumber}'`,
    );
    let invoiceDateShippedCases = '';
    let invoiceInvoiceNoCases = '';
    let invoiceCustomerOrderNumberCases = '';
    let invoicePriceCases = '';
    let invoiceSalesAmountCase = '';

    invoiceReports.forEach((invoiceReport) => {
      invoiceDateShippedCases += `WHEN '${invoiceReport.customerOrderNumber}' THEN '${invoiceReport.dateShipped}' `;
      invoiceInvoiceNoCases += `WHEN '${invoiceReport.customerOrderNumber}' THEN '${invoiceReport.invoiceNo}' `;
      invoiceCustomerOrderNumberCases += `WHEN '${invoiceReport.customerOrderNumber}' THEN '${invoiceReport.customerOrderNumber}' `;
      invoicePriceCases += `WHEN '${invoiceReport.customerOrderNumber}' THEN '${invoiceReport.price}' `;
      invoiceSalesAmountCase += `WHEN '${invoiceReport.customerOrderNumber}' THEN '${invoiceReport.salesAmount}' `;
    });

    const query = `
      UPDATE "reports"
      SET
        invoice_date_shipped = CASE del_number ${invoiceDateShippedCases} END,
        invoice_invoice_no = CASE del_number ${invoiceInvoiceNoCases} END,
        invoice_customer_order_number = CASE del_number ${invoiceCustomerOrderNumberCases} END,
        invoice_price = CASE del_number ${invoicePriceCases} END,
        invoice_sales_amount = CASE del_number ${invoiceSalesAmountCase} END,
        updated_at = NOW()
      WHERE del_number IN (${customerOrderNumbers.join(',')});
    `;
    await this.dataSource.query(query);
  }

  public async mergeReportWithDeliveryReport() {
    const formatTimestamp = (date: Date | string) => {
      return `'${DateTime.fromJSDate(new Date(date)).toISO()}'`;
    };
    const deliveryReports = await this.deliveryRepository
      .createQueryBuilder('deliveryReport')
      .innerJoinAndMapOne(
        'deliveryReport.report',
        Report,
        'report',
        'deliveryReport.deliveryNo = report.delNumber',
      )
      .select(['deliveryReport', 'report.id'])
      .getMany();
    if (deliveryReports.length) {
      const removeDeliveryReportId: string[] = [];
      const reportIds: string[] = [];
      let deliveryDeliveryDateCases = '';
      let deliveryDeliveryNoCases = '';
      let deliveryFollowingProcCases = '';
      let deliveryPartNoProcCases = '';
      let deliveryPlantCodeCases = '';
      let deliveryPrivilegeFlagCases = '';
      let deliveryQtyCases = '';
      let deliveryReceiveAreaCases = '';
      let deliveryReferenceNoTagCases = '';
      let deliveryVatCases = '';
      let deliveryVenderCodeCases = '';
      deliveryReports.forEach((deliveryReport) => {
        removeDeliveryReportId.push(deliveryReport.id);
        const reportId = get(deliveryReport, 'report.id');
        reportIds.push(`'${get(deliveryReport, 'report.id')}'`);
        deliveryDeliveryDateCases += `WHEN '${reportId}' THEN ${formatTimestamp(
          deliveryReport.deliveryDate,
        )}::timestamptz `;
        deliveryDeliveryNoCases += `WHEN '${reportId}' THEN '${deliveryReport.deliveryNo}' `;
        deliveryFollowingProcCases += `WHEN '${reportId}' THEN '${deliveryReport.followingProc}' `;
        deliveryPartNoProcCases += `WHEN '${reportId}' THEN '${deliveryReport.partNo}' `;
        deliveryPlantCodeCases += `WHEN '${reportId}' THEN '${deliveryReport.plantCode}' `;
        deliveryPrivilegeFlagCases += `WHEN '${reportId}' THEN '${deliveryReport.privilegeFlag}' `;
        deliveryQtyCases += `WHEN '${reportId}' THEN '${deliveryReport.qty}' `;
        deliveryReceiveAreaCases += `WHEN '${reportId}' THEN '${deliveryReport.receiveArea}' `;
        deliveryReferenceNoTagCases += `WHEN '${reportId}' THEN '${deliveryReport.referenceNoTag}' `;
        deliveryVatCases += `WHEN '${reportId}' THEN '${deliveryReport.vat}' `;
        deliveryVenderCodeCases += `WHEN '${reportId}' THEN '${deliveryReport.venderCode}' `;
      });
      const query = `
      UPDATE "reports"
      SET
        delivery_plant_code = CASE id ${deliveryPlantCodeCases} END,
        delivery_vender_code = CASE id ${deliveryVenderCodeCases} END,
        delivery_delivery_no = CASE id ${deliveryDeliveryNoCases} END,
        delivery_delivery_date = CASE id ${deliveryDeliveryDateCases} END,
        delivery_part_no = CASE id ${deliveryPartNoProcCases} END,
        delivery_qty = CASE id ${deliveryQtyCases} END,
        delivery_receive_area = CASE id ${deliveryReceiveAreaCases} END,
        delivery_following_proc = CASE id ${deliveryFollowingProcCases} END,
        delivery_vat = CASE id ${deliveryVatCases} END,
        delivery_privilege_flag = CASE id ${deliveryPrivilegeFlagCases} END,
        delivery_reference_no_tag = CASE id ${deliveryReferenceNoTagCases} END,
        updated_at = NOW()
      WHERE id IN (${reportIds.join(',')});
    `;
      try {
        await this.dataSource.query(query);
        await this.deliveryRepository
          .createQueryBuilder('deliveryReport')
          .where('id IN (:...ids)', {
            ids: removeDeliveryReportId,
          })
          .delete()
          .execute();
      } catch (err) {
        console.log('err', err);
        throw err;
      }
    }
  }

  public async listReports(options: ListReports) {
    const [month, year] = options.monthly.split('/');
    const start = DateTime.fromObject({ year: +year, month: +month })
      .startOf('month')
      .toJSDate();
    const end = DateTime.fromObject({ year: +year, month: +month })
      .endOf('month')
      .plus({ days: 1 })
      .startOf('day')
      .toJSDate();
    const query = this.reportRepository
      .createQueryBuilder('report')
      .select('report')
      .where('report.delDate >= :start AND report.delDate < :end', {
        start,
        end,
      });
    if (options.status) {
      if (options.status === 'NO_MERGE') {
        query
          .andWhere('report.invoiceInvoiceNo IS NULL')
          .andWhere('report.deliveryDeliveryNo IS NULL');
      }
      if (options.status === 'MERGE_WITH_INVOICE') {
        query.andWhere('report.invoiceInvoiceNo IS NOT NULL');
      }
      if (options.status === 'MERGE_WITH_ORDER') {
        query.andWhere('report.deliveryDeliveryNo IS NOT NULL');
      }
      if (options.status === 'ALREADY_MERGED') {
        query.andWhere('report.invoiceInvoiceNo IS NOT NULL');
        query.andWhere('report.deliveryDeliveryNo IS NOT NULL');
      }
    }
    const count = await query.getCount();
    query.addOrderBy('report.delDate', 'DESC');
    query.addOrderBy('report.plantCode', 'ASC');
    query.addOrderBy('CAST(RIGHT(report.delNumber, 5) AS INTEGER)', 'ASC');
    query.limit(+options.limit || 20);
    query.offset(+options.offset || 0);
    const reports = await query.getMany();
    return {
      reports: reports,
      count,
    };
  }

  public async listDeliveryReports(options: ListDeliveryReport) {
    const { dateEnd, dateStart, offset, limit } = options;
    const query = this.deliveryRepository.createQueryBuilder('deliveryReport');
    if (dateStart && dateEnd) {
      query.andWhere(
        'deliveryReport.deliveryDate BETWEEN :dateStart AND :dateEnd',
        {
          dateStart: DateTime.fromFormat(dateStart, 'dd-MM-yyyy').toJSDate(),
          dateEnd: DateTime.fromFormat(dateEnd, 'dd-MM-yyyy').toJSDate(),
        },
      );
    }
    const count = await query.getCount();
    query.orderBy('deliveryReport.deliveryDate', 'DESC');
    query.limit(+limit || 20);
    query.offset(+offset || 0);
    const deliveryReports = await query.getMany();
    return { deliveryReports, count };
  }

  public async exportDeliveryReport(
    response: Response,
    options: ListDeliveryReport,
  ) {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename=reports.xlsx',
    );
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response, // STREAM directly to response
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet('DeliveryReports');
    worksheet.columns = [
      { header: 'Vendor_code', key: 'venderCode', width: 20 },
      { header: 'Plant_code', key: 'plantCode', width: 20 },
      { header: 'Delivery_No', key: 'deliveryNo', width: 20 },
      { header: 'Delivery_Date', key: 'deliveryDate', width: 20 },
      { header: 'Part_No', key: 'partNo', width: 20 },
      { header: `Q'ty`, key: 'qty', width: 20 },
      { header: `Receive_area`, key: 'receiveArea', width: 20 },
      { header: `Following_proc`, key: 'followingProc', width: 20 },
      { header: `Vat`, key: 'vat', width: 20 },
      { header: `Privilege_Flag`, key: 'privilegeFlag', width: 20 },
      { header: `Reference_No_Tag`, key: 'referenceNoTag', width: 20 },
    ];

    const batchSize = 20;
    let offset = 0;
    while (true) {
      const { deliveryReports } = await this.listDeliveryReports({
        ...options,
        offset: `${offset}`,
        limit: `${batchSize}`,
      });
      if (deliveryReports.length === 0) break;
      deliveryReports.forEach((deliveryReport) => {
        worksheet
          .addRow({
            venderCode: deliveryReport.venderCode,
            plantCode: deliveryReport.plantCode,
            deliveryNo: deliveryReport.deliveryNo,
            deliveryDate: DateTime.fromISO(
              deliveryReport.deliveryDate.toISOString(),
            ).toFormat('d/M/yyyy'),
            partNo: deliveryReport.partNo,
            qty: deliveryReport.qty,
            receiveArea: deliveryReport.receiveArea,
            followingProc: deliveryReport.followingProc,
            vat: deliveryReport.vat,
            privilegeFlag: deliveryReport.privilegeFlag,
            referenceNoTag: deliveryReport.referenceNoTag,
          })
          .commit(); // important in streaming mode
      });
      offset += batchSize;
    }
    worksheet.commit(); // commit worksheet

    await workbook.commit();
  }

  public async exportReport(response: Response, options: ListReports) {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename=reports.xlsx',
    );
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response, // STREAM directly to response
      useStyles: true,
      useSharedStrings: true,
    });
    const worksheet = workbook.addWorksheet('Reports');
    worksheet.columns = [
      { header: 'Plant Code', key: 'plantCode', width: 20 },
      { header: 'Vendor Code', key: 'venderCode', width: 20 },
      { header: 'Del No', key: 'delNumber', width: 20 },
      { header: 'Del Date', key: 'delDate', width: 20 },
      { header: 'Del. Period', key: 'delPeriod', width: 20 },
      { header: `Del Slide Date`, key: 'delSlideDate', width: 20 },
      { header: `Del. Slide Period`, key: 'delSlidePeriod', width: 20 },
      { header: `Received Date`, key: 'receivedDate', width: 20 },
      { header: `Del. Ctl`, key: 'delCtl', width: 20 },
      { header: `Work Group`, key: 'workGroup', width: 20 },
      { header: `Po No`, key: 'poNo', width: 20 },
      { header: `Material No`, key: 'materialNo', width: 20 },
      { header: `Material Name`, key: 'materialName', width: 20 },
      { header: `PO Qty.`, key: 'poQty', width: 20 },
      { header: `Received Qty.`, key: 'receiveQty', width: 20 },
      { header: `Receive Area`, key: 'receiveArea', width: 20 },
      { header: `Following Proc`, key: 'followingProc', width: 20 },
      { header: `Privilege Flag`, key: 'privilegeFlag', width: 20 },
      { header: `Barcode Status`, key: 'barcodeStatus', width: 20 },
      { header: `Tag ID`, key: 'tagId', width: 20 },
      { header: `Organize Id`, key: 'organizeId', width: 20 },
      { header: `VAT Sale Flag`, key: 'vatSaleFlag', width: 20 },
      { header: `DATE SHIPPED`, key: 'invoiceDateShipped', width: 20 },
      { header: `INVOICE NO.(KSBP)`, key: 'invoiceInvoiceNo', width: 20 },
      {
        header: `CUSTOMER ORDER NUMBE`,
        key: 'invoiceCustomerOrderNumber',
        width: 20,
      },
      { header: `PRICE`, key: 'invoicePrice', width: 20 },
      { header: `SALES AMOUNT`, key: 'invoiceSalesAmount', width: 20 },
      { header: `Vendor_code`, key: 'deliveryVenderCode', width: 20 },
      { header: `Plant_code`, key: 'deliveryPlantCode', width: 20 },
      { header: `Delivery_No`, key: 'deliveryDeliveryNo', width: 20 },
      { header: `Delivery_Date`, key: 'deliveryDeliveryDate', width: 20 },
      { header: `Part_No`, key: 'deliveryPartNo', width: 20 },
      { header: `Q'ty`, key: 'deliveryQty', width: 20 },
      { header: `Receive_area`, key: 'deliveryReceiveArea', width: 20 },
      { header: `Following_proc`, key: 'deliveryFollowingProc', width: 20 },
      { header: `Vat`, key: 'deliveryVat', width: 20 },
      { header: `Privilege_Flag`, key: 'deliveryPrivilegeFlag', width: 20 },
      { header: `Reference_No_Tag`, key: 'deliveryReferenceNoTag', width: 20 },
    ];
    const batchSize = 20;
    let offset = 0;
    while (true) {
      const { reports } = await this.listReports({
        ...options,
        offset: `${offset}`,
        limit: `${batchSize}`,
      });
      if (reports.length === 0) break;
      reports.forEach((report) => {
        worksheet
          .addRow({
            plantCode: report.plantCode,
            venderCode: report.venderCode,
            delNumber: report.delNumber,
            delDate: DateTime.fromISO(report.delDate.toISOString()).toFormat(
              'd/M/yyyy',
            ),
            delPeriod: report.delPeriod,
            delSlideDate: report.delSlideDate,
            delSlidePeriod: report.delSlidePeriod,
            receivedDate: DateTime.fromISO(
              report.receivedDate.toISOString(),
            ).toFormat('d/M/yyyy'),
            delCtl: report.delCtl,
            workGroup: report.workGroup,
            poNo: report.poNo,
            materialNo: report.materialNo,
            materialName: report.materialName,
            poQty: report.poQty,
            receiveQty: report.receiveQty,
            receiveArea: report.receiveArea,
            followingProc: report.followingProc,
            privilegeFlag: report.privilegeFlag,
            barcodeStatus: report.barcodeStatus,
            tagId: report.tagId,
            organizeId: report.organizeId,
            vatSaleFlag: report.vatSaleFlag,
            invoiceDateShipped: report.invoiceDateShipped
              ? DateTime.fromFormat(
                report.invoiceDateShipped,
                'yyyyMMdd',
              ).toFormat('d/M/yyyy')
              : '',
            invoiceInvoiceNo: report.invoiceInvoiceNo,
            invoiceCustomerOrderNumber: report.invoiceCustomerOrderNumber,
            invoicePrice: report.invoicePrice,
            invoiceSalesAmount: report.invoiceSalesAmount,
            deliveryVenderCode: report.deliveryVenderCode,
            deliveryPlantCode: report.deliveryPlantCode,
            deliveryDeliveryNo: report.deliveryDeliveryNo,
            deliveryDeliveryDate: report.deliveryDeliveryDate
              ? DateTime.fromISO(
                report.deliveryDeliveryDate.toISOString(),
              ).toFormat('d/M/yyyy')
              : '',
            deliveryPartNo: report.deliveryPartNo,
            deliveryQty: report.deliveryQty,
            deliveryReceiveArea: report.deliveryReceiveArea,
            deliveryFollowingProc: report.deliveryFollowingProc,
            deliveryVat: report.deliveryVat,
            deliveryPrivilegeFlag: report.deliveryPrivilegeFlag,
            deliveryReferenceNoTag: report.deliveryReferenceNoTag,
          })
          .commit(); // important in streaming mode
      });
      offset += batchSize;
    }
    worksheet.commit(); // commit worksheet

    await workbook.commit();
  }

  public async listBilling(options: ListBilling) {
    const { startDate, endDate, status, plantCode } = options;
    const query = this.reportRepository
      .createQueryBuilder('report')
      .select([
        'DISTINCT(report.invoiceInvoiceNo)', // 1. original string field
        'CAST(report.invoiceInvoiceNo AS INTEGER) AS invoiceInvoiceNoNumber', // 2. also casted number field
      ])
      .where('report.invoiceInvoiceNo IS NOT NULL')
      .andWhere('report.deliveryDeliveryNo is NOT NULL')
      .andWhere('report.plantCode ILIKE :plantCode', { plantCode });
    if (startDate && endDate) {
      query.andWhere('report.delDate >= :start AND report.delDate < :end', {
        start: startDate,
        end: endDate,
      });
    }
    if (status && status !== 'ALL') {
      if (status === 'NEW') {
        query.andWhere('report.isExportedDIT = :status', {
          status: false,
        });
        query.andWhere('report.isExportedDITT = :status', {
          status: false,
        });
      }
      if (status === 'EXPORTED') {
        query.andWhere('report.isExportedDIT = :status', {
          status: true,
        });
        query.andWhere('report.isExportedDITT = :status', {
          status: true,
        });
      }
      if (status === 'EXPORTED_DIT') {
        query.andWhere('report.isExportedDIT = :status', {
          status: true,
        });
      }
      if (status === 'EXPORTED_DITT') {
        query.andWhere('report.isExportedDITT = :status', {
          status: true,
        });
      }
    }
    query.orderBy('invoiceInvoiceNoNumber', 'ASC');
    const data = await query.getRawMany();

    return data;
  }

  private async exportDITTFile(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    reports: Report[],
  ) {
    worksheet.columns = [
      { header: 'id_code', key: 'idCode', width: 20 },
      { header: 'vendor_code', key: 'venderCode', width: 20 },
      { header: 'plant_code', key: 'plantCode', width: 20 },
      { header: 'delivery_ctl_code', key: 'deliveryCtlNo', width: 20 },
      { header: 'delivery_no', key: 'deliveryNo', width: 20 },
      { header: 'delivery_date', key: 'deliveryDate', width: 20 },
      { header: 'delivery_period', key: 'deliveryPeriod', width: 20 },
      { header: 'part_no', key: 'partNo', width: 20 },
      { header: 'qty', key: 'qty', width: 20 },
      { header: 'po_no', key: 'poNo', width: 20 },
      { header: 'set_code', key: 'setCode', width: 20 },
      { header: 'receive_area', key: 'receiveArea', width: 20 },
      { header: 'following_proc', key: 'followingProc', width: 20 },
      { header: 'work_group', key: 'workGroup', width: 20 },
      { header: 'create_date', key: 'createDate', width: 20 },
      { header: 'create_time', key: 'createTime', width: 20 },
      { header: 'invoice_no', key: 'invoiceNo', width: 20 },
      { header: 'invoice_date', key: 'invoiceDate', width: 20 },
      { header: 'privilege_flag', key: 'privilegeFlag', width: 20 },
      { header: 'reference_no_tag', key: 'referenceNoTag', width: 20 },
      { header: 'branch_id', key: 'branchId', width: 20 },
    ];
    const sortedReports = sortBy(
      reports,
      (report) => +report.invoiceInvoiceNo,
      ['ASC'],
    );

    sortedReports.forEach((report) => {
      worksheet
        .addRow({
          idCode: 'VMIT50',
          venderCode: report.venderCode,
          plantCode: report.plantCode,
          deliveryCtlNo: '',
          deliveryNo: report.delNumber,
          deliveryDate: report.deliveryDeliveryDate
            ? DateTime.fromISO(
              report.deliveryDeliveryDate.toISOString(),
            ).toFormat('d/M/yyyy')
            : '',
          deliveryPeriod: '',
          partNo: report.materialNo,
          qty: report.poQty,
          poNO: '',
          setCode: '',
          receiveArea: report.receiveArea,
          followingProc: report.followingProc,
          workGroup: '',
          createDate: DateTime.now().toFormat('d/M/yyyy'),
          createTime: DateTime.now().toFormat('HH:mm'),
          invoiceNo: report.invoiceInvoiceNo,
          invoiceDate: DateTime.fromFormat(
            report.invoiceDateShipped,
            'yyyyMMdd',
          ).toFormat('d/M/yyyy'),
          privilegeFlag: report.privilegeFlag,
          referenceNoTag: 'N' + report.deliveryReferenceNoTag.slice(1),
          branchId: '0000',
        })
        .commit(); // important in streaming mode
    });

    worksheet
      .addRow({
        idCode: 'VMIT50',
        venderCode: 'T043',
        plantCode: reports?.[0]?.plantCode,
        deliveryCtlNo: '',
        deliveryNo: '9999999999',
        deliveryDate: '',
        deliveryPeriod: '',
        partNo: '',
        qty: reports.length,
        poNO: '',
        setCode: '',
        receiveArea: '',
        followingProc: '',
        workGroup: '',
        createDate: DateTime.now().toFormat('d/M/yyyy'),
        createTime: DateTime.now().toFormat('HH:mm'),
        invoiceNo: '',
        invoiceDate: '',
        privilegeFlag: '',
        referenceNoTag: '',
        branchId: '',
      })
      .commit();
    worksheet.commit(); // commit worksheet
    await workbook.commit();
  }

  private async exportDITFile(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    reports: Report[],
  ) {
    worksheet.columns = [
      { header: 'id_code', key: 'idCode', width: 20 },
      { header: 'vendor_code', key: 'venderCode', width: 20 },
      { header: 'plant_code', key: 'plantCode', width: 20 },
      { header: 'invoice_no', key: 'invoiceNo', width: 20 },
      { header: 'invoice_date', key: 'invoiceDate', width: 20 },
      { header: 'receive_date', key: 'receiveDate', width: 20 },
      { header: 'part_no', key: 'partNo', width: 20 },
      { header: 'qty', key: 'qty', width: 20 },
      { header: 'unit', key: 'unit', width: 20 },
      { header: 'unit_price', key: 'unitPrice', width: 20 },
      { header: 'amount', key: 'amount', width: 20 },
      { header: 'vat', key: 'vat', width: 20 },
      { header: 'create_date', key: 'createDate', width: 20 },
      { header: 'create_time', key: 'createTime', width: 20 },
      { header: 'privilege_flag', key: 'privilegeFlag', width: 20 },
      { header: 'branch_id', key: 'branchId', width: 20 },
    ];
    const groupReportByInvoiceInvoiceNo = groupBy(
      sortBy(reports, (report) => +report.invoiceInvoiceNo, ['ASC']),
      (report) => report.invoiceInvoiceNo,
    );
    values(groupReportByInvoiceInvoiceNo).forEach((reportGroup) => {
      reportGroup.forEach((report) => {
        worksheet
          .addRow({
            idCode: 'VMI050',
            venderCode: report.venderCode,
            plantCode: report.plantCode,
            invoiceNo: report.invoiceInvoiceNo,
            invoiceDate: DateTime.fromFormat(
              report.invoiceDateShipped,
              'yyyyMMdd',
            ).toFormat('d/M/yyyy'),
            receiveDate: DateTime.fromISO(
              report.receivedDate.toISOString(),
            ).toFormat('d/M/yyyy'),
            partNo: report.materialNo,
            qty: report.poQty,
            unit: '',
            unitPrice: report.invoicePrice,
            amount: report.invoiceSalesAmount,
            vat: '',
            createDate: DateTime.now().toFormat('d/M/yyyy'),
            createTime: DateTime.now().toFormat('HH:mm'),
            privilegeFlag: report.privilegeFlag,
            branchId: '0000',
          })
          .commit(); // important in streaming mode
      });
      worksheet
        .addRow({
          idCode: 'VMI050',
          venderCode: reportGroup[0].venderCode,
          plantCode: reportGroup[0].plantCode,
          invoiceNo: reportGroup[0].invoiceInvoiceNo,
          invoiceDate: DateTime.fromFormat(
            reportGroup[0].invoiceDateShipped,
            'yyyyMMdd',
          ).toFormat('d/M/yyyy'),
          receiveDate: DateTime.fromISO(
            reportGroup[0].receivedDate.toISOString(),
          ).toFormat('d/M/yyyy'),
          partNo: '9999999999999999',
          qty: reportGroup.length,
          unit: '',
          unitPrice: '',
          amount: sumBy(reportGroup, (report) => +report.invoiceSalesAmount),
          vat:
            reportGroup[0].vatSaleFlag === 'V'
              ? (
                sumBy(reportGroup, (report) => +report.invoiceSalesAmount) *
                0.07
              ).toFixed(4)
              : 0,
          createDate: DateTime.now().toFormat('d/M/yyyy'),
          createTime: DateTime.now().toFormat('HH:mm'),
          privilegeFlag: reportGroup[0].privilegeFlag,
          branchId: '0000',
        })
        .commit(); // important in streaming mode
    });
    worksheet.commit(); // commit worksheet
    await workbook.commit();
  }

  private async exportDITFileTXT(stream: PassThrough, reports: Report[]) {
    const groupReportByInvoiceInvoiceNo = groupBy(
      sortBy(reports, (report) => +report.invoiceInvoiceNo, ['ASC']),
      (report) => report.invoiceInvoiceNo,
    );
    values(groupReportByInvoiceInvoiceNo).forEach((reportGroup) => {
      reportGroup.forEach((report) => {
        stream.write(
          `VMIT50\t${report.venderCode}\t${report.plantCode}\t${report.invoiceInvoiceNo
          }\t${DateTime.fromFormat(
            report.invoiceDateShipped,
            'yyyyMMdd',
          ).toFormat('yyyy/MM/dd')}\t${DateTime.fromISO(
            report.receivedDate.toISOString(),
          ).toFormat('yyyy/MM/dd')}\t${report.materialNo}\t${report.poQty
          }\t${''}\t${report.invoicePrice}\t${report.invoiceSalesAmount
          }\t${''}\t${DateTime.now().toFormat(
            'yyyy/MM/dd',
          )}\t${DateTime.now().toFormat('HH:mm')}\t${report.privilegeFlag
          }\t0000\n`,
        );
      });
      stream.write(
        `VMI050\t${reportGroup[0].venderCode}\t${reportGroup[0].plantCode}\t${reportGroup[0].invoiceInvoiceNo
        }\t${DateTime.fromFormat(
          reportGroup[0].invoiceDateShipped,
          'yyyyMMdd',
        ).toFormat('yyyy/MM/dd')}\t${DateTime.fromISO(
          reportGroup[0].receivedDate.toISOString(),
        ).toFormat('yyyy/MM/dd')}\t9999999999999999\t${reportGroup.length
        }\t${''}\t${''}\t${sumBy(
          reportGroup,
          (report) => +report.invoiceSalesAmount,
        )}\t${reportGroup[0].vatSaleFlag === 'V'
          ? (
            sumBy(reportGroup, (report) => +report.invoiceSalesAmount) *
            0.07
          ).toFixed(4)
          : 0
        }\t${DateTime.now().toFormat('yyyy/MM/dd')}\t${DateTime.now().toFormat(
          'HH:mm',
        )}\t${reportGroup[0].privilegeFlag}\t${'0000'}\n`,
      );
    });
  }

  private async exportDITTFileTXT(stream: PassThrough, reports: Report[]) {
    const sortedReports = sortBy(
      reports,
      (report) => +report.invoiceInvoiceNo,
      ['ASC'],
    );

    sortedReports.forEach((report) => {
      stream.write(
        `VMIT050\t${report.venderCode}\t${report.plantCode}\t${''}\t${report.delNumber
        }\t${report.deliveryDeliveryDate
          ? DateTime.fromISO(
            report.deliveryDeliveryDate.toISOString(),
          ).toFormat('yyyy/MM/dd')
          : ''
        }\t${''}\t${report.materialNo}\t${report.poQty}\t${''}\t${''}\t${report.receiveArea
        }\t${report.followingProc}\t${''}\t${DateTime.now().toFormat(
          'yyyy/MM/dd',
        )}\t${DateTime.now().toFormat('HH:mm')}\t${report.invoiceInvoiceNo
        }\t${DateTime.fromFormat(
          report.invoiceDateShipped,
          'yyyyMMdd',
        ).toFormat('yyyy/MM/dd')}\t${report.privilegeFlag}\t${'N' + report.deliveryReferenceNoTag.slice(1)
        }\t${'0000'}\n`,
      );
    });
    stream.write(
      `VMIT50\t${'T043'}\t${sortedReports[0].plantCode}\t${''}\t9999999999\t${''}\t${''}\t${''}\t${reports.length
      }\t${''}\t${''}\t${''}\t${''}\t${''}\t${DateTime.now().toFormat(
        'yyyy/MM/dd',
      )}\t${DateTime.now().toFormat(
        'HH:mm',
      )}\t${''}\t${''}\t${''}\t${''}\t${''}\n`,
    );
  }

  public async exportBilling(
    response: Response,
    billings: string[],
    billingType: string,
  ) {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename=billings.xlsx',
    );
    const reports = await this.reportRepository
      .createQueryBuilder('report')
      .where('report.invoiceInvoiceNo IS NOT NULL')
      .andWhere('report.deliveryDeliveryNo is NOT NULL')
      .andWhere('report.invoiceInvoiceNo IN(:...billings)', {
        billings: billings,
      })
      .getMany();
    if (!reports?.length) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          detail: 'Not found any billing',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response, // STREAM directly to response
      useStyles: true,
      useSharedStrings: true,
    });
    const worksheet = workbook.addWorksheet('Billing');
    if (billingType === 'DIT') {
      await this.exportDITFile(worksheet, workbook, reports);
      this.updateAlreadyExportedDIT(reports.map((report) => report.id));
    } else {
      await this.exportDITTFile(worksheet, workbook, reports);
      this.updateAlreadyExportedDITT(reports.map((report) => report.id));
    }
  }
  public async exportBillingTXT(
    response: Response,
    billings: string[],
    billingType: string,
  ) {
    response.setHeader('Content-Disposition', 'attachment; filename=data.txt');
    response.setHeader('Content-Type', 'text/plain');

    const stream = new PassThrough(); // This is a writable stream

    // Start streaming to response
    stream.pipe(response);
    const reports = await this.reportRepository
      .createQueryBuilder('report')
      .where('report.invoiceInvoiceNo IS NOT NULL')
      .andWhere('report.deliveryDeliveryNo is NOT NULL')
      .andWhere('report.invoiceInvoiceNo IN(:...billings)', {
        billings: billings,
      })
      .getMany();
    if (!reports?.length) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          detail: 'Not found any billing',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (billingType === 'DIT') {
      this.exportDITFileTXT(stream, reports);
      this.updateAlreadyExportedDIT(reports.map((report) => report.id));
    } else {
      this.exportDITTFileTXT(stream, reports);
      this.updateAlreadyExportedDITT(reports.map((report) => report.id));
    }
    stream.end();
  }

  private async updateAlreadyExportedDIT(reportIds: string[]) {
    await this.reportRepository
      .createQueryBuilder()
      .update(Report)
      .set({ isExportedDIT: true })
      .where('id IN (:...reportIds)', { reportIds })
      .execute();
  }

  private async updateAlreadyExportedDITT(reportIds: string[]) {
    await this.reportRepository
      .createQueryBuilder()
      .update(Report)
      .set({ isExportedDITT: true })
      .where('id IN (:...reportIds)', { reportIds })
      .execute();
  }
}
