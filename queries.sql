----------------------------------------------------------------------
--                             HOMEWORK 1                           --
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 1. Premium vs. Standard Product Performance
------------------------------------------------------------------------
SELECT 
    p.is_premium, 
    SUM(t.quantity) AS total_items_sold,
    ROUND(AVG(t.gross_revenue)::numeric, 2) AS avg_gross_revenue
FROM transactions t 
JOIN products p 
    ON t.product_id = p.product_id 
GROUP BY 
    p.is_premium;

----------------------------------------------------------------------
-- 2. Sales Funnel Conversion Rate by Campaign
----------------------------------------------------------------------
SELECT 
    e.campaign_id,
    COUNT(DISTINCT e.customer_id) AS unique_visitors,
    COUNT(DISTINCT t.customer_id) AS unique_buyers,
    ROUND((COUNT(DISTINCT t.customer_id)::numeric / COUNT(DISTINCT e.customer_id)) * 100, 2) AS conversion_rate
FROM events e
LEFT JOIN transactions t 
    ON e.campaign_id = t.campaign_id 
    AND e.customer_id = t.customer_id
WHERE e.campaign_id IS NOT NULL
GROUP BY e.campaign_id
ORDER BY conversion_rate DESC;

----------------------------------------------------------------------
-- 3. Impact of Discounts on Refund Rates
----------------------------------------------------------------------
SELECT 
    CASE 
        WHEN discount_applied > 0 THEN 'Discounted Price'
        ELSE 'Full Price'
    END AS purchase_type,
    COUNT(transaction_id) AS total_transactions,
    COUNT(CASE WHEN refund_flag = TRUE THEN 1 END) AS total_refunds,
    ROUND((COUNT(CASE WHEN refund_flag = TRUE THEN 1 END) * 100.0) / COUNT(transaction_id), 2) AS refund_rate_percentage
FROM transactions
GROUP BY purchase_type;

----------------------------------------------------------------------
-- 4. Campaign Performance: Clicks and Revenue Since 2022
----------------------------------------------------------------------
SELECT 
    c.campaign_id,
    c.channel,
    (SELECT COUNT(e.event_id)
     FROM events e
     WHERE e.campaign_id = c.campaign_id
       AND e.event_type = 'click'
       AND e."timestamp" >= '2022-01-01'
    ) AS total_clicks,
    ROUND((
        SELECT SUM(t.gross_revenue)
        FROM transactions t
        WHERE t.campaign_id = c.campaign_id
          AND t."timestamp" >= '2022-01-01'
    )::numeric, 2) AS total_revenue
FROM campaigns c
WHERE c.channel IS NOT NULL
GROUP BY c.campaign_id, c.channel;

----------------------------------------------------------------------
-- 5. Premium Product Performance Metrics
----------------------------------------------------------------------
SELECT 
    p.product_id,
    p.category,
    (SELECT COUNT(e.event_id) 
     FROM events e 
     WHERE e.product_id = p.product_id 
       AND DATE(e."timestamp") >= '2022-01-01' 
       AND e.event_type = 'view') AS total_views,
    ROUND((SELECT SUM(t.gross_revenue) 
           FROM transactions t 
           WHERE t.product_id = p.product_id 
             AND DATE(t."timestamp") >= '2022-01-01')::numeric, 2) AS total_revenue
FROM products p
WHERE p.is_premium = TRUE;

----------------------------------------------------------------------
-- 6. Refund Rate Analysis by Product Category
----------------------------------------------------------------------
SELECT 
    p.category,
    COUNT(t.transaction_id)                          AS total_transactions,
    SUM(CASE WHEN t.refund_flag THEN 1 ELSE 0 END)   AS refunds,
    ROUND(
        100.0 * SUM(CASE WHEN t.refund_flag THEN 1 ELSE 0 END)
        / COUNT(t.transaction_id), 2
    )                                                AS refund_rate_pct
FROM transactions t
JOIN products p ON t.product_id = p.product_id
GROUP BY p.category
ORDER BY refund_rate_pct DESC;

----------------------------------------------------------------------
-- 7. Unconverted Clicks by Traffic Source
----------------------------------------------------------------------
SELECT
    e.traffic_source,
    COUNT(DISTINCT cu.customer_id) AS customers_clicked_not_bought
FROM customers cu
JOIN events e ON cu.customer_id = e.customer_id
WHERE e.event_type = 'click'
  AND NOT EXISTS (
    SELECT *
    FROM transactions t
    WHERE t.customer_id = cu.customer_id
)
GROUP BY e.traffic_source
ORDER BY customers_clicked_not_bought DESC;

----------------------------------------------------------------------
-- 8. Purchases and Revenue by Traffic Source
----------------------------------------------------------------------
SELECT
    LOWER(e.traffic_source)                         AS traffic_source,
    COUNT(DISTINCT t.transaction_id)                AS total_purchases,
    ROUND(SUM(t.gross_revenue)::NUMERIC, 2)         AS total_revenue,
    ROUND(AVG(t.gross_revenue)::NUMERIC, 2)         AS avg_revenue_per_purchase
FROM events e
JOIN transactions t ON e.customer_id = t.customer_id
WHERE e.event_type = 'purchase'
GROUP BY LOWER(e.traffic_source)
ORDER BY total_revenue DESC;

----------------------------------------------------------------------
-- 9. Conversion Rate and Session Duration Analysis by Device
----------------------------------------------------------------------
SELECT 
    e.device_type,
    COUNT(DISTINCT e.session_id)                      AS total_sessions,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.event_type = 'purchase' THEN e.session_id END)
        / NULLIF(COUNT(DISTINCT e.session_id), 0), 2) AS conversion_rate_pct,
    ROUND(AVG(e.session_duration_sec)::NUMERIC, 2)    AS avg_session_duration,
    ROUND((SELECT AVG(session_duration_sec) FROM events)::NUMERIC, 2) AS global_avg_duration
