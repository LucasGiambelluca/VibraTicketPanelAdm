-- VibraTickets - Database Initialization Script
-- Ejecutar este script para crear las tablas iniciales
-- Uso: mysql -u root -p ticketera < init.sql

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE,
    phone VARCHAR(20),
    role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    last_login DATETIME,
    last_login_ip VARCHAR(45),
    login_attempts INT DEFAULT 0,
    locked_until DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_dni (dni),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- VENUES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Argentina',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    capacity INT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_city (city),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- EVENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    image_url VARCHAR(500),
    banner_url VARCHAR(500),
    venue_id INT,
    organizer_id INT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    status ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
    category VARCHAR(100),
    tags JSON,
    min_age INT,
    dress_code VARCHAR(100),
    refund_policy TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    total_capacity INT,
    sold_out BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_start_date (start_date),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_featured (is_featured),
    FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SHOWS TABLE (Event Sessions)
-- ==========================================
CREATE TABLE IF NOT EXISTS shows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    name VARCHAR(255),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status ENUM('active', 'cancelled', 'postponed', 'completed') DEFAULT 'active',
    total_capacity INT,
    available_capacity INT,
    is_sold_out BOOLEAN DEFAULT FALSE,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_event_id (event_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SECTIONS TABLE (Show Sections)
-- ==========================================
CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    show_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity INT NOT NULL,
    available_seats INT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ARS',
    color VARCHAR(7) DEFAULT '#000000',
    seating_type ENUM('numbered', 'general', 'standing') DEFAULT 'general',
    metadata JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_show_id (show_id),
    INDEX idx_name (name),
    INDEX idx_active (is_active),
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SEATS TABLE (For numbered seating)
-- ==========================================
CREATE TABLE IF NOT EXISTS seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    section_id INT NOT NULL,
    row_label VARCHAR(10),
    seat_number VARCHAR(20) NOT NULL,
    status ENUM('available', 'occupied', 'reserved', 'disabled', 'hold') DEFAULT 'available',
    hold_expires_at DATETIME,
    hold_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_section_id (section_id),
    INDEX idx_status (status),
    INDEX idx_hold_token (hold_token),
    UNIQUE KEY unique_seat (section_id, row_label, seat_number),
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- HOLDS TABLE (Temporary reservations)
-- ==========================================
CREATE TABLE IF NOT EXISTS holds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    show_id INT NOT NULL,
    section_id INT,
    seat_id INT,
    quantity INT DEFAULT 1,
    status ENUM('active', 'released', 'converted', 'expired') DEFAULT 'active',
    expires_at DATETIME NOT NULL,
    token VARCHAR(255) NOT NULL,
    source_ip VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_token (token),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- ORDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT,
    show_id INT NOT NULL,
    status ENUM('pending', 'hold', 'reserved', 'processing', 'completed', 'cancelled', 'refunded', 'expired') DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    service_charge DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    discount_code VARCHAR(50),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'ARS',
    payment_method VARCHAR(50),
    payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_provider VARCHAR(50),
    payment_provider_id VARCHAR(255),
    payment_data JSON,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_first_name VARCHAR(100),
    buyer_last_name VARCHAR(100),
    buyer_dni VARCHAR(20),
    buyer_phone VARCHAR(20),
    hold_id INT,
    metadata JSON,
    expires_at DATETIME,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_number (order_number),
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_status (status),
    INDEX idx_payment_status (payment_status),
    INDEX idx_buyer_email (buyer_email),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (hold_id) REFERENCES holds(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- ORDER ITEMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    section_id INT NOT NULL,
    seat_id INT,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_section_id (section_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TICKETS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(100) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    user_id INT,
    show_id INT NOT NULL,
    section_id INT NOT NULL,
    seat_id INT,
    status ENUM('active', 'used', 'cancelled', 'refunded', 'expired') DEFAULT 'active',
    price_paid DECIMAL(10, 2) NOT NULL,
    qr_code VARCHAR(500),
    barcode VARCHAR(100),
    metadata JSON,
    used_at DATETIME,
    used_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ticket_number (ticket_number),
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_status (status),
    INDEX idx_qr (qr_code),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- DISCOUNT CODES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type ENUM('percentage', 'fixed_amount') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    max_discount_amount DECIMAL(10, 2),
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0.00,
    max_uses INT,
    max_uses_per_user INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    start_date DATETIME,
    end_date DATETIME,
    applicable_events JSON,
    applicable_sections JSON,
    applicable_users JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_active (is_active),
    INDEX idx_dates (start_date, end_date),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- DISCOUNT CODE USAGE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS discount_code_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discount_code_id INT NOT NULL,
    user_id INT,
    order_id INT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- QUEUE TABLE (Virtual Queue)
-- ==========================================
CREATE TABLE IF NOT EXISTS queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    show_id INT NOT NULL,
    position INT NOT NULL,
    status ENUM('waiting', 'active', 'completed', 'expired') DEFAULT 'waiting',
    token VARCHAR(255) UNIQUE NOT NULL,
    priority INT DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSON,
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_token (token),
    INDEX idx_status (status),
    INDEX idx_position (position),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- AUDIT LOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- BANNERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500),
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    position ENUM('home', 'event', 'checkout') DEFAULT 'home',
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATETIME,
    end_date DATETIME,
    click_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_position (position),
    INDEX idx_active (is_active),
    INDEX idx_priority (priority),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SETTINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) UNIQUE NOT NULL,
    `value` TEXT,
    `group` VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT FALSE,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (`key`),
    INDEX idx_group (`group`),
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- INSERT DEFAULT SETTINGS
-- ==========================================
INSERT INTO settings (`key`, `value`, `group`, is_public, description) VALUES
('site_name', 'VibraTickets', 'general', TRUE, 'Nombre del sitio'),
('site_url', 'http://localhost', 'general', TRUE, 'URL del sitio'),
('maintenance_mode', 'false', 'system', FALSE, 'Modo mantenimiento'),
('queue_enabled', 'true', 'features', TRUE, 'Cola virtual habilitada'),
('hold_minutes', '7', 'features', FALSE, 'Minutos de hold'),
('service_charge_percent', '10', 'pricing', FALSE, 'Porcentaje de cargo por servicio'),
('max_tickets_per_order', '10', 'limits', TRUE, 'Máximo de tickets por orden')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- ==========================================
-- INSERT ADMIN USER (opcional)
-- Descomenta y modifica la contraseña si necesitas un admin inicial
-- ==========================================
-- INSERT INTO users (email, password, first_name, last_name, role, email_verified)
-- VALUES (
--     'admin@vibratickets.com',
--     '$2b$10$YourHashedPasswordHere', -- Genera un hash con bcrypt
--     'Admin',
--     'VibraTickets',
--     'super_admin',
--     TRUE
-- )
-- ON DUPLICATE KEY UPDATE email = email;
