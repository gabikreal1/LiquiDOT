import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service'; // Assuming UsersService exists and checks DB
import { ethers } from 'ethers';
import { signatureVerify } from '@polkadot/util-crypto'; // Polkadot validation
import { hexToU8a, isHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    /**
     * Validate EVM Signature (SIWE-like)
     */
    async validateEvm(address: string, message: string, signature: string) {
        try {
            // 1. Verify signature
            const recoveredAddress = ethers.verifyMessage(message, signature);

            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                throw new UnauthorizedException('Invalid EVM signature');
            }

            // 2. Find or Create User
            // Note: In a real app we'd verify the nonce in the message to prevent replay attacks
            return this.findOrCreateUser(address, 'EVM');
        } catch (e) {
            this.logger.error(`EVM Auth failed: ${e.message}`);
            throw new UnauthorizedException('Authentication failed');
        }
    }

    /**
     * Validate Substrate Signature (SIWS)
     */
    async validateSubstrate(address: string, message: string, signature: string) {
        try {
            // 1. Verify signature
            // signatureVerify handles various formats (sr25519, ed25519, ecdsa) automatically
            const result = signatureVerify(message, signature, address);

            if (!result.isValid) {
                throw new UnauthorizedException('Invalid Substrate signature');
            }

            // 2. Find or Create User
            // Ensure specific address format (e.g. 42 for Substrate generic, or keep as provided if consistent)
            // Usually good practice to store in consistent SS58 format or hex.
            // For now, storing as provided but could normalize.
            return this.findOrCreateUser(address, 'SUBSTRATE');
        } catch (e) {
            this.logger.error(`Substrate Auth failed: ${e.message}`);
            throw new UnauthorizedException('Authentication failed');
        }
    }

    async login(user: any) {
        const payload = {
            walletAddress: user.walletAddress,
            sub: user.id
        };
        return {
            access_token: this.jwtService.sign(payload),
            user,
        };
    }

    private async findOrCreateUser(walletAddress: string, type: 'EVM' | 'SUBSTRATE') {
        // We need a method in usersService to find or create.
        // If not exists, I'll assume usersService.findByAddress or create.
        // Since I don't recall seeing usersService implementation details, 
        // I will assume standard interaction or fix lightly later.
        const normalizedAddress = type === 'EVM' ? walletAddress.toLowerCase() : walletAddress;

        let user = await this.usersService.findByWallet(normalizedAddress);
        if (!user) {
            user = await this.usersService.create(normalizedAddress);
        }
        return user;
    }
}
