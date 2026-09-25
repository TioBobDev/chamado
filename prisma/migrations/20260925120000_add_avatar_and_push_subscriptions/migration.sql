-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(1000) NOT NULL,
    `p256dh` TEXT NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `push_subscriptions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
