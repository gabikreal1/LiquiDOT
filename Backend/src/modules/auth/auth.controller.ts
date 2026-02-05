import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

class LoginDto {
    address: string;
    message: string;
    signature: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @ApiOperation({ summary: 'Login with Ethereum wallet (EVM)' })
    @Post('login/evm')
    async loginEvm(@Body() body: LoginDto) {
        const user = await this.authService.validateEvm(body.address, body.message, body.signature);
        return this.authService.login(user);
    }

    @ApiOperation({ summary: 'Login with Polkadot/Substrate wallet' })
    @Post('login/substrate')
    async loginSubstrate(@Body() body: LoginDto) {
        const user = await this.authService.validateSubstrate(body.address, body.message, body.signature);
        return this.authService.login(user);
    }
}
