import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const getTransporter = () => {
  const SMTP_USER = process.env.SMTP_USER || "academyossos@gmail.com";
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<void> => {
  const SMTP_USER = process.env.SMTP_USER || "academyossos@gmail.com";
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  try {
    if (!SMTP_PASSWORD) {
      console.warn("[Email Service] SMTP_PASSWORD is not set. Welcome email skipped.");
      return;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>مرحباً بك في أكاديمية أسس</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f6f9fc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          text-align: right;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f6f9fc;
          padding: 40px 0;
        }
        .card {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
          border: 1px solid #F95353;
        }
        .header {
          background-color: #F95353;
          padding: 40px 20px;
          text-align: center;
        }
        .logo {
          color: #ffffff;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .content {
          padding: 40px 35px;
        }
        h1 {
          font-size: 22px;
          font-weight: 800;
          color: #0a3d3f;
          margin-top: 0;
          margin-bottom: 16px;
        }
        p {
          font-size: 15px;
          color: #4a5568;
          line-height: 1.7;
          margin-top: 0;
          margin-bottom: 24px;
        }
        .btn-container {
          text-align: center;
          margin: 32px 0;
        }
        .btn {
          display: inline-block;
          padding: 16px 36px;
          background-color: #F95353;
          color: #ffffff !important;
          text-decoration: none;
          font-size: 15px;
          font-weight: 800;
          border-radius: 14px;
          box-shadow: 0 4px 14px rgba(249, 83, 83, 0.25);
          transition: background-color 0.2s ease;
        }
        .btn:hover {
          background-color: #0a3d3f;
        }
        .footer {
          padding: 24px;
          background-color: #fafbfc;
          border-top: 1px solid #edf2f7;
          text-align: center;
        }
        .footer-text {
          font-size: 12px;
          color: #718096;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          
          <div class="header">
            <h2 class="logo">أكاديمية أسس</h2>
          </div>
          
          <div class="content">
            <h1>مرحباً بك في أكاديميتنا ${name}!</h1>
            <p>شكراً لتسجيلك معنا. نحن سعداء بانضمامك إلى مجتمعنا التعليمي. يمكنك الآن البدء في استكشاف دوراتنا المتنوعة والاستفادة من المحتوى القيم الذي نقدمه.</p>
            
            <div class="btn-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/courses" class="btn">استكشف الدورات الآن</a>
            </div>
            
            <p>نتمنى لك رحلة تعلم ممتعة ومفيدة!</p>
          </div>
          
          <div class="footer">
            <p class="footer-text">© 2026 أكاديمية أسس. جميع الحقوق محفوظة.</p>
          </div>

        </div>
      </div>
    </body>
    </html>
    `;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"أكاديمية أسس" <${SMTP_USER}>`,
      to: email,
      subject: 'مرحباً بك في أكاديمية أسس!',
      html: htmlContent,
    });

    console.log(`[Email Service] Welcome email successfully sent to ${email}`);
  } catch (err: any) {
    console.error(`[Email Service] Failed to send welcome email to ${email}:`, err.message);
  }
};

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const SMTP_USER = process.env.SMTP_USER || "academyossos@gmail.com";
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  try {
    if (!SMTP_PASSWORD) {
      console.warn("[Email Service] SMTP_PASSWORD is not set. Reset email skipped.");
      return;
    }

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>إعادة تعيين كلمة المرور</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f6f9fc;
          font-family: 'Montserrat',-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          text-align: right;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f6f9fc;
          padding: 40px 0;
        }
        .card {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
          border: 1px solid #F95353;
        }
        .header {
          background-color: #F95353;
          padding: 40px 20px;
          text-align: center;
        }
        .logo {
          color: #ffffff;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .content {
          padding: 40px 35px;
        }
        h1 {
          font-size: 22px;
          font-weight: 800;
          color: #0a3d3f;
          margin-top: 0;
          margin-bottom: 16px;
        }
        p {
          font-size: 15px;
          color: #4a5568;
          line-height: 1.7;
          margin-top: 0;
          margin-bottom: 24px;
        }
        .btn-container {
          text-align: center;
          margin: 32px 0;
        }
        .btn {
          display: inline-block;
          padding: 16px 36px;
          background-color: #F95353;
          color: #ffffff !important;
          text-decoration: none;
          font-size: 15px;
          font-weight: 800;
          border-radius: 14px;
          box-shadow: 0 4px 14px rgba(249, 83, 83, 0.25);
          transition: background-color 0.2s ease;
        }
        .btn:hover {
          background-color: #0a3d3f;
        }
        .footer {
          padding: 24px;
          background-color: #fafbfc;
          border-top: 1px solid #edf2f7;
          text-align: center;
        }
        .footer-text {
          font-size: 12px;
          color: #718096;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          
          <div class="header">
            <h2 class="logo">أكاديمية أسس</h2>
          </div>
          
          <div class="content">
            <h1>إعادة تعيين كلمة المرور</h1>
            <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في أكاديمية أسس. إذا كنت قد طلبت ذلك، يرجى النقر على الزر أدناه لإعادة تعيين كلمة المرور:</p>
            
            <div class="btn-container">
              <a href="${resetUrl}" class="btn">إعادة تعيين كلمة المرور</a>
            </div>
            
            <p>إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني. لن يتم تغيير كلمة المرور الخاصة بك ما لم تنقر على الزر أعلاه.</p>
          </div>
          
          <div class="footer">
            <p class="footer-text">© 2026 أكاديمية أسس. جميع الحقوق محفوظة.</p>
          </div>

        </div>
      </div>
    </body>
    </html>
    `;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"أكاديمية أسس" <${SMTP_USER}>`,
      to: email,
      subject: 'إعادة تعيين كلمة المرور',
      html: htmlContent,
    });

    console.log(`[Email Service] Password reset email successfully sent to ${email}`);
  } catch (err: any) {
    console.error(`[Email Service] Failed to send password reset email to ${email}:`, err.message);
  }
};