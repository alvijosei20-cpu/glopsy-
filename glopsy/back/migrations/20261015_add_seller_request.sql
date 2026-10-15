-- Solicitud para ser vendedor (alta con aprobación del admin).
-- sell_status: 'none' | 'pending' | 'approved' | 'rejected'
ALTER TABLE users ADD COLUMN IF NOT EXISTS sell_status varchar(20) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS sell_requested_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sell_reviewed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sell_note text;
