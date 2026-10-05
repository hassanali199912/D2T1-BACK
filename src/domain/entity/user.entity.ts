import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  Admin = 'admin',
  Employee = 'employee',
}

@Entity('auth_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;
}
