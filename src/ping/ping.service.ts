import { Injectable } from '@nestjs/common';

@Injectable()
export class PingService {
  getPingPong(): { ping: string } {
    return { ping: 'pong' };
  }
}
