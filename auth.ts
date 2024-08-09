import { generateLoginCode, validateLoginCode } from './db';
import { sendEmail } from './email';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRATION = '1h';

export class AuthManager {
  async sendLoginCode(email: string) {
    const code = generateLoginCode(email);
    await sendEmail({
      to: email,
      from: 'codes@lexer.cc',
      subject: 'Lexer Auth Code',
      text: 'Your authorization code is: ' + code,
      html: 'Your authorization code is: ' + code,
    });
    return true;
  }

  verifyLoginCode(email: string, code: string): boolean {
    return validateLoginCode(email, code);
  }

  issueToken(email: string): string {
    return jwt.sign({ email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  }

  verifyToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
      return decoded.email;
    } catch (error) {
      return null;
    }
  }
}
