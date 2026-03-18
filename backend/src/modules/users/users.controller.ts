import { Body, Controller, Get, Patch, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('me')
	getMe(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.usersService.getMe(user.id);
	}

	@Patch('me')
	updateMe(@CurrentUser() user: { id?: string }, @Body() dto: UpdateProfileDto) {
		if (!user.id) {
			throw new UnauthorizedException();
		}

		return this.usersService.updateMe(user.id, dto);
	}
}
