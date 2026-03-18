import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'second-bloom-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
