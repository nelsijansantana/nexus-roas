import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export const MEMBER_ROLES = ['admin', 'analyst', 'viewer'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

export class CreateMemberDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  password: string;

  @IsIn(MEMBER_ROLES, { message: 'Role deve ser admin, analyst ou viewer' })
  role: MemberRole;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(MEMBER_ROLES)
  role?: MemberRole;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
