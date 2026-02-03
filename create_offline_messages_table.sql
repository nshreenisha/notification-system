-- Create table for storing offline messages
CREATE TABLE IF NOT EXISTS `socket_offline_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'notification',
  `message_data` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `socket_offline_messages_user_id_index` (`user_id`),
  KEY `socket_offline_messages_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up expired messages event (MySQL)
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS `cleanup_expired_socket_messages`
-- ON SCHEDULE EVERY 1 HOUR
-- DO
--   DELETE FROM `socket_offline_messages` WHERE `expires_at` < NOW();
