import {
	ConflictException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Profile } from '../users/entities/profile.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
		@InjectRepository(Profile)
		private readonly profilesRepository: Repository<Profile>,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	async register(dto: RegisterDto) {
		const email = dto.email.toLowerCase().trim();
		const existing = await this.usersRepository.findOne({ where: { email } });

		if (existing) {
			throw new ConflictException('Email already registered');
		}

		const passwordHash = await hash(dto.password, 12);

		const user = this.usersRepository.create({
			email,
			passwordHash,
			isActive: true,
			isVerified: false,
			refreshTokenHash: null,
		});

		const savedUser = await this.usersRepository.save(user);

		const profile = this.profilesRepository.create({
			userId: savedUser.id,
			displayName: dto.displayName,
			birthDate: null,
			gender: 'other',
			seeking: 'any',
			bio: null,
			city: null,
			latitude: null,
			longitude: null,
			interests: [],
			intent: null,
			smokes: null,
			hasCohabitingKids: null,
			politicalLean: null,
			religion: null,
			subscriptionTier: 'free',
			avatarUrl: null,
		});

		await this.profilesRepository.save(profile);

		return this.issueTokens(savedUser.id, savedUser.email);
	}

	async login(dto: LoginDto) {
		const email = dto.email.toLowerCase().trim();
		const user = await this.usersRepository.findOne({ where: { email } });

		if (!user || !user.isActive) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const isValid = await compare(dto.password, user.passwordHash);

		if (!isValid) {
			throw new UnauthorizedException('Invalid credentials');
		}

		return this.issueTokens(user.id, user.email);
	}

	async refresh(refreshToken: string) {
		const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

		if (!refreshSecret) {
			throw new UnauthorizedException('Refresh secret missing');
		}

		let payload: JwtPayload;

		try {
			payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
				secret: refreshSecret,
			});
		} catch {
			throw new UnauthorizedException('Invalid refresh token');
		}

		const user = await this.usersRepository.findOne({ where: { id: payload.sub } });

		if (!user || !user.refreshTokenHash) {
			throw new UnauthorizedException('Invalid refresh token');
		}

		const refreshMatches = await compare(refreshToken, user.refreshTokenHash);

		if (!refreshMatches) {
			throw new UnauthorizedException('Invalid refresh token');
		}

		return this.issueTokens(user.id, user.email);
	}

	async logout(userId: string) {
		await this.usersRepository.update({ id: userId }, { refreshTokenHash: null });
	}

	private async issueTokens(userId: string, email: string) {
		const payload: JwtPayload = {
			sub: userId,
			email,
		};

		const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
		const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

		if (!accessSecret || !refreshSecret) {
			throw new UnauthorizedException('JWT secrets are not configured');
		}

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: accessSecret,
				expiresIn: 15 * 60,
			}),
			this.jwtService.signAsync(payload, {
				secret: refreshSecret,
				expiresIn: 30 * 24 * 60 * 60,
			}),
		]);

		const refreshTokenHash = await hash(refreshToken, 12);

		await this.usersRepository.update({ id: userId }, { refreshTokenHash });

		return {
			accessToken,
			refreshToken,
			tokenType: 'Bearer',
		};
	}
}
