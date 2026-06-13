const net = require("net");
const tls = require("tls");

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function encodeBase64(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

function sanitizeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function messageId() {
  const host = (process.env.SUPPORT_FROM_EMAIL || "budgethubfamily.local").split("@")[1] || "budgethubfamily.local";
  return `<${Date.now()}.${Math.random().toString(16).slice(2)}@${host}>`;
}

function buildMessage({ from, to, subject, text }) {
  const safeFrom = sanitizeHeader(from);
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
  return [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `Message-ID: ${messageId()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    String(text || "")
  ].join("\r\n");
}

function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket, line, expected) {
  socket.write(`${line}\r\n`);
  const response = await readLine(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${line} -> ${response.trim()}`);
  }
  return response;
}

function connectSmtp() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(15000);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP connection timeout")));
  });
}

async function sendEmail({ to, subject, text }) {
  const from = process.env.SUPPORT_FROM_EMAIL || process.env.SMTP_USER;
  if (!to || !from) {
    console.warn("[email] Missing recipient or SUPPORT_FROM_EMAIL.");
    return { sent: false, skipped: true };
  }

  if (!smtpConfigured()) {
    console.warn(`[email] SMTP not configured. Would send "${subject}" to ${to}.`);
    return { sent: false, skipped: true };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const socket = await connectSmtp();
  try {
    await readLine(socket);
    await command(socket, `EHLO ${host}`, [250]);
    if (String(process.env.SMTP_SECURE || "").toLowerCase() !== "true" && port !== 465) {
      await command(socket, "STARTTLS", [220]);
      const secureSocket = tls.connect({ socket, servername: host });
      await new Promise((resolve) => secureSocket.once("secureConnect", resolve));
      await command(secureSocket, `EHLO ${host}`, [250]);
      await command(secureSocket, "AUTH LOGIN", [334]);
      await command(secureSocket, encodeBase64(process.env.SMTP_USER), [334]);
      await command(secureSocket, encodeBase64(process.env.SMTP_PASS), [235]);
      await command(secureSocket, `MAIL FROM:<${from}>`, [250]);
      await command(secureSocket, `RCPT TO:<${to}>`, [250, 251]);
      await command(secureSocket, "DATA", [354]);
      secureSocket.write(`${buildMessage({ from, to, subject, text })}\r\n.\r\n`);
      await readLine(secureSocket);
      await command(secureSocket, "QUIT", [221]);
      secureSocket.end();
      return { sent: true };
    }

    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, encodeBase64(process.env.SMTP_USER), [334]);
    await command(socket, encodeBase64(process.env.SMTP_PASS), [235]);
    await command(socket, `MAIL FROM:<${from}>`, [250]);
    await command(socket, `RCPT TO:<${to}>`, [250, 251]);
    await command(socket, "DATA", [354]);
    socket.write(`${buildMessage({ from, to, subject, text })}\r\n.\r\n`);
    await readLine(socket);
    await command(socket, "QUIT", [221]);
    return { sent: true };
  } finally {
    socket.end();
  }
}

module.exports = {
  sendEmail
};
