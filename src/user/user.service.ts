import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './user-data.dto';
import { User } from './user.entity'; // Your User entity path
import { sendConfirmationEmail } from './lib/mailer';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  // Password strength validation helper
  private validatePasswordStrength(password: string): 'strong' | 'weak' {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongRegex.test(password) ? 'strong' : 'weak';
  }

  // Step 1: create pending user & send confirmation email
  async create(createUserDto: CreateUserDto) {
    const { full_name, email, password, username } = createUserDto;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists in DB or pending
    const existingUser = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingUser || this.pendingUsers.has(normalizedEmail)) {
      return {
        message: 'Email already exists or is awaiting confirmation.',
        user: null,
      };
    }

    // Validate password strength (same as before)
    const strength = this.validatePasswordStrength(password);
    if (strength === 'weak') {
      return {
        message:
          'Password is too weak. It should be at least 8 characters long, contain uppercase and lowercase letters, a number, and a special character.',
        user: null,
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate confirmation code & expiry
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Store pending user data
    this.pendingUsers.set(normalizedEmail, {
      full_name,
      email: normalizedEmail,
      username,
      password: hashedPassword,
      confirmationCode,
      expiresAt,
    });

    // Send confirmation email
    await sendConfirmationEmail(normalizedEmail, confirmationCode);

    return {
      message: 'A confirmation email has been sent. Please enter the code to complete registration.',
    };
  }

  // Step 2: confirm user code and insert into DB
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

    // Create User entity instance
    const user = this.userRepository.create({
      full_name: pending.full_name,
      email: pending.email,
      username: pending.username,
      password: pending.password,
    });

    // Save to DB
    await this.userRepository.save(user);

    // Remove from pending
    this.pendingUsers.delete(normalizedEmail);

    return { message: 'Email confirmed successfully!', success: true };
  }
}

