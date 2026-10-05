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
export const sendPreRegistrationConfirmationEmail = async (
  email: string,
  name: string,
  courseName: string
): Promise<void> => {
  const SMTP_USER = process.env.SMTP_USER || "academyossos@gmail.com";
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  try {
    if (!SMTP_PASSWORD) {
      console.warn("[Email Service] SMTP_PASSWORD is not set. Pre-registration confirmation email skipped.");
      return;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تأكيد الحجز المسبق</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: right; }
        .wrapper { width: 100%; padding: 40px 0; background-color: #f6f9fc; }
        .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #F95353; }
        .header { background-color: #F95353; padding: 40px 20px; text-align: center; }
        .logo { color: #ffffff; font-size: 26px; font-weight: 900; margin: 0; }
        .content { padding: 40px 35px; }
        h1 { font-size: 22px; font-weight: 800; color: #0a3d3f; margin-bottom: 16px; }
        p { font-size: 15px; color: #4a5568; line-height: 1.8; margin-bottom: 20px; }
        .highlight-box { background-color: #fff5f5; border-right: 4px solid #F95353; padding: 16px 20px; border-radius: 12px; margin: 24px 0; }
        .btn-container { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; padding: 16px 36px; background-color: #F95353; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 14px; }
        .footer { padding: 24px; background-color: #fafbfc; border-top: 1px solid #edf2f7; text-align: center; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <h2 class="logo">أكاديمية أسس</h2>
          </div>
          <div class="content">
            <h1>مرحباً بك يا ${name}! 👋</h1>
            <p>لقد تم تسجيل حجزك المسبق بنجاح في دورة:</p>
            <div class="highlight-box">
              <strong style="color: #F95353; font-size: 18px;">${courseName}</strong>
            </div>
            <p>
              بصفتك من المسجلين الأوائل في قائمة الحجز المسبق، نود أن نعلمك بأنك <strong>ستحصل على خصم استثنائي خاص</strong> على سعر الدورة فور إطلاقها واكتمالها رسمياً!
            </p>
            <p>
              سنقوم بمراسلتك والاتصال بك فور اكتمال الدورة لتأكيد طلبك وتفعيله لك مباشرة بسعر الحجز المخفّض.
            </p>
            <div class="btn-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/courses" class="btn">تصفح باقي الدورات</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2026 أكاديمية أسس. جميع الحقوق محفوظة.</p>
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
      subject: `تم تأكيد حجزك المسبق لدورة: ${courseName} 🎉`,
      html: htmlContent,
    });
    console.log(`[Email Service] Pre-registration confirmation sent to ${email}`);
  } catch (err: any) {
    console.error(`[Email Service] Failed to send pre-registration email to ${email}:`, err.message);
  }
};

export const sendCourseReadyNotificationEmail = async (
  email: string,
  name: string,
  courseName: string,
  courseUrl: string,
  price: number,
  discountPercentage?: number,
  discountedPrice?: number
): Promise<void> => {
  const SMTP_USER = process.env.SMTP_USER || "academyossos@gmail.com";
  const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

  try {
    if (!SMTP_PASSWORD) {
      console.warn("[Email Service] SMTP_PASSWORD is not set. Course ready notification email skipped.");
      return;
    }

    const fullCourseLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/courses/${courseUrl}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>أصبحت الدورة جاهزة الآن!</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: right; }
        .wrapper { width: 100%; padding: 40px 0; background-color: #f6f9fc; }
        .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.04); border: 1px solid #10b981; }
        .header { background-color: #10b981; padding: 40px 20px; text-align: center; }
        .logo { color: #ffffff; font-size: 26px; font-weight: 900; margin: 0; }
        .content { padding: 40px 35px; }
        h1 { font-size: 22px; font-weight: 800; color: #065f46; margin-bottom: 16px; }
        p { font-size: 15px; color: #4a5568; line-height: 1.8; margin-bottom: 20px; }
        .highlight-box { background-color: #ecfdf5; border-right: 4px solid #10b981; padding: 18px 20px; border-radius: 12px; margin: 24px 0; }
        .btn-container { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; padding: 16px 36px; background-color: #10b981; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 800; border-radius: 14px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); }
        .footer { padding: 24px; background-color: #fafbfc; border-top: 1px solid #edf2f7; text-align: center; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <h2 class="logo">أكاديمية أسس</h2>
          </div>
          <div class="content">
            <h1>بشرى سارة يا ${name}! 🚀</h1>
            <p>يسعدنا إعلامك بأن الدورة التي قمت بالحجز المسبق لها أصبحت <strong>متاحة وجاهزة للمشاهدة الآن</strong>:</p>
            <div class="highlight-box">
              <div style="font-size: 18px; font-weight: 900; color: #065f46; margin-bottom: 6px;">${courseName}</div>
              <div style="font-size: 15px; color: #047857; font-weight: bold; margin-bottom: 6px;">
                🎁 عرض الحجز المسبق المخفّض المخصص لك أصبح جاهزاً للاستفادة منه!
              </div>
              ${
                discountedPrice && discountedPrice < price
                  ? `<div style="font-size: 16px; font-weight: 900; color: #059669; margin-top: 8px;">
                      السعر المخصص لك: <span style="font-size: 20px; color: #10b981;">${discountedPrice} د.ت</span>
                      <span style="font-size: 14px; text-decoration: line-through; color: #9ca3af; margin-right: 8px;">${price} د.ت</span>
                      ${discountPercentage ? `<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 12px; margin-right: 6px;">خصم ${discountPercentage}%</span>` : ''}
                    </div>`
                  : `<div style="font-size: 15px; font-weight: 800; color: #059669;">سعر الدورة: ${price} د.ت مع خصمك الخاص للحجز المسبق</div>`
              }
            </div>
            <p>
              يمكنك الآن الدخول إلى صفحة الدورة وتأكيد طلبها بالسعر المخفّض وسنقوم بالتواصل معك لتأكيد التوصيل والتفعيل مباشرة.
            </p>
            <div class="btn-container">
              <a href="${fullCourseLink}" class="btn">مشاهدة الدورة وطلبها الآن 👈</a>
            </div>
          </div>
          <div class="footer">
            <p>© 2026 أكاديمية أسس. جميع الحقوق محفوظة.</p>
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
      subject: `أصبحت دورة: ${courseName} جاهزة الآن! احصل على خصمك 🚀`,
      html: htmlContent,
    });
    console.log(`[Email Service] Course ready notification sent to ${email}`);
  } catch (err: any) {
    console.error(`[Email Service] Failed to send course ready email to ${email}:`, err.message);
  }
};
