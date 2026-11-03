import { Request } from 'express';
import { User } from './user.entity.js';

export interface AuthenticatedRequest extends Request {
  user: User;
}
