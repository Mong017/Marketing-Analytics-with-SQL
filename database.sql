-- Group number:40
-- Group members: Giannicola Mongelli 2254343 ;  Emidio Veccia 2255130

----------------------------------------------------------------------
--                          DATABASE'S SCHEMA                             --
----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id INT PRIMARY KEY,
    channel VARCHAR(50) NULL,
    objective VARCHAR(50) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    target_segment VARCHAR(50) NULL,
    expected_uplift FLOAT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY,
    signup_date TIMESTAMP NULL,
    country VARCHAR(50) NULL,
    age INT NULL,
    gender VARCHAR(20) NULL,
    loyalty_tier VARCHAR(20) NULL,
    acquisition_channel VARCHAR(50) NULL
);

CREATE TABLE IF NOT EXISTS products (
    product_id  INT PRIMARY KEY,
    category    VARCHAR(50) NULL,
    brand       VARCHAR(50) NULL,
    base_price  FLOAT NULL,
    launch_date DATE NULL,
    is_premium  BOOLEAN
);

INSERT INTO campaigns (campaign_id, channel, objective, start_date, end_date, target_segment, expected_uplift)
VALUES (0, 'Organic / Direct', 'No Campaign', NULL, NULL, 'All Customers', 0.0);

CREATE TABLE IF NOT EXISTS events (
    event_id INT PRIMARY KEY,
    "timestamp" TIMESTAMP NULL, 
    customer_id INT REFERENCES customers(customer_id) NULL,
    session_id INT NULL,
    event_type VARCHAR(50) NULL,
    product_id INT REFERENCES products(product_id) NULL,    
    device_type VARCHAR(50) NULL,
    traffic_source VARCHAR(50) NULL,
    campaign_id INT REFERENCES campaigns(campaign_id) NULL, 
    page_category VARCHAR(50) NULL,                          
    session_duration_sec FLOAT NULL,
    experiment_group VARCHAR(50) NULL
);

UPDATE events
SET traffic_source = INITCAP(LOWER(traffic_source)) 
WHERE traffic_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INT PRIMARY KEY,
    "timestamp" TIMESTAMP NULL,
    customer_id INT REFERENCES customers(customer_id) NULL,
    product_id INT REFERENCES products(product_id) NULL,    
    quantity INT NULL,
    discount_applied FLOAT NULL,
    gross_revenue FLOAT NULL,
    campaign_id INT REFERENCES campaigns(campaign_id) NULL,  
    refund_flag BOOLEAN NULL
);

SELECT 
    c.loyalty_tier,
    COUNT(e.event_id) AS total_events,
    COUNT(DISTINCT e.customer_id) AS unique_customers
FROM events e
JOIN customers c ON e.customer_id = c.customer_id
WHERE EXTRACT(YEAR FROM e."timestamp") = 2023
  AND LOWER(e.traffic_source) = 'organic'
GROUP BY c.loyalty_tier;
