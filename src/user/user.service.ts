import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './user-data.dto';
import { sendConfirmationEmail } from './lib/mailer';

@Injectable()
export class UserService {
  // In-memory users array (for development only)
  private users: {
    id: number;
    full_name: string;
    email: string;
    password: string;
    username: string;
  }[] = [];

  // Temporary storage for users awaiting email confirmation
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

  // Validate password strength: weak, medium, or strong
  private validatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const mediumRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;

    if (strongRegex.test(password)) return 'strong';
    if (mediumRegex.test(password)) return 'medium';
    return 'weak';
  }

  // Step 1: Create a pending user and send confirmation code
  async create(createUserDto: CreateUserDto) {
    const { full_name, email, password, username } = createUserDto;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists or is pending confirmation
    const existingEmail = this.users.find(user => user.email === normalizedEmail);
    if (existingEmail || this.pendingUsers.has(normalizedEmail)) {
      return {
        message: 'Email already exists or is awaiting confirmation.',
        user: null,
      };
    }

    // Check password strength
    const strength = this.validatePasswordStrength(password);
    if (strength === 'weak') {
      return {
        message:
          'Password is too weak. It should be at least 8 characters long, contain uppercase and lowercase letters, a number, and a special character.',
        user: null,
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate confirmation code and expiry (5 minutes)
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

  // Step 2: Confirm the user's code and register permanently
async confirmCode(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('Confirm attempt for email:', normalizedEmail);

  const pending = this.pendingUsers.get(normalizedEmail);
  console.log('Pending user:', pending);

  if (!pending) {
    return { message: 'No pending registration found for this email.' };
  }

  if (Date.now() > pending.expiresAt) {
    this.pendingUsers.delete(normalizedEmail);
    return { message: 'Confirmation code expired. Please register again.' };
  }

  if (pending.confirmationCode !== code) {
    return { message: 'Invalid confirmation code.' };
  }

  // finalize registration...
}

}
