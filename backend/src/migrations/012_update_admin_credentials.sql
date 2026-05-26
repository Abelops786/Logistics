-- Migration 012: Update super admin phone and password
UPDATE users
SET phone = '03214018035',
    password_hash = '$2a$10$OBi1Y4LOdwgVQzliiTVj0ePAoVFst3ydj39tyK7kGVtbcREYBTS2y',
    updated_at = NOW()
WHERE role = 'super_admin';
