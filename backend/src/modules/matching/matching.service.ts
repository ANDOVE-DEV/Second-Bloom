import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Profile } from '../users/entities/profile.entity';
import { SwipeDto } from './dto/swipe.dto';
import { Match } from './entities/match.entity';
import { Swipe } from './entities/swipe.entity';

@Injectable()
export class MatchingService {
	private readonly lastSwipeMap = new Map<string, string>();

	constructor(
		@InjectRepository(Swipe)
		private readonly swipeRepository: Repository<Swipe>,
		@InjectRepository(Match)
		private readonly matchRepository: Repository<Match>,
		@InjectRepository(Profile)
		private readonly profileRepository: Repository<Profile>,
		private readonly usersService: UsersService,
	) {}

	async discover(userId: string) {
		const me = await this.usersService.findById(userId);

		if (!me) {
			throw new NotFoundException('User not found');
		}

		const swiped = await this.swipeRepository.find({
			where: { actorId: userId },
			select: ['targetId'],
		});

		const excludedIds = swiped.map((item) => item.targetId);

		const query = this.profileRepository
			.createQueryBuilder('p')
			.where('p.user_id != :userId', { userId });

		if (excludedIds.length > 0) {
			query.andWhere('p.user_id NOT IN (:...excluded)', { excluded: excludedIds });
		}

		const candidate = await query
			.orderBy('p.updated_at', 'DESC')
			.limit(1)
			.getRawOne<{
				user_id: string;
				display_name: string;
				bio: string | null;
				city: string | null;
				avatar_url: string | null;
			}>();

		if (!candidate) {
			return { candidate: null };
		}

		return {
			candidate: {
				userId: candidate.user_id,
				displayName: candidate.display_name,
				bio: candidate.bio,
				city: candidate.city,
				avatarUrl: candidate.avatar_url,
			},
		};
	}

	async swipe(userId: string, dto: SwipeDto) {
		if (userId === dto.targetId) {
			throw new BadRequestException('Cannot swipe yourself');
		}

		const target = await this.usersService.findById(dto.targetId);

		if (!target || !target.isActive) {
			throw new NotFoundException('Target user not found');
		}

		let swipe = await this.swipeRepository.findOne({
			where: { actorId: userId, targetId: dto.targetId },
		});

		if (!swipe) {
			swipe = this.swipeRepository.create({
				actorId: userId,
				targetId: dto.targetId,
				action: dto.action,
			});
		} else {
			swipe.action = dto.action;
		}

		const savedSwipe = await this.swipeRepository.save(swipe);
		this.lastSwipeMap.set(userId, savedSwipe.id);

		let createdMatch: Match | null = null;

		if (dto.action === 'yes') {
			const reciprocal = await this.swipeRepository.findOne({
				where: {
					actorId: dto.targetId,
					targetId: userId,
					action: 'yes',
				},
			});

			if (reciprocal) {
				const [userAId, userBId] = [userId, dto.targetId].sort();
				let match = await this.matchRepository.findOne({
					where: {
						userAId,
						userBId,
					},
				});

				if (!match) {
					match = this.matchRepository.create({
						userAId,
						userBId,
						isActive: true,
					});
					match = await this.matchRepository.save(match);
				}

				createdMatch = match;
			}
		}

		return {
			success: true,
			swipeId: savedSwipe.id,
			match: createdMatch
				? {
						id: createdMatch.id,
						userAId: createdMatch.userAId,
						userBId: createdMatch.userBId,
						matchedAt: createdMatch.matchedAt,
					}
				: null,
		};
	}

	async undo(userId: string) {
		const swipeId = this.lastSwipeMap.get(userId);

		if (!swipeId) {
			return {
				success: false,
				message: 'No swipe to undo',
			};
		}

		const swipe = await this.swipeRepository.findOne({
			where: {
				id: swipeId,
				actorId: userId,
			},
		});

		if (!swipe) {
			this.lastSwipeMap.delete(userId);
			return {
				success: false,
				message: 'No swipe to undo',
			};
		}

		await this.swipeRepository.delete({ id: swipe.id });
		this.lastSwipeMap.delete(userId);

		return {
			success: true,
			undoneSwipeId: swipe.id,
		};
	}

	async listMatches(userId: string) {
		const matches = await this.matchRepository.find({
			where: [{ userAId: userId, isActive: true }, { userBId: userId, isActive: true }],
			order: { matchedAt: 'DESC' },
		});

		return {
			items: matches,
		};
	}
}
