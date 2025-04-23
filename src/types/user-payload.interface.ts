export interface UserPayload {
  sub: string; // user ID
  username: string;
  iat?: number;
  exp?: number;
}
