import { Controller, Post, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user-data.dto';

class ConfirmDto {
  email: string;
  code: string;
}

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Step 1: Register a new user (pending confirmation)
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // Step 2: Confirm OTP and finalize registration
  @Post('confirm')
  async confirm(@Body() confirmDto: ConfirmDto) {
    const { email, code } = confirmDto;
    return this.userService.confirmCode(email, code);
  }
}
