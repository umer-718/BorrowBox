CREATE DATABASE borrowbox;
USE borrowbox;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(25),
    location VARCHAR(150),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    condition_status ENUM(
        'NEW',
        'LIKE_NEW',
        'GOOD',
        'FAIR'
    ) DEFAULT 'GOOD',
    location VARCHAR(150) NOT NULL,
    daily_price DECIMAL(10,2) DEFAULT 0,
    deposit DECIMAL(10,2) DEFAULT 0,
    image_url VARCHAR(500),
    status ENUM('AVAILABLE','UNAVAILABLE')
        DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE borrow_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    borrower_id INT NOT NULL,
    owner_id INT NOT NULL,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    message TEXT,
    status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'RETURNED'
    ) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (item_id)
        REFERENCES items(item_id),

    FOREIGN KEY (borrower_id)
        REFERENCES users(user_id),

    FOREIGN KEY (owner_id)
        REFERENCES users(user_id),

    CHECK (return_date >= pickup_date),

    INDEX idx_item_dates (item_id, pickup_date, return_date),
    INDEX idx_borrower (borrower_id),
    INDEX idx_owner (owner_id)
);

CREATE TABLE ratings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    reviewee_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (request_id)
        REFERENCES borrow_requests(request_id),

    FOREIGN KEY (reviewer_id)
        REFERENCES users(user_id),

    FOREIGN KEY (reviewee_id)
        REFERENCES users(user_id),

    UNIQUE KEY unique_review (request_id, reviewer_id),

    CHECK (rating BETWEEN 1 AND 5)
);