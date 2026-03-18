import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /api/payments/webhook
   * Receives Stripe webhook events.
   * NOTE: In production, validate the stripe-signature header here before calling the service.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  async handleWebhook(@Body() payload: { type: string; data: Record<string, any> }) {
    // TODO: verify Stripe-Signature header with stripe.webhooks.constructEvent(rawBody, sig, secret)
    await this.paymentsService.handleStripeWebhook(payload);
    return { received: true };
  }
}
