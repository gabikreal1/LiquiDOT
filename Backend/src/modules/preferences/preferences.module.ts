import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { PreferencesService } from './preferences.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPreference])],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [TypeOrmModule, PreferencesService],
})
export class PreferencesModule {}
