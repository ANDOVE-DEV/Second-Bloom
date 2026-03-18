import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Profile } from '../users/entities/profile.entity';
import { AffinityService } from './affinity.service';
import { MatchingCacheService } from './matching-cache.service';
import { SwipeDto } from './dto/swipe.dto';
import { Match } from './entities/match.entity';
import { Swipe } from './entities/swipe.entity';

@Injectable()
export class MatchingService {
	constructor(
		@InjectRepository(Swipe)
		private readonly swipeRepository: Repository<Swipe>,
		@InjectRepository(Match)
		private readonly matchRepository: Repository<Match>,
		@InjectRepository(Profile)
		private readonly profileRepository: Repository<Profile>,
		private readonly usersService: UsersService,
		private readonly affinityService: AffinityService,
		private readonly cacheService: MatchingCacheService,
	) {}

	async discover(userId: string) {
		const me = await this.usersService.findById(userId);
		const myProfile = await this.usersService.findProfileByUserId(userId);

		if (!me || !myProfile) {
			throw new NotFoundException('User not found');
		}

		let candidateProfile = await this.popCandidateFromQueue(userId);

		if (!candidateProfile) {
			await this.rebuildQueue(userId, myProfile);
			candidateProfile = await this.popCandidateFromQueue(userId);
		}

		if (!candidateProfile) {
			return { candidate: null };
		}

		await this.cacheService.markSeen(userId, candidateProfile.userId);

		return {
			candidate: {
				userId: candidateProfile.userId,
				displayName: candidateProfile.displayName,
				bio: candidateProfile.bio,
				city: candidateProfile.city,
				avatarUrl: candidateProfile.avatarUrl,
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

		const actorProfile = await this.usersService.findProfileByUserId(userId);

		if (!actorProfile) {
			throw new NotFoundException('Profile not found');
		}

		let swipe = await this.swipeRepository.findOne({
			where: { actorId: userId, targetId: dto.targetId },
		});

		const previousAction = swipe?.action;

		if (actorProfile.subscriptionTier !== 'gold') {
			if (dto.action === 'yes' && previousAction !== 'yes') {
				const count = await this.cacheService.incrementDailyYes(userId);

				if (count > 5) {
					await this.cacheService.decrementDailyYes(userId);
					throw new HttpException(
						'Free plan allows up to 5 "yes" actions per day',
						HttpStatus.TOO_MANY_REQUESTS,
					);
				}
			}

			if (dto.action !== 'yes' && previousAction === 'yes') {
				await this.cacheService.decrementDailyYes(userId);
			}
		}

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
		await this.cacheService.setUndo(userId, savedSwipe.id);
		await this.cacheService.markSeen(userId, dto.targetId);
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
		const swipeId = await this.cacheService.getUndo(userId);

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
			await this.cacheService.clearUndo(userId);
			return {
				success: false,
				message: 'No swipe to undo',
			};
		}

		await this.swipeRepository.delete({ id: swipe.id });
		await this.cacheService.clearUndo(userId);

		const actorProfile = await this.usersService.findProfileByUserId(userId);
		if (actorProfile?.subscriptionTier !== 'gold' && swipe.action === 'yes') {
			await this.cacheService.decrementDailyYes(userId);
		}

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

	private async popCandidateFromQueue(userId: string): Promise<Profile | null> {
		while (true) {
			const candidateUserId = await this.cacheService.popTopQueue(userId);

			if (!candidateUserId) {
				return null;
			}

			const alreadySeen = await this.cacheService.isSeen(userId, candidateUserId);
			if (alreadySeen) {
				continue;
			}

			const profile = await this.profileRepository.findOne({
				where: { userId: candidateUserId },
			});

			if (profile) {
				return profile;
			}
		}
	}

	private async rebuildQueue(userId: string, myProfile: Profile): Promise<void> {
		const swiped = await this.swipeRepository.find({
			where: { actorId: userId },
			select: ['targetId'],
		});

		const excluded = new Set(swiped.map((item) => item.targetId));

		const candidates = await this.profileRepository
			.createQueryBuilder('p')
			.where('p.user_id != :userId', { userId })
			.limit(200)
			.getMany();

		const ranked = candidates
			.filter((candidate) => !excluded.has(candidate.userId))
			.map((candidate) => ({
				userId: candidate.userId,
				score: this.affinityService.calculateScore(myProfile, candidate),
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, 50);

		await this.cacheService.setQueue(userId, ranked);
	}
}
