import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
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
    return 'Hello World!';
  }
  public async createReports(payload: CreateReport) {
    const reports = payload.reports;
    let createReport: Partial<Report>[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const report of reports) {
        createReport = [
          ...createReport,
          {
            plantCode: report.plantCode,
            venderCode: report.venderCode,
            delNumber: report.delNumber,
            delDate: report.delDate,
            delPeriod: report.delPeriod,
            delSlideDate: report.delSlideDate || null,
            delSlidePeriod: report.delSlidePeriod,
            receivedDate: report.receivedDate,
            delCtl: report.delCtl,
            workGroup: report.workGroup,
            poNo: report.poNo,
            materialName: report.materialName,
            materialNo: report.materialNo,
            poQty: report.poQty,
            receiveQty: report.receiveQty,
            receiveArea: report.receiveArea,
            followingProc: report.followingProc,
            privilegeFlag: report.privilegeFlag,
            barcodeStatus: report.barcodeStatus,
            tagId: report.tagId,
            organizeId: report.organizeId,
            vatSaleFlag: report.vatSaleFlag,
          },
        ];
      }
      if (createReport?.length) {
        const chunks = chunk(createReport, 200);
        for (const chunk of chunks) {
          await this.reportRepository.save(chunk);
        }
      }
      await queryRunner.commitTransaction();
    } catch (err) {
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

  public async createDeliveryReport(payload: CreateDeliveryReport) {
    const deliveryReports = payload.deliveryReports;
    let createDeliveryReport: Partial<Delivery>[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const deliveryReport of deliveryReports) {
        createDeliveryReport = [
          ...createDeliveryReport,
          {
            venderCode: deliveryReport.venderCode,
            plantCode: deliveryReport.plantCode as DeliveryPlantCodeType,
            deliveryNo: deliveryReport.deliveryNo,
            deliveryDate: deliveryReport.deliveryDate,
            partNo: deliveryReport.partNo,
            qty: deliveryReport.qty,
            receiveArea: deliveryReport.receiveArea,
            followingProc: deliveryReport.followingProc,
            vat: deliveryReport.vat,
            privilegeFlag: deliveryReport.privilegeFlag,
            referenceNoTag: deliveryReport.referenceNoTag,
          },
        ];
      }
      if (createDeliveryReport?.length) {
        const chunks = chunk(createDeliveryReport, 200);
        for (const chunk of chunks) {
          await this.deliveryRepository.save(chunk);
        }
      }
      await queryRunner.commitTransaction();
    } catch (err) {
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
    const count = await query.getCount();
    query.addOrderBy('report.updatedAt', 'DESC');
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
            ).toFormat('dd/MM/yyyy'),
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
              'dd/MM/yyyy',
            ),
            delPeriod: report.delPeriod,
            delSlideDate: report.delSlideDate,
            delSlidePeriod: report.delSlidePeriod,
            receivedDate: DateTime.fromISO(
              report.receivedDate.toISOString(),
            ).toFormat('dd/MM/yyyy'),
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
            invoiceDateShipped: report.invoiceDateShipped,
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
              ).toFormat('dd/MM/yyyy')
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
}
