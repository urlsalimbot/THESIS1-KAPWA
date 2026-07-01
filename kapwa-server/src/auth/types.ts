import { Request } from 'express';
import { User } from './user.entity';

export interface AuthenticatedRequest extends Request {
  user: User;
}
