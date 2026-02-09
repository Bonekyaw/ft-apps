import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_NAME = 'Family Taxi';
const PRIMARY_COLOR = '#FFB800';
const PRIMARY_DARK = '#E5A500';
const DARK_COLOR = '#1A1A2E';
const GRAY_100 = '#F3F4F6';
const GRAY_200 = '#E5E7EB';
const GRAY_500 = '#6B7280';
const GRAY_600 = '#4B5563';
const GRAY_900 = '#111827';

interface SendEmailValues {
  to: string;
  subject: string;
  text: string;
}

interface SendOTPEmailValues {
  to: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password';
}

interface SendResetPasswordEmailValues {
  to: string;
  userName?: string;
  resetUrl: string;
}

/**
 * Generate individual OTP digit boxes HTML
 */
function generateOTPDigits(otp: string): string {
  return otp
    .split('')
    .map(
      (digit) => `
      <td style="padding: 0 4px;">
        <div style="
          width: 48px;
          height: 56px;
          background: linear-gradient(135deg, ${GRAY_100} 0%, #FFFFFF 100%);
          border: 2px solid ${GRAY_200};
          border-radius: 12px;
          font-size: 28px;
          font-weight: 700;
          color: ${DARK_COLOR};
          text-align: center;
          line-height: 52px;
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
        ">${digit}</div>
      </td>
    `,
    )
    .join('');
}

/**
 * Base email layout wrapper with improved design
 */
function emailLayout(content: string, headerIcon: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${APP_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  
  <!-- Preview Text -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    Your ${APP_NAME} verification code is ready
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background-color: #F9FAFB;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 440px; border-collapse: collapse;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="
                    width: 48px;
                    height: 48px;
                    background-color: ${PRIMARY_COLOR};
                    border-radius: 14px;
                    text-align: center;
                    vertical-align: middle;
                    font-size: 24px;
                    box-shadow: 0 4px 14px rgba(255, 184, 0, 0.4);
                  ">🚕</td>
                  <td style="padding-left: 14px;">
                    <span style="font-size: 22px; font-weight: 800; color: ${DARK_COLOR}; letter-spacing: -0.5px;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" style="
                width: 100%;
                background-color: #FFFFFF;
                border-radius: 20px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.05);
                overflow: hidden;
              ">
                
                <!-- Header Accent -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%);"></td>
                </tr>
                
                <!-- Icon Circle -->
                <tr>
                  <td align="center" style="padding-top: 40px;">
                    <div style="
                      width: 80px;
                      height: 80px;
                      background: linear-gradient(135deg, ${PRIMARY_COLOR}15 0%, ${PRIMARY_COLOR}30 100%);
                      border-radius: 50%;
                      text-align: center;
                      line-height: 80px;
                      font-size: 36px;
                    ">${headerIcon}</div>
                  </td>
                </tr>
                
                <!-- Content -->
                ${content}
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; font-size: 13px; color: ${GRAY_500};">
                      © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: ${GRAY_500};">
                      Yangon, Myanmar
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Unsubscribe Link -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate OTP email HTML with individual digit boxes
 */
