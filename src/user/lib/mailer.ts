import * as nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendConfirmationEmail = async (email: string, code: string) => {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Confirmation Code',
    text: `Your confirmation code is: ${code}`,
    html: `<p>Your confirmation code is: <strong>${code}</strong></p>`,
  });

  return info;
};
