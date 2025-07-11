import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './user-data.dto';
import * as bcrypt from 'bcrypt'; // Use `* as` to import bcrypt correctly
import { sendConfirmationEmail } from './lib/mailer';

@Injectable()
export class UserService {
  private users: {
    id: number;
    full_name: string;
    email: string;
    password: string;
    username: string;
  }[] = [];

  // Validate password strength
  private validatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const mediumRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

    if (strongRegex.test(password)) return 'strong';
    if (mediumRegex.test(password)) return 'medium';
    return 'weak';
  }

  // Create new user
  async create(createUserDto: CreateUserDto) {
    const { full_name, email, password, username } = createUserDto;

    // Check for existing email
    const existingEmail = this.users.find(user => user.email === email);
    if (existingEmail) {
      return {
        message: 'Email already exists',
        user: null,
      };
    }

    // Check password strength
    const strength = this.validatePasswordStrength(password);
    if (strength === 'weak') {
      return {
        message: 'Password is too weak. It should be at least 8 characters long, contain uppercase and lowercase letters, a number, and a special character.',
        user: null,
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const newUser = {
      id: Date.now(),
      full_name,
      email,
      password: hashedPassword,
      username,
    };

    this.users.push(newUser);

    // Generate confirmation code
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Send confirmation email
    await sendConfirmationEmail(email, confirmationCode);

    return {
      message: 'User created successfully. A confirmation email has been sent.',
      user: newUser,
    };
  }
}
