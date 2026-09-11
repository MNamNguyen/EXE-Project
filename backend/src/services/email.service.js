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

function assertConfigured() {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Email chưa cấu hình: thiếu BREVO_API_KEY / BREVO_SENDER_EMAIL');
  }
}

async function sendOtpEmail(email, name, otp) {
  assertConfigured();
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
  assertConfigured();
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


async function sendPasswordResetEmail(email, name, newPassword) {
  assertConfigured();
  await brevoRequest({
    sender,
    to: [{ email }],
    subject: '[FPT Event] Mật khẩu của bạn đã được đặt lại',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Quản trị viên vừa đặt lại mật khẩu cho tài khoản của bạn.</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #6b7b9a; font-size: 14px;">Mật khẩu mới:</p>
            <p style="margin: 0;"><span style="color: #1a6bff; font-family: monospace; font-size: 18px;">${newPassword}</span></p>
          </div>
          <p style="color: #ff4d6a; font-size: 14px;">Bạn sẽ được yêu cầu đổi mật khẩu ngay sau khi đăng nhập lần tới. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy liên hệ quản trị viên.</p>
        </div>
      </div>
    `,
  });
}

// OTP đặt lại mật khẩu (người dùng tự bấm "Quên mật khẩu"). Khác
// sendPasswordResetEmail ở chỗ KHÔNG gửi mật khẩu thật qua email — chỉ gửi mã
// để người dùng tự đặt mật khẩu mới trên trình duyệt.
async function sendPasswordResetOtpEmail(email, name, otp) {
  assertConfigured();
  await brevoRequest({
    sender,
    to: [{ email }],
    subject: '[FPT Event] Mã đặt lại mật khẩu',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Mã xác thực để đặt lại mật khẩu tài khoản của bạn:</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1a6bff;">${otp}</span>
          </div>
          <p style="color: #6b7b9a; font-size: 14px;">Mã có hiệu lực trong <strong>15 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
          <p style="color: #ff4d6a; font-size: 14px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>
        </div>
      </div>
    `,
  });
}

// Mã đăng nhập không cần mật khẩu (sinh viên quét QR rồi chọn "Đăng nhập bằng
// OTP"). Tách riêng khỏi sendOtpEmail vì ngữ cảnh khác hẳn: đây là đăng nhập,
// không phải xác thực thiết bị mới sau khi đã nhập đúng mật khẩu.
async function sendLoginOtpEmail(email, name, otp) {
  assertConfigured();
  await brevoRequest({
    sender,
    to: [{ email }],
    subject: '[FPT Event] Mã đăng nhập của bạn',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Mã đăng nhập của bạn:</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1a6bff;">${otp}</span>
          </div>
          <p style="color: #6b7b9a; font-size: 14px;">Mã có hiệu lực trong <strong>10 phút</strong> và chỉ dùng được trên thiết bị vừa yêu cầu.</p>
          <p style="color: #ff4d6a; font-size: 14px;">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này và đổi mật khẩu.</p>
        </div>
      </div>
    `,
  });
}

// Xác nhận đăng ký tham gia sự kiện. Nếu tài khoản vừa được tạo từ form đăng ký
// thì kèm luôn mật khẩu tạm để người dùng đăng nhập quét QR điểm danh.
async function sendEventRegistrationEmail(email, name, event, { mssv, tempPassword } = {}) {
  assertConfigured();

  const fmt = (d) => new Date(d).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' });

  const credentialsBlock = tempPassword
    ? `
          <div style="background: #fff8e6; border: 1px solid #ffe0a3; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #6b7b9a; font-size: 14px;">Tài khoản đăng nhập vừa được tạo cho bạn:</p>
            <p style="margin: 0 0 4px;"><strong>MSSV:</strong> ${mssv || '—'}</p>
            <p style="margin: 0 0 4px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Mật khẩu tạm:</strong> <span style="color: #1a6bff; font-family: monospace;">${tempPassword}</span></p>
            <p style="margin: 12px 0 0; color: #ff4d6a; font-size: 13px;">Hãy đăng nhập và đổi mật khẩu trước khi sự kiện diễn ra.</p>
          </div>`
    : '';

  await brevoRequest({
    sender,
    to: [{ email }],
    subject: `[FPT Event] Đăng ký thành công: ${event.name}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1A6BFF, #00A3FF); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FPT Event System</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2eaff;">
          <p style="color: #0d1b2e; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
          <p style="color: #6b7b9a;">Bạn đã đăng ký tham gia sự kiện thành công. Thông tin chi tiết:</p>
          <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 6px; font-size: 17px;"><strong>${event.name}</strong></p>
            <p style="margin: 0 0 4px; color: #6b7b9a;"><strong>Địa điểm:</strong> ${event.location}</p>
            <p style="margin: 0; color: #6b7b9a;"><strong>Thời gian:</strong> ${fmt(event.checkinOpen)}</p>
          </div>${credentialsBlock}
          <p style="color: #6b7b9a; font-size: 14px;">Đến ngày sự kiện, hãy đăng nhập hệ thống và quét mã QR tại cửa vào để điểm danh.</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendOtpEmail,
  sendLoginOtpEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendEventRegistrationEmail,
};
