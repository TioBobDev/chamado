-- CreateTable
CREATE TABLE `user_departments` (
    `user_id` VARCHAR(191) NOT NULL,
    `department_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`user_id`, `department_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `user_departments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_departments` ADD CONSTRAINT `user_departments_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
