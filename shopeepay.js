const axios = require("axios");
const crypto = require("crypto");

class ShopeePayClient {
  constructor(config = {}) {
    this.shopeeToken = config.shopeeToken || "";
    this.qrisStatic = config.qrisStatic || "";
    
    this.userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
      "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ];

    this.statusMap = {
      1: "pending",
      2: "failed",
      3: "success",
      4: "refunded",
      5: "expired",
    };

    this.jar = this.createCookieJar();
    this.host = {
      account: 'https://partner.business.accounts.shopee.co.id',
      partner: 'https://partner.shopee.co.id',
      partnerApi: 'https://api.partner.shopee.co.id',
      pay: 'https://shopeepay.shopee.co.id'
    };
    this.payBase = this.host.pay + '/merchant/v1/partner-web';
    this.riskReportUrl = 'https://df.infra.sz.shopee.co.id/v2/shpsec/web/report';
    this.accountClientId = '5';
    this.businessClientId = '1';
    this.otpOperation = 50001;
    this.otpChannels = [1, 2, 3, 5];
    this.merchantTokenCookie = '__shopee_partner_website_x_token_live';
    this.needOtp = 48401102;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0';
    this.browser = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site'
    };
    this.endpoints = {
      checkPasswordMigration: '/api/v4/account/business/check_password_migrate',
      authenticateByPassword: '/api/v4/account/business/authenticate_toc_by_password',
      otpSettings: '/api/v4/account/business/get_otp_settings',
      sendOtp: '/api/v4/account/business/send_otp',
      verifyOtp: '/api/v4/account/business/verify_otp',
      authenticateByOtp: '/api/v4/account/business/authenticate_toc_by_otp',
      loginToc: '/api/v4/account/business/login_toc',
      loginStatus: '/api/v4/account/business/login_status',
      accountLogin: '/account/login/auth',
      accountLoginToken: '/authenticate/login/token/',
      accountTobAuth: '/account/login/tob/auth',
      merchantDetect: '/nb/mss/mer-detect-api/PartnerMerchantDetectServer/MerchantDetect'
    };
    this.SHOPEE_DEVICE_RISK_BLOB = "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";
  }

  randomUA() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getStatusText(statusCode) {
    return this.statusMap[statusCode] || `unknown_${statusCode}`;
  }

  formatTransaction(t) {
    const date = new Date(t.createTime * 1000);
    const offset = 7 * 60;
    const wibTime = new Date(date.getTime() + offset * 60 * 1000);

    const pad = (n) => String(n).padStart(2, "0");
    const formattedTime = `${wibTime.getUTCFullYear()}-${pad(wibTime.getUTCMonth() + 1)}-${pad(wibTime.getUTCDate())} ${pad(wibTime.getUTCHours())}:${pad(wibTime.getUTCMinutes())}:${pad(wibTime.getUTCSeconds())}`;

    let cleanAmount = String(t.amount || "0").replace(/\./g, "").replace(/,/g, "");
    const amount = parseInt(cleanAmount, 10) || 0;

    return {
      amount,
      status: this.getStatusText(t.status),
      time: formattedTime,
    };
  }

  parseTLV(data) {
    const result = [];
    let i = 0;
    while (i < data.length) {
      if (i + 4 > data.length) break;
      const tag = data.slice(i, i + 2);
      const length = parseInt(data.slice(i + 2, i + 4), 10);
      if (isNaN(length)) break;
      i += 4;
      if (i + length > data.length) break;
      const value = data.slice(i, i + length);
      i += length;
      result.push([tag, value]);
    }
    return result;
  }

  buildTLV(fields) {
    let res = "";
    for (const f of fields) {
      const tag = f[0];
      const val = f[1];
      res += tag + String(val.length).padStart(2, "0") + val;
    }
    return res;
  }

  crc16CCITT(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  generateDynamicQRIS(amount) {
    if (!this.qrisStatic) {
      throw new Error("QRIS_STATIC belum diset");
    }

    const fields = this.parseTLV(this.qrisStatic);
    if (fields.length === 0) {
      throw new Error("Invalid QRIS format");
    }

    const newFields = [];
    let hasAmount = false;
    for (const f of fields) {
      if (f[0] === "63") continue;
      if (f[0] === "54") {
        newFields.push(["54", String(amount)]);
        hasAmount = true;
        continue;
      }
      newFields.push(f);
    }

    if (!hasAmount) {
      const withAmount = [];
      for (const f of newFields) {
        withAmount.push(f);
        if (f[0] === "53") {
          withAmount.push(["54", String(amount)]);
        }
      }
      newFields.length = 0;
      newFields.push(...withAmount);
    }

    let qrisWithoutCRC = this.buildTLV(newFields);
    qrisWithoutCRC += "6304";
    const crc = this.crc16CCITT(qrisWithoutCRC);
    return qrisWithoutCRC + crc;
  }

  createCookieJar() {
    const cookies = new Map();
    return {
      store: (url, headers) => {
        const cookieHeader = headers['set-cookie'] || headers['Set-Cookie'] || [];
        const list = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
        const domainFrom = new URL(url).hostname;
        for (const raw of list) {
          if (!raw) continue;
          const parts = String(raw).split(';');
          const first = parts[0].split('=');
          const name = first[0].trim();
          if (!name) continue;
          const value = first.slice(1).join('=').trim();
          const attrs = {};
          for (let i = 1; i < parts.length; i++) {
            const pair = parts[i].trim().split('=');
            attrs[pair[0].toLowerCase()] = pair[1] === undefined ? '' : pair[1];
          }
          const domain = (attrs.domain || domainFrom).replace(/^\./, '');
          cookies.set(domain + ':' + name, { name: name, value: value, domain: domain });
        }
      },
      read: (name, url) => {
        const domain = new URL(url).hostname;
        for (const cookie of cookies.values()) {
          if (cookie.name === name && (domain === cookie.domain || domain.endsWith('.' + cookie.domain))) return cookie.value;
        }
        return null;
      },
      header: (url) => {
        const domain = new URL(url).hostname;
        const parts = [];
        for (const cookie of cookies.values()) {
          if (domain === cookie.domain || domain.endsWith('.' + cookie.domain)) parts.push(cookie.name + '=' + cookie.value);
        }
        return parts.join('; ');
      },
      snapshot: () => {
        const out = [];
        for (const [key, cookie] of cookies) out.push({ key: key, ...cookie });
        return out;
      },
      restore: (list) => {
        cookies.clear();
        if (Array.isArray(list)) for (const cookie of list) cookies.set(cookie.key, cookie);
      }
    };
  }

  hashPassword(password) {
    const md5 = crypto.createHash('md5').update(String(password)).digest('hex').toLowerCase();
    return crypto.createHash('sha256').update(md5).digest('hex');
  }

  uuid() { return crypto.randomUUID(); }

  partnerStateUrl() {
    const next = encodeURIComponent(this.host.partner + '/login/auth');
    const state = encodeURIComponent(this.host.partner);
    return this.host.partner + '/?business_next=' + next + '&business_state=' + state + '&business_client_id=' + this.businessClientId;
  }

  loginReferer() {
    const state = encodeURIComponent(this.partnerStateUrl());
    return this.host.account + '/authenticate/login/?lang=id&should_hide_back=true&state=' + state +
      '&client_id=' + this.accountClientId + '&next=' + encodeURIComponent(this.host.partner + '/account/login/auth');
  }

  normalizePhone(phone) {
    return '62' + String(phone).replace(/\D/g, '').replace(/^62/, '').replace(/^0/, '');
  }

  formatPhoneForOtp(e164) {
    const subscriber = e164.replace(/^62/, '');
    const groups = [subscriber.slice(0, 3), subscriber.slice(3, 7), subscriber.slice(7)].filter(Boolean);
    return '(+62) ' + groups.join(' ');
  }

  async request(url, opts = {}) {
    const target = new URL(url);
    if (opts.query) {
      for (const key of Object.keys(opts.query)) target.searchParams.set(key, opts.query[key]);
    }
    const headers = Object.assign({}, this.browser, opts.headers || {});
    const cookie = this.jar.header(target.toString());
    if (cookie) headers.Cookie = cookie;
    if (opts.body !== undefined && !opts.html && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (opts.html) headers.Accept = 'text/html';
    
    const config = {
      method: opts.method || 'POST',
      url: target.toString(),
      headers: headers,
      timeout: 60000,
      maxRedirects: 0,
      validateStatus: false
    };
    if (opts.body !== undefined && !opts.html) {
      config.data = opts.body;
    }
    const res = await axios(config);
    this.jar.store(target.toString(), res.headers);
    return res;
  }

  async followGet(url, max = 10) {
    let current = url;
    for (let i = 0; i < max; i++) {
      const res = await this.request(current, { method: 'GET', html: true });
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        current = new URL(res.headers.location, current).toString();
        continue;
      }
      return current;
    }
    return current;
  }

  async accountCall(body, options = {}) {
    const csrf = this.jar.read('csrftoken', this.host.account);
    const headers = {
      Origin: this.host.account,
      Referer: this.loginReferer(),
      'X-App-Type': '2',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };
    if (options.riskToken) {
      headers['af-ac-enc-sz-token'] = options.riskToken;
      headers['x-sz-sdk-version'] = '1.12.26-user.1';
    }
    if (csrf) headers['X-CSRFToken'] = csrf;
    const res = await this.request(this.host.account + options.path, { headers, body });
    const json = res.data;
    if (!json || json.error !== 0) {
      const message = json && json.error_msg ? json.error_msg : ('Shopee auth error ' + (json ? json.error : res.status));
      const err = new Error(message);
      err.code = json ? json.error : undefined;
      if (json && json.error_msg && /captcha/i.test(json.error_msg)) err.name = 'CaptchaRequired';
      throw err;
    }
    return json.data;
  }

  async bootstrapSession() {
    await this.request(this.host.account + '/login', { method: 'GET', query: { lang: 'id' }, html: true });
  }

  async getRiskToken(deviceReport = this.SHOPEE_DEVICE_RISK_BLOB) {
    const headers = Object.assign({}, this.browser, {
      Origin: this.host.account,
      Referer: this.host.account + '/',
      'Content-Type': 'text/plain;charset=UTF-8',
      szdet: String(Date.now())
    });
    const res = await axios.post(this.riskReportUrl, deviceReport, {
      headers: headers,
      timeout: 60000,
      maxRedirects: 0
    });
    const json = res.data;
    if (!json || json.code !== 0 || !json.data || !json.data.riskToken) {
      const err = new Error('Shopee device-risk service returned no risk token');
      err.code = 'DEVICE_RISK';
      throw err;
    }
    return json.data.riskToken;
  }

  async requestOtp(phone, opts = {}) {
    const e164 = this.normalizePhone(phone);
    this.jar.restore([]);
    await this.bootstrapSession();
    const riskToken = await this.getRiskToken(opts.deviceReport);

    await this.accountCall({ phone: e164 }, { path: this.endpoints.checkPasswordMigration, riskToken: riskToken });
    let hasPassword = false;
    try {
      const auth = await this.accountCall({
        phone: e164,
        password: opts.password ? this.hashPassword(opts.password) : '',
        security_device_fingerprint: riskToken
      }, { path: this.endpoints.authenticateByPassword, riskToken: riskToken });
      hasPassword = !!(auth && auth.toc_account && auth.toc_account.has_password);
    } catch (err) {
      if (err.code === this.needOtp) {
        if (!opts.password) {
          const missing = new Error('This Shopee account is password-protected; supply the password to receive an OTP');
          missing.code = 'PASSWORD_REQUIRED';
          throw missing;
        }
        hasPassword = true;
      } else if (err.code === 48401004) {
        const wrong = new Error('Password akun Shopee salah.');
        wrong.code = 'INVALID_PASSWORD';
        throw wrong;
      } else if (err.code === 10002 && !opts.password) {
        const missing = new Error('Akun ini butuh password. Masukkan password dan coba lagi.');
        missing.code = 'PASSWORD_REQUIRED';
        throw missing;
      } else {
        throw err;
      }
    }
    if (hasPassword && !opts.password) {
      const missing = new Error('This Shopee account is password-protected; supply the password to receive an OTP');
      missing.code = 'PASSWORD_REQUIRED';
      throw missing;
    }

    const settings = await this.accountCall({
      operation: this.otpOperation,
      phone: e164,
      security_device_fingerprint: riskToken,
      support_session: false,
      supported_channels: this.otpChannels
    }, { path: this.endpoints.otpSettings, riskToken: riskToken });
    const available = (settings.available_channel_list || []).map(Number);
    const channel = opts.channel !== undefined ? opts.channel : (settings.default_channel !== undefined ? Number(settings.default_channel) : 3);
    if (available.length && available.indexOf(channel) === -1) {
      const err = new Error('Requested Shopee OTP channel is unavailable');
      err.code = 'CHANNEL_UNAVAILABLE';
      err.available = available;
      throw err;
    }

    await this.accountCall({
      operation: this.otpOperation,
      phone: e164,
      security_device_fingerprint: riskToken,
      support_session: false,
      supported_channels: this.otpChannels,
      channel: channel,
      captcha_signature: ''
    }, { path: this.endpoints.sendOtp, riskToken: riskToken });

    return {
      version: 1,
      phone: e164,
      channel: channel,
      availableChannels: available,
      deviceFingerprint: riskToken,
      riskToken: riskToken,
      hasPassword: hasPassword,
      id: this.uuid(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      cookies: this.jar.snapshot()
    };
  }

  async verifyOtp(challenge, otp) {
    if (!/^\d{4,10}$/.test(String(otp))) throw new Error('OTP harus 4-10 digit');
    this.jar.restore(challenge.cookies);
    const verified = await this.accountCall({
      operation: this.otpOperation,
      otp: String(otp),
      phone: this.formatPhoneForOtp(challenge.phone),
      security_device_fingerprint: challenge.deviceFingerprint,
      support_session: false
    }, { path: this.endpoints.verifyOtp, riskToken: challenge.riskToken });
    if (!verified.otp_token) throw new Error('Verifikasi OTP gagal');

    const authenticated = await this.accountCall({
      otp_token: verified.otp_token,
      security_device_fingerprint: challenge.deviceFingerprint,
      is_signup: false
    }, { path: this.endpoints.authenticateByOtp, riskToken: challenge.riskToken });
    const tocNonce = authenticated.toc_nonce;
    const tocUserId = authenticated.toc_account && authenticated.toc_account.userid;
    if (!tocNonce || typeof tocUserId !== 'number') throw new Error('Sesi akun Shopee tidak lengkap');
    const spcClientId = this.jar.read('SPC_CLIENTID', this.host.account);
    if (!spcClientId) throw new Error('Shopee tidak mengembalikan session id');

    const loginUrl = this.host.partner + this.endpoints.accountLogin + '?' + new URLSearchParams({
      lang: 'id',
      spc_clientid: spcClientId,
      state: this.partnerStateUrl(),
      toc_nonce: tocNonce
    }).toString();
    await this.followGet(loginUrl);

    const detectRes = await this.request(this.host.partnerApi + this.endpoints.merchantDetect, {
      headers: {
        Origin: this.host.partner,
        Referer: this.host.partner + '/',
        'X-Merchant-ToB-Clientid': 'undefined',
        'X-Merchant-Login-From': '12',
        'X-Merchant-From': '12',
        'X-Merchant-Language': 'id',
        'X-Merchant-Timezone': 'Asia/Jakarta',
        'X-Merchant-RequestId': this.uuid(),
        'X-Merchant-Token': '',
        'shopee-baggage': 'PFB=undefined',
        'X-Merchant-ToC-Nonce': tocNonce
      },
      body: {}
    });
    const detect = detectRes.data;
    if (!detect || detect.errorCode !== 0) throw new Error('Merchant detect gagal: ' + (detect && detect.errorMsg ? detect.errorMsg : 'no data'));
    const rawList = detect.data && detect.data.selectMerchant && detect.data.selectMerchant.merchantList ? detect.data.selectMerchant.merchantList : [];
    const merchants = rawList
      .map((item) => ({
        id: item.merchantId,
        name: item.merchantName,
        status: item.merchantStatus,
        staffUserId: item.staffTobUid,
        isActive: item.isActive,
        isBanned: item.isBanned
      }))
      .filter((item) => item.id && item.staffUserId);
    if (!merchants.length) throw new Error('Akun Shopee tidak punya merchant yang dapat dipakai');

    return {
      version: 1,
      tocNonce: tocNonce,
      tocUserId: tocUserId,
      spcClientId: spcClientId,
      deviceFingerprint: challenge.deviceFingerprint,
      riskToken: challenge.riskToken,
      merchants: merchants,
      cookies: this.jar.snapshot(),
      verifiedAt: Date.now()
    };
  }

  async completeLogin(verification, opts = {}) {
    this.jar.restore(verification.cookies);
    let merchant = null;
    if (opts.merchantId) {
      merchant = verification.merchants.find((item) => String(item.id) === String(opts.merchantId)) || null;
    }
    if (!merchant) merchant = verification.merchants[0];
    if (!merchant) throw new Error('Merchant Shopee tidak ditemukan');
    if (merchant.isBanned || merchant.isActive === false) throw new Error('Merchant Shopee tidak aktif');

    const tokenUrl = this.host.account + this.endpoints.accountLoginToken + '?' + new URLSearchParams({
      lang: 'id',
      spc_clientid: verification.spcClientId,
      state: this.partnerStateUrl(),
      tob_userid: String(merchant.staffUserId),
      next: this.host.partner + this.endpoints.accountTobAuth,
      client_id: this.accountClientId,
      toc_nonce: verification.tocNonce
    }).toString();
    await this.followGet(tokenUrl);

    const login = await this.accountCall({
      toc_nonce: verification.tocNonce,
      tob_userid: merchant.staffUserId,
      security_device_fingerprint: verification.deviceFingerprint
    }, { path: this.endpoints.loginToc, riskToken: verification.riskToken });
    if (!login.nonce) throw new Error('Login merchant Shopee tidak mengembalikan authorization code');

    const exchangeUrl = this.host.partner + this.endpoints.accountTobAuth + '?' + new URLSearchParams({
      code: login.nonce,
      lang: 'id',
      spc_clientid: verification.spcClientId,
      state: this.partnerStateUrl()
    }).toString();
    await this.followGet(exchangeUrl);

    const jwt = this.jar.read(this.merchantTokenCookie, this.host.partner);
    if (!jwt) throw new Error('Login Shopee tidak mengembalikan token merchant');
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    const token = payload.token;
    if (!token) throw new Error('Token merchant Shopee kosong');

    return {
      token: token,
      accountId: String(payload.userid !== undefined && payload.userid !== null ? payload.userid : merchant.staffUserId),
      merchantId: merchant.id,
      merchantName: merchant.name,
      session: this.jar.snapshot(),
      verifiedAt: Date.now()
    };
  }

  async getToken(phone, password) {
    try {
      const challenge = await this.requestOtp(phone, { password });
      return { success: false, otp_sent: true, challenge };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  }

  async verifyAndGetToken(challenge, otp) {
    try {
      const verification = await this.verifyOtp(challenge, otp);
      const session = await this.completeLogin(verification, {
        merchantId: verification.merchants[0].id
      });
      return { success: true, token: session.token };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async callShopeeAPI(startTime, endTime, pageSize, nextPos, token = this.shopeeToken) {
    const payload = {
      data: {
        metadata: {
          token: token,
          language: "id",
          timezone: "Asia/Jakarta",
        },
        pageSize: pageSize,
        filter: {
          startTime: startTime,
          endTime: endTime,
          serviceList: [1, 3],
        },
        sorter: {
          field: "createTime",
          order: "descend",
        },
        next_position: nextPos || "",
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Origin: "https://partner.shopee.co.id",
      Referer: "https://partner.shopee.co.id/",
      "User-Agent": this.randomUA(),
      "X-Timestamp-Ms": String(Date.now()),
    };

    const response = await axios.post(
      "https://shopeepay.shopee.co.id/merchant/v1/partner-web/get-transaction-list",
      payload,
      { headers, timeout: 20000 }
    );

    return response.data;
  }

  async callShopeeDetailAPI(orderSN, token = this.shopeeToken) {
    const payload = {
      data: {
        metadata: {
          token: token,
          language: "id",
          timezone: "Asia/Jakarta",
        },
        order_sn: orderSN,
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Origin: "https://partner.shopee.co.id",
      Referer: "https://partner.shopee.co.id/",
      "User-Agent": this.randomUA(),
      "X-Timestamp-Ms": String(Date.now()),
    };

    const response = await axios.post(
      "https://shopeepay.shopee.co.id/merchant/v1/partner-web/get-transaction-detail",
      payload,
      { headers, timeout: 20000 }
    );

    return response.data;
  }

  async getTransactions(startTime, endTime, pageSize = 10, nextPos = "", token = this.shopeeToken) {
    const now = Math.floor(Date.now() / 1000);
    
    if (!startTime || startTime === 0) {
      startTime = now - 3 * 24 * 3600;
    }
    if (!endTime || endTime === 0) {
      endTime = now;
    }

    const result = await this.callShopeeAPI(startTime, endTime, pageSize, nextPos, token);
    
    if (!result) {
      throw new Error("Empty response from ShopeePay API");
    }
    if (result.code !== 0) {
      throw new Error(result.msg || `API error code ${result.code}`);
    }

    const list = (result.data && result.data.list) || [];
    const formatted = [];

    for (const t of list) {
      const trx = this.formatTransaction(t);
      try {
        const detail = await this.callShopeeDetailAPI(t.displayTransactionId || t.transactionId, token);
        if (detail && detail.code === 0 && detail.data) {
          trx.issuer = detail.data.issuer;
        }
      } catch (err) {}
      formatted.push(trx);
    }

    return {
      total_amount: (result.data && result.data.totalNetSales) || "0",
      transactions: formatted,
      next_position: result.data && result.data.next_position,
    };
  }

  async getAllTransactions(token = this.shopeeToken) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 7 * 60 * 60 * 1000);
    const startTime = Math.floor(startOfMonth.getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);

    const allTrx = [];
    let nextPos = "";
    const pageSize = 100;

    while (true) {
      const result = await this.callShopeeAPI(startTime, endTime, pageSize, nextPos, token);
      
      if (!result) {
        throw new Error("Empty response from ShopeePay API");
      }
      if (result.code !== 0) {
        throw new Error(result.msg || `API error code ${result.code}`);
      }

      const list = (result.data && result.data.list) || [];
      for (const t of list) {
        const trx = this.formatTransaction(t);
        try {
          const detail = await this.callShopeeDetailAPI(t.displayTransactionId || t.transactionId, token);
          if (detail && detail.code === 0 && detail.data) {
            trx.issuer = detail.data.issuer;
          }
        } catch (err) {}
        allTrx.push(trx);
      }

      if (!result.data || !result.data.next_position || list.length < pageSize) {
        break;
      }
      nextPos = result.data.next_position;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const pad = (n) => String(n).padStart(2, "0");
    const startWIB = new Date(startOfMonth.getTime() + 7 * 60 * 60 * 1000);
    const endWIB = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const periodStr = `${startWIB.getUTCFullYear()}-${pad(startWIB.getUTCMonth() + 1)}-${pad(startWIB.getUTCDate())} s/d ${endWIB.getUTCFullYear()}-${pad(endWIB.getUTCMonth() + 1)}-${pad(endWIB.getUTCDate())}`;

    return {
      period: periodStr,
      total_count: allTrx.length,
      transactions: allTrx,
    };
  }

  async checkPayment(amount, startTime = null, token = this.shopeeToken) {
    if (!amount || amount <= 0) {
      throw new Error("Provide valid amount (positive integer)");
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    let startUnix = startTime;
    if (!startUnix || startUnix === 0) {
      startUnix = nowUnix - 30 * 60;
    }

    const result = await this.callShopeeAPI(startUnix, nowUnix, 50, "", token);
    
    if (!result) {
      throw new Error("Empty response from ShopeePay API");
    }
    if (result.code !== 0) {
      throw new Error(result.msg || `API error code ${result.code}`);
    }

    const list = (result.data && result.data.list) || [];
    const expectedAmount = Number(amount);

    const match = list.find((tx) => {
      const cleanAmount = String(tx.amount || "0").replace(/\./g, "").replace(/,/g, "");
      const txAmount = parseInt(cleanAmount, 10) || 0;
      return tx.status === 3 && txAmount === expectedAmount && tx.createTime >= startUnix;
    });

    if (!match) {
      return { paid: false };
    }

    const trx = this.formatTransaction(match);
    try {
      const detail = await this.callShopeeDetailAPI(match.displayTransactionId || match.transactionId, token);
      if (detail && detail.code === 0 && detail.data) {
        trx.issuer = detail.data.issuer;
      }
    } catch (err) {}

    return {
      paid: true,
      transaction: {
        transactionId: match.transactionId || match.displayTransactionId,
        amount: trx.amount,
        status: trx.status,
        time: trx.time,
        issuer: trx.issuer || "QRIS / ShopeePay"
      }
    };
  }

  setToken(token) {
    this.shopeeToken = token;
  }

  async checkToken() {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 3600;
    const endTime = now;

    try {
      const result = await this.callShopeeAPI(startTime, endTime, 1, "");
      if (!result || result.code !== 0) {
        return { valid: false, message: result ? result.msg : "Invalid response" };
      }
      return { valid: true, message: "Token is valid" };
    } catch (err) {
      return { valid: false, message: err.message };
    }
  }

  // ============================================================
  // ============== MUTASI (support storeId, start, end) =========
  // ============================================================

  /**
   * Ambil daftar transaksi (raw) dari ShopeePay API.
   * @param {string} token
   * @param {string|number} [storeId] - opsional, filter by store
   * @param {number|string} [startTime] - opsional, Unix timestamp (detik / ms)
   * @param {number|string} [endTime] - opsional, Unix timestamp (detik / ms)
   */
  async getTransactionList(token, storeId, startTime, endTime) {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Default: 1 bulan terakhir
    let start = Math.floor(oneMonthAgo.getTime() / 1000);
    let end = Math.floor(now.getTime() / 1000);

    // Override startTime kalau diisi
    if (startTime !== undefined && startTime !== null && String(startTime).trim() !== '') {
      let st = parseInt(startTime);
      if (!isNaN(st)) {
        if (st > 9999999999) st = Math.floor(st / 1000);
        start = st;
      }
    }

    // Override endTime kalau diisi
    if (endTime !== undefined && endTime !== null && String(endTime).trim() !== '') {
      let et = parseInt(endTime);
      if (!isNaN(et)) {
        if (et > 9999999999) et = Math.floor(et / 1000);
        end = et;
      }
    }

    if (start >= end) {
      throw new Error('start_time harus lebih kecil dari end_time');
    }

    // Filter dasar
    const filter = {
      startTime: start,
      endTime: end,
      serviceList: [1, 3]
    };

    // Tambahkan storeIdList kalau storeId diisi
    if (storeId !== undefined && storeId !== null && String(storeId).trim() !== '') {
      const sid = parseInt(storeId);
      if (!isNaN(sid)) {
        filter.storeIdList = [sid];
      }
    }

    const requestBody = {
      data: {
        metadata: {
          token,
          language: 'id',
          timezone: 'Asia/Jakarta'
        },
        pageSize: 30,
        filter,
        sorter: { field: 'createTime', order: 'descend' },
        next_position: ''
      }
    };

    const headers = {
      'User-Agent': this.randomUA(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Content-Type': 'application/json',
      'x-timestamp-ms': Date.now().toString(),
      'x-token': '',
      'origin': 'https://partner.shopee.co.id',
      'referer': 'https://partner.shopee.co.id/',
      'accept-language': 'en-US,en;q=0.9,id;q=0.8,ms;q=0.7',
      'priority': 'u=1, i'
    };

    const response = await axios.post(
      'https://shopeepay.shopee.co.id/merchant/v1/partner-web/get-transaction-list',
      requestBody,
      { headers, timeout: 20000 }
    );

    return response.data?.data || {};
  }

  /**
   * Ambil mutasi terformat.
   * @param {string} token
   * @param {string|number} [storeId]
   * @param {number|string} [startTime]
   * @param {number|string} [endTime]
   * @returns {Promise<Array<{id, amount, tanggal, time, status, issuer, reference}>>}
   */
  async getMutations(token, storeId, startTime, endTime) {
    try {
      if (!token) throw new Error('token wajib diisi');

      const transactionData = await this.getTransactionList(token, storeId, startTime, endTime);
      if (!transactionData?.list) {
        throw new Error('Token salah / expired');
      }

      return transactionData.list.map(tx => {
        const createTime = tx.createTime || tx.create_time || 0;
        const dateObj = new Date(createTime * 1000);
        return {
          id: tx.transactionId || tx.id || tx.transaction_id,
          amount: parseInt(String(tx.amount || '0').replace(/\./g, '')),
          tanggal: dateObj,
          time: dateObj,
          status: tx.status === 3 ? 'success' : 'pending',
          issuer: tx.merchantName || tx.merchant_name || '',
          reference: tx.externalTransactionId || tx.external_transaction_id || ''
        };
      });
    } catch (err) {
      console.error('ShopeePay get mutations error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error || err.message);
    }
  }
}

module.exports = ShopeePayClient;