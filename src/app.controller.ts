import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): object {
    return {
      name: "hassan",
      email: "hassanalihassan1203@gmail.com",
      phone: "01553880080"
  };;
  }
}
