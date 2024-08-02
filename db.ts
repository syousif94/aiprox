import { BunORM } from 'bunorm';

const db = new BunORM('db.sql3', {
  tables: {
    users: {
      columns: {
        email: {
          type: 'TEXT',
          unique: true,
        },
        subscription: {
          type: 'JSON',
          default: false,
        },
      },
    },
    tokens: {
      columns: {
        token: {
          type: 'TEXT',
          unique: true,
        },
        device: {
          type: 'TEXT',
        },
        location: {
          type: 'TEXT',
        },
        lastUsed: {
          type: 'JSON',
          default: {} as Date,
        },
      },
    },
    loginCodes: {
      columns: {
        code: {
          type: 'TEXT',
        },
        email: {
          type: 'TEXT',
          unique: true,
        },
      },
    },
    requests: {
      columns: {
        email: {
          type: 'TEXT',
        },
        status: {
          type: 'TEXT',
        },
      },
    },
  },
});

function generateLoginCode(email: string) {
  const code = Math.random().toString(36).substring(2, 8);
  db.tables.loginCodes.delete({ email });
  db.tables.loginCodes.create({ code, email });
}

function validateLoginCode(email: string, code: string) {
  const loginCode = db.tables.loginCodes.findBy({ email })[0];
  const createdAt = new Date(loginCode.createdAt);
  const now = new Date();
  const diffInSeconds = Math.abs(now.getTime() - createdAt.getTime()) / 1000;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (loginCode.code === code && diffInMinutes < 5) {
    db.tables.loginCodes.delete({ email });
    return true;
  }
  return false;
}
