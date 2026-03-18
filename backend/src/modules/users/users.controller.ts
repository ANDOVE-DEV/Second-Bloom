import { Body, Controller, Delete, Get, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
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

	@Delete('me')
	deleteMe(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}
		return this.usersService.softDeleteUser(user.id);
	}

	@Get('me/export')
	exportMe(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}
		return this.usersService.exportUserData(user.id);
	}

	@Post('me/avatar')
	uploadAvatar(@CurrentUser() user: { id?: string }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}
		// S3 upload to be implemented, mock for now
		return this.usersService.updateAvatar(user.id, 'https://example.com/avatar.jpg');
	}

	@Patch('me/visibility')
	updateVisibility(@CurrentUser() user: { id?: string }, @Body() dto: { isInvisible: boolean }) {
		if (!user.id) {
			throw new UnauthorizedException();
		}
		return this.usersService.updateVisibility(user.id, dto.isInvisible);
	}
}
