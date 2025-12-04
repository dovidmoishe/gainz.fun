import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SolanaModule } from '../solana/solana.module';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [SolanaModule, ChatModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
