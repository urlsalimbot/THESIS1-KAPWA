import { Module } from '@nestjs/common';
@Module({ providers: [{ provide: 'IrfService', useValue: {} }] })
export class IrfModule {}