FROM events e
WHERE e.device_type IS NOT NULL
GROUP BY e.device_type
ORDER BY conversion_rate_pct DESC; 

----------------------------------------------------------------------
-- 10. Impulse Purchase Behavior by Age Group
----------------------------------------------------------------------
SELECT
    CASE 
        WHEN cu.age < 25 THEN 'Under 25'
        WHEN cu.age BETWEEN 25 AND 34 THEN '25-34'
        WHEN cu.age BETWEEN 35 AND 44 THEN '35-44'
        WHEN cu.age BETWEEN 45 AND 54 THEN '45-54'
        ELSE '55+'
    END                                     AS age_group,
    COUNT(DISTINCT t.transaction_id)        AS impulse_purchases,
    ROUND(AVG(t.gross_revenue)::NUMERIC, 2) AS avg_impulse_revenue
FROM customers cu 
JOIN transactions t ON cu.customer_id = t.customer_id
LEFT JOIN events e 
    ON e.customer_id = t.customer_id
    AND e.product_id = t.product_id
    AND e.event_type IN ('view', 'click', 'add_to_cart')
    AND e."timestamp" < t."timestamp"
WHERE e.event_id IS NULL
GROUP BY age_group
ORDER BY impulse_purchases DESC;


----------------------------------------------------------------------
--                             HOMEWORK 2                           --
----------------------------------------------------------------------

----------------------------------------------------------------------
-- Optimization of query number 4 
----------------------------------------------------------------------
SELECT 
    c.campaign_id,
    c.channel,
    COALESCE(e.total_clicks, 0) AS total_clicks,
    ROUND(COALESCE(t.total_revenue, 0)::numeric, 2) AS total_revenue
FROM campaigns c
LEFT JOIN (
    SELECT 
        campaign_id,
        COUNT(event_id) AS total_clicks
    FROM events
    WHERE event_type = 'click'
      AND "timestamp" >= '2022-01-01'
    GROUP BY campaign_id
) e ON c.campaign_id = e.campaign_id
LEFT JOIN (
    SELECT 
        campaign_id,
        SUM(gross_revenue) AS total_revenue
    FROM transactions
    WHERE "timestamp" >= '2022-01-01'
    GROUP BY campaign_id
) t ON c.campaign_id = t.campaign_id
WHERE c.channel IS NOT NULL;

----------------------------------------------------------------------
-- Optimization of query number 5
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_product_time ON events (product_id, "timestamp", event_type);
CREATE INDEX IF NOT EXISTS idx_transactions_product_time ON transactions (product_id, "timestamp");
CREATE INDEX IF NOT EXISTS idx_products_premium ON products (is_premium, product_id);

SELECT 
    p.product_id,
    p.category,
    COALESCE(v.total_views, 0) AS total_views,
    ROUND(COALESCE(s.total_revenue, 0)::numeric, 2) AS total_revenue
FROM products p
LEFT JOIN (
    SELECT 
        product_id, 
        COUNT(event_id) AS total_views
    FROM events
    WHERE "timestamp" >= '2022-01-01 00:00:00' 
      AND event_type = 'view'
    GROUP BY product_id
) v ON p.product_id = v.product_id
LEFT JOIN (
    SELECT 
        product_id,
        SUM(gross_revenue) AS total_revenue
    FROM transactions
    WHERE "timestamp" >= '2022-01-01'
    GROUP BY product_id
) s ON p.product_id = s.product_id
WHERE p.is_premium = TRUE;

----------------------------------------------------------------------
-- Optimization of query number 9
----------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS global_stats AS
SELECT AVG(session_duration_sec) AS global_avg_duration
FROM events;

SELECT 
    e.device_type,
    COUNT(DISTINCT e.session_id) AS total_sessions,
    ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN e.event_type = 'purchase'
                                    THEN e.session_id END)
        / NULLIF(COUNT(DISTINCT e.session_id), 0), 2
    ) AS conversion_rate_pct,
    ROUND(AVG(e.session_duration_sec)::NUMERIC, 2) AS avg_session_duration,
    ROUND(g.global_avg_duration::NUMERIC, 2) AS global_avg_duration
FROM events e, global_stats g
WHERE e.device_type IS NOT NULL
GROUP BY e.device_type, g.global_avg_duration
ORDER BY conversion_rate_pct DESC;

----------------------------------------------------------------------
-- Optimization of query number 10
----------------------------------------------------------------------
SELECT
    CASE 
        WHEN cu.age < 25 THEN 'Under 25'
        WHEN cu.age BETWEEN 25 AND 34 THEN '25-34'
        WHEN cu.age BETWEEN 35 AND 44 THEN '35-44'
        WHEN cu.age BETWEEN 45 AND 54 THEN '45-54'
        ELSE '55+'
    END                                     AS age_group,
    COUNT(DISTINCT t.transaction_id)        AS impulse_purchases,
    ROUND(AVG(t.gross_revenue)::NUMERIC, 2) AS avg_impulse_revenue
FROM customers cu
JOIN transactions t ON cu.customer_id = t.customer_id
WHERE NOT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.customer_id = cu.customer_id
      AND e.product_id  = t.product_id
      AND e.event_type IN ('view', 'click', 'add_to_cart')
      AND e."timestamp" < t."timestamp"
)
GROUP BY age_group
ORDER BY impulse_purchases DESC;
