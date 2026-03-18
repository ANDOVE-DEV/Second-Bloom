import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './entities/profile.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
		@InjectRepository(Profile)
		private readonly profilesRepository: Repository<Profile>,
	) {}

	findById(id: string) {
		return this.usersRepository.findOne({ where: { id } });
	}

	findByEmail(email: string) {
		return this.usersRepository.findOne({ where: { email } });
	}

	findProfileByUserId(userId: string) {
		return this.profilesRepository.findOne({ where: { userId } });
	}

	async getMe(userId: string) {
		const user = await this.usersRepository.findOne({ where: { id: userId } });

		if (!user) {
			throw new NotFoundException('User not found');
		}

		const profile = await this.profilesRepository.findOne({
			where: { userId: user.id },
		});

		return {
			id: user.id,
			email: user.email,
			isActive: user.isActive,
			isVerified: user.isVerified,
			profile,
			createdAt: user.createdAt,
		};
	}

	async updateMe(userId: string, dto: UpdateProfileDto) {
		const profile = await this.profilesRepository.findOne({ where: { userId } });

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		if (dto.displayName !== undefined) {
			profile.displayName = dto.displayName;
		}

		if (dto.birthDate !== undefined) {
			profile.birthDate = dto.birthDate;
		}

		if (dto.gender !== undefined) {
			profile.gender = dto.gender;
		}

		if (dto.seeking !== undefined) {
			profile.seeking = dto.seeking;
		}

		if (dto.bio !== undefined) {
			profile.bio = dto.bio;
		}

		if (dto.city !== undefined) {
			profile.city = dto.city;
		}

		if (dto.latitude !== undefined) {
			profile.latitude = dto.latitude.toString();
		}

		if (dto.longitude !== undefined) {
			profile.longitude = dto.longitude.toString();
		}

		if (dto.interests !== undefined) {
			profile.interests = dto.interests;
		}

		if (dto.intent !== undefined) {
			profile.intent = dto.intent;
		}

		if (dto.smokes !== undefined) {
			profile.smokes = dto.smokes;
		}

		if (dto.hasCohabitingKids !== undefined) {
			profile.hasCohabitingKids = dto.hasCohabitingKids;
		}

		if (dto.politicalLean !== undefined) {
			profile.politicalLean = dto.politicalLean;
		}

		if (dto.religion !== undefined) {
			profile.religion = dto.religion;
		}

		const updated = await this.profilesRepository.save(profile);

		return {
			success: true,
			profile: updated,
		};
	}
}
