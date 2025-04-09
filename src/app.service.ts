import { Injectable } from '@nestjs/common';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
} from './schema/zod';
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
        try {
          await this.reportRepository.save(chunk);
        } catch (err) {
          console.log('createReports err', err);
        }
      }
    }
  }

  public async createDeliveryReport(payload: CreateDeliveryReport) {
    const deliveryReports = payload.deliveryReports;
    let createDeliveryReport: Partial<Delivery>[] = [];
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
        try {
          await this.deliveryRepository.save(chunk);
        } catch (err) {
          console.log('createReports err', err);
        }
      }
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

  public async listReports() {
    const reports = await this.reportRepository.find({
      order: {
        updatedAt: 'DESC',
      },
    });
    return reports;
  }

  public async listDeliveryReports() {
    const deliveryReports = await this.deliveryRepository.find({
      order: {
        updatedAt: 'DESC',
      },
    });
    return deliveryReports;
  }
}
