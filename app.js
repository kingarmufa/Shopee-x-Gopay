try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const path = require('path');
const FormData = require("form-data");
const axios = require('axios');
const crypto = require('crypto');

// Import modul GoPay & ShopeePay
const GoMerchant = require('./gopay');
const ShopeePayClient = require('./shopeepay');

const app = express();
const sdk = new GoMerchant();

app.set('json spaces', 2);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== MIDDLEWARE API KEY ====================
const VALID_API_KEYS = (process.env.API_KEYS || 'syahxpiantech').split(',').map(k => k.trim()).filter(Boolean);

function validateApiKey(req, res, next) {
    const apikey = req.query.apikey || '';
    if (!VALID_API_KEYS.includes(apikey)) {
        return res.status(403).json({ success: false, error: 'API Key tidak valid' });
    }
    next();
}

// ==================== ROUTE UTAMA ====================
app.get('/', (req, res) => res.render('index'));

// ==================== ROUTE DINAMIS QRIS ====================
// Query: apikey, amount (wajib), static_qr (wajib)
async function createDinamis(req, res) {
    try {
        const { amount, static_qr } = req.query;
        if (!amount || !static_qr) return res.status(400).json({ success: false, error: 'amount dan static_qr wajib diisi' });
        const data = await sdk.createDynamicQRIS(amount, static_qr);
        const qrBuffer = Buffer.isBuffer(data.qr_buffer) ? data.qr_buffer : Buffer.from(data.qr_buffer.data);
        res.json({
            success: true,
            amount: data.amount,
            qr_string: data.qr_string,
            qr_buffer: qrBuffer.toString('base64'),
            created_at: data.created_at
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
}

app.get('/api/dinamis', validateApiKey, createDinamis);

// Alias lama (tidak ditampilkan di dokumentasi, supaya integrasi lama tidak putus)
app.get('/api/gopay/create-qris', validateApiKey, createDinamis);
app.get('/api/shopeepay/create-payment', validateApiKey, createDinamis);

// ==================== ROUTE GOPAY ====================
app.get('/api/gopay/get-otp', validateApiKey, async (req, res) => {
    try {
        const { email, phone } = req.query;
        if (email) {
            const data = await sdk.requestOtpEmail(email);
            return res.json({ success: true, data: { otp_token: data.data.otp_token, message: "Kode OTP Berhasil Dikirim ke Email" } });
        }
        let phoneNumber = phone;
        if (!phoneNumber) return res.status(400).json({ success: false, error: 'email atau phone wajib diisi' });
        if (phoneNumber.startsWith("62")) phoneNumber = phoneNumber.slice(2);
        const data = await sdk.requestOtp(phoneNumber);
        res.json({ success: true, data: { otp_token: data.data.otp_token, message: "Kode OTP Berhasil Dikirim Via SMS" } });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

app.get('/api/gopay/verify-otp', validateApiKey, async (req, res) => {
    try {
        const { otp, otp_token } = req.query;
        if (!otp || !otp_token) return res.status(400).json({ success: false, error: 'otp dan otp_token wajib diisi' });
        const data = await sdk.verifyOtp(otp, otp_token);
        res.json({ success: true, data });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

app.get('/api/gopay/refresh-token', validateApiKey, async (req, res) => {
    try {
        const refreshToken = req.query.refresh_token;
        if (!refreshToken) return res.status(400).json({ success: false, error: 'refresh_token wajib diisi' });
        const data = await sdk.refreshToken(refreshToken);
        res.json({ success: true, data });
    } catch (e) {
        res.status(401).json({ success: false, error: e.response?.data || e.message });
    }
});

app.get('/api/gopay/mutasi-qris', validateApiKey, async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ success: false, error: 'token wajib diisi' });
        const user = await sdk.getMe(token);
        const defaultStartTime = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
        const startTime = req.query.start_time || defaultStartTime;
        const result = await sdk.getJournals(token, user.user.merchant_id, startTime);
        const data = (result.hits || [])
            .filter(item => item?.metadata?.transaction?.payment_type === 'qris')
            .map(item => {
                const aspi = item.metadata?.provider_metadata?.aspi;
                return {
                    id: item.id,
                    reference_id: item.reference_id,
                    status: item.status,
                    time: item.time,
                    amount: aspi?.data?.amount || 0,
                    issuer: aspi?.issuer || null,
                    acquirer: aspi?.acquirer || null,
                    merchant_name: aspi?.data?.merchant_name || null,
                    merchant_id: aspi?.data?.merchant_id || null,
                    merchant_city: aspi?.data?.merchant_city || null,
                    terminal_label: aspi?.data?.additional_data?.terminal_label || null
                };
            });
        res.json({ success: true, total: data.length, data });
    } catch (e) {
        res.status(400).json({ success: false, error: e.response?.data || e.message });
    }
});

// ==================== ROUTE SHOPEEPAY ====================

// ---------- STEP 1: REQUEST OTP ----------
// Query: phone (wajib, format 08xxx / 62xxx / 8xxx), password (opsional), channel (opsional 1|2|3|5)
app.get('/api/shopeepay/get-otp', validateApiKey, async (req, res) => {
    try {
        const { phone, password, channel } = req.query;
        if (!phone) return res.status(400).json({ success: false, error: 'phone wajib diisi' });

        const client = new ShopeePayClient();
        const challenge = await client.requestOtp(phone, {
            password: password || undefined,
            channel: channel !== undefined ? Number(channel) : undefined
        });

        const challengeToken = Buffer.from(JSON.stringify(challenge)).toString('base64');

        res.json({
            success: true,
            message: 'Kode OTP berhasil dikirim',
            phone: challenge.phone,
            channel: challenge.channel,
            available_channels: challenge.availableChannels,
            has_password: challenge.hasPassword,
            expires_at: challenge.expiresAt,
            challenge: challengeToken
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message, code: e.code || null, available: e.available || null });
    }
});

// ---------- STEP 2: VERIFY OTP & AMBIL TOKEN ----------
// Query: challenge (base64 dari get-otp), otp (4-10 digit), merchant_id (opsional)
app.get('/api/shopeepay/verify-otp', validateApiKey, async (req, res) => {
    try {
        const { challenge, otp, merchant_id } = req.query;
        if (!challenge || !otp) {
            return res.status(400).json({ success: false, error: 'challenge dan otp wajib diisi' });
        }

        let challengeObj;
        try {
            challengeObj = JSON.parse(Buffer.from(challenge, 'base64').toString('utf8'));
        } catch (err) {
            return res.status(400).json({ success: false, error: 'challenge tidak valid (bukan base64 JSON)' });
        }

        if (challengeObj.expiresAt && Date.now() > challengeObj.expiresAt) {
            return res.status(400).json({ success: false, error: 'Challenge sudah expired, request OTP ulang' });
        }

        const client = new ShopeePayClient();
        const verification = await client.verifyOtp(challengeObj, otp);

        const merchantId = merchant_id || verification.merchants[0]?.id;
        const session = await client.completeLogin(verification, { merchantId });

        res.json({
            success: true,
            message: 'OTP terverifikasi, login berhasil',
            token: session.token,
            account_id: session.accountId,
            merchant_id: session.merchantId,
            merchant_name: session.merchantName,
            merchants: verification.merchants,
            verified_at: session.verifiedAt
        });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message, code: e.code || null });
    }
});

// ---------- STEP 3: CEK TOKEN ----------
// Query: token (wajib)
app.get('/api/shopeepay/check-token', validateApiKey, async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ success: false, error: 'token wajib diisi' });

        const client = new ShopeePayClient({ shopeeToken: token });
        const result = await client.checkToken();

        res.json({ success: true, ...result });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// ---------- MUTASI SHOPEEPAY ----------
// Query: token (wajib), store_id (opsional), start_time (opsional, unix ts), end_time (opsional, unix ts)
app.get('/api/shopeepay/mutation', validateApiKey, async (req, res) => {
    try {
        const { token, store_id, start_time, end_time } = req.query;
        if (!token) {
            return res.status(400).json({ success: false, error: 'token wajib diisi' });
        }

        const client = new ShopeePayClient({ shopeeToken: token });
        const mutations = await client.getMutations(token, store_id, start_time, end_time);

        res.json({
            success: true,
            total: mutations.length,
            data: mutations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Gagal mengambil mutasi' });
    }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));

module.exports = app;