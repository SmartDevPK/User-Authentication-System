import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Gmail address from .env
    pass: process.env.EMAIL_PASS,  // Gmail app password from .env
  },
});

export const sendConfirmationEmail = async (email: string, code: string) => {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER,        // Sender address
    to: email,                           // Recipient address
    subject: 'Your Confirmation Code',
    text: `Your confirmation code is: ${code}`,       // Plain text body
    html: `<p>Your confirmation code is: <strong>${code}</strong></p>`,  // HTML body
  });

  return info;
};
