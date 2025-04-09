import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
} from './schema/zod';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

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
  async listReports() {
    const reports = await this.appService.listReports();
    return { reports };
  }

  @Get('/deliveries')
  async listDeliveries() {
    const deliveryReports = await this.appService.listDeliveryReports();
    return { deliveryReports };
  }
}
