const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const BRAND_NAME = "Quotation Portal";
const NAVY = "#0B1F3A";
const BLUE = "#2563EB";
const TEXT = "#172033";
const MUTED = "#667085";
const BORDER = "#E7EAF0";
const BACKGROUND = "#F4F6F9";

function emailLayout({
  eyebrow,
  title,
  greeting,
  content,
  buttonText,
  buttonUrl,
  footerText
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${title}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:${BACKGROUND};
    font-family:Arial, Helvetica, sans-serif;
    color:${TEXT};
  "
>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="background:${BACKGROUND};"
>
  <tr>
    <td align="center" style="padding:40px 16px;">

      <!-- Main container -->
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="
          max-width:620px;
          background:#ffffff;
          border-radius:14px;
          overflow:hidden;
          border:1px solid ${BORDER};
        "
      >

        <!-- Header -->
        <tr>
          <td
            style="
              background:${NAVY};
              padding:30px 40px;
            "
          >

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>

                <td
                  style="
                    color:#ffffff;
                    font-size:20px;
                    font-weight:bold;
                    letter-spacing:-0.3px;
                  "
                >
                  ${BRAND_NAME}
                </td>

                <td
                  align="right"
                  style="
                    color:#AFC1D9;
                    font-size:11px;
                    letter-spacing:1px;
                    text-transform:uppercase;
                  "
                >
                  Secure Access
                </td>

              </tr>
            </table>

          </td>
        </tr>


        <!-- Accent line -->
        <tr>
          <td
            style="
              height:4px;
              background:${BLUE};
              font-size:0;
              line-height:0;
            "
          >
            &nbsp;
          </td>
        </tr>


        <!-- Content -->
        <tr>
          <td style="padding:42px 40px 36px 40px;">

            <!-- Eyebrow -->
            <div
              style="
                color:${BLUE};
                font-size:11px;
                font-weight:bold;
                letter-spacing:1.4px;
                text-transform:uppercase;
                margin-bottom:12px;
              "
            >
              ${eyebrow}
            </div>


            <!-- Title -->
            <h1
              style="
                margin:0 0 18px 0;
                color:${NAVY};
                font-size:30px;
                line-height:1.2;
                letter-spacing:-0.7px;
                font-weight:700;
              "
            >
              ${title}
            </h1>


            <!-- Greeting -->
            <p
              style="
                margin:0 0 18px 0;
                font-size:15px;
                line-height:1.7;
                color:${TEXT};
              "
            >
              ${greeting}
            </p>


            <!-- Main content -->
            <div
              style="
                font-size:14px;
                line-height:1.75;
                color:${MUTED};
              "
            >
              ${content}
            </div>


            <!-- CTA -->
            <table
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="margin:30px 0;"
            >
              <tr>
                <td
                  align="center"
                  style="
                    border-radius:7px;
                    background:${BLUE};
                  "
                >
                  <a
                    href="${buttonUrl}"
                    target="_blank"
                    style="
                      display:inline-block;
                      padding:14px 26px;
                      color:#ffffff;
                      font-size:14px;
                      font-weight:bold;
                      text-decoration:none;
                      border-radius:7px;
                    "
                  >
                    ${buttonText}
                  </a>
                </td>
              </tr>
            </table>


            <!-- URL fallback -->
            <div
              style="
                padding:14px 16px;
                background:#F8FAFC;
                border:1px solid ${BORDER};
                border-radius:7px;
                font-size:11px;
                line-height:1.6;
                color:${MUTED};
                word-break:break-all;
              "
            >
              If the button doesn't work, copy and paste this link into your browser:<br />

              <a
                href="${buttonUrl}"
                style="
                  color:${BLUE};
                  text-decoration:none;
                "
              >
                ${buttonUrl}
              </a>
            </div>

          </td>
        </tr>


        <!-- Security notice -->
        <tr>
          <td
            style="
              padding:0 40px 34px 40px;
            "
          >

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                background:#F8FAFC;
                border:1px solid ${BORDER};
                border-radius:8px;
              "
            >
              <tr>
                <td style="padding:15px 17px;">

                  <div
                    style="
                      color:${NAVY};
                      font-size:12px;
                      font-weight:bold;
                      margin-bottom:5px;
                    "
                  >
                    Security notice
                  </div>

                  <div
                    style="
                      color:${MUTED};
                      font-size:11px;
                      line-height:1.6;
                    "
                  >
                    ${footerText}
                  </div>

                </td>
              </tr>
            </table>

          </td>
        </tr>


        <!-- Footer -->
        <tr>
          <td
            align="center"
            style="
              padding:24px 40px;
              border-top:1px solid ${BORDER};
              background:#FBFCFE;
            "
          >

            <div
              style="
                color:${NAVY};
                font-size:12px;
                font-weight:bold;
                margin-bottom:6px;
              "
            >
              ${BRAND_NAME}
            </div>

            <div
              style="
                color:#98A2B3;
                font-size:10px;
                line-height:1.6;
              "
            >
              This is an automated message. Please do not reply to this email.
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
`;
}


/*
 * PASSWORD SETUP EMAIL
 */
async function sendPasswordSetupEmail({
  email,
  name,
  setupToken
}) {
  const setupUrl =
    `${process.env.FRONTEND_URL}/setup-password?token=${encodeURIComponent(setupToken)}`;

  const expiry =
    process.env.PASSWORD_SETUP_TOKEN_EXPIRES_HOURS || 24;

  const html = emailLayout({
    eyebrow: "Account invitation",

    title: "Set up your account",

    greeting: `Hello ${name},`,

    content: `
      <p style="margin:0 0 12px 0;">
        Your account for ${BRAND_NAME} has been created.
        You're just one step away from getting started.
      </p>

      <p style="margin:0;">
        Create your password using the secure button below.
        Once completed, your account will be ready to use.
      </p>
    `,

    buttonText: "Set up my password",

    buttonUrl: setupUrl,

    footerText: `
      This password setup link will expire in
      <strong>${expiry} hours</strong>.
      If you were not expecting this invitation, you can safely ignore this email.
    `
  });

  await transporter.sendMail({
    from: `"${BRAND_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Quotation Portal account is ready",
    text: `
Hello ${name},

Your ${BRAND_NAME} account has been created.

Set up your password here:

${setupUrl}

This link expires in ${expiry} hours.

If you were not expecting this email, you can safely ignore it.

${BRAND_NAME}
    `.trim(),
    html
  });
}


