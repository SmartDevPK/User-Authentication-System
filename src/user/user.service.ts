import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './user-data.dto';
import { User } from './user.entity';
import { sendConfirmationEmail } from './lib/mailer';
import { LoginAttemptService } from './LoginAttemptService';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  private pendingUsers: Map<
    string,
    {
      full_name: string;
      email: string;
      username: string;
      password: string;
      confirmationCode: string;
      expiresAt: number;
    }
  > = new Map();

  /**
   * Validates password strength
   */
  private validatePasswordStrength(password: string): 'strong' | 'weak' {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongRegex.test(password) ? 'strong' : 'weak';
  }

  /**
   * Step 1: Register user and send confirmation code
   */
  async create(createUserDto: CreateUserDto) {
    const { full_name, email, password, username } = createUserDto;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already used
    const existingUser = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingUser || this.pendingUsers.has(normalizedEmail)) {
      return {
        message: 'Email already exists or is awaiting confirmation.',
        user: null,
      };
    }

    // Password strength check
    const strength = this.validatePasswordStrength(password);
    if (strength === 'weak') {
      return {
        message:
          'Password is too weak. It should be at least 8 characters long, contain uppercase and lowercase letters, a number, and a special character.',
        user: null,
      };
    }

    // Hash password and create confirmation code
    const hashedPassword = await bcrypt.hash(password, 10);
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Store pending user
    this.pendingUsers.set(normalizedEmail, {
      full_name,
      email: normalizedEmail,
      username,
      password: hashedPassword,
      confirmationCode,
      expiresAt,
    });

    // Send email
    await sendConfirmationEmail(normalizedEmail, confirmationCode);

    return {
      message: 'A confirmation email has been sent. Please enter the code to complete registration.',
    };
  }

  /**
   * Step 2: Confirm code and register user in DB
   */
  async confirmCode(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const pending = this.pendingUsers.get(normalizedEmail);

    if (!pending) {
      return { message: 'No pending registration found for this email.', success: false };
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingUsers.delete(normalizedEmail);
      return { message: 'Confirmation code expired. Please register again.', success: false };
    }

    if (pending.confirmationCode !== code) {
      return { message: 'Invalid confirmation code.', success: false };
    }

    // Save user to DB
    const user = this.userRepository.create({
      full_name: pending.full_name,
      email: pending.email,
      username: pending.username,
      password: pending.password,
    });
    await this.userRepository.save(user);

    // Clear from pending
    this.pendingUsers.delete(normalizedEmail);

    return { message: 'Email confirmed successfully!', success: true };
  }

  /**
   * Validates login credentials and lockout logic
   */
  async validateUser(email: string, pass: string): Promise<any> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check lock status
    if (this.loginAttemptService.isLocked(normalizedEmail)) {
      throw new UnauthorizedException('Too many failed attempts. Try again in 40 minutes.');
    }

    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });

    // Incorrect credentials
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      this.loginAttemptService.registerFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Successful login - reset failed attempts
    this.loginAttemptService.reset(normalizedEmail);
    return user;
  }

  // Login user and return access token
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Login Successful',
      user: userWithoutPassword,
      accessToken,
    };
  }
}
