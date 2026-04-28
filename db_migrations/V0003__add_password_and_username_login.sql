
ALTER TABLE t_p25066548_messenger_real_time_.users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username_login VARCHAR(50) UNIQUE;
