import crypto from 'node:crypto';

/**
 * 主密钥只从环境变量 MASTER_KEY 读取（§10 安全要点）。
 * 支持两种形式：
 *  - 64 位 hex 字符串（32 字节，推荐：openssl rand -hex 32）
 *  - 任意字符串（用 sha256 派生为 32 字节密钥）
 */
function getMasterKey(): Buffer {
  const raw = process.env.MASTER_KEY;
  if (!raw) {
    throw new Error('环境变量 MASTER_KEY 未设置（生成：openssl rand -hex 32）');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

/**
 * AES-256-GCM 加密。
 * 输出格式：base64(iv) . base64(authTag) . base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/** AES-256-GCM 解密（encrypt 的逆操作）。 */
export function decrypt(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('密文格式非法');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMasterKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
