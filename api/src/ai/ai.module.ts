import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SolanaModule } from '../solana/solana.module';
import { ChatModule } from 'src/chat/chat.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [SolanaModule, ChatModule, UserModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
