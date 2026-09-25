/**
 * 楽天・Yahoo!・eBay のキーの保管。
 *  - 値は OS の暗号化保管（Electron の safeStorage: Mac はキーチェーン、Windows は DPAPI）で暗号化してファイルに保存する。
 *  - 画面側（renderer）へは「設定済みかどうか」だけを返し、キーの値そのものは渡さない。
 *  - 自動テスト（E2E_FAKE_UPSTREAM=1 かつ E2E_PLAIN_KEYSTORE=1）のときだけ、キーチェーンを使わずに保存する。
 */
import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { KeyInput, KeySite, KeyStatus } from '../src/lib/desktopBridge';
import { DESKTOP_RAKUTEN_ALLOWED_ORIGIN } from '../src/lib/desktopConfig';

type Secrets = {
  rakutenAppId?: string;
  rakutenAccessKey?: string;
  yahooClientId?: string;
  ebayClientId?: string;
  ebayClientSecret?: string;
};

type Settings = {
  rakutenAllowedOrigin?: string;
  rakutenExpiresOn?: string;
};

type FileShape = { version: 1; encrypted: boolean; secrets: string; settings: Settings };

const MAX_KEY_LENGTH = 200;

function plainForTests(): boolean {
  return process.env.E2E_FAKE_UPSTREAM === '1' && process.env.E2E_PLAIN_KEYSTORE === '1';
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/[\u0000-\u001f\u007f\s]/g, '').slice(0, MAX_KEY_LENGTH);
  return trimmed || undefined;
}

function cleanOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function cleanDate(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export class KeyStore {
  private secrets: Secrets = {};
  private settings: Settings = {};
  private loaded = false;

  private get file(): string {
    return path.join(app.getPath('userData'), 'keys.json');
  }

  private canEncrypt(): boolean {
    return !plainForTests() && safeStorage.isEncryptionAvailable();
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf-8')) as FileShape;
      this.settings = data.settings ?? {};
      const raw = data.encrypted
        ? safeStorage.decryptString(Buffer.from(data.secrets, 'base64'))
        : Buffer.from(data.secrets, 'base64').toString('utf-8');
      this.secrets = JSON.parse(raw) as Secrets;
    } catch {
      // 初回・壊れたファイル・別のPCから持ってきたファイルは、未設定として扱う
      this.secrets = {};
    }
  }

  private persist(): void {
    const json = JSON.stringify(this.secrets);
    const encrypted = this.canEncrypt();
    if (!encrypted && !plainForTests()) {
      // 暗号化できない環境ではディスクに書かない（この起動中だけ使う）
      return;
    }
    const secrets = encrypted ? safeStorage.encryptString(json).toString('base64') : Buffer.from(json).toString('base64');
    const data: FileShape = { version: 1, encrypted, secrets, settings: this.settings };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data), { mode: 0o600 });
  }

  status(): KeyStatus {
    this.load();
    return {
      rakuten: {
        configured: Boolean(this.secrets.rakutenAppId && this.secrets.rakutenAccessKey),
        allowedOrigin: this.settings.rakutenAllowedOrigin ?? DESKTOP_RAKUTEN_ALLOWED_ORIGIN,
        ...(this.settings.rakutenExpiresOn ? { expiresOn: this.settings.rakutenExpiresOn } : {}),
      },
      yahoo: { configured: Boolean(this.secrets.yahooClientId) },
      ebay: { configured: Boolean(this.secrets.ebayClientId && this.secrets.ebayClientSecret) },
      // 自動テストの平文保存も「保存できる」扱い（案内文を実際の利用時と同じにする）
      encrypted: this.canEncrypt() || plainForTests(),
    };
  }

  save(input: KeyInput): KeyStatus {
    this.load();
    if (input.rakuten) {
      const appId = clean(input.rakuten.appId);
      const accessKey = clean(input.rakuten.accessKey);
      if (appId && accessKey) Object.assign(this.secrets, { rakutenAppId: appId, rakutenAccessKey: accessKey });
      const origin = cleanOrigin(input.rakuten.allowedOrigin);
      if (origin) this.settings.rakutenAllowedOrigin = origin;
      const expires = cleanDate(input.rakuten.expiresOn);
      if (expires) this.settings.rakutenExpiresOn = expires;
    }
    if (input.yahoo) {
      const clientId = clean(input.yahoo.clientId);
      if (clientId) this.secrets.yahooClientId = clientId;
    }
    if (input.ebay) {
      const clientId = clean(input.ebay.clientId);
      const clientSecret = clean(input.ebay.clientSecret);
      if (clientId && clientSecret) Object.assign(this.secrets, { ebayClientId: clientId, ebayClientSecret: clientSecret });
    }
    this.persist();
    return this.status();
  }

  clear(site: KeySite): KeyStatus {
    this.load();
    if (site === 'rakuten') {
      delete this.secrets.rakutenAppId;
      delete this.secrets.rakutenAccessKey;
      delete this.settings.rakutenExpiresOn;
    }
    if (site === 'yahoo') delete this.secrets.yahooClientId;
    if (site === 'ebay') {
      delete this.secrets.ebayClientId;
      delete this.secrets.ebayClientSecret;
    }
    this.persist();
    return this.status();
  }

  /** worker.ts（/api/* の処理）に渡す環境変数。自動テストのときだけ偽サーバーへの差し替えを足す。 */
  workerEnv(): Record<string, string | undefined> {
    this.load();
    const env: Record<string, string | undefined> = {
      SERVER_RAKUTEN_APP_ID: this.secrets.rakutenAppId,
      SERVER_RAKUTEN_ACCESS_KEY: this.secrets.rakutenAccessKey,
      SERVER_RAKUTEN_ALLOWED_ORIGIN: this.settings.rakutenAllowedOrigin ?? DESKTOP_RAKUTEN_ALLOWED_ORIGIN,
      SERVER_YAHOO_CLIENT_ID: this.secrets.yahooClientId,
      SERVER_EBAY_CLIENT_ID: this.secrets.ebayClientId,
      SERVER_EBAY_CLIENT_SECRET: this.secrets.ebayClientSecret,
    };
    if (process.env.E2E_FAKE_UPSTREAM === '1') {
      for (const name of ['E2E_FAKE_UPSTREAM', 'RAKUTEN_API_BASE_OVERRIDE', 'YAHOO_API_BASE_OVERRIDE', 'EBAY_API_BASE_OVERRIDE', 'EBAY_OAUTH_URL_OVERRIDE']) {
        env[name] = process.env[name];
      }
    }
    return env;
  }
}
