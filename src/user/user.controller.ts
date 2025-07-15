import { Controller, Post, Body, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user-data.dto';
import { Response } from 'express';

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

  // Step 3: Login
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.userService.login(body.email, body.password);

      // Set secure cookie
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true in production
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      return res.redirect('/dashboard');
    } catch (err) {
      return res.status(401).render('login', { error: err.message });
    }
  }
}
