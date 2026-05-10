export interface AuthenticatedUser {
  id: number;
  email: string;
}

export interface JwtPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

export interface RequestWithUser {
  user: AuthenticatedUser;
}
