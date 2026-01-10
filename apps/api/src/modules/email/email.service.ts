import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'localhost'),
      port: this.configService.get('SMTP_PORT', 1025),
      secure: this.configService.get('SMTP_SECURE', 'false') === 'true',
      auth: this.configService.get('SMTP_USER')
        ? {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name?: string | null,
  ): Promise<void> {
    const appUrl = this.configService.get('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM', 'noreply@dms.local'),
        to: email,
        subject: 'Reset Your Password - DMS',
        html: this.getPasswordResetTemplate(name || 'there', resetUrl),
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error}`);
      throw error;
    }
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    name?: string | null,
  ): Promise<void> {
    const appUrl = this.configService.get('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM', 'noreply@dms.local'),
        to: email,
        subject: 'Verify Your Email - DMS',
        html: this.getVerificationTemplate(name || 'there', verifyUrl),
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error}`);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name?: string | null): Promise<void> {
    const appUrl = this.configService.get('APP_URL', 'http://localhost:3000');

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM', 'noreply@dms.local'),
        to: email,
        subject: 'Welcome to DMS',
        html: this.getWelcomeTemplate(name || 'there', appUrl),
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error}`);
      throw error;
    }
  }

  private getPasswordResetTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Password Reset Request</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            ">Reset Password</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by DMS (Document Management System)
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getVerificationTemplate(name: string, verifyUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Welcome to DMS!</h1>
          <p>Hi ${name},</p>
          <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
          <p style="margin: 30px 0;">
            <a href="${verifyUrl}" style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            ">Verify Email</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by DMS (Document Management System)
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(name: string, appUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to DMS</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Welcome to DMS!</h1>
          <p>Hi ${name},</p>
          <p>Thank you for joining DMS (Document Management System). Your account has been created successfully.</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>Upload and organize your documents</li>
            <li>Share files with your team</li>
            <li>Search documents with AI-powered semantic search</li>
            <li>Process PDFs with OCR and intelligent classification</li>
          </ul>
          <p style="margin: 30px 0;">
            <a href="${appUrl}/dashboard" style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            ">Go to Dashboard</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by DMS (Document Management System)
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
