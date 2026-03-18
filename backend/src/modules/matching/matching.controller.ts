import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SwipeDto } from './dto/swipe.dto';
import { MatchingService } from './matching.service';

@Controller('matching')
@UseGuards(JwtAuthGuard)
export class MatchingController {
	constructor(private readonly matchingService: MatchingService) {}

	@Get('discover')
	discover(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.matchingService.discover(user.id);
	}

	@Post('swipe')
	@HttpCode(HttpStatus.OK)
	swipe(@CurrentUser() user: { id?: string }, @Body() dto: SwipeDto) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.matchingService.swipe(user.id, dto);
	}

	@Post('undo')
	@HttpCode(HttpStatus.OK)
	undo(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.matchingService.undo(user.id);
	}

	@Get('matches')
	matches(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.matchingService.listMatches(user.id);
	}
}
