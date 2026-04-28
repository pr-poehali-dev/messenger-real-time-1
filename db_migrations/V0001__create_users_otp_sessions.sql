
CREATE TABLE IF NOT EXISTS t_p25066548_messenger_real_time_.users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    username VARCHAR(50),
    bio TEXT DEFAULT 'Привет, я использую Messenger!',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p25066548_messenger_real_time_.otp_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p25066548_messenger_real_time_.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p25066548_messenger_real_time_.users(id),
    token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
);
