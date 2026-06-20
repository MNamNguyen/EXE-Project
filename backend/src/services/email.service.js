const https = require('https');

function brevoRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Brevo API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const sender = {
  name: process.env.BREVO_SENDER_NAME || 'FPT Event System',
  email: process.env.BREVO_SENDER_EMAIL,
};

async function sendOtpEmail(email, name, otp) {
  await brevoRequest({
    sender,
    to: [{ email }],
    subject: '[FPT Event] Xác thực thiết bị mới',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Mã OTP để xác thực thiết bị mới của bạn:</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1a6bff;">${otp}</span>
          </div>
          <p style="color: #6b7b9a; font-size: 14px;">Mã có hiệu lực trong <strong>10 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeEmail(email, name, mssv, tempPassword) {
  await brevoRequest({
    sender,
    to: [{ email }],
    subject: '[FPT Event] Tài khoản của bạn đã được tạo',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Tài khoản của bạn trên hệ thống FPT Event đã được tạo.</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #6b7b9a; font-size: 14px;">Thông tin đăng nhập:</p>
            <p style="margin: 0 0 4px;"><strong>MSSV:</strong> ${mssv}</p>
            <p style="margin: 0 0 4px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Mật khẩu tạm:</strong> <span style="color: #1a6bff; font-family: monospace;">${tempPassword}</span></p>
          </div>
          <p style="color: #ff4d6a; font-size: 14px;">Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail, sendWelcomeEmail };