function otpEmailTemplate(
  otp: string,
  type: SendOTPEmailValues['type'],
): string {
  const config: Record<
    string,
    { title: string; subtitle: string; icon: string }
  > = {
    'sign-in': {
      title: 'Sign in to your account',
      subtitle:
        'Enter this code to securely sign in to your Family Taxi account.',
      icon: '🔐',
    },
    'email-verification': {
      title: 'Verify your email',
      subtitle:
        "Welcome aboard! Let's verify your email to get you started with Family Taxi.",
      icon: '✉️',
    },
    'forget-password': {
      title: 'Reset your password',
      subtitle:
        'No worries! Use this code to reset your password and get back on track.',
      icon: '🔑',
    },
  };

  const { title, subtitle, icon } = config[type];

  const content = `
    <tr>
      <td style="padding: 28px 36px 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${GRAY_900}; text-align: center; line-height: 1.3;">
          ${title}
        </h1>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 12px 36px 0;">
        <p style="margin: 0; font-size: 15px; color: ${GRAY_600}; text-align: center; line-height: 1.6;">
          ${subtitle}
        </p>
      </td>
    </tr>
    
    <!-- OTP Digits -->
    <tr>
      <td align="center" style="padding: 32px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            ${generateOTPDigits(otp)}
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Timer -->
    <tr>
      <td align="center" style="padding: 0 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="
          background-color: #FEF3C7;
          border-radius: 10px;
          padding: 14px 20px;
        ">
          <tr>
            <td style="font-size: 18px; padding-right: 10px;">⏱️</td>
            <td>
              <span style="font-size: 14px; color: #92400E;">
                Code expires in <strong style="color: #78350F;">10 minutes</strong>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Security Notice -->
    <tr>
      <td style="padding: 32px 36px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="
          width: 100%;
          background-color: ${GRAY_100};
          border-radius: 12px;
          padding: 16px 20px;
        ">
          <tr>
            <td style="font-size: 20px; padding-right: 12px; vertical-align: top;">🛡️</td>
            <td>
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: ${GRAY_900};">
                Keep this code private
              </p>
              <p style="margin: 0; font-size: 12px; color: ${GRAY_600}; line-height: 1.5;">
                Family Taxi will never call or message you asking for this code. Don't share it with anyone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return emailLayout(content, icon);
}

/**
 * Generate password reset email HTML
 */
function resetPasswordEmailTemplate(
  resetUrl: string,
  userName?: string,
): string {
  const greeting = userName ? userName : 'there';

  const content = `
    <tr>
      <td style="padding: 28px 36px 0;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${GRAY_900}; text-align: center; line-height: 1.3;">
          Reset your password
        </h1>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 12px 36px 0;">
        <p style="margin: 0; font-size: 15px; color: ${GRAY_600}; text-align: center; line-height: 1.6;">
          Hey ${greeting}! We received a request to reset your password. Click the button below to choose a new one.
        </p>
      </td>
    </tr>
    
    <!-- Reset Button -->
    <tr>
      <td align="center" style="padding: 32px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius: 12px; background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%); box-shadow: 0 4px 14px rgba(255, 184, 0, 0.4);">
              <a href="${resetUrl}" target="_blank" style="
                display: inline-block;
                padding: 16px 40px;
                font-size: 16px;
                font-weight: 600;
                color: ${DARK_COLOR};
                text-decoration: none;
                letter-spacing: 0.3px;
              ">Reset Password</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Alternative Link -->
    <tr>
      <td style="padding: 0 36px;">
        <p style="margin: 0 0 12px; font-size: 13px; color: ${GRAY_500}; text-align: center;">
          Or copy this link into your browser:
        </p>
        <div style="
          background-color: ${GRAY_100};
          border-radius: 8px;
          padding: 12px 16px;
          word-break: break-all;
        ">
          <a href="${resetUrl}" style="font-size: 12px; color: #2563EB; text-decoration: none; font-family: 'SF Mono', 'Menlo', monospace;">
            ${resetUrl}
          </a>
        </div>
      </td>
    </tr>
    
    <!-- Timer -->
    <tr>
      <td align="center" style="padding: 24px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="
          background-color: #FEF3C7;
          border-radius: 10px;
          padding: 14px 20px;
        ">
          <tr>
            <td style="font-size: 18px; padding-right: 10px;">⏱️</td>
            <td>
              <span style="font-size: 14px; color: #92400E;">
                Link expires in <strong style="color: #78350F;">1 hour</strong>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Security Notice -->
    <tr>
      <td style="padding: 8px 36px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="
          width: 100%;
          background-color: ${GRAY_100};
          border-radius: 12px;
          padding: 16px 20px;
        ">
          <tr>
            <td style="font-size: 20px; padding-right: 12px; vertical-align: top;">🔒</td>
            <td>
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: ${GRAY_900};">
                Didn't request this?
              </p>
              <p style="margin: 0; font-size: 12px; color: ${GRAY_600}; line-height: 1.5;">
                If you didn't request a password reset, you can safely ignore this email. Your password won't change.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return emailLayout(content, '🔑');
}

/**
 * Send a basic email (legacy support)
 */
export async function sendEmail({ to, subject, text }: SendEmailValues) {
  await resend.emails.send({
    from: `${APP_NAME} <no-reply@familytaximm.com>`,
    to,
    subject,
    text,
  });
}

/**
 * Send OTP verification email with beautiful HTML template
 */
export async function sendOTPEmail({ to, otp, type }: SendOTPEmailValues) {
  const subjects: Record<string, string> = {
    'sign-in': `Your sign-in code: ${otp}`,
    'email-verification': `Verify your email: ${otp}`,
    'forget-password': `Password reset code: ${otp}`,
  };

  await resend.emails.send({
    from: `${APP_NAME} <no-reply@familytaximm.com>`,
    to,
    subject: subjects[type] || `Your verification code: ${otp}`,
    html: otpEmailTemplate(otp, type),
    text: `Your ${APP_NAME} verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
  });
}

/**
 * Send password reset email with beautiful HTML template
 */
export async function sendResetPasswordEmail({
  to,
  userName,
  resetUrl,
}: SendResetPasswordEmailValues) {
  await resend.emails.send({
    from: `${APP_NAME} <no-reply@familytaximm.com>`,
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: resetPasswordEmailTemplate(resetUrl, userName),
    text: `Reset your password\n\nHey ${userName || 'there'}! Click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
  });
}
