import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
  ListDeliveryReport,
  ListReports,
} from './schema/zod';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/report')
  async createReport(@Body() body: CreateReport) {
    await this.appService.createReports(body);
    return { status: 'Create report success' };
  }

  @Post('/invoice')
  async uploadInvoice(@Body() body: CreateInvoiceReport) {
    await this.appService.mergeInvoiceWithReport(body);
    return { status: 'Create report success' };
  }

  @Post('/delivery-report')
  async createDeliveryReport(@Body() body: CreateDeliveryReport) {
    await this.appService.createDeliveryReport(body);
    return { status: 'Create report success' };
  }

  @Post('/merge-delivery-report')
  async mergeReportWithDeliveryReport() {
    await this.appService.mergeReportWithDeliveryReport();
    return { status: 'Merge data success' };
  }

  @Get('/reports')
  async listReports(@Query() query: ListReports) {
    const result = await this.appService.listReports(query);
    return {
      reports: result.reports,
      count: result.count,
    };
  }

  @Get('/reports/export')
  async exportReports(@Res() res: Response, @Query() query: ListReports) {
    return this.appService.exportReport(res, query);
  }

  @Get('/deliveries')
  async listDeliveries(@Query() query: ListDeliveryReport) {
    const result = await this.appService.listDeliveryReports(query);
    return { deliveryReports: result.deliveryReports, count: result.count };
  }

  @Get('/deliveries/export')
  async exportEquipments(
    @Res() res: Response,
    @Query() query: ListDeliveryReport,
  ) {
    return this.appService.exportDeliveryReport(res, query); // stream to client
  }
}
