import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role?: string;
    playerId?: string | null;
    alias?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      role?: string;
      playerId?: string | null;
      alias?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    playerId?: string | null;
    alias?: string | null;
  }
}
