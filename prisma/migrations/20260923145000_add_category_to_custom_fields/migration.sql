-- AlterTable
ALTER TABLE `ticket_custom_fields` ADD COLUMN `category_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ticket_custom_fields_category_id_idx` ON `ticket_custom_fields`(`category_id`);

-- AddForeignKey
ALTER TABLE `ticket_custom_fields` ADD CONSTRAINT `ticket_custom_fields_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `ticket_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
