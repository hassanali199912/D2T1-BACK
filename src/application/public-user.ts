import { User, UserRole } from '../domain/entity/user.entity.js';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
