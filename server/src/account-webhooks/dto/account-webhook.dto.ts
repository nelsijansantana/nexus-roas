export class CreateAccountWebhookDto {
  name: string;
  gateway: string;
  projectIds: string[];
}

export class UpdateAccountWebhookDto {
  name?: string;
  gateway?: string;
  projectIds?: string[];
  isActive?: boolean;
}