/*
 * PASSWORD RESET EMAIL
 */
async function sendPasswordResetEmail({
  email,
  name,
  resetToken
}) {
  const resetUrl =
    `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const expiry =
    process.env.PASSWORD_RESET_TOKEN_EXPIRES_HOURS || 1;

  const html = emailLayout({
    eyebrow: "Password security",

    title: "Reset your password",

    greeting: `Hello ${name},`,

    content: `
      <p style="margin:0 0 12px 0;">
        We received a request to reset the password
        for your ${BRAND_NAME} account.
      </p>

      <p style="margin:0;">
        If you made this request, use the button below
        to create a new password.
      </p>
    `,

    buttonText: "Reset my password",

    buttonUrl: resetUrl,

    footerText: `
      This password reset link will expire in
      <strong>${expiry} hour</strong>.
      If you did not request a password reset,
      no action is required and your account remains secure.
    `
  });

  await transporter.sendMail({
    from: `"${BRAND_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your Quotation Portal password",
    text: `
Hello ${name},

We received a request to reset your ${BRAND_NAME} password.

Reset your password here:

${resetUrl}

This link expires in ${expiry} hour.

If you did not request this, you can safely ignore this email.

${BRAND_NAME}
    `.trim(),
    html
  });
}


module.exports = {
  sendPasswordSetupEmail,
  sendPasswordResetEmail
};

