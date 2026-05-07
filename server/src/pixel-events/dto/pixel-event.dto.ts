import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const TRIGGER_TYPES = [
  'click',
  'form_submit',
  'scroll',
  'time_on_page',
  'pageload',
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export class CreatePixelEventDto {
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @IsIn(TRIGGER_TYPES)
  triggerType: TriggerType;

  /** CSS selector for click / form_submit triggers */
  @IsOptional()
  @IsString()
  selector?: string;

  /** Button text match (case-insensitive, partial) for click triggers */
  @IsOptional()
  @IsString()
  buttonText?: string;

  /** 1–100 — scroll depth percentage for scroll triggers */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  scrollDepth?: number;

  /** Seconds to wait for time_on_page triggers */
  @IsOptional()
  @IsInt()
  @Min(1)
  timeSeconds?: number;

  /** Static customData merged into the fired event */
  @IsOptional()
  @IsObject()
  customData?: Record<string, unknown>;
}

export class UpdatePixelEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  eventName?: string;

  @IsOptional()
  @IsIn(TRIGGER_TYPES)
  triggerType?: TriggerType;

  @IsOptional()
  @IsString()
  selector?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  scrollDepth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeSeconds?: number;

  @IsOptional()
  @IsObject()
  customData?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Shape returned to direct-pixel.js in the PageView response */
export interface PixelEventRule {
  id: string;
  eventName: string;
  triggerType: TriggerType;
  selector?: string | null;
  buttonText?: string | null;
  scrollDepth?: number | null;
  timeSeconds?: number | null;
  customData?: Record<string, unknown>;
}
