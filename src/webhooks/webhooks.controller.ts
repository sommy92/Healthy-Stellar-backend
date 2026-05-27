import { Controller, Post, Body, HttpCode, Inject, Logger } from '@nestjs/common';
import { IpfsService } from '../stellar/services/ipfs.service';
import { QueueService } from '../queues/queue.service';
import { ConfigService } from '@nestjs/config';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly ipfsService: IpfsService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  @Post('ipfs')
  @HttpCode(200)
  async handleIpfsWebhook(@Body() payload: any) {
    this.logger.log(`Received IPFS webhook: ${JSON.stringify(payload)}`);
    
    // Handle IPFS pinning service webhook
    // Extract CID from payload and dispatch for processing
    const cid = payload?.cid || payload?.ipfs_hash || payload?.hash;
    if (!cid) {
      this.logger.warn('IPFS webhook received without CID');
      return { received: false, error: 'Missing CID in payload' };
    }
    
    try {
      // Dispatch IPFS upload job for processing
      await this.queueService.dispatchIpfsUpload({
        cid,
        payload,
        correlationId: `ipfs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      this.logger.log(`IPFS webhook processed successfully for CID: ${cid}`);
      return { received: true, cid, status: 'queued_for_processing' };
    } catch (error) {
      this.logger.error(`Failed to process IPFS webhook for CID ${cid}: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }
  }

  @Post('stellar')
  @HttpCode(200)
  async handleStellarWebhook(@Body() payload: any) {
    this.logger.log(`Received Stellar webhook: ${JSON.stringify(payload)}`);
    
    // Handle Stellar payment processor webhook
    // Extract transaction details and dispatch for reconciliation
    const txHash = payload?.transaction_hash || payload?.tx_hash || payload?.hash;
    const ledger = payload?.ledger || payload?.ledger_sequence;
    const operationType = payload?.operation_type || 'payment';
    
    if (!txHash) {
      this.logger.warn('Stellar webhook received without transaction hash');
      return { received: false, error: 'Missing transaction hash in payload' };
    }
    
    try {
      // Dispatch Stellar transaction job for processing
      await this.queueService.dispatchStellarTransaction({
        operationType,
        params: {
          txHash,
          ledger,
          payload,
        },
        initiatedBy: 'webhook',
        correlationId: `stellar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      this.logger.log(`Stellar webhook processed successfully for transaction: ${txHash}`);
      return { received: true, txHash, status: 'queued_for_reconciliation' };
    } catch (error) {
      this.logger.error(`Failed to process Stellar webhook for transaction ${txHash}: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }
  }
}
