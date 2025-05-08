import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import {
  CreateDeliveryReport,
  CreateInvoiceReport,
  CreateReport,
  ExportBilling,
  ListBilling,
  ListDeliveryReport,
  ListReports,
} from './schema/zod';
import { JwtAuthGuard } from './module/auth/jwt-auth.guard';
import { User } from './decorator/user.decorator';
import { UserPayload } from './types/user-payload.interface';
import { AdminGuard } from './module/auth/admin.guard';

@UseGuards(JwtAuthGuard)
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

  @Get('/billing')
  async listBilling(@Query() query: ListBilling) {
    const data = await this.appService.listBilling(query);
    return { billings: data };
  }

  @Get('/deliveries/export')
  async exportEquipments(
    @Res() res: Response,
    @Query() query: ListDeliveryReport,
  ) {
    return this.appService.exportDeliveryReport(res, query); // stream to client
  }

  @Post('/billing/text/export')
  async exportBillingsText(@Res() res: Response, @Body() body: ExportBilling) {
    return this.appService.exportBillingTXT(res, body.billings, body.type); // stream to client
  }

  @Post('/billing/export')
  async exportBillings(@Res() res: Response, @Body() body: ExportBilling) {
    return this.appService.exportBilling(res, body.billings, body.type); // stream to client
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(AdminGuard)
  @Get('/test')
  test(@User() user: UserPayload) {
    return { status: 'test' };
  }
}
