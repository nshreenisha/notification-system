-- Run this SQL in your Laravel database
-- Or create a Laravel migration with this structure

CREATE TABLE IF NOT EXISTS `socket_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `subscription_data` json NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `socket_subscriptions_user_id_unique` (`user_id`),
  KEY `socket_subscriptions_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Test the table
-- INSERT INTO socket_subscriptions (user_id, subscription_data, created_at, updated_at) 
-- VALUES ('test_user', '{"endpoint":"test","keys":{"p256dh":"test","auth":"test"}}', NOW(), NOW